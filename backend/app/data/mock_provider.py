"""Mock 데이터 provider — v1 기본. KR=실데이터 형태, US=잠금.

DataProvider 계약을 그대로 구현하므로 Phase 2 에서 KiwoomClient 로 교체 가능.
"""
from app.data.provider import DataProvider
from app.services import mock_data


class MockProvider(DataProvider):
    def is_market_available(self, market: str) -> bool:
        # v1: KR 만 실데이터. US 는 데이터 소스 준비 중(잠금) — CLAUDE.md §7.
        return market == "KR"

    def get_holdings(self, market: str) -> list[dict]:
        if market == "KR":
            return [dict(h) for h in mock_data.KR_HOLDINGS]
        return []

    def get_trades(self, market: str) -> list[dict]:
        if market == "KR":
            return [dict(t) for t in mock_data.KR_TRADES]
        return []

    def get_dividends(self, market: str) -> list[dict]:
        if market == "KR":
            return [dict(d) for d in mock_data.KR_DIVIDENDS]
        return []
