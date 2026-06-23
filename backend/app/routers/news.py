"""보유 종목 관련 뉴스 — 네이버 증권 종목뉴스 병합. 종목 추천 아님(정보 제공)."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter

from app.data import naver_news
from app.data.provider import get_provider
from app.services import cache_service

router = APIRouter(prefix="/api/news", tags=["news"])
logger = logging.getLogger(__name__)

_CACHE_TTL_SEC = 1800  # 30분
_DISCLAIMER = "투자권유 아님 · 종목 추천 아님 · 정보 제공 목적"


def _fresh(cached_at: str) -> bool:
    try:
        t = datetime.strptime(cached_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - t).total_seconds() < _CACHE_TTL_SEC
    except Exception:
        return False


@router.get("")
def get_news(market: str = "KR", ticker: str | None = None) -> dict:
    """보유 종목별 네이버 뉴스. ticker 지정 시 해당 종목만 5개."""
    if market != "KR":
        return {
            "market": market,
            "items": [],
            "locked": True,
            "note": "해외 종목 뉴스는 준비 중입니다.",
            "disclaimer": _DISCLAIMER,
        }

    provider = get_provider()
    holdings = provider.get_holdings(market) or []

    # 특정 종목 뉴스 (Bottom Sheet 상세 조회 — 캐시 없이 최신)
    if ticker:
        h = next((h for h in holdings if h["ticker"] == ticker), None)
        items = naver_news.get_stock_news(ticker, h["name"] if h else ticker, limit=5) if h else []
        return {"items": items, "market": market, "disclaimer": _DISCLAIMER}

    key = f"news:{market}"
    cached = cache_service.get(key)
    if cached and _fresh(cached[1]):
        return {**cached[0], "market": market, "cachedAt": cached[1]}

    collected: list[dict] = []
    for h in holdings:
        collected.extend(naver_news.get_stock_news(h["ticker"], h["name"], limit=3))

    # 최신순 정렬 + URL 중복 제거
    seen: set[str] = set()
    uniq: list[dict] = []
    for n in sorted(collected, key=lambda x: x.get("datetime", ""), reverse=True):
        if n["url"] in seen:
            continue
        seen.add(n["url"])
        uniq.append(n)

    result = {
        "items": uniq,
        "holdingsCount": len(holdings),
        "note": "보유 종목명 기준 네이버 증권 뉴스",
        "disclaimer": _DISCLAIMER,
    }
    cache_service.put(key, result)
    return {**result, "market": market, "cachedAt": cache_service._now()}
