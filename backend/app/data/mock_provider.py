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

    def get_theme_index(self, market: str) -> dict[str, list[str]]:
        if market != "KR":
            return {}
        # mock 종목들의 키움 테마명 (실제 키움 테마명과 유사하게 작성)
        return {
            "005930": ["AI반도체", "반도체"],           # 삼성전자
            "000660": ["AI반도체", "HBM", "반도체"],    # SK하이닉스
            "005380": ["로봇", "전기차"],               # 현대차
            "105560": [],                               # KB금융 (성장테마 없음)
            "006400": ["2차전지", "배터리"],            # 삼성SDI
        }

    def get_supply_scores(
        self, tickers: list[str], market: str, days: int = 20
    ) -> dict[str, float]:
        if market != "KR":
            return {}
        # 예시 수급 점수 (0~100)
        _mock = {
            "005930": 62.0,
            "000660": 78.0,
            "005380": 55.0,
            "105560": 48.0,
            "006400": 41.0,
        }
        return {t: _mock[t] for t in tickers if t in _mock}

    def get_account_summary(self, market: str) -> dict | None:
        if market != "KR":
            return None
        holdings = self.get_holdings(market)
        total_eval = sum(h["qty"] * h["current_price"] for h in holdings)
        total_purchase = sum(h["qty"] * h["avg_price"] for h in holdings)
        return {
            "totalPurchase": total_purchase,
            "totalEval": total_eval,
            "cash": 1_500_000,   # mock 예수금
            "cashProvisional": True,
        }
