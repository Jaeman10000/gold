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

    return {
        "status": "ok",
        "market": market,
        "currency": cur["currency"],
        "currencySymbol": cur["symbol"],
        **breakdown,
        "disclaimer": common.DISCLAIMER,
    }
