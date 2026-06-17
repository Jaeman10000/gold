"""금고 — 매매·배당 장부 조회 (CLAUDE.md §7 금고).

데이터 소스 우선순위:
  trades   = kt00009(최근 2개월) + CSV 임포트(DB) 합산, 중복 제거
  dividends = CSV 임포트(DB)만 (키움 배당 API 없음)
"""
from app.data.provider import get_provider
from app.db import SessionLocal
from app.models import Dividend, Trade
from app.services import common


def _db_trades(market: str) -> list[dict]:
    db = SessionLocal()
    try:
        rows = db.query(Trade).filter_by(market=market).all()
        return [
            {"date": r.date, "ticker": r.ticker, "name": r.name,
             "side": r.side, "qty": r.qty, "price": int(r.price)}
            for r in rows
        ]
    finally:
        db.close()


def _db_dividends(market: str) -> list[dict]:
    db = SessionLocal()
    try:
        rows = db.query(Dividend).filter_by(market=market).all()
        return [
            {"date": r.date, "ticker": r.ticker, "name": r.name, "amount": r.amount}
            for r in rows
        ]
    finally:
        db.close()


def _get_merged_trades(market: str, provider) -> list[dict]:
    api_trades = provider.get_trades(market)
    db_trades = _db_trades(market)
    seen: set = set()
    trades = []
    for t in api_trades + db_trades:
        key = (t["date"], t["ticker"], t["side"], t["qty"], t["price"])
        if key not in seen:
            seen.add(key)
            trades.append(t)
    return sorted(trades, key=lambda t: t["date"], reverse=True)


def build_vault(market: str) -> dict:
    provider = get_provider()
    if not provider.is_market_available(market):
        return common.locked_response(market)

    cur = common.currency_of(market)
    trades = _get_merged_trades(market, provider)
    dividends = sorted(_db_dividends(market), key=lambda d: d["date"], reverse=True)
    dividend_total = sum(d["amount"] for d in dividends)

    realized_pnl = []
    if hasattr(provider, "get_realized_pnl"):
        realized_pnl = provider.get_realized_pnl(market)
    realized_total = sum(r["realizedPnl"] for r in realized_pnl)

    return {
        "status": "ok",
        "market": market,
        "currency": cur["currency"],
        "currencySymbol": cur["symbol"],
        "trades": _fmt_trades(trades),
        "dividends": dividends,
        "dividendTotal": round(dividend_total),
        "dividendTotalDisplay": common.format_amount(market, dividend_total),
        "realizedPnl": realized_pnl,
        "realizedPnlTotal": realized_total,
        "realizedPnlTotalDisplay": common.format_amount(market, realized_total),
        "disclaimer": common.DISCLAIMER,
    }


def _fmt_trades(trades: list[dict]) -> list[dict]:
    return [
        {
            "date": t["date"],
            "ticker": t["ticker"],
            "name": t["name"],
            "side": t["side"],
            "sideLabel": "매수" if t["side"] == "BUY" else "매도",
            "qty": t["qty"],
            "price": t["price"],
            "amount": round(t["price"] * t["qty"]),
        }
        for t in trades
    ]


def build_trades(market: str) -> dict:
    provider = get_provider()
    if not provider.is_market_available(market):
        return common.locked_response(market)
    cur = common.currency_of(market)
    trades = _get_merged_trades(market, provider)
    return {
        "status": "ok",
        "market": market,
        "currency": cur["currency"],
        "currencySymbol": cur["symbol"],
        "trades": _fmt_trades(trades),
        "count": len(trades),
        "disclaimer": common.DISCLAIMER,
    }


def build_dividends(market: str) -> dict:
    provider = get_provider()
    if not provider.is_market_available(market):
        return common.locked_response(market)
    cur = common.currency_of(market)
    dividends = sorted(_db_dividends(market), key=lambda d: d["date"], reverse=True)
    total = sum(d["amount"] for d in dividends)
    return {
        "status": "ok",
        "market": market,
        "currency": cur["currency"],
        "currencySymbol": cur["symbol"],
        "dividends": dividends,
        "count": len(dividends),
        "dividendTotal": round(total),
        "dividendTotalDisplay": common.format_amount(market, total),
        "disclaimer": common.DISCLAIMER,
    }
