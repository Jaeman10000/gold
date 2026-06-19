"""네이버 모바일 증권 종목뉴스 — m.stock.naver.com JSON API.

CLAUDE.md §4: 종목 추천 아님. 보유 종목 관련 뉴스를 '정보'로 보여줄 뿐,
매수/매도 신호를 생성하지 않는다. (네이버 구 RSS는 종료 → 이 모바일 API 사용)
"""
import html
import logging

import httpx

logger = logging.getLogger(__name__)

_API = "https://m.stock.naver.com/api/news/stock/{code}"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    "Referer": "https://m.stock.naver.com/",
}


def _article_url(office_id: str, article_id: str) -> str:
    return f"https://n.news.naver.com/mnews/article/{office_id}/{article_id}"


def _fmt_dt(s: str) -> str:
    """"202606192159" → "06.19 21:59"."""
    if s and len(s) >= 12:
        return f"{s[4:6]}.{s[6:8]} {s[8:10]}:{s[10:12]}"
    return s or ""


def get_stock_news(ticker: str, name: str, limit: int = 2) -> list[dict]:
    """종목코드 관련 최신 뉴스 limit개. 실패 시 빈 리스트(앱은 계속 동작)."""
    try:
        r = httpx.get(
            _API.format(code=ticker),
            headers=_HEADERS,
            params={"pageSize": limit, "page": 1},
            timeout=6,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:  # noqa: BLE001 — 뉴스는 부가기능, 실패해도 무시
        logger.debug("네이버 뉴스 %s 실패: %s", ticker, e)
        return []

    out: list[dict] = []
    # 응답 형태: [{"total":N,"items":[{...}]}] (날짜 그룹 배열)
    groups = data if isinstance(data, list) else []
    for group in groups:
        for it in group.get("items", []):
            office_id = str(it.get("officeId", ""))
            article_id = str(it.get("articleId", ""))
            if not office_id or not article_id:
                continue
            out.append(
                {
                    "ticker": ticker,
                    "stockName": name,
                    "title": html.unescape(it.get("title", "")).strip(),
                    "press": it.get("officeName", ""),
                    "datetime": it.get("datetime", ""),
                    "datetimeText": _fmt_dt(it.get("datetime", "")),
                    "url": _article_url(office_id, article_id),
                }
            )
    return out[:limit]
