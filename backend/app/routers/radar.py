"""광맥 레이더 라우터 — 보유 종목 기준 이벤트."""
from fastapi import APIRouter

from app.services import radar_service

router = APIRouter()


@router.get("/api/radar")
def get_radar(market: str = "KR") -> dict:
    """보유 종목 기준 이벤트 목록 반환.

    이벤트 종류: 외인·기관 수급 (ka10059) + 측량소 점수 변화 (ScoreSnapshot).
    이벤트 없으면 events=[] — 프론트에서 패널 숨김 처리.
    CLAUDE.md §4: 투자권유 아님. 사실 수치만.
    """
    return radar_service.build_radar(market)
