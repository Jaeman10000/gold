"""탐사 종목 이해 도구 — 재무 사실 정보(사실만, 판단 없음).

하드룰 (CLAUDE.md §4·§7):
  - 투자권유·종목추천 아님. 수치+지표 설명만. 판단은 투자자 본인.
  - "높다/낮다/좋다/나쁘다/저평가/매수" 텍스트 일절 생성 금지.
  - Phase 1 (ka10001 즉시) / Phase 2 (DART 재무, lazy 별도 요청).
"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from app.data import dart_client
from app.data.kiwoom_client import KiwoomClient
from app.data.provider import get_provider
from app.services import cache_service

logger = logging.getLogger(__name__)

_DISCLAIMER = "투자권유 아님 · DART·키움 공시 기준 사실 정보 · 판단은 투자자 본인 몫"
_NEUTRAL_NOTE = "이 수치가 높은지 낮은지는 업종·기업마다 다릅니다"
_CACHE_TTL = 1800  # 30분

_KSIC_PATH = Path(__file__).parents[2] / "data" / "ksic_names.json"
_ksic: dict[str, str] = {}


def _load_ksic() -> None:
    global _ksic
    if _ksic:
        return
    try:
        with open(_KSIC_PATH, encoding="utf-8") as f:
            _ksic = json.load(f)
    except Exception as e:
        logger.warning("ksic_names.json 로드 실패: %s", e)


def ksic_name(code: str) -> str | None:
    _load_ksic()
    if not code:
        return None
    for c in [code, code[:3], code[:2]]:
        if c and c in _ksic:
            return _ksic[c]
    return None


def _fresh(cached_at: str) -> bool:
    try:
        t = datetime.strptime(cached_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - t).total_seconds() < _CACHE_TTL
    except Exception:
        return False


def _to_float(v) -> float | None:
    if v is None:
        return None
    try:
        s = str(v).replace(",", "").replace("+", "").strip()
        if not s or s in ("-", "N/A", "n/a"):
            return None
        return float(s)
    except (ValueError, TypeError):
        return None


def _fmt_est_dt(s: str) -> str:
    """"20020401" → "2002년 4월"."""
    if not s or len(s) < 6:
        return s
    try:
        return f"{s[:4]}년 {int(s[4:6])}월"
    except Exception:
        return s


# ── Phase 1: ka10001 즉시 ─────────────────────────────────────────────────────

def get_stock_overview(ticker: str, market: str) -> dict:
    """Phase 1 — ka10001 + DART company.json. 빠름 (~1~2초)."""
    cache_key = f"study_overview:{ticker}"
    cached = cache_service.get(cache_key)
    if cached and _fresh(cached[1]):
        return {**cached[0], "cachedAt": cached[1]}

    provider = get_provider()

    # ka10001
    raw: dict = {}
    if isinstance(provider, KiwoomClient):
        try:
            raw = provider.get_stock_info_full(ticker) or {}
        except Exception as e:
            logger.debug("ka10001 %s 실패: %s", ticker, e)

    def fv(key: str, *alts: str) -> float | None:
        for k in (key, *alts):
            v = _to_float(raw.get(k))
            if v is not None:
                return v
        return None

    # 현재가 (±부호 제거)
    cur_prc = _to_float(str(raw.get("cur_prc", "")).lstrip("+-"))
    sale_amt = fv("sale_amt")
    bus_pro = fv("bus_pro")
    op_margin: float | None = None
    if sale_amt and sale_amt > 0 and bus_pro is not None:
        op_margin = round(bus_pro / sale_amt * 100, 2)

    valuation = {
        "curPrc": cur_prc,
        "mac": fv("mac"),
        "per": fv("per"),
        "pbr": fv("pbr"),
        "roe": fv("roe"),
        "eps": fv("eps"),
        "bps": fv("bps"),
        "ev": fv("ev"),
        "forExhRt": _to_float(str(raw.get("for_exh_rt", "")).lstrip("+-")),
        "opMargin": op_margin,
        "saleAmt": sale_amt,
        "busPro": bus_pro,
        "oyrHgst": _to_float(str(raw.get("oyr_hgst", "")).lstrip("+-")),
        "oyrLwst": _to_float(str(raw.get("oyr_lwst", "")).lstrip("+-")),
    }

    # DART company.json
    corp_info: dict = {}
    company = dart_client.get_company_info(ticker)
    if company:
        code = (company.get("induty_code") or "").strip()
        corp_info = {
            "corpNameEng": company.get("corp_name_eng") or "",
            "ceoNm": company.get("ceo_nm") or "",
            "indutyCode": code,
            "indutyName": ksic_name(code),
            "estDt": _fmt_est_dt(company.get("est_dt") or ""),
            "hmUrl": company.get("hm_url") or "",
            "accMt": company.get("acc_mt") or "",
        }

    result = {
        "ticker": ticker,
        "market": market,
        "corpInfo": corp_info,
        "valuation": valuation,
        "available": bool(raw),
        "neutralNote": _NEUTRAL_NOTE,
        "disclaimer": _DISCLAIMER,
    }
    cache_service.put(cache_key, result)
    return {**result, "cachedAt": cache_service._now()}


# ── Phase 2: DART 재무 3년 (lazy) ────────────────────────────────────────────

def get_stock_financials(ticker: str, market: str) -> dict:
    """Phase 2 — DART 재무 3년. 느림 (5~15초). 별도 lazy 요청."""
    cache_key = f"study_financials:{ticker}"
    cached = cache_service.get(cache_key)
    if cached and _fresh(cached[1]):
        return {**cached[0], "cachedAt": cached[1]}

    years_raw = dart_client.get_financials_for_study(ticker, num_years=3)
    if not years_raw:
        result = {
            "ticker": ticker,
            "available": False,
            "years": [],
            "latestDebtRatio": None,
            "note": "DART 재무 데이터 미확보 (미상장·corp_code 없음·API 키 미설정 중 하나)",
            "neutralNote": _NEUTRAL_NOTE,
            "disclaimer": _DISCLAIMER,
        }
        cache_service.put(cache_key, result)
        return {**result, "cachedAt": cache_service._now()}

    years = []
    for row in years_raw:
        rev = row.get("revenue")
        op = row.get("operating_income")
        liab = row.get("total_liabilities")
        eq = row.get("total_equity")
        debt_ratio: float | None = None
        if liab is not None and eq and eq > 0:
            debt_ratio = round(liab / eq * 100, 1)
        years.append({
            "year": row["year"],
            "revenue": rev,
            "opIncome": op,
            "debtRatio": debt_ratio,
        })

    # YoY 변화율 (최신→이전 순서 기준)
    for i, y in enumerate(years):
        if i < len(years) - 1:
            prev = years[i + 1]
            for field in ("revenue", "opIncome"):
                cur_v = y.get(field)
                prev_v = prev.get(field)
                if cur_v and prev_v and prev_v != 0:
                    y[f"{field}Yoy"] = round((cur_v - prev_v) / abs(prev_v) * 100, 1)
                else:
                    y[f"{field}Yoy"] = None

    latest_debt = next(
        (y["debtRatio"] for y in years if y.get("debtRatio") is not None), None
    )

    result = {
        "ticker": ticker,
        "available": True,
        "years": years,
        "latestDebtRatio": latest_debt,
        "neutralNote": _NEUTRAL_NOTE,
        "disclaimer": _DISCLAIMER,
    }
    cache_service.put(cache_key, result)
    return {**result, "cachedAt": cache_service._now()}
