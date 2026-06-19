"""광맥 레이더 — 보유 종목 기준 이벤트 생성.

이벤트 종류 (v1):
  supply_buy  🟢 외인·기관 순매수 (ka10059)
  supply_sell 🔴 외인·기관 순매도 (ka10059)
  score_up    🔵 측량소 점수 상승 (ScoreSnapshot 전일 대비)
  score_dn    🔵 측량소 점수 하락 (ScoreSnapshot 전일 대비)

배당락(🟡): DART 미래 배당락일 없음 → v2.
하드룰: 사실 수치만. 매수/매도 권유 표현 절대 금지. (CLAUDE.md §4·§12)
"""
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.data.kiwoom_client import KiwoomClient
from app.data.provider import get_provider
from app.db import SessionLocal
from app.models import ScoreSnapshot
from app.services import cache_service

logger = logging.getLogger(__name__)

_CACHE_TTL_SEC = 1800  # 30분
_DISCLAIMER = "투자권유 아님 · 정보 제공 목적 · 사실 수치만"
_SCORE_DELTA_MIN = 5   # |Δ| 이상만 이벤트 생성


def _fmt_shares(val: int) -> str:
    """주 수 포맷 (SupplyDetailSheet 와 동일 기준)."""
    sign = "+" if val >= 0 else "-"
    abs_v = abs(val)
    if abs_v >= 10000:
        return f"{sign}{abs_v / 10000:.1f}만주"
    return f"{sign}{abs_v:,}주"


def _supply_events(market: str) -> list[dict]:
    """오늘 모든 보유 종목 외인·기관 순매수/순매도 이벤트.

    절대값 큰 순서로 정렬. 합계 0인 종목은 제외.
    하드룰: '상승 기대' 같은 권유 표현 0개 — 수치 팩트만.
    """
    if market != "KR":
        return []
    provider = get_provider()
    if not isinstance(provider, KiwoomClient):
        return []
    holdings = provider.get_holdings(market) or []
    if not holdings:
        return []
    names = {h["ticker"]: h["name"] for h in holdings}
    try:
        netbuy = provider.get_today_net_buy(list(names.keys()))
    except Exception as e:
        logger.debug("레이더 수급 실패: %s", e)
        return []

    events: list[dict] = []
    for tk, v in netbuy.items():
        foreign = v.get("foreign", 0)
        inst    = v.get("inst", 0)
        total   = foreign + inst
        if total == 0:
            continue
        is_buy = total > 0
        # 누가 더 많이 움직였나 (팩트 표기용)
        who = "외인" if abs(foreign) >= abs(inst) else "기관"
        events.append({
            "type":   "supply_buy" if is_buy else "supply_sell",
            "emoji":  "🟢" if is_buy else "🔴",
            "ticker": tk,
            "name":   names.get(tk, tk),
            "text":   f"{who} {_fmt_shares(total)}",
            "detail": {
                "foreign": foreign,
                "inst":    inst,
                "who":     who,
            },
        })
    # 절대값 내림차순
    events.sort(key=lambda x: abs(x["detail"]["foreign"] + x["detail"]["inst"]), reverse=True)
    return events


def _score_events(market: str, db: Session) -> list[dict]:
    """전일 대비 측량소 펀더멘털 점수 변화 이벤트.

    ScoreSnapshot 테이블에 오늘·어제 데이터가 모두 있어야 생성됨.
    첫 실행(스냅샷 없음) 시 빈 리스트 반환 → 레이더 패널 숨김.
    """
    today     = date.today().strftime("%Y%m%d")
    yesterday = (date.today() - timedelta(days=1)).strftime("%Y%m%d")

    today_snaps = {
        s.ticker: s.fund_score
        for s in db.query(ScoreSnapshot).filter_by(market=market, date=today)
    }
    yest_snaps = {
        s.ticker: s.fund_score
        for s in db.query(ScoreSnapshot).filter_by(market=market, date=yesterday)
    }

    events: list[dict] = []
    for ticker, cur in today_snaps.items():
        prev = yest_snaps.get(ticker)
        if prev is None:
            continue
        delta = cur - prev
        if abs(delta) < _SCORE_DELTA_MIN:
            continue
        is_up = delta > 0
        events.append({
            "type":   "score_up" if is_up else "score_dn",
            "emoji":  "🔵",
            "ticker": ticker,
            "name":   ticker,   # 이름은 build_radar 에서 패치
            "text":   f"점수 {round(prev)}→{round(cur)} ({'+' if is_up else ''}{round(delta)})",
            "detail": {
                "prev":  round(prev),
                "cur":   round(cur),
                "delta": round(delta),
            },
        })
    return events


def save_score_snapshots(market: str, contributions: list[dict], db: Session) -> None:
    """/api/refresh 완료 시 오늘 날짜 펀더멘털 점수 upsert.

    contributions = survey 응답의 contributions 리스트.
    각 항목에 ticker / fund 필드 필요.
    """
    today = date.today().strftime("%Y%m%d")
    for c in contributions:
        ticker     = c.get("ticker")
        fund_score = c.get("fund")
        if not ticker or fund_score is None:
            continue
        existing = db.query(ScoreSnapshot).filter_by(
            market=market, ticker=ticker, date=today
        ).first()
        if existing:
            existing.fund_score = float(fund_score)
        else:
            db.add(ScoreSnapshot(
                market=market,
                ticker=ticker,
                date=today,
                fund_score=float(fund_score),
            ))
    db.commit()


def _fresh(cached_at: str) -> bool:
    try:
        t = datetime.strptime(cached_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - t).total_seconds() < _CACHE_TTL_SEC
    except Exception:
        return False


def build_radar(market: str) -> dict:
    """레이더 이벤트 빌드 + 30분 캐시.

    수급 이벤트 우선 → 점수변화 후순위. 최대 6개.
    이벤트 없으면 events=[] → 프론트에서 패널 숨김.
    """
    key = f"radar:{market}"
    cached = cache_service.get(key)
    if cached and _fresh(cached[1]):
        return {**cached[0], "cachedAt": cached[1]}

    provider = get_provider()
    db = SessionLocal()
    try:
        supply_evts = _supply_events(market)
        score_evts  = _score_events(market, db)

        # 점수 이벤트 이름 패치 (DB에는 ticker만 저장)
        holdings = provider.get_holdings(market) or []
        names = {h["ticker"]: h["name"] for h in holdings}
        for ev in score_evts:
            ev["name"] = names.get(ev["ticker"], ev["ticker"])
    finally:
        db.close()

    events = (supply_evts + score_evts)[:6]
    result = {
        "events":     events,
        "disclaimer": _DISCLAIMER,
    }
    cache_service.put(key, result)
    return {**result, "cachedAt": cache_service._now()}
