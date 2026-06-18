"""수익률·평단 계산 — 한 곳에 집중 (CLAUDE.md §8-2: 키움 표시값과 일치해야).

평단(avg_price)은 가중평균 가정. 평가손익/수익률 산식:
  종목 평가금액 = current_price * qty
  종목 원가     = avg_price * qty
  종목 수익률   = (current_price - avg_price) / avg_price * 100
  전체 수익률   = (총평가 - 총원가) / 총원가 * 100   (원 액수 합산 기반)
"""
from app.data.provider import get_provider
from app.db import SessionLocal
from app.models import Dividend
from app.services import common, scoring_service


def _pending_dividend(market: str) -> float:
    """DB에 저장된 미수확 배당 합계 (수확 기능 구현 전까지는 전체 합산)."""
    db = SessionLocal()
    try:
        rows = db.query(Dividend).filter_by(market=market).all()
        return sum(r.amount for r in rows)
    finally:
        db.close()


def _compute_holdings(raw: list[dict]) -> list[dict]:
    out = []
    for h in raw:
        eval_amount = h["current_price"] * h["qty"]
        cost_amount = h["avg_price"] * h["qty"]
        return_rate = ((h["current_price"] - h["avg_price"]) / h["avg_price"] * 100) if h["avg_price"] else 0.0
        out.append({
            "ticker": h["ticker"],
            "name": h["name"],
            "qty": h["qty"],
            "evalAmount": round(eval_amount),
            "returnRate": round(return_rate, 1),
            "profit": round(eval_amount - cost_amount),
        })
    return out


def build_portfolio(market: str, pending_override: int | None = None) -> dict:
    provider = get_provider()
    if not provider.is_market_available(market):
        return common.locked_response(market)

    cur = common.currency_of(market)
    holdings = _compute_holdings(provider.get_holdings(market))

    # 미수확 배당 합계 = pendingDividend. 0 → idle, >0 → claimable.
    # pending_override 는 상태기계 테스트용(쿼리).
    if pending_override is not None:
        pending_dividend = max(0, pending_override)
    else:
        pending_dividend = round(_pending_dividend(market))

    total_eval = sum(h["evalAmount"] for h in holdings)
    total_profit = sum(h["profit"] for h in holdings)
    total_cost = total_eval - total_profit
    total_return = round(total_profit / total_cost * 100, 1) if total_cost else 0.0

    # 평가금액 내림차순 정렬 → 홈 미리보기 상위 3
    holdings.sort(key=lambda h: h["evalAmount"], reverse=True)

    # 활성 모드(기본/테마)에 맞는 광맥 등급·레이블
    from app.services.survey_service import get_user_themes
    user_themes = get_user_themes(market)
    is_theme = bool(user_themes)
    score = scoring_service.vein_score(
        market,
        mode="theme" if is_theme else "basic",
        themes=user_themes or None,
    )
    if is_theme:
        vein_label = f"AI테마 {scoring_service.grade_of(score)}"
    else:
        vein_label = f"{'US 광맥' if market == 'US' else '광맥'} {scoring_service.grade_of(score)}"

    return {
        "status": "ok",
        "market": market,
        "currency": cur["currency"],
        "currencySymbol": cur["symbol"],
        "veinGrade": {
            "label": vein_label,
            "score": score,
        },
        "disposition": scoring_service.disposition(market),  # 글씨 표시 (색 아님)
        "tier": scoring_service.tier(market),
        "goldAmount": total_eval,
        "goldAmountDisplay": common.format_amount(market, total_eval),
        "returnRate": total_return,
        "evalProfit": total_profit,
        "evalProfitDisplay": common.format_amount(market, total_profit),
        "pendingDividend": pending_dividend,  # 배당 상태기계: 0=idle, >0=claimable
        "pendingDividendDisplay": common.format_amount(market, pending_dividend),
        "holdings": holdings,            # 전체 (펼침)
        "topHoldings": holdings[:3],     # 홈 미리보기
        "disclaimer": common.DISCLAIMER,
    }
