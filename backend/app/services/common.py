"""시장 공통 상수/포맷터 + 잠금 응답. 통화·디스클레이머를 한 곳에서 관리."""

DISCLAIMER = "본 정보는 투자 참고용이며 투자권유가 아닙니다. 투자 판단과 책임은 본인에게 있습니다."

# 시장별 통화 (CLAUDE.md §5: KR=₩, US=$)
MARKET_CURRENCY = {
    "KR": {"currency": "KRW", "symbol": "₩"},
    "US": {"currency": "USD", "symbol": "$"},
}


def currency_of(market: str) -> dict:
    return MARKET_CURRENCY.get(market, MARKET_CURRENCY["KR"])


def format_amount(market: str, amount: float) -> str:
    """금액 표기 — KR: ₩4,540,000 / US: $4,540.00"""
    sign = "-" if amount < 0 else ""
    abs_v = abs(amount)
    if market == "KR":
        return f"{sign}₩{round(abs_v):,}"
    return f"{sign}${abs_v:,.2f}"


def locked_response(market: str) -> dict:
    """US 등 미지원 시장 — 프론트가 이 status 로 잠금 UI 표시 (CLAUDE.md §7)."""
    cur = currency_of(market)
    return {
        "status": "locked",
        "reason": "현재 키움증권이 개인 투자자용 해외주식 REST API를 제공하지 않아, 미국 주식 자동 연동을 준비 중입니다.",
        "market": market,
        "currency": cur["currency"],
        "currencySymbol": cur["symbol"],
    }
