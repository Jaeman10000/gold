"""수익률·평단 계산 — 한 곳에 집중 (CLAUDE.md §8-2: 키움 표시값과 일치해야).

평단(avg_price)은 가중평균 가정. 평가손익/수익률 산식:
  종목 평가금액 = current_price * qty
  종목 원가     = avg_price * qty
  종목 수익률   = (current_price - avg_price) / avg_price * 100
  전체 수익률   = (총평가 - 총원가) / 총원가 * 100   (원 액수 합산 기반)
"""
from datetime import date, datetime

from app.data.provider import get_provider
from app.db import SessionLocal
from app.models import Dividend, Trade
from app.services import cache_service, common, meta_service, scoring_service


def _parse_date(s: str) -> date | None:
    """'YYYY-MM-DD' 또는 'YYYYMMDD' → date. 실패 시 None."""
    if not s:
        return None
    s = str(s).strip()
    for fmt in ("%Y-%m-%d", "%Y%m%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _enrich_holdings(market: str, holdings: list[dict], provider) -> None:
    """홈 금광 변주용 종목별 누적 지표 — firstBuyDate·holdingDays·dividendCount.

    하드룰(§4 스타일 중립): 광물 누적은 보유기간(중립)만. 배당횟수는 보조 표식.
    데이터 한계: 키움 kt00009 60일 → 그 이전 매수는 CSV 임포트 or first_link_date 폴백.
    거래 소스 = API(kt00009 60일) + DB(CSV 임포트) 합산 — vault와 동일.
    """
    # API 거래는 DB에 영구 저장되지 않으므로 직접 합산해야 첫매수일이 잡힘
    try:
        api_trades = provider.get_trades(market) or []
    except Exception:
        api_trades = []

    db = SessionLocal()
    try:
        db_trades = [
            {"date": r.date, "ticker": r.ticker, "side": r.side}
            for r in db.query(Trade).filter_by(market=market).all()
        ]

        # 종목별 배당 횟수 + 총액
        div_count: dict[str, int] = {}
        div_amount: dict[str, float] = {}
        for r in db.query(Dividend).filter_by(market=market).all():
            div_count[r.ticker] = div_count.get(r.ticker, 0) + 1
            div_amount[r.ticker] = div_amount.get(r.ticker, 0.0) + (r.amount or 0)

        # 거래기록 없는 종목 폴백 바닥값 = 첫 연동일(앱이 지켜본 시작)
        link_floor = _parse_date(meta_service.get_first_link_date(db) or "")
        today = date.today()
    finally:
        db.close()

    # 종목별 첫 매수일 (API + DB 의 BUY 중 최소 날짜)
    first_buy: dict[str, date] = {}
    for t in api_trades + db_trades:
        if (t.get("side") or "").upper() != "BUY":
            continue
        d = _parse_date(t.get("date"))
        tk = t.get("ticker")
        if d and tk and (tk not in first_buy or d < first_buy[tk]):
            first_buy[tk] = d

    for h in holdings:
        fb = first_buy.get(h["ticker"]) or link_floor
        if fb:
            h["firstBuyDate"] = fb.isoformat()
            h["holdingDays"] = max(1, (today - fb).days + 1)
        else:
            h["firstBuyDate"] = None
            h["holdingDays"] = None
        h["dividendCount"] = div_count.get(h["ticker"], 0)
        h["dividendAmount"] = round(div_amount.get(h["ticker"], 0))


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


def build_portfolio(market: str, pending_override: int | None = None, force: bool = False) -> dict:
    provider = get_provider()
    if not provider.is_market_available(market):
        return common.locked_response(market)

    if not force and pending_override is None:
        hit = cache_service.get(f"portfolio_{market}")
        if hit:
            data, cached_at = hit
            return {**data, "cachedAt": cached_at}

    cur = common.currency_of(market)
    holdings = _compute_holdings(provider.get_holdings(market))
    _enrich_holdings(market, holdings, provider)  # 종목별 누적(보유일·배당횟수) — 홈 금광 변주

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

    result = {
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
    if pending_override is None:
        cached_at = cache_service.put(f"portfolio_{market}", result)
        result["cachedAt"] = cached_at
    return result
