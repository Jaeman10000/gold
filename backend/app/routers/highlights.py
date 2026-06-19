"""홈 하이라이트 — 오늘의 수급 한 줄 + 연속투자일·업적 한 줄. 투자권유 아님."""
from fastapi import APIRouter

from app.services import highlights_service

router = APIRouter(prefix="/api/highlights", tags=["highlights"])


@router.get("")
def get_highlights(market: str = "KR") -> dict:
    return highlights_service.build_highlights(market)
