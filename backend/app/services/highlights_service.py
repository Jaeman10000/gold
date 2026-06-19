"""홈 하이라이트 — [B] 오늘의 수급 한 줄 + [C] 연속투자일·업적 한 줄.

CLAUDE.md §4: 투자권유·종목추천 금지. 사실 정보만.
수급(ka10059)은 외부 호출이라 30분 캐시. 연속투자일은 거래일/최초연동일 기반(로컬).
배당 예정(배당락일)은 현재 데이터 소스 없음 → 미구현(DART는 과거 연간 DPS만 제공).
"""
import logging
from datetime import date, datetime, timezone

from app.data.kiwoom_client import KiwoomClient
from app.data.provider import get_provider
from app.db import SessionLocal
from app.services import cache_service, meta_service, vault_service

logger = logging.getLogger(__name__)

_CACHE_TTL_SEC = 1800  # 30분
_MILESTONES = [30, 50, 100, 200, 300, 365, 500, 730, 1000]


def _fresh(cached_at: str) -> bool:
    try:
        t = datetime.strptime(cached_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - t).total_seconds() < _CACHE_TTL_SEC
    except Exception:
        return False


def _parse_ymd(s: str | None):
    if not s:
        return None
    try:
        return datetime.strptime(s[:8], "%Y%m%d").date()
    except Exception:
        return None


def _streak_block(market: str) -> dict | None:
    """연속 투자일 = 최초 투자 시점(거래일 최소 또는 최초연동일)부터 오늘까지."""
    db = SessionLocal()
    try:
        candidates = []
        fl = meta_service.get_first_link_date(db)
        if fl:
            candidates.append(fl)
        try:
            for t in vault_service._db_trades(market):
                if t.get("date"):
                    candidates.append(t["date"])
        except Exception:
            pass
    finally:
        db.close()

    parsed = [d for d in (_parse_ymd(x) for x in candidates) if d]
    if not parsed:
        return None
    start = min(parsed)
    days = (date.today() - start).days + 1  # 오늘 포함
    if days < 1:
        days = 1
    nxt = next((m for m in _MILESTONES if m > days), None)
    return {
        "days": days,
        "nextMilestone": nxt,
        "daysToNext": (nxt - days) if nxt else None,
    }


def _supply_block(market: str) -> dict | None:
    """오늘 외인·기관 순매수가 가장 두드러진 보유 종목 1개."""
    if market != "KR":
        return None
    provider = get_provider()
    if not isinstance(provider, KiwoomClient):
        return None
    holdings = provider.get_holdings(market) or []
    if not holdings:
        return None
    names = {h["ticker"]: h["name"] for h in holdings}
    try:
        netbuy = provider.get_today_net_buy(list(names.keys()))
    except Exception as e:  # noqa: BLE001
        logger.debug("수급 한 줄 실패: %s", e)
        return None

    best = None  # (ticker, total, row)
    for tk, v in netbuy.items():
        total = v.get("foreign", 0) + v.get("inst", 0)
        if best is None or abs(total) > abs(best[1]):
            best = (tk, total, v)
    if not best or best[1] == 0:
        return None

    tk, total, v = best
    who = "외인" if abs(v.get("foreign", 0)) >= abs(v.get("inst", 0)) else "기관"
    direction = "순매수" if total > 0 else "순매도"
    arrow = "↑" if total > 0 else "↓"
    return {
        "ticker": tk,
        "name": names.get(tk, tk),
        "who": who,
        "direction": direction,
        "arrow": arrow,
        "foreign": v.get("foreign", 0),
        "inst": v.get("inst", 0),
        "text": f"오늘 {names.get(tk, tk)} {who} {direction} {arrow}",
    }


def _achievement_line(streak: dict | None) -> str | None:
    if not streak:
        return None
    days = streak["days"]
    dtn = streak.get("daysToNext")
    if dtn is not None and dtn <= 30:
        return f"{streak['nextMilestone']}일 연속까지 {dtn}일 남았어요"
    return f"오늘 포함 {days}일 연속 투자 중"


def build_highlights(market: str) -> dict:
    key = f"highlights:{market}"
    cached = cache_service.get(key)
    if cached and _fresh(cached[1]):
        return {**cached[0], "cachedAt": cached[1]}

    streak = _streak_block(market)
    supply = _supply_block(market)
    result = {
        "streak": streak,
        "supply": supply,
        "achievement": _achievement_line(streak),
        "disclaimer": "투자권유 아님 · 정보 제공 목적",
    }
    cache_service.put(key, result)
    return {**result, "cachedAt": cache_service._now()}
