"""데이터 접근 추상화 (CLAUDE.md 하드룰 §4: mock → 키움 무손실 교체).

서비스 계층은 이 인터페이스만 의존한다. 구현체를 mock → kiwoom 으로 바꿔도
상위 코드는 변경되지 않는다.

반환 dict 형태 (시장 데이터 계약):
  holding  = {"ticker", "name", "qty", "avg_price", "current_price"}
  trade    = {"date", "ticker", "name", "side"("BUY"|"SELL"), "qty", "price"}
  dividend = {"date", "ticker", "name", "amount"}
"""
import logging
from abc import ABC, abstractmethod

from app.config import settings

logger = logging.getLogger(__name__)


class DataProvider(ABC):
    @abstractmethod
    def is_market_available(self, market: str) -> bool:
        """해당 시장 실데이터 제공 가능 여부. v1: KR=True, US=False(잠금)."""

    @abstractmethod
    def get_holdings(self, market: str) -> list[dict]: ...

    @abstractmethod
    def get_trades(self, market: str) -> list[dict]: ...

    @abstractmethod
    def get_dividends(self, market: str) -> list[dict]: ...

    def get_theme_index(self, market: str) -> dict[str, list[str]]:
        """ticker → 해당 종목이 속한 테마명 리스트 (키움 테마 원본명).

        scoring_service 가 themes.json 키워드와 교차해 성장테마 여부를 판단.
        구현 불가(mock 등) 시 {} 반환 → theme 점수 None → 가중치 재정규화.
        """
        return {}

    def get_supply_scores(
        self, tickers: list[str], market: str, days: int = 20
    ) -> dict[str, float]:
        """ticker → 최근 N거래일 외인+기관 순매수 기반 수급 점수(0~100).

        구현 불가 시 {} 반환 → supply 점수 None → 가중치 재정규화.
        """
        return {}

    def get_fundamentals(self, tickers: list[str], market: str) -> dict[str, dict]:
        """ka10001 주식기본정보 → ticker: {"mac": int, "trde_qty": int}.

        mac = 시가총액, trde_qty = 거래대금(or 거래량). trust 축 계산용.
        구현 불가 시 {} 반환 → trust 점수 None → 가중치 재정규화.
        """
        return {}


_provider: DataProvider | None = None
_init_error: str = ""  # KiwoomClient 초기화 실패 메시지 (health check 용)


def get_provider() -> DataProvider:
    """설정에 따른 단일 provider 반환.

    DATA_PROVIDER=kiwoom 일 때 KiwoomClient 초기화 실패 시:
    - 에러를 _init_error 에 저장하고 MockProvider 로 폴백.
    - health 엔드포인트에서 오류 원인 확인 가능.
    """
    global _provider, _init_error
    if _provider is None:
        if settings.data_provider == "kiwoom":
            from app.data.kiwoom_client import KiwoomClient
            try:
                _provider = KiwoomClient(use_mock=settings.kiwoom_use_mock)
                _init_error = ""
            except Exception as exc:
                _init_error = str(exc)
                logger.error("KiwoomClient 초기화 실패 → MockProvider 폴백: %s", exc)
                from app.data.mock_provider import MockProvider
                _provider = MockProvider()
        else:
            from app.data.mock_provider import MockProvider
            _provider = MockProvider()
            _init_error = ""
    return _provider


def provider_status() -> dict:
    """health check 용 provider 상태 dict."""
    p = get_provider()
    result: dict = {
        "provider": type(p).__name__,
        "configured": settings.data_provider,
    }
    if _init_error:
        result["init_error"] = _init_error
    # KiwoomClient 전용: 토큰 유효 여부 (duck typing, import 없이)
    if hasattr(p, "token_ok"):
        result["token_ok"] = p.token_ok
    return result
