"""DART(금융감독원 전자공시) 클라이언트 — Phase 3b health 점수.

health = 0.4·수익성 + 0.3·안정성 + 0.3·성장성  (N/A 재정규화)
성장의 실효비중 = health(50%) × 성장(30%) = 15%  ← CLAUDE.md §6 성장 상한 준수

사용 전 선결:
  1. opendart.fss.or.kr 가입 → API 키 발급 (무료)
  2. .env 에 DART_API_KEY=<발급키> 추가
  3. 첫 실행 시 corpCode.xml 자동 다운로드 → data/corp_codes.json 캐시

DART_API_KEY 없으면 모든 메서드가 {} 또는 None 반환 (서버 정상 구동 유지).
"""
import json
import logging
import math
import zipfile
from io import BytesIO
from pathlib import Path

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_DART_BASE = "https://opendart.fss.or.kr/api"
_CORP_CODES_PATH = Path(__file__).parents[2] / "data" / "corp_codes.json"
_INDUTY_CODES_PATH = Path(__file__).parents[2] / "data" / "induty_codes.json"

_ticker_map: dict[str, str] = {}
_map_loaded = False

_induty_cache: dict[str, str] = {}
_induty_loaded = False


def _corp_codes_available() -> bool:
    return bool(settings.dart_api_key)


def _load_ticker_map() -> None:
    global _ticker_map, _map_loaded
    if _map_loaded:
        return
    if _CORP_CODES_PATH.exists():
        try:
            with open(_CORP_CODES_PATH, encoding="utf-8") as f:
                _ticker_map = json.load(f)
            logger.info("corp_code 맵 로드: %d 종목", len(_ticker_map))
        except Exception as e:
            logger.warning("corp_codes.json 로드 실패: %s", e)
    _map_loaded = True


def update_corp_code_cache() -> int:
    global _ticker_map, _map_loaded
    if not settings.dart_api_key:
        logger.error("DART_API_KEY 미설정 — corp_code 캐시 갱신 불가")
        return 0
    try:
        resp = httpx.get(
            f"{_DART_BASE}/corpCode.xml",
            params={"crtfc_key": settings.dart_api_key},
            timeout=30,
        )
        resp.raise_for_status()
        with zipfile.ZipFile(BytesIO(resp.content)) as zf:
            xml_name = next(n for n in zf.namelist() if n.lower().endswith(".xml"))
            xml_bytes = zf.read(xml_name)

        import xml.etree.ElementTree as ET
        root = ET.fromstring(xml_bytes)
        mapping: dict[str, str] = {}
        for corp in root.findall("list"):
            stock_code = (corp.findtext("stock_code") or "").strip()
            corp_code = (corp.findtext("corp_code") or "").strip()
            if stock_code and corp_code:
                mapping[stock_code] = corp_code

        _CORP_CODES_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(_CORP_CODES_PATH, "w", encoding="utf-8") as f:
            json.dump(mapping, f, ensure_ascii=False)

        _ticker_map = mapping
        _map_loaded = True
        logger.info("corp_code 캐시 갱신 완료: %d 종목", len(mapping))
        return len(mapping)
    except Exception as e:
        logger.error("corp_code 캐시 갱신 실패: %s", e)
        return 0


def get_corp_code(ticker: str) -> str | None:
    _load_ticker_map()
    return _ticker_map.get(ticker)


# ── KSIC 업종코드 (테마 B레이어 매칭용) ─────────────────────────────────────────

def _load_induty_cache() -> None:
    global _induty_cache, _induty_loaded
    if _induty_loaded:
        return
    if _INDUTY_CODES_PATH.exists():
        try:
            with open(_INDUTY_CODES_PATH, encoding="utf-8") as f:
                _induty_cache = json.load(f)
            logger.info("induty_code 캐시 로드: %d 종목", len(_induty_cache))
        except Exception as e:
            logger.warning("induty_codes.json 로드 실패: %s", e)
    _induty_loaded = True


def _save_induty_cache() -> None:
    try:
        _INDUTY_CODES_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(_INDUTY_CODES_PATH, "w", encoding="utf-8") as f:
            json.dump(_induty_cache, f, ensure_ascii=False)
    except Exception as e:
        logger.warning("induty_codes.json 저장 실패: %s", e)


def get_induty_codes(tickers: list[str]) -> dict[str, str | None]:
    """ticker 목록 → KSIC 업종코드(induty_code). 캐시 우선, 미스만 DART 조회.

    DART company.json 의 induty_code 는 거의 변하지 않으므로 파일 캐싱(반복 콜 0).
    DART_API_KEY 없으면 모두 None. 조회 실패(None)는 캐싱 안 함(다음에 재시도).
    """
    if not settings.dart_api_key:
        return {t: None for t in tickers}

    _load_ticker_map()
    _load_induty_cache()

    result: dict[str, str | None] = {}
    dirty = False
    for ticker in tickers:
        if ticker in _induty_cache:
            result[ticker] = _induty_cache[ticker]
            continue
        corp_code = _ticker_map.get(ticker)
        if not corp_code:
            result[ticker] = None
            continue
        code = _fetch_induty_code(corp_code)
        result[ticker] = code
        if code:  # 성공한 코드만 캐싱 (실패=네트워크 이슈 → 재시도 여지)
            _induty_cache[ticker] = code
            dirty = True
    if dirty:
        _save_induty_cache()
    return result


def _fetch_induty_code(corp_code: str) -> str | None:
    """DART company.json → induty_code(KSIC 기반 업종코드). 실패 시 None."""
    try:
        resp = httpx.get(
            f"{_DART_BASE}/company.json",
            params={"crtfc_key": settings.dart_api_key, "corp_code": corp_code},
            timeout=10,
        )
        data = resp.json()
        if data.get("status") != "000":
            return None
        code = (data.get("induty_code") or "").strip()
        return code or None
    except Exception as e:
        logger.debug("induty_code 조회 실패 %s: %s", corp_code, e)
        return None


# ── 점수 계산 ─────────────────────────────────────────────────────────────────

def get_financial_scores(tickers: list[str]) -> dict[str, float | None]:
    """ticker 목록 → health 서브점수(0~100).

    health = 0.4·수익성(영업이익률) + 0.3·안정성(부채비율) + 0.3·성장성(YoY)
    N/A 항목은 가중치 재정규화. DART_API_KEY 없으면 모두 None.
    """
    if not settings.dart_api_key:
        logger.info("DART_API_KEY 미설정 — health 점수 모두 None (가중치 재정규화됨)")
        return {t: None for t in tickers}

    _load_ticker_map()
    if not _ticker_map:
        logger.warning("corp_code 맵 없음 — /api/admin/dart/update 호출 필요")
        return {t: None for t in tickers}

    scores: dict[str, float | None] = {}
    for ticker in tickers:
        corp_code = _ticker_map.get(ticker)
        if not corp_code:
            scores[ticker] = None
            continue
        scores[ticker] = _fetch_health(ticker, corp_code)
    return scores


def _fetch_health(ticker: str, corp_code: str) -> float | None:
    """단일 종목 health 점수 계산. 실패 시 None."""
    try:
        cur = _fetch_financials(corp_code, year_offset=0)
        if cur is None:
            cur = _fetch_financials(corp_code, year_offset=1)
            prev = _fetch_financials(corp_code, year_offset=2)
        else:
            prev = _fetch_financials(corp_code, year_offset=1)
        if not cur or not prev:
            return None

        profit_s = _profitability_score(cur.get("operating_income", 0), cur.get("revenue", 0))
        stable_s = _stability_score(cur.get("total_liabilities"), cur.get("total_equity"))
        growth_s = _growth_score(cur, prev)

        return _weighted_health(profit_s, stable_s, growth_s)

    except Exception as e:
        logger.debug("health 점수 계산 실패 %s: %s", ticker, e)
        return None


def _profitability_score(op_income: int, revenue: int) -> float | None:
    """영업이익률 → 0~100. revenue=0 이면 None."""
    if revenue <= 0:
        return None
    margin = op_income / revenue
    return 50.0 + 40.0 * math.tanh(margin / 0.10)


def _stability_score(total_liabilities: int | None, total_equity: int | None) -> float | None:
    """부채비율(부채/자본) → 0~100. 낮을수록 높음. 자본=0 이면 None."""
    if total_liabilities is None or total_equity is None or total_equity <= 0:
        return None
    debt_ratio = total_liabilities / total_equity
    return 50.0 + 40.0 * math.tanh((1.5 - debt_ratio) / 1.5)


def _growth_score(cur: dict, prev: dict) -> float:
    """매출·영업이익 YoY 성장 → 0~100. 성장성 단독 점수."""
    rev_s = _growth_to_score(cur.get("revenue", 0), prev.get("revenue", 0))
    op_s = _growth_to_score(cur.get("operating_income", 0), prev.get("operating_income", 0))
    op_cur = cur.get("operating_income", 0)
    op_prev = prev.get("operating_income", 0)
    profit_continuity = (
        90.0 if op_cur > 0 and op_prev > 0
        else 70.0 if op_cur > 0 and op_prev <= 0
        else 30.0 if op_cur <= 0 and op_prev > 0
        else 15.0
    )
    return 0.4 * rev_s + 0.4 * op_s + 0.2 * profit_continuity


def _weighted_health(
    profitability: float | None,
    stability: float | None,
    growth: float | None,
) -> float | None:
    """health = 0.4·수익성 + 0.3·안정성 + 0.3·성장성 (N/A 재정규화)."""
    vals = {"p": profitability, "s": stability, "g": growth}
    weights = {"p": 40.0, "s": 30.0, "g": 30.0}
    avail = {k: v for k, v in vals.items() if v is not None}
    if not avail:
        return None
    total_w = sum(weights[k] for k in avail)
    return sum(weights[k] / total_w * avail[k] for k in avail)


def _fetch_financials(corp_code: str, year_offset: int = 0) -> dict | None:
    """DART fnlttSinglAcntAll → revenue, operating_income, total_liabilities, total_equity."""
    from datetime import date
    year = str(date.today().year - year_offset)
    for fs_div in ("CFS", "OFS"):
        try:
            resp = httpx.get(
                f"{_DART_BASE}/fnlttSinglAcntAll.json",
                params={
                    "crtfc_key": settings.dart_api_key,
                    "corp_code": corp_code,
                    "bsns_year": year,
                    "reprt_code": "11011",
                    "fs_div": fs_div,
                },
                timeout=10,
            )
            data = resp.json()
            if data.get("status") != "000":
                continue

            items = data.get("list", [])
            revenue = _find_account(items, ["매출액", "수익(매출액)", "영업수익"])
            op_income = _find_account(items, ["영업이익", "영업이익(손실)"])
            total_liabilities = _find_account(items, ["부채총계"])
            total_equity = _find_account(items, ["자본총계", "자본 총계"])

            if revenue is not None:
                return {
                    "revenue": revenue,
                    "operating_income": op_income or 0,
                    "total_liabilities": total_liabilities,
                    "total_equity": total_equity,
                }
        except Exception:
            continue
    return None


def _find_account(items: list[dict], names: list[str]) -> int | None:
    for item in items:
        acnt = item.get("account_nm", "")
        if any(n in acnt for n in names):
            val_str = str(item.get("thstrm_amount", "")).replace(",", "").strip()
            try:
                return int(val_str)
            except ValueError:
                return None
    return None


def _growth_to_score(cur: int, prev: int) -> float:
    if prev == 0:
        return 50.0
    rate = (cur - prev) / abs(prev)
    return 50.0 + 40.0 * math.tanh(rate / 0.5)
