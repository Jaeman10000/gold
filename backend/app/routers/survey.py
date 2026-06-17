"""측량소 — 미래정합성 점수 분해."""
from fastapi import APIRouter, Query

from app.services import survey_service

router = APIRouter(prefix="/api/survey", tags=["survey"])


@router.get("")
def get_survey(market: str = Query("KR", pattern="^(KR|US)$")):
    return survey_service.build_survey(market)
