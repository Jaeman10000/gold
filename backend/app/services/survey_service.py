"""측량소 — 미래정합성 점수 분해 (CLAUDE.md §7). disclaimer 필수."""
from app.data.provider import get_provider
from app.services import common, scoring_service


def build_survey(market: str) -> dict:
    provider = get_provider()
    if not provider.is_market_available(market):
        return common.locked_response(market)

    cur = common.currency_of(market)
    breakdown = scoring_service.survey_breakdown(market)

    return {
        "status": "ok",
        "market": market,
        "currency": cur["currency"],
        "currencySymbol": cur["symbol"],
        **breakdown,
        "disclaimer": common.DISCLAIMER,  # CLAUDE.md §4: 모든 분석에 "투자권유 아님"
    }
