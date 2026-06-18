"""측량소 점수 체계 v2 — 기본/테마 2모드 (CLAUDE.md §6).

기본 모드 산식:
  fundᵢ = 0.5·healthᵢ + 0.3·supplyᵢ + 0.2·trustᵢ  (N/A 재정규화)
  trustᵢ = 0.6·pct(log_mac) + 0.4·pct(log_vol)     (포트 내 백분위 0-100)
  S = Σ wᵢ·fundᵢ,  cᵢ = wᵢ·fundᵢ,  Σcᵢ = S  (정확 분해 보장)

테마 모드 산식:
  sᵢ = alignᵢ · fundᵢ   (정렬=1|0, 미정렬=0 기여)
  S = Σ wᵢ·sᵢ
  정렬도(%) = Σ wᵢ·alignᵢ  (평가금액 기준 비중)

하드룰 (CLAUDE.md §4, §6):
  - 매수/매도 조언 생성 금지.
  - 투자권유 아님. disclaimer 항상 포함.
  - 점수 낮음 ≠ 나쁜 포트. "사실 스냅샷" 문구 고정.
  - 테마 모드: 종목 추천 절대 금지. 사용자가 고른 렌즈로 비추는 것.
  - XP·티어와 무관. 성장 실효비중 15% 상한 준수 (health×0.3 = 전체×0.15).
  - PER/PBR/ROE 기본 모드 미사용 (스타일 중립).
"""
import json
import logging
import math
from datetime import datetime
from pathlib import Path

from app.data.provider import DataProvider

logger = logging.getLogger(__name__)

_THEMES_PATH = Path(__file__).parents[2] / "themes.json"

_BASIC_LENS = (
    "객관 펀더멘털 렌즈 — 재무건전성·수급·시장신뢰의 사실 스냅샷입니다. "
    "우열 평가가 아니며, 점수 낮음 ≠ 나쁜 포트폴리오입니다. 투자권유 아님."
)

# 기본 모드 fund 가중치 (합 = 100)
_FUND_WEIGHTS = {"health": 50.0, "supply": 30.0, "trust": 20.0}


# ── 등급·공용 ─────────────────────────────────────────────────────────────────

def grade_of(score: int) -> str:
    if score >= 89: return "S"
    if score >= 76: return "A"
    if score >= 61: return "B"
    if score >= 41: return "C"
    if score >= 21: return "D"
    return "F"


def disposition(market: str) -> str:
    return "공격형"  # Phase 4 실산식 예정


def tier(market: str) -> dict:
    return {"name": "마스터", "division": 4, "emblem": "master"}


def vein_score(market: str, mode: str = "basic", themes: list[str] | None = None) -> int:
    """HUD 등 외부에서 단순 점수만 필요할 때. 활성 모드(기본/테마) 반영."""
    from app.data.provider import get_provider
    provider = get_provider()
    if not provider.is_market_available(market):
        return 0
    return survey_breakdown(market, provider, mode=mode, themes=themes).get("score", 0)


def _as_of() -> dict:
    from app.config import settings
    today = datetime.now().strftime("%Y-%m-%d")
    fin = today if settings.dart_api_key else "N/A (DART 키 필요)"
    return {"financial": fin, "supply": today, "market": today}


def _flags(health: float | None, supply: float | None, trust: float | None) -> list[str]:
    flags = []
    if health is None:
        flags.append("health_na")
    if supply is None:
        flags.append("supply_na")
    if trust is None:
        flags.append("trust_na")
    return flags


# ── trust 백분위 ─────────────────────────────────────────────────────────────

def _log_pct_map(log_vals: dict[str, float]) -> dict[str, float]:
    """로그 값 딕셔너리 → 포트 내 백분위(0~100) 딕셔너리."""
    if not log_vals:
        return {}
    sorted_keys = sorted(log_vals, key=lambda k: log_vals[k])
    n = len(sorted_keys)
    return {
        k: (rank / (n - 1) * 100.0 if n > 1 else 50.0)
        for rank, k in enumerate(sorted_keys)
    }


def _compute_trust_scores(
    fundamentals: dict[str, dict], tickers: list[str]
) -> dict[str, float | None]:
    """ka10001 mac/trde_qty → trust 점수(0~100). 데이터 없으면 None.

    trust_i = 0.6·pct(log_mac) + 0.4·pct(log_vol)  (포트폴리오 내 상대 위치)
    대형주가 자동 만점이 아니라 포트 구성 내 상대적 위치를 본다.
    """
    log_macs: dict[str, float] = {}
    log_vols: dict[str, float] = {}
    for t in tickers:
        fd = fundamentals.get(t, {})
        mac = fd.get("mac", 0)
        vol = fd.get("trde_qty", 0)
        if mac > 0:
            log_macs[t] = math.log(mac)
        if vol > 0:
            log_vols[t] = math.log(vol)

    mac_pct = _log_pct_map(log_macs)
    vol_pct = _log_pct_map(log_vols)

    result: dict[str, float | None] = {}
    for t in tickers:
        m = mac_pct.get(t)
        v = vol_pct.get(t)
        if m is not None and v is not None:
            result[t] = 0.6 * m + 0.4 * v
        elif m is not None:
            result[t] = m
        elif v is not None:
            result[t] = v
        else:
            result[t] = None
    return result


# ── fund 계산 ─────────────────────────────────────────────────────────────────

def _calc_fund(
    health: float | None, supply: float | None, trust: float | None
) -> float | None:
    """fundᵢ = 0.5·health + 0.3·supply + 0.2·trust (N/A 재정규화)."""
    vals = {"health": health, "supply": supply, "trust": trust}
    avail = {k: v for k, v in vals.items() if v is not None}
    if not avail:
        return None
    total_w = sum(_FUND_WEIGHTS[k] for k in avail)
    return sum(_FUND_WEIGHTS[k] / total_w * avail[k] for k in avail)


# ── 테마 데이터 로드 ──────────────────────────────────────────────────────────

def load_themes() -> list[dict]:
    """themes.json → 전체 테마 객체 목록 [{id,label,keywords,codes,names_ref,note}, ...].

    자유입력 해석·바스켓/키워드 매칭의 단일 진실 소스.
    """
    try:
        with open(_THEMES_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("themes", [])
    except Exception:
        logger.exception("themes.json 로드 실패")
        return []


# ── 테마 매칭 엔진 (3단 폴백: basket > KSIC > keyword) ───────────────────────

def _match_ticker(
    ticker: str,
    name: str,
    active_themes: list[dict],
) -> tuple[bool, str, list[str]]:
    """ticker가 활성 테마(자급식 객체)에 속하는지 3단 폴백 매칭.

    active_themes: 각 항목 {label, keywords[], codes[]} (DB에 저장된 자급식 객체).
    반환: (matched, matchSource, matched_label_list)
    matchSource: "basket" | "keyword" | ""  (B: DART KSIC는 v2 예정)
    """
    matched_labels: list[str] = []
    first_source = ""

    for theme in active_themes:
        label = theme.get("label", "")
        codes = theme.get("codes", []) or []
        keywords = theme.get("keywords", []) or []
        # A: 큐레이션 바스켓 (신뢰도 높음 — 에스피지=로봇 같은 케이스 커버)
        if ticker in codes:
            matched_labels.append(label)
            if not first_source:
                first_source = "basket"
        elif any(kw in name for kw in keywords):
            # C: 종목명 키워드 매칭 (B: DART induty_code는 v2 예정)
            matched_labels.append(label)
            if not first_source:
                first_source = "keyword"

    return bool(matched_labels), first_source, matched_labels


# ── components 빌더 ───────────────────────────────────────────────────────────

def _portfolio_axis_avg(contributions: list[dict], axis: str) -> int | None:
    """포트폴리오 가중 평균 (평가금액 비중). None 종목 제외 후 재정규화."""
    total_w = 0.0
    total_v = 0.0
    for c in contributions:
        sub_val = c["sub"].get(axis)
        if sub_val is None:
            continue
        w = c["weight"] / 100.0
        total_w += w
        total_v += w * sub_val
    if total_w == 0:
        return None
    return round(total_v / total_w)


def _build_components_basic(contributions: list[dict]) -> list[dict]:
    from app.config import settings
    fin_note = "DART 영업이익률·부채비율·매출성장"
    if not settings.dart_api_key:
        fin_note += " (DART 키 미등록 → N/A)"
    return [
        {
            "key": "재무건전성",
            "weight": 50,
            "score": _portfolio_axis_avg(contributions, "health"),
            "note": fin_note,
        },
        {
            "key": "수급",
            "weight": 30,
            "score": _portfolio_axis_avg(contributions, "supply"),
            "note": "최근 20일 외인·기관 순매수(지연 가능)",
        },
        {
            "key": "시장신뢰",
            "weight": 20,
            "score": _portfolio_axis_avg(contributions, "trust"),
            "note": "시총·거래대금 포트 내 분포 위치(로그 백분위)",
        },
    ]


def _build_components_theme(
    contributions: list[dict], selected_labels: list[str]
) -> list[dict]:
    matched = [c for c in contributions if c.get("matched")]
    alignment_pct = round(sum(c["weight"] for c in matched), 1)
    matched_with_fund = [c for c in matched if c.get("fund") is not None]
    avg_quality = (
        round(sum(c["fund"] for c in matched_with_fund) / len(matched_with_fund), 1)
        if matched_with_fund
        else None
    )
    return [
        {
            "key": "정렬도",
            "weight": None,
            "score": alignment_pct,
            "note": f"평가금액 중 '{'+'.join(selected_labels)}' 테마 비중(%)",
        },
        {
            "key": "정렬 종목 품질",
            "weight": None,
            "score": avg_quality,
            "note": "정렬 종목 평균 펀더멘털(fund) — 비중 부족 vs 종목 품질 구분용",
        },
    ]


# ── 공개 인터페이스 ──────────────────────────────────────────────────────────

def survey_breakdown(
    market: str,
    provider: DataProvider,
    mode: str = "basic",
    themes: list[dict] | None = None,
) -> dict:
    """측량소 핵심: 2모드 점수 분해 + 종목 기여도.

    mode="basic"  → 펀더멘털 스냅샷 (health+supply+trust)
    mode="theme"  → 사용자 테마 정렬도 × 펀더멘털
    themes: 자급식 테마 객체 목록 [{label, keywords[], codes[]}, ...] (DB 저장 포맷).
    provider 를 인수로 받아 테스트 가능성 확보.
    """
    holdings = provider.get_holdings(market)
    if not holdings:
        return _empty_response(mode, themes)

    total_eval = sum(float(h["qty"]) * float(h["current_price"]) for h in holdings)
    if total_eval <= 0:
        return _empty_response(mode, themes)

    tickers = [h["ticker"] for h in holdings]

    # 데이터 수집 (3 소스 병렬은 v2 — v1은 순차)
    from app.data.dart_client import get_financial_scores
    health_map = get_financial_scores(tickers)                        # DART health
    supply_raw = provider.get_supply_scores(tickers, market, days=20)
    supply_map: dict[str, float | None] = {t: supply_raw.get(t) for t in tickers}
    fundamentals = provider.get_fundamentals(tickers, market)         # ka10001
    trust_map = _compute_trust_scores(fundamentals, tickers)

    # 기본 fund (두 모드 공통으로 계산)
    fund_map: dict[str, float | None] = {
        t: _calc_fund(health_map.get(t), supply_map.get(t), trust_map.get(t))
        for t in tickers
    }

    # 활성 테마 (theme 모드만) — 자급식 객체 {label, keywords, codes}
    active_themes = themes or []
    active_labels = [t.get("label", "") for t in active_themes]

    contributions: list[dict] = []
    total_score = 0.0

    for h in holdings:
        ticker = h["ticker"]
        name = h["name"]
        eval_amt = float(h["qty"]) * float(h["current_price"])
        w = eval_amt / total_eval

        health = health_map.get(ticker)
        supply = supply_map.get(ticker)
        trust = trust_map.get(ticker)
        fund = fund_map.get(ticker)

        if mode == "theme" and active_themes:
            matched, match_src, matched_themes = _match_ticker(
                ticker, name, active_themes
            )
            align = 1.0 if matched else 0.0
            stock_score = align * (fund or 0.0)
        else:
            matched = None
            match_src = None
            matched_themes = []
            stock_score = fund or 0.0

        contribution = w * stock_score
        total_score += contribution

        c: dict = {
            "ticker": ticker,
            "name": name,
            "weight": round(w * 100, 1),
            "contribution": round(contribution, 2),
            "fund": round(fund, 1) if fund is not None else None,
            "sub": {
                "health": round(health, 1) if health is not None else None,
                "supply": round(supply, 1) if supply is not None else None,
                "trust": round(trust, 1) if trust is not None else None,
            },
            "flags": _flags(health, supply, trust),
        }
        if mode == "theme":
            c["matched"] = matched
            c["matchSource"] = match_src or ""
            c["themes"] = matched_themes

        contributions.append(c)

    # 기여도 내림차순 정렬 (Σcᵢ = S 정확 분해 계승)
    contributions.sort(key=lambda x: x["contribution"], reverse=True)
    score = round(total_score)

    result: dict = {
        "mode": mode,
        "score": score,
        "grade": grade_of(score),
        "asOf": _as_of(),
        "contributions": contributions,
    }

    if mode == "basic":
        result["lens"] = _BASIC_LENS
        result["components"] = _build_components_basic(contributions)
    else:
        theme_label = "·".join(active_labels)
        result["lens"] = (
            f"'{theme_label}' 테마 렌즈 — 사용자가 설정한 방향성에 포트가 얼마나 "
            "정렬됐는지 보여줍니다. 종목 추천 아님. "
            "점수 낮음 = 이 렌즈 기준 미정렬이며 결함이 아닙니다. 투자권유 아님."
        )
        result["components"] = _build_components_theme(contributions, active_labels)
        alignment_pct = sum(c["weight"] for c in contributions if c.get("matched"))
        matched_with_fund = [
            c for c in contributions if c.get("matched") and c.get("fund") is not None
        ]
        result["theme"] = {
            "selected": active_labels,
            "alignment": round(alignment_pct, 1),
            "matchedQuality": (
                round(
                    sum(c["fund"] for c in matched_with_fund) / len(matched_with_fund), 1
                )
                if matched_with_fund
                else None
            ),
        }

    return result


def _empty_response(mode: str, themes: list[dict] | None) -> dict:
    if mode == "theme" and themes:
        labels = [t.get("label", "") for t in themes]
        lens = (
            f"'{'+'.join(labels)}' 테마 렌즈. 종목 추천 아님. 투자권유 아님."
        )
    else:
        lens = _BASIC_LENS
    return {
        "mode": mode,
        "score": 0,
        "grade": "D",
        "lens": lens,
        "asOf": _as_of(),
        "components": [],
        "contributions": [],
        "themeNarrative": "보유 종목이 없습니다.",
    }
