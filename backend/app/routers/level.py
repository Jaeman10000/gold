"""레벨 / EXP 엔드포인트 (CLAUDE.md §4: ₩비례 금지, 손실 무강등).

GET  /api/level          → 현재 레벨·EXP 조회
GET  /api/level?sync=true → 키움(ka10073) + DB 배당 동기화 후 조회
POST /api/level/sync     → 강제 동기화 (동일 결과)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.data.provider import get_provider
from app.db import get_db
from app.services import level_service

router = APIRouter(prefix="/api/level", tags=["level"])


@router.get("")
def get_level(sync: bool = False, db: Session = Depends(get_db)) -> dict:
    if sync:
        provider = get_provider()
        sell_new = level_service.sync_sell_exp(provider, db)
        div_new = level_service.sync_div_exp(db)
    else:
        sell_new = div_new = None

    result = level_service.get_level_summary(db)
    if sync:
        result["syncResult"] = {"sellNew": sell_new, "divNew": div_new}
    return result


@router.post("/sync")
def force_sync(db: Session = Depends(get_db)) -> dict:
    provider = get_provider()
    sell_new = level_service.sync_sell_exp(provider, db)
    div_new = level_service.sync_div_exp(db)
    result = level_service.get_level_summary(db)
    result["syncResult"] = {"sellNew": sell_new, "divNew": div_new}
    return result
