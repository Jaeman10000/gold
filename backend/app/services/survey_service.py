"""측량소 — 2모드 점수 분해 서비스 (CLAUDE.md §7). disclaimer 필수.

모드 결정:
  DB user_themes 에 선택 테마 있음 → theme 모드 (미래정합성)
  없음 → basic 모드 (펀더멘털 스냅샷, 디폴트)
"""
import json

from app.data.provider import get_provider
from app.services import common, scoring_service


# ── 테마 해석 (resolve) — 라벨/객체 → 자급식 객체 ───────────────────────────────

def _resolve_theme_item(item, by_label: dict[str, dict]) -> dict | None:
    """입력 항목(프리셋 라벨 문자열 또는 객체)을 자급식 테마 객체로 정규화.

    프리셋 라벨이면 themes.json 의 keywords/codes 로 보강한다.
    프리셋에 없는 라벨(커스텀)이면 전달된 keywords/codes 를 그대로 쓴다.
    """
    if isinstance(item, str):
        preset = by_label.get(item)
        if not preset:
            return None
        return {
            "label": preset["label"],
            "keywords": preset.get("keywords", []),
            "codes": preset.get("codes", []),
            "type": "preset",
        }
    if isinstance(item, dict) and item.get("label"):
        preset = by_label.get(item["label"])
        if preset:  # 라벨이 프리셋과 일치 → 신뢰할 수 있는 프리셋 데이터로 덮어씀
            return {
                "label": preset["label"],
                "keywords": preset.get("keywords", []),
                "codes": preset.get("codes", []),
                "type": "preset",
            }
        return {  # 커스텀 (자유입력에서 만든 렌즈)
            "label": item["label"],
            "keywords": item.get("keywords", []),
            "codes": item.get("codes", []),
            "type": "custom",
        }
    return None


def resolve_themes(items: list) -> list[dict]:
    """프리셋 라벨/객체 혼합 목록 → 자급식 테마 객체 목록."""
    by_label = {t["label"]: t for t in scoring_service.load_themes()}
    out: list[dict] = []
    for it in items:
        r = _resolve_theme_item(it, by_label)
        if r:
            out.append(r)
    return out


def interpret_text(text: str) -> dict:
    """자유입력 텍스트 → 키워드 사전 스캔으로 프리셋 테마 감지 (결정론적, LLM 없음).

    저장하지 않고 '이렇게 이해했어요' 확인용 결과만 반환한다.
    matchSource 투명성: 어떤 키워드가 걸렸는지 그대로 노출한다.
    """
    text_l = (text or "").lower()
    detected: list[dict] = []
    for t in scoring_service.load_themes():
        hits = [kw for kw in t.get("keywords", []) if kw.lower() in text_l]
        if hits:
            detected.append({
                "id": t["id"],
                "label": t["label"],
                "matchedKeywords": hits,
                "keywords": t.get("keywords", []),
                "codes": t.get("codes", []),
            })
    # 매칭 키워드가 많은 테마를 위로
    detected.sort(key=lambda d: len(d["matchedKeywords"]), reverse=True)
    return {
        "status": "ok",
        "input": text,
        "detected": detected,
        "note": (
            "입력에서 감지한 방향입니다. 종목 추천이 아니라, 내 포트가 이 방향에 "
            "얼마나 정렬됐는지 비추는 렌즈입니다. 맞으면 적용, 아니면 칩에서 직접 고르세요."
        ),
    }


# ── DB 테마 설정 관리 ─────────────────────────────────────────────────────────

def get_user_themes(market: str) -> list[dict]:
    """user_themes 테이블에서 사용자 선택 테마(자급식 객체) 로드. 없으면 [].

    저장 포맷: [{label, keywords[], codes[], type}, ...].
    """
    from app.db import SessionLocal
    from app.models import UserTheme
    with SessionLocal() as db:
        row = db.query(UserTheme).filter(UserTheme.market == market).first()
        if row and row.themes_json:
            try:
                stored = json.loads(row.themes_json)
            except Exception:
                return []
            # 구버전(라벨 문자열 배열) 호환: 자급식 객체로 재해석
            return resolve_themes(stored)
    return []


def set_user_themes(market: str, themes: list) -> None:
    """사용자 테마 저장 (upsert). 라벨/객체 혼합 입력을 자급식 객체로 정규화해 저장.

    themes=[] 이면 delete_user_themes 를 쓸 것.
    """
    from app.db import SessionLocal
    from app.models import UserTheme
    resolved = resolve_themes(themes)
    payload = json.dumps(resolved, ensure_ascii=False)
    with SessionLocal() as db:
        row = db.query(UserTheme).filter(UserTheme.market == market).first()
        if row:
            row.themes_json = payload
        else:
            db.add(UserTheme(market=market, themes_json=payload))
        db.commit()


def delete_user_themes(market: str) -> None:
    """테마 삭제 → 기본 모드(펀더멘털 스냅샷) 복귀."""
    from app.db import SessionLocal
    from app.models import UserTheme
    with SessionLocal() as db:
        db.query(UserTheme).filter(UserTheme.market == market).delete()
        db.commit()


# ── 계좌 구성 (사실 정보 — 점수와 무관) ─────────────────────────────────────────

# 집중도 "사실" 팩트 태그 기준 (단일 종목 비중). "분산하세요" 권유 아님 — 사실 표기만.
_CONCENTRATION_THRESHOLD = 40.0


def _build_account(market: str, provider) -> dict | None:
    """계좌 구성 정보 — 총매수·예수금·현금비중·종목별 비중(총자산 기준).

    ★ 점수에 일절 반영하지 않는다(현금 많아도 감점 0 — 보수적 투자는 스타일).
    비중 기준 = 총자산(주식 평가총액 + 예수금) → 현금비중 + 종목비중 합 = 100%.
    """
    summary = provider.get_account_summary(market)
    if not summary:
        return None

    holdings = provider.get_holdings(market)
    cash = summary.get("cash", 0)
    total_eval = summary.get("totalEval", 0) or sum(
        float(h["qty"]) * float(h["current_price"]) for h in holdings
    )
    total_assets = total_eval + cash

    positions = []
    for h in holdings:
        eval_amt = float(h["qty"]) * float(h["current_price"])
        w = (eval_amt / total_assets * 100) if total_assets > 0 else 0.0
        # 집중도 판정은 주식평가총액 기준 — 예수금이 많아도 종목 자체 비중으로 사실 표기
        w_stock = (eval_amt / total_eval * 100) if total_eval > 0 else 0.0
        positions.append({
            "ticker": h["ticker"],
            "name": h["name"],
            "qty": int(h["qty"]),
            "evalAmount": round(eval_amt),
            "weight": round(w, 1),
            "concentrated": w_stock >= _CONCENTRATION_THRESHOLD,
        })
    positions.sort(key=lambda p: p["evalAmount"], reverse=True)

    cash_weight = (cash / total_assets * 100) if total_assets > 0 else 0.0

    return {
        "totalPurchase": summary.get("totalPurchase", 0),
        "totalEval": round(total_eval),
        "cash": cash,
        "cashProvisional": summary.get("cashProvisional", True),
        "totalAssets": round(total_assets),
        "cashWeight": round(cash_weight, 1),
        "concentrationThreshold": _CONCENTRATION_THRESHOLD,
        "positions": positions,
        "note": (
            "사실 정보입니다. 현금 비중은 점수에 반영되지 않으며, "
            "보수적 구성도 하나의 투자 스타일입니다(우열 아님). "
            "예수금은 잠정값으로 키움 앱 표시값과 다를 수 있습니다."
        ),
    }


# ── 성향 판정 (사실 기반 — 점수·XP와 무관, 스타일 중립) ────────────────────────

def _build_disposition(market: str, provider, account: dict | None) -> dict:
    """성향 판정 + 중립 설명. 하드룰: 우열 금지. 점수와 무관."""
    holdings = provider.get_holdings(market)
    return scoring_service.build_disposition_info(holdings, account)


# ── 측량소 빌드 ──────────────────────────────────────────────────────────────

def build_survey(market: str) -> dict:
    provider = get_provider()
    if not provider.is_market_available(market):
        return common.locked_response(market)

    cur = common.currency_of(market)
    user_themes = get_user_themes(market)
    mode = "theme" if user_themes else "basic"

    breakdown = scoring_service.survey_breakdown(
        market, provider, mode=mode, themes=user_themes or None
    )

    account = _build_account(market, provider)
    return {
        "status": "ok",
        "market": market,
        "currency": cur["currency"],
        "currencySymbol": cur["symbol"],
        **breakdown,
        "account": account,
        "disposition": _build_disposition(market, provider, account),
        "disclaimer": common.DISCLAIMER,
    }
