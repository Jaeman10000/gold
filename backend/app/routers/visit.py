"""연속 방문일 라우터."""
from fastapi import APIRouter

from app.db import SessionLocal
from app.services import visit_service

router = APIRouter()


@router.get("/api/visit/streak")
def visit_streak(user_id: str = "default") -> dict:
    """앱 열 때마다 호출 — 오늘 방문 기록 + 연속 방문일 반환.

    응답: {streak: int, message: str, daysSinceLast: int | null}
    """
    db = SessionLocal()
    try:
        return visit_service.log_and_get_streak(db, user_id=user_id)
    finally:
        db.close()
