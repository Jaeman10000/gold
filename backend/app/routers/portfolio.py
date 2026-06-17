"""광산 홈 — 포트폴리오 요약."""
from fastapi import APIRouter, Query

from app.services import portfolio_service

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("")
def get_portfolio(
    market: str = Query("KR", pattern="^(KR|US)$"),
    pending: int | None = Query(None, ge=0, description="배당 상태기계 테스트용 override"),
):
    """market=KR → ok 응답, market=US → {status:'locked'} (CLAUDE.md §7)."""
    return portfolio_service.build_portfolio(market, pending_override=pending)
