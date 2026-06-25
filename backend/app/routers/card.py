"""광부 명함 라우터."""
from fastapi import APIRouter, Query

from app.services import card_service

router = APIRouter(prefix="/api/card", tags=["card"])


@router.get("")
def get_card(market: str = Query("KR", pattern="^(KR|US)$")) -> dict:
    """광부 명함 데이터.

    응답에 총자산·평가금액 없음 (CLAUDE.md §12: 규모 아닌 성장).
    """
    return card_service.build_card(market)
