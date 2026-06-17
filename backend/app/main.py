"""광맥(Gwangmaek) FastAPI 진입점.

실행: cd backend && uvicorn app.main:app --reload --port 8002
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.routers import import_router, portfolio, survey, vault

logger = logging.getLogger(__name__)

app = FastAPI(title="광맥 (Gwangmaek) API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolio.router)
app.include_router(vault.router)
app.include_router(survey.router)
app.include_router(import_router.router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    # Provider 사전 초기화 — DATA_PROVIDER=kiwoom 시 토큰 발급 시도.
    # 실패해도 서버는 뜨고, /api/health 에서 오류 원인 확인 가능.
    from app.data.provider import get_provider, provider_status
    get_provider()
    status = provider_status()
    if status.get("init_error"):
        logger.error("Provider 초기화 오류: %s", status["init_error"])
    else:
        logger.info("Provider 준비 완료: %s", status)


@app.get("/api/debug/kiwoom/ka10073")
def debug_kiwoom_ka10073(strt_dt: str = "", end_dt: str = "") -> dict:
    """ka10073 기간별실현손익 원시 응답 — 파라미터·필드명 탐색용 (DEV 전용)."""
    from datetime import date, timedelta
    from app.data.provider import get_provider
    from app.data.kiwoom_client import KiwoomClient
    p = get_provider()
    if not isinstance(p, KiwoomClient):
        return {"error": "DATA_PROVIDER=kiwoom 일 때만 사용 가능"}
    today = date.today()
    if not end_dt:
        end_dt = today.strftime("%Y%m%d")
    if not strt_dt:
        strt_dt = (today - timedelta(days=365)).strftime("%Y%m%d")
    return p.raw_ka10073(strt_dt=strt_dt, end_dt=end_dt)


@app.get("/api/debug/kiwoom/kt00009")
def debug_kiwoom_kt00009(strt_dt: str = "", end_dt: str = "") -> dict:
    """kt00009 체결내역 원시 응답 — 파라미터 구조·필드명 탐색용 (DEV 전용)."""
    from datetime import date, timedelta
    from app.data.provider import get_provider
    from app.data.kiwoom_client import KiwoomClient
    p = get_provider()
    if not isinstance(p, KiwoomClient):
        return {"error": "DATA_PROVIDER=kiwoom 일 때만 사용 가능"}
    today = date.today()
    if not end_dt:
        end_dt = today.strftime("%Y%m%d")
    if not strt_dt:
        strt_dt = (today - timedelta(days=60)).strftime("%Y%m%d")
    return p.raw_kt00009(strt_dt=strt_dt, end_dt=end_dt)


@app.get("/api/debug/kiwoom/scan")
def debug_kiwoom_scan() -> dict:
    """dmst_stex_tp 후보값 일괄 테스트 — 유효한 값 탐색용 (DEV 전용)."""
    from app.data.provider import get_provider
    from app.data.kiwoom_client import KiwoomClient
    p = get_provider()
    if not isinstance(p, KiwoomClient):
        return {"error": "DATA_PROVIDER=kiwoom 일 때만 사용 가능"}
    candidates = ["NXT", "SOR", "1", "2", "01", "02", "KS", "KQ", "KOSPI", "ALL", "9", "99"]
    results = {}
    for val in candidates:
        r = p.raw_kt00018(qry_tp="1", dmst_stex_tp=val)
        results[val] = {
            "return_code": r.get("body", {}).get("return_code"),
            "return_msg": r.get("body", {}).get("return_msg", "")[:80],
        }
    return results


@app.get("/api/debug/kiwoom")
def debug_kiwoom_raw(qry_tp: str = "1", dmst_stex_tp: str = "KRX") -> dict:
    """kt00018 원시 응답 확인 — 파라미터 값 탐색용 (DEV 전용).

    사용 예:
      /api/debug/kiwoom?dmst_stex_tp=KRX
      /api/debug/kiwoom?dmst_stex_tp=J
      /api/debug/kiwoom?dmst_stex_tp=
      /api/debug/kiwoom?dmst_stex_tp=01
    """
    from app.data.provider import get_provider
    from app.data.kiwoom_client import KiwoomClient
    p = get_provider()
    if not isinstance(p, KiwoomClient):
        return {"error": "DATA_PROVIDER=kiwoom 일 때만 사용 가능"}
    return p.raw_kt00018(qry_tp=qry_tp, dmst_stex_tp=dmst_stex_tp)


@app.get("/api/health")
def health() -> dict:
    """서버 상태 + provider 상태 (토큰 유효 여부 포함).

    DATA_PROVIDER=kiwoom 일 때:
      {"status":"ok","provider":"KiwoomClient","configured":"kiwoom","token_ok":true}
    초기화 실패 시:
      {"status":"ok","provider":"MockProvider","configured":"kiwoom","init_error":"..."}
    """
    from app.data.provider import provider_status
    return {"status": "ok", **provider_status()}
