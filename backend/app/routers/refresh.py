"""강제 새로고침 — Kiwoom/DART 재fetch + DB 캐시 갱신 + EXP sync."""
from fastapi import APIRouter

from app.data.provider import get_provider
from app.db import SessionLocal
from app.services import dividend_service, level_service, meta_service, portfolio_service, radar_service, survey_service, vault_service

router = APIRouter()


@router.get("/api/refresh")
def refresh_all(market: str = "KR") -> dict:
    """portfolio · vault · survey 재fetch + 캐시 갱신 + EXP sync 후 전체 반환.

    pull-to-refresh 및 앱 시작 백그라운드 갱신에 사용.
    survey는 DART를 포함하므로 최대 15초 소요 가능.
    """
    portfolio = portfolio_service.build_portfolio(market, force=True)
    vault     = vault_service.build_vault(market, force=True)
    survey    = survey_service.build_survey(market, force=True)

    # EXP 동기화 + 배당 추정 — 새 익절/배당 있으면 자동 적립
    db = SessionLocal()
    try:
        provider = get_provider()
        # DART 배당 추정 (idempotent) — 새 항목 있으면 vault 재build
        new_divs = dividend_service.infer_and_sync_dividends(market, provider, db)
        if new_divs:
            vault = vault_service.build_vault(market, force=True)
        level_service.sync_sell_exp(provider, db)
        level_service.sync_div_exp(db)
        meta_service.ensure_first_link_date(db)
        level_summary = level_service.get_level_summary(db)
        # 레이더 점수변화 이벤트용 — survey contributions → ScoreSnapshot upsert
        radar_service.save_score_snapshots(
            market, survey.get("contributions", []), db
        )
    finally:
        db.close()

    return {
        "portfolio":  portfolio,
        "vault":      vault,
        "survey":     survey,
        "level":      level_summary,
        "cachedAt":   portfolio.get("cachedAt"),
    }
