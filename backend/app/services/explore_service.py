"""탐사(what-if) 서비스 — 가상 비중으로 활성 모드 점수 재계산.

하드룰 (CLAUDE.md §4, §6):
  - 검색: 입력 글자 매칭만. 인기/추천 기준 없음. 이름+코드만 반환.
  - 시뮬 결과: 사실만("이 가정에서는 광맥 C·52"). 매수/매도 조언 없음.
  - 점수 변화는 사실 서술. 높은 점수 = 좋은 투자 아님. 투자권유 아님.
  - disclaimer + note 항상 포함.
"""

from app.data.provider import get_provider
from app.services import common, scoring_service
from app.services.survey_service import get_user_themes

_DISCLAIMER = (
    "가정 시뮬레이션 · 투자권유 아님 · 사용자가 직접 입력한 종목 기준. "
    "이 결과는 가상 가정이며 실제 매수·매도를 권유하지 않습니다."
)
_SIM_NOTE = (
    "높은 점수 = 좋은 투자가 아닙니다. 이 종목을 사라는 게 아닙니다. "
    "점수는 이 가정에서의 펀더멘털 스냅샷이며, 판단은 본인 몫입니다."
)
_TRUST_NOTE = (
    "시뮬 결과는 근사값입니다. "
    "시장신뢰(trust) 지표는 포트폴리오 구성 변화 시 재산정이 필요하나 여기선 생략됩니다."
)


def search_tickers(query: str, market: str) -> dict:
    """종목명·코드 검색. 하드룰: 입력 매칭만, 추천 없음."""
    from app.data.dart_client import search_stocks as dart_search

    results = dart_search(query, limit=12)

    # name_map 없을 때 현재 보유 종목에서 보완
    if not results and market:
        try:
            provider = get_provider()
            if provider.is_market_available(market):
                holdings = provider.get_holdings(market)
                q = query.strip().lower()
                results = [
                    {"ticker": h["ticker"], "name": h["name"]}
                    for h in holdings
                    if q in h["name"].lower() or q in h["ticker"]
                ][:12]
        except Exception:
            pass

    return {
        "status": "ok",
        "query": query,
        "results": results,
        "note": (
            "입력하신 글자와 일치하는 종목만 표시합니다. "
            "추천·인기 기준 없음. 종목 추천이 아닙니다."
        ) if results else (
            "검색 결과가 없습니다. 종목 코드(6자리)로 직접 입력하거나, "
            "DART 데이터 업데이트 후 재시도해 주세요."
        ),
    }


def simulate(
    market: str,
    ticker: str,
    name: str,
    target_weight: float,
) -> dict:
    """가상 비중으로 활성 모드(기본/테마) 점수 재계산.

    target_weight: 재조정 후 포트폴리오 내 비중 % (0=해당 종목 제외).
    케이스A: 기존 보유 종목 비중 변경 → 추가 API 호출 없음 (fast).
    케이스B: 신규 종목 추가 → DART + ka10059 1회 호출 (5~15초).
    """
    provider = get_provider()
    if not provider.is_market_available(market):
        return common.locked_response(market)

    user_themes = get_user_themes(market)
    mode = "theme" if user_themes else "basic"
    active_themes = user_themes or []

    # 1. 현재 breakdown (기존 종목 fund·weight 확보)
    breakdown = scoring_service.survey_breakdown(
        market, provider, mode=mode, themes=active_themes or None
    )
    current_score = breakdown["score"]
    contributions = breakdown["contributions"]

    if not contributions:
        return {
            "status": "error",
            "msg": "현재 보유 종목이 없어 시뮬레이션을 실행할 수 없습니다.",
            "disclaimer": _DISCLAIMER,
        }

    tw = max(0.0, min(1.0, target_weight / 100.0))

    # fund·weight·align 맵
    fund_map: dict[str, float] = {c["ticker"]: (c["fund"] or 0.0) for c in contributions}
    weight_map: dict[str, float] = {c["ticker"]: c["weight"] / 100.0 for c in contributions}
    align_map: dict[str, float] = {
        c["ticker"]: (1.0 if c.get("matched") else 0.0) if mode == "theme" else 1.0
        for c in contributions
    }

    is_existing = ticker in fund_map
    new_fund_raw: float | None = None

    # ── 케이스 A: 기존 종목 비중 변경 ────────────────────────────────────────
    if is_existing:
        old_w = weight_map[ticker]
        remaining = 1.0 - old_w
        if remaining <= 1e-9:
            # 단일 보유 종목 → 해당 종목만
            new_weights = {ticker: tw}
        else:
            new_weights = {}
            for t, w in weight_map.items():
                if t == ticker:
                    new_weights[t] = tw
                else:
                    new_weights[t] = w * (1.0 - tw) / remaining
        new_fund = fund_map[ticker]
        case = "A"
        new_ticker_name = next(
            (c["name"] for c in contributions if c["ticker"] == ticker), name
        )

    # ── 케이스 B: 신규 종목 추가 ────────────────────────────────────────────
    else:
        # DART + 수급 1회 호출
        new_fund_raw = scoring_service.compute_ticker_fund_score(ticker, market, provider)
        new_fund = new_fund_raw if new_fund_raw is not None else 0.0

        # 테마 모드: 신규 종목 정렬 여부 (basket+keyword만, KSIC 생략 → 근사)
        if mode == "theme" and active_themes:
            new_align = _quick_theme_match(ticker, name, active_themes)
        else:
            new_align = 1.0

        # 신규 비중 추가용 가중치 맵
        new_weights = {t: w * (1.0 - tw) for t, w in weight_map.items()}
        new_weights[ticker] = tw
        fund_map[ticker] = new_fund
        align_map[ticker] = new_align
        case = "B"
        new_ticker_name = name

    # 점수 재계산
    sim_score = _recompute_score(new_weights, fund_map, align_map, mode)
    sim_score_int = round(max(0, min(100, sim_score)))
    delta = sim_score_int - current_score

    def _label(sc: int) -> str:
        g = scoring_service.grade_of(sc)
        prefix = "AI테마" if mode == "theme" else ("US 광맥" if market == "US" else "광맥")
        return f"{prefix} {g} · {sc}"

    # 변화 서술 — 사실만, 방향 중립 (좋다/나쁘다 금지)
    if delta > 0:
        change_desc = f"이 가정에서는 점수가 {delta}점 높아집니다."
    elif delta < 0:
        change_desc = f"이 가정에서는 점수가 {abs(delta)}점 달라집니다."
    else:
        change_desc = "이 가정에서는 점수 변화가 없습니다."

    return {
        "status": "ok",
        "market": market,
        "mode": mode,
        "case": case,
        "current": {
            "score": current_score,
            "grade": scoring_service.grade_of(current_score),
            "label": _label(current_score),
        },
        "simulated": {
            "score": sim_score_int,
            "grade": scoring_service.grade_of(sim_score_int),
            "label": _label(sim_score_int),
        },
        "delta": delta,
        "changeDesc": change_desc,
        "stock": {
            "ticker": ticker,
            "name": new_ticker_name,
            "isNew": not is_existing,
            "fundScore": round(new_fund, 1) if case == "B" else None,
            "dataAvailable": new_fund_raw is not None if case == "B" else True,
        },
        "targetWeight": target_weight,
        "trustNote": _TRUST_NOTE if case == "A" else None,
        "note": _SIM_NOTE,
        "disclaimer": _DISCLAIMER,
    }


def _recompute_score(
    new_weights: dict[str, float],
    fund_map: dict[str, float],
    align_map: dict[str, float],
    mode: str,
) -> float:
    """새 비중·fund·align으로 점수 재계산."""
    total = 0.0
    for t, w in new_weights.items():
        fund = fund_map.get(t, 0.0)
        align = align_map.get(t, 1.0) if mode == "theme" else 1.0
        total += w * align * fund
    return total


def _quick_theme_match(ticker: str, name: str, active_themes: list[dict]) -> float:
    """신규 종목 테마 매칭 (basket+keyword만, KSIC 생략). 1.0 or 0.0."""
    for theme in active_themes:
        if ticker in (theme.get("codes") or []):
            return 1.0
        for kw in (theme.get("keywords") or []):
            if kw in name:
                return 1.0
    return 0.0
