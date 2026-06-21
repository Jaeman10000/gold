"""탐사 API — 종목 이해 도구 (사실 정보) + 가상 비중 시뮬레이션.

하드룰: 종목 추천 없음. 사실 정보만. 판단은 사용자 본인. disclaimer 항상 포함.
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.services import explore_service, stock_study_service

router = APIRouter(prefix="/api/explore", tags=["explore"])


class SimulateRequest(BaseModel):
    market: str = "KR"
    ticker: str
    name: str = ""
    targetWeight: float = Field(..., ge=0.0, le=100.0)


@router.get("/search")
def search(q: str = Query(..., min_length=1), market: str = "KR") -> dict:
    """종목명·코드 검색. 하드룰: 입력 매칭만. 이름+코드만 반환. 추천 없음."""
    return explore_service.search_tickers(q, market)


@router.get("/stock")
def get_stock_overview(
    ticker: str = Query(..., min_length=1),
    market: str = "KR",
) -> dict:
    """종목 이해 도구 Phase 1 — ka10001 + company.json (즉시). 투자권유 아님."""
    return stock_study_service.get_stock_overview(ticker, market)


@router.get("/stock/financials")
def get_stock_financials(
    ticker: str = Query(..., min_length=1),
    market: str = "KR",
) -> dict:
    """종목 이해 도구 Phase 2 — DART 재무 3년 (lazy, 5~15초). 투자권유 아님."""
    return stock_study_service.get_stock_financials(ticker, market)


@router.post("/simulate")
def simulate(body: SimulateRequest) -> dict:
    """가상 비중으로 활성 모드(기본/테마) 점수 재계산.

    케이스A (기존 보유 종목): 추가 API 호출 없음.
    케이스B (신규 종목): DART + 수급 1회 조회 (5~15초 소요 가능).
    항상 disclaimer("가정 시뮬레이션·투자권유 아님") 포함.
    """
    return explore_service.simulate(
        market=body.market,
        ticker=body.ticker,
        name=body.name,
        target_weight=body.targetWeight,
    )
