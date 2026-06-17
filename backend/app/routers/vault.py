"""금고 — 매매·배당 장부."""
from fastapi import APIRouter, Query

from app.services import vault_service

router = APIRouter(prefix="/api/vault", tags=["vault"])


@router.get("")
def get_vault(market: str = Query("KR", pattern="^(KR|US)$")):
    return vault_service.build_vault(market)


@router.get("/trades")
def get_trades(market: str = Query("KR", pattern="^(KR|US)$")):
    """매매 내역 전용 엔드포인트."""
    return vault_service.build_trades(market)


@router.get("/dividends")
def get_dividends(market: str = Query("KR", pattern="^(KR|US)$")):
    """배당 내역 전용 엔드포인트."""
    return vault_service.build_dividends(market)
