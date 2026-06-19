"""광맥(Gwangmaek) FastAPI 진입점.

실행: cd backend && uvicorn app.main:app --reload --port 8002
"""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import init_db
from app.routers import (
    explore,
    highlights,
    import_router,
    level,
    news,
    portfolio,
    radar,
    refresh,
    survey,
    vault,
    visit,
)

logger = logging.getLogger(__name__)

app = FastAPI(title="광맥 (Gwangmaek) API", version="0.1.0")

_PASSCODE_EXEMPT = {"/api/health"}  # Railway 헬스체크는 패스코드 없이 통과


# 패스코드 게이트를 먼저 등록 → CORS 를 나중에 등록해 '가장 바깥'에 둔다.
# Starlette 는 나중에 add 한 미들웨어가 outermost. CORS 가 outermost 여야
# 패스코드 401 같은 단축 응답에도 Access-Control-Allow-Origin 이 붙어
# 브라우저가 응답을 읽을 수 있다(안 그러면 401 이 CORS 에러로 막혀 프론트가 오판).
@app.middleware("http")
async def passcode_gate(request: Request, call_next):
    """APP_PASSCODE 설정 시 모든 API에 X-Passcode 헤더 검증. 빈 값이면 개발 모드(무제한)."""
    if (
        request.method == "OPTIONS"  # preflight 는 바깥 CORS 가 처리 (방어적)
        or not settings.app_passcode
        or request.url.path in _PASSCODE_EXEMPT
    ):
        return await call_next(request)
    if request.headers.get("X-Passcode", "") != settings.app_passcode:
        return JSONResponse({"detail": "패스코드가 맞지 않아요"}, status_code=401)
    return await call_next(request)


# CORS 를 마지막에 등록 = outermost (위 주석 참고)
# allow_origin_regex: Cloudflare Quick Tunnel(*.trycloudflare.com) URL이 재시작마다 바뀌어도 자동 허용.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://.*\.trycloudflare\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-Passcode"],
)

app.include_router(portfolio.router)
app.include_router(vault.router)
app.include_router(survey.router)
app.include_router(import_router.router)
app.include_router(explore.router)
app.include_router(level.router)
app.include_router(refresh.router)
app.include_router(news.router)
app.include_router(highlights.router)
app.include_router(radar.router)
app.include_router(visit.router)


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


@app.get("/api/debug/kiwoom/themes")
def debug_kiwoom_themes() -> dict:
    """ka90001 테마그룹 목록 원시 응답 — 경로·필드명 검증용 (DEV 전용)."""
    from app.data.provider import get_provider
    from app.data.kiwoom_client import KiwoomClient
    p = get_provider()
    if not isinstance(p, KiwoomClient):
        return {"error": "DATA_PROVIDER=kiwoom 일 때만 사용 가능"}
    try:
        return p._call_api("/api/dostk/thema", "ka90001", {})
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/debug/kiwoom/supply/{ticker}")
def debug_kiwoom_supply(ticker: str) -> dict:
    """ka10059 종목별투자자 원시 응답 — 경로·필드명 검증용 (DEV 전용)."""
    from datetime import date
    from app.data.provider import get_provider
    from app.data.kiwoom_client import KiwoomClient
    p = get_provider()
    if not isinstance(p, KiwoomClient):
        return {"error": "DATA_PROVIDER=kiwoom 일 때만 사용 가능"}
    try:
        return p._call_api(
            "/api/dostk/stkinfo",
            "ka10059",
            {
                "stk_cd": ticker,
                "dt": date.today().strftime("%Y%m%d"),
                "amt_qty_tp": "1",
                "trde_tp": "0",
                "unit_tp": "1",
            },
        )
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/admin/dart/update")
def admin_dart_update() -> dict:
    """DART corpCode.xml 갱신 — DART_API_KEY 등록 후 1회 실행 (DEV 전용)."""
    from app.data.dart_client import update_corp_code_cache
    count = update_corp_code_cache()
    if count:
        return {"status": "ok", "corp_count": count}
    return {"status": "error", "msg": "DART_API_KEY 미설정이거나 다운로드 실패"}


@app.get("/api/auth/check")
def auth_check() -> dict:
    """패스코드 검증용 — 미들웨어를 통과했으면 올바른 패스코드. APP_PASSCODE 미설정 시 항상 200."""
    return {"ok": True}


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
