"""레벨 / EXP 엔드포인트 (CLAUDE.md §4: ₩비례 금지, 손실 무강등).

GET  /api/level          → 현재 레벨·EXP 조회
GET  /api/level?sync=true → 키움(ka10073) + DB 배당 동기화 후 조회
POST /api/level/sync     → 강제 동기화 (동일 결과)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.data.provider import get_provider
from app.db import get_db
from app.services import level_service, meta_service

router = APIRouter(prefix="/api/level", tags=["level"])


@router.get("")
def get_level(sync: bool = False, db: Session = Depends(get_db)) -> dict:
    if sync:
        provider = get_provider()
        sell_new = level_service.sync_sell_exp(provider, db)
        div_new = level_service.sync_div_exp(db)
        # 첫 동기화 시점 = 최초 연동일 (1회 고정) → 금고 백필/실시간 분기 기준
        meta_service.ensure_first_link_date(db)
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
    meta_service.ensure_first_link_date(db)
    result = level_service.get_level_summary(db)
    result["syncResult"] = {"sellNew": sell_new, "divNew": div_new}
    return result
