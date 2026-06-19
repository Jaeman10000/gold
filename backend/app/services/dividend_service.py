"""DART 기반 배당금 자동 추정 — 실제 매매내역 기반 배당락일 적격 검증.

원리:
  1. 매매기록(kt00009 + DB CSV임포트)에서 배당락일 기준 보유 수량 계산.
     - 배당락일 이전에 매수한 수량 합계
     - 배당락일 이하에 매도한 수량 차감 (배당락일 당일 매도 = 0원)
  2. 적격 수량 > 0인 경우에만 DART DPS 조회 후 추정 배당금 삽입.
  3. 멱등 — 이미 있는 항목은 건너뜀.

핵심 한계:
  kt00009(체결내역)는 최근 60일만 제공.
  배당락일이 60일 이전이면 매매기록 없음 → 자동 추정 불가 → 삽입 안 함.
  이 경우 금고 > CSV 임포트로 과거 매매내역을 추가하면 자동 반영됨.

추가 한계:
  - 12월 결산 법인 기준. 3월·6월 결산 법인은 오차 가능.
  - DART 공시 DPS = 세전. 원천징수(15.4%) 미반영.
  - 배당락일 실제 영업일 보정 없음 (보수적으로 12/26 고정).
"""

import logging
from datetime import date, timedelta

from app.data.dart_client import get_dividend_per_share
from app.models import Dividend

logger = logging.getLogger(__name__)

_EX_MONTH = 12
_EX_DAY = 26   # 12월 결산 기준 보수적 추정 (실제 배당락일보다 약간 이른 날짜)


def _ex_date_str(year: int) -> str:
    return f"{year}-{_EX_MONTH:02d}-{_EX_DAY:02d}"


def _payment_date_str(year: int) -> str:
    """배당금 지급일 추정 — 12월 결산 기준 익년 4월 1일."""
    return f"{year + 1}-04-01"


def _eligible_qty(ticker: str, ex_str: str, all_trades: list[dict]) -> int:
    """배당락일 기준 적격 보유 수량.

    bought: 배당락일 이전(strictly <) 매수 합계.
    sold:   배당락일 이하(≤) 매도 합계 — 배당락일 당일 매도는 0주 처리.

    매매기록이 없으면(배당락일이 kt00009 60일 범위 밖) 0 반환 → 추정 안 함.
    """
    bought = sum(
        t["qty"] for t in all_trades
        if t["ticker"] == ticker and t["side"] == "BUY" and t["date"] < ex_str
    )
    sold = sum(
        t["qty"] for t in all_trades
        if t["ticker"] == ticker and t["side"] == "SELL" and t["date"] <= ex_str
    )
    return max(0, bought - sold)


def infer_and_sync_dividends(market: str, provider, db) -> int:
    """보유 종목 DART DPS 조회 → 추정 배당 DB 동기화.

    Returns: 새로 삽입된 건 수.
    """
    if market != "KR":
        return 0  # US 배당 추정은 v2

    holdings = provider.get_holdings(market)
    if not holdings:
        return 0

    # 전체 매매 기록 (API 60일 + DB CSV임포트 합산)
    from app.services.vault_service import _get_merged_trades
    all_trades = _get_merged_trades(market, provider)

    if not all_trades:
        logger.info("매매기록 없음 — 배당 추정 건너뜀")
        return 0

    # 매매기록 중 가장 오래된 날짜 (이보다 이전 배당락일은 검증 불가)
    oldest_trade_date = min(t["date"] for t in all_trades)

    today = date.today()
    # 완료된 회계연도만 (당해 연도 배당은 이듬해 3월 이후 확정)
    completed_years = [y for y in range(today.year - 3, today.year)]

    holding_tickers = {h["ticker"]: h.get("name", h["ticker"]) for h in holdings}
    inserted = 0

    for ticker, name in holding_tickers.items():
        for year in completed_years:
            ex_str = _ex_date_str(year)
            pay_str = _payment_date_str(year)

            # 배당락일이 매매기록 범위 밖이면 검증 불가 → 건너뜀
            if ex_str < oldest_trade_date:
                logger.debug(
                    "%s %d년 배당락일(%s)이 매매기록 시작(%s)보다 이름 — 건너뜀",
                    ticker, year, ex_str, oldest_trade_date,
                )
                continue

            # 멱등 체크
            already = (
                db.query(Dividend)
                .filter(
                    Dividend.market == market,
                    Dividend.ticker == ticker,
                    Dividend.date == pay_str,
                    Dividend.source == "dart_inferred",
                )
                .first()
            )
            if already:
                continue

            qty = _eligible_qty(ticker, ex_str, all_trades)
            if qty <= 0:
                logger.debug("%s %d년: 배당락일 기준 보유 0주 → 건너뜀", ticker, year)
                continue

            dps = get_dividend_per_share(ticker, year)
            if not dps or dps <= 0:
                continue

            amount = float(qty * dps)
            logger.info(
                "배당 추정 삽입: %s %d년 | 배당락일=%s, %d주×%d원=%.0f원",
                ticker, year, ex_str, qty, dps, amount,
            )
            db.add(Dividend(
                market=market,
                date=pay_str,
                ticker=ticker,
                name=name,
                amount=amount,
                source="dart_inferred",
            ))
            try:
                db.commit()
                inserted += 1
            except Exception:
                db.rollback()
                logger.warning("배당 추정 삽입 실패: %s %d", ticker, year)

    return inserted
