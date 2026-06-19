"""키움 REST 클라이언트 — Phase 2 실구현.

CLAUDE.md 하드룰 §4:
  - 앱키·시크릿은 .env 저장, config.settings 로만 접근.
  - 키는 절대 로깅·응답에 포함하지 않는다.
  - 데이터 접근은 DataProvider 인터페이스로 추상화 (mock → kiwoom 무손실 교체).
"""
import json
import logging
import math
import time
from pathlib import Path

import httpx

from app.config import settings
from app.data.provider import DataProvider

_THEMES_PATH = Path(__file__).parents[2] / "themes.json"

logger = logging.getLogger(__name__)

KIWOOM_BASE = "https://api.kiwoom.com"           # 실전
KIWOOM_MOCK_BASE = "https://mockapi.kiwoom.com"  # 모의투자
_TOKEN_BUFFER_SEC = 300  # 만료 5분 전 갱신


class KiwoomClient(DataProvider):
    """키움 REST API 클라이언트. 토큰 자동 갱신 포함."""

    def __init__(self, use_mock: bool = False) -> None:
        if not settings.kiwoom_app_key or not settings.kiwoom_app_secret:
            raise EnvironmentError(
                "KIWOOM_APP_KEY / KIWOOM_APP_SECRET 가 .env 에 설정되지 않았습니다. "
                ".env.example 참고."
            )
        self._base = KIWOOM_MOCK_BASE if use_mock else KIWOOM_BASE
        self._token: str = ""
        self._expires_at: float = 0.0
        # 테마 인덱스 캐시 (일 1회 갱신 — rate limit 회피)
        self._theme_cache: dict[str, list[str]] = {}
        self._theme_cache_expires: float = 0.0
        self._issue_token()

    # ── 토큰 ─────────────────────────────────────────────────────────────────

    @property
    def token_ok(self) -> bool:
        """현재 토큰이 유효한지 여부 (health check 용)."""
        return bool(self._token) and time.monotonic() < self._expires_at

    def _issue_token(self) -> None:
        """앱키·시크릿으로 액세스 토큰 발급. 키는 로깅하지 않는다."""
        try:
            resp = httpx.post(
                f"{self._base}/oauth2/token",
                json={
                    "grant_type": "client_credentials",
                    "appkey": settings.kiwoom_app_key,
                    "secretkey": settings.kiwoom_app_secret,  # 키움 비표준 파라미터명
                },
                headers={"Content-Type": "application/json;charset=UTF-8"},
                timeout=10,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"키움 토큰 발급 실패 — HTTP {e.response.status_code}: {e.response.text}"
            ) from e
        except httpx.RequestError as e:
            raise RuntimeError(f"키움 서버 연결 실패: {e}") from e

        data = resp.json()
        # 키움 응답 필드명은 "token" (표준 OAuth2의 "access_token" 아님)
        self._token = data.get("token") or data.get("access_token") or ""
        if not self._token:
            raise RuntimeError(f"토큰 필드 없음 — 응답: {data}")
        expires_in = int(data.get("expires_in", 86400))
        self._expires_at = time.monotonic() + expires_in - _TOKEN_BUFFER_SEC
        logger.info("키움 토큰 발급 완료 (유효 %ds)", expires_in)

    def _auth_headers(self) -> dict:
        """유효한 Bearer 토큰 헤더 반환. 만료 임박 시 자동 갱신."""
        if time.monotonic() >= self._expires_at:
            logger.info("키움 토큰 갱신 중")
            self._issue_token()
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json;charset=UTF-8",
        }

    def _call_acnt(self, api_id: str, body: dict) -> list[dict]:
        """계좌 API 공통 호출 — 페이지네이션 자동 처리.

        POST /api/dostk/acnt
        api-id 는 요청 헤더로 전달. 연속조회(cont-yn/next-key) 반복.
        반환: 응답 JSON에서 추출한 항목 리스트 (전 페이지 합산).
        """
        all_items: list[dict] = []
        cont_yn = "N"
        next_key = ""

        while True:
            try:
                resp = httpx.post(
                    f"{self._base}/api/dostk/acnt",
                    json=body,
                    headers={
                        **self._auth_headers(),
                        "api-id": api_id,
                        "cont-yn": cont_yn,
                        "next-key": next_key,
                    },
                    timeout=10,
                )
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise RuntimeError(
                    f"키움 {api_id} 실패 — HTTP {e.response.status_code}: {e.response.text}"
                ) from e

            data = resp.json()
            logger.debug("%s 응답 최상위 키: %s", api_id, list(data.keys()))

            rc = data.get("return_code", 0)
            msg = data.get("return_msg", "")
            if rc != 0:
                # "관련자료가없습니다" (501724) → 정상 빈 결과, 에러 아님
                if "관련자료가없습니다" in msg or "501724" in msg:
                    logger.info("%s 조회 결과 없음 (빈 리스트 반환)", api_id)
                    break
                raise RuntimeError(f"키움 {api_id} 오류 (return_code={rc}): {msg}")

            items = (
                data.get("acnt_evlt_remn_indv_tot")   # kt00018 잔고
                or data.get("acnt_ccls_indv_tot")      # kt00009 체결내역
                or data.get("dt_stk_rlzt_pl")          # ka10073 기간별실현손익
                or data.get("output1")
                or data.get("output")
                or data.get("data")
                or []
            )
            if isinstance(items, list):
                all_items.extend(items)

            # 연속조회: 응답 헤더 cont-yn = "Y" 이면 다음 페이지 존재
            if resp.headers.get("cont-yn") == "Y":
                cont_yn = "Y"
                next_key = resp.headers.get("next-key", "")
            else:
                break

        return all_items

    def _call_acnt_raw(self, api_id: str, body: dict) -> dict:
        """계좌 API 단건 호출 — 최상위 응답 dict 반환 (요약 필드용, 페이지네이션 없음)."""
        resp = httpx.post(
            f"{self._base}/api/dostk/acnt",
            json=body,
            headers={
                **self._auth_headers(),
                "api-id": api_id,
                "cont-yn": "N",
                "next-key": "",
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()

    # ── 범용 단건 API 호출 ───────────────────────────────────────────────────

    def _call_api(self, path: str, api_id: str, body: dict) -> dict:
        """단건 API 호출 (페이지네이션 없음). 테마·투자자 데이터용."""
        try:
            resp = httpx.post(
                f"{self._base}{path}",
                json=body,
                headers={
                    **self._auth_headers(),
                    "api-id": api_id,
                    "cont-yn": "N",
                    "next-key": "",
                },
                timeout=10,
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"키움 {api_id} 실패 — HTTP {e.response.status_code}: {e.response.text}"
            ) from e
        except httpx.RequestError as e:
            raise RuntimeError(f"키움 {api_id} 연결 실패: {e}") from e

    # ── DataProvider 인터페이스 ───────────────────────────────────────────────

    def is_market_available(self, market: str) -> bool:
        return market == "KR"  # v2 에서 US 추가

    def get_holdings(self, market: str) -> list[dict]:
        """kt00018 계좌평가잔고내역 → DataProvider 계약 dict 로 정규화.

        반환 필드: ticker, name, qty, avg_price, current_price
        current_price = 평가금액 / 수량 (키움이 별도 현재가 필드 미제공 시)
        """
        if market != "KR":
            return []

        raw = self._call_acnt(
            api_id="kt00018",
            body={"qry_tp": "1", "dmst_stex_tp": "NXT"},  # NXT = 유효값 확인됨 (KRX 불가)
        )

        holdings = []
        for item in raw:
            qty = _to_int(item.get("rmnd_qty", 0))
            if qty <= 0:
                continue

            avg_price = _to_int(item.get("pur_pric", 0))
            cur_price = _to_int(item.get("cur_prc", 0))
            eval_amt = _to_int(item.get("evlt_amt", 0))
            if cur_price == 0 and qty > 0:
                cur_price = eval_amt // qty

            # 키움은 종목코드 앞에 "A" 접두사 붙임 → 표준 6자리 코드로 변환
            ticker_raw = str(item.get("stk_cd", "")).strip()
            ticker = ticker_raw[1:] if ticker_raw.startswith("A") else ticker_raw

            holdings.append({
                "ticker": ticker,
                "name": str(item.get("stk_nm", "")).strip(),
                "qty": qty,
                "avg_price": avg_price,
                "current_price": cur_price,
            })

        logger.info("kt00018 잔고 %d 종목 로드", len(holdings))
        return holdings

    def get_trades(self, market: str) -> list[dict]:
        """kt00009 계좌체결내역 — 최근 2개월. 그 이전은 CSV 임포트(Step 4)로 보완."""
        if market != "KR":
            return []
        from datetime import date, timedelta
        today = date.today()
        strt_dt = (today - timedelta(days=60)).strftime("%Y%m%d")
        end_dt = today.strftime("%Y%m%d")

        raw = self._call_acnt(
            api_id="kt00009",
            body={
                "qry_tp": "1",
                "strt_dt": strt_dt,
                "end_dt": end_dt,
                "dmst_stex_tp": "NXT",
                "stk_bond_tp": "1",
                "mrkt_tp": "0",
                "sell_tp": "0",
            },
        )

        trades = []
        for item in raw:
            ticker_raw = str(item.get("stk_cd", "")).strip()
            ticker = ticker_raw[1:] if ticker_raw.startswith("A") else ticker_raw

            # 매매구분: 키움 필드값 → "BUY" | "SELL"
            side_raw = str(item.get("sell_tp", item.get("buy_sell_tp", ""))).strip()
            if side_raw in ("1", "매수"):
                side = "BUY"
            elif side_raw in ("2", "매도"):
                side = "SELL"
            else:
                logger.warning("kt00009 알 수 없는 매매구분: %s, 종목: %s", side_raw, ticker)
                continue

            # 체결일: YYYYMMDD → YYYY-MM-DD
            raw_date = str(item.get("ccls_dt", item.get("trde_dt", ""))).strip()
            if len(raw_date) == 8:
                date_str = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
            else:
                date_str = raw_date

            trades.append({
                "date": date_str,
                "ticker": ticker,
                "name": str(item.get("stk_nm", "")).strip(),
                "side": side,
                "qty": _to_int(item.get("ccls_qty", item.get("trde_qty", 0))),
                "price": _to_int(item.get("ccls_pric", item.get("trde_pric", 0))),
            })

        logger.info("kt00009 체결내역 %d 건 로드 (%s~%s)", len(trades), strt_dt, end_dt)
        return trades

    def get_realized_pnl(self, market: str, days: int = 88) -> list[dict]:
        """ka10073 기간별실현손익 — 최근 N일. API 제한: 종료일 기준 3개월(≈90일) 이내.
        매도 없으면 빈 리스트."""
        if market != "KR":
            return []
        from datetime import date, timedelta
        today = date.today()
        strt_dt = (today - timedelta(days=min(days, 88))).strftime("%Y%m%d")
        end_dt = today.strftime("%Y%m%d")

        raw = self._call_acnt(
            api_id="ka10073",
            body={"strt_dt": strt_dt, "end_dt": end_dt, "dmst_stex_tp": "NXT"},
        )

        # 실제 응답 필드(2026-06 확인):
        #   dt=거래일, stk_cd=종목코드, stk_nm=종목명,
        #   cntr_qty=체결수량, cntr_pric=체결가(매도가), buy_uv=매수단가,
        #   tdy_sel_pl=실현손익, pl_rt=수익률("+12.05" 형식)
        result = []
        for item in raw:
            ticker_raw = str(item.get("stk_cd", "")).strip()
            ticker = ticker_raw[1:] if ticker_raw.startswith("A") else ticker_raw
            pl_rt_str = str(item.get("pl_rt", "0")).replace(",", "").replace("+", "").strip()
            try:
                return_rate = float(pl_rt_str or "0")
            except ValueError:
                return_rate = 0.0
            result.append({
                "date": str(item.get("dt", "")).strip(),
                "ticker": ticker,
                "name": str(item.get("stk_nm", "")).strip(),
                "realizedPnl": _to_int(item.get("tdy_sel_pl", 0)),
                "returnRate": return_rate,
                "sellQty": _to_int(item.get("cntr_qty", 0)),
                "sellPrice": _to_int(item.get("cntr_pric", 0)),
                "buyPrice": _to_int(item.get("buy_uv", 0)),
            })
        logger.info("ka10073 실현손익 %d 건 (%s~%s)", len(result), strt_dt, end_dt)
        return result

    def get_dividends(self, market: str) -> list[dict]:
        # Step 4 에서 CSV 임포트로 구현. 지금은 빈 리스트 → 배당 수확 0원 상태.
        return []

    def get_account_summary(self, market: str) -> dict | None:
        """kt00018(총매입·평가) + kt00001(예수금 entr) → 계좌 요약.

        cash = kt00001 'entr'(예수금). 두 API 정합성 미확정이라 잠정값으로 표기.
        실패 시 None (프론트는 카드 숨김). 점수 로직과 무관.
        """
        if market != "KR":
            return None
        try:
            summary = self._call_acnt_raw(
                "kt00018", {"qry_tp": "1", "dmst_stex_tp": "NXT"}
            )
            total_purchase = _to_int(summary.get("tot_pur_amt", 0))
            total_eval = _to_int(summary.get("tot_evlt_amt", 0))

            cash_resp = self._call_acnt_raw("kt00001", {"qry_tp": "2"})
            cash = _to_int(cash_resp.get("entr", 0))  # 예수금 (잠정)

            return {
                "totalPurchase": total_purchase,
                "totalEval": total_eval,
                "cash": cash,
                "cashProvisional": True,  # 키움 앱 표시값과 대조 전
            }
        except Exception as e:
            logger.warning("계좌 요약(kt00018/kt00001) 조회 실패: %s", e)
            return None

    def get_fundamentals(self, tickers: list[str], market: str) -> dict[str, dict]:
        """ka10001 주식기본정보 → ticker: {"mac": int, "trde_qty": int}.

        mac = 시가총액(원), trde_qty = 거래대금(원).
        trust 축 계산용. 필드 미확보 시 {} 반환 → trust 점수 None → 가중치 재정규화.

        경로: POST /api/dostk/stkinfo, api-id: ka10001, body: {"stk_cd": "066570"}
        """
        if market != "KR" or not tickers:
            return {}

        result: dict[str, dict] = {}
        for ticker in tickers:
            try:
                raw = self._call_api(
                    "/api/dostk/stkinfo",
                    "ka10001",
                    {"stk_cd": ticker},
                )
                logger.debug("ka10001 %s 전체 키: %s", ticker, list(raw.keys()))

                # 응답이 output/data 중첩일 수 있으므로 방어적 탐색
                data: dict = raw
                for sub_key in ("output", "data", "output1"):
                    if sub_key in raw and isinstance(raw[sub_key], dict):
                        data = raw[sub_key]
                        break

                # 시가총액 — 후보 필드명 순서대로 시도
                mac = (
                    _to_int(data.get("mac"))
                    or _to_int(data.get("mac_amt"))
                    or _to_int(data.get("mkt_cap"))
                    or _to_int(data.get("mkt_cap_amt"))
                    or _to_int(data.get("cap"))
                    or 0
                )
                # 거래대금 — 후보 필드명 순서대로 시도
                trde_qty = (
                    _to_int(data.get("trde_prica"))
                    or _to_int(data.get("acc_trde_prica"))
                    or _to_int(data.get("trde_qty"))
                    or _to_int(data.get("acc_trde_qty"))
                    or _to_int(data.get("vol"))
                    or 0
                )

                if mac > 0 or trde_qty > 0:
                    result[ticker] = {"mac": mac, "trde_qty": trde_qty}
                    logger.debug("ka10001 %s mac=%d trde_qty=%d", ticker, mac, trde_qty)
                else:
                    logger.debug("ka10001 %s — mac/trde_qty 필드 미확인 (전체: %s)", ticker, data)

            except Exception as e:
                logger.debug("ka10001 %s 실패 (trust 점수 제외): %s", ticker, e)

        logger.info("ka10001 펀더멘털 %d/%d 종목 확보", len(result), len(tickers))
        return result

    def get_theme_index(self, market: str) -> dict[str, list[str]]:
        """ka90001(테마그룹) + ka90002(구성종목) → ticker → [테마명, ...].

        themes.json 키워드와 매칭되는 그룹만 조회 (rate limit 절약).
        캐시: 24시간. 실패 시 빈 dict 반환 (theme=0 처리, 감점 아님).

        ⚠ v1 알려진 한계: /api/dostk/thema 경로에서 ka90001이 1504 응답.
           키움 REST 테마 API 경로 미확인 — 실패 시 빈 dict 폴백, theme=0 처리.
           theme=0 은 "성장테마 미확인"이며 스코어링 로직에서 정규화됨.
        """
        if market != "KR":
            return {}

        now = time.monotonic()
        if now < self._theme_cache_expires and self._theme_cache:
            return self._theme_cache

        try:
            keywords = _load_all_theme_keywords()
            if not keywords:
                return {}

            # 테마그룹 목록
            raw = self._call_api("/api/dostk/thema", "ka90001", {})
            groups = (
                raw.get("thema_grp_list")
                or raw.get("thema_grp")
                or raw.get("output")
                or []
            )

            index: dict[str, list[str]] = {}
            for grp in groups:
                theme_nm = str(grp.get("thema_nm") or grp.get("name") or "")
                # 우리 키워드와 매칭되는 그룹만 조회 (rate limit 절약)
                if not any(kw in theme_nm for kw in keywords):
                    continue

                grp_code = str(grp.get("thema_cd") or grp.get("code") or "").strip()
                if not grp_code:
                    continue

                stocks_raw = self._call_api(
                    "/api/dostk/thema", "ka90002", {"thema_cd": grp_code}
                )
                stocks = (
                    stocks_raw.get("thema_stk_list")
                    or stocks_raw.get("thema_stk")
                    or stocks_raw.get("output")
                    or []
                )
                for s in stocks:
                    ticker_raw = str(s.get("stk_cd") or s.get("code") or "").strip()
                    ticker = ticker_raw[1:] if ticker_raw.startswith("A") else ticker_raw
                    if ticker:
                        index.setdefault(ticker, []).append(theme_nm)

            self._theme_cache = index
            self._theme_cache_expires = now + 86400  # 24시간
            logger.info("테마 인덱스 구축: %d 종목", len(index))
            return index

        except Exception as e:
            logger.warning("테마 인덱스 구축 실패 (빈 dict 반환): %s", e)
            return {}

    def get_supply_scores(
        self, tickers: list[str], market: str, days: int = 20
    ) -> dict[str, float]:
        """ka10059 종목별투자자기관별: 최근 N일 외인+기관 순매수비율 → 0~100.

        경로: /api/dostk/stkinfo
        파라미터: stk_cd, dt(기준일), amt_qty_tp=1(금액), trde_tp=0(전체), unit_tp=1
        응답: stk_invsr_orgn 배열, 각 행 → frgnr_invsr(외국인), orgn(기관), acc_trde_prica(거래대금)

        스코어링: 20일 평균 (외인+기관 순매수) / 총거래대금 비율 → tanh 정규화.
        비율 기반이라 대형주/소형주 스케일 중립.
        """
        if market != "KR" or not tickers:
            return {}

        from datetime import date
        today = date.today().strftime("%Y%m%d")

        scores: dict[str, float] = {}
        for ticker in tickers:
            try:
                raw = self._call_api(
                    "/api/dostk/stkinfo",
                    "ka10059",
                    {
                        "stk_cd": ticker,
                        "dt": today,
                        "amt_qty_tp": "1",  # 금액
                        "trde_tp": "0",     # 전체(매수+매도 합산 순)
                        "unit_tp": "1",     # 단위
                    },
                )
                items: list[dict] = raw.get("stk_invsr_orgn") or []
                items = items[:days]  # 최근 N일만 사용

                ratios: list[float] = []
                for item in items:
                    total = _to_int(item.get("acc_trde_prica", 0))
                    if total <= 0:
                        continue
                    foreign = _to_int(item.get("frgnr_invsr", 0))
                    inst = _to_int(item.get("orgn", 0))
                    ratios.append((foreign + inst) / total)

                if ratios:
                    avg_ratio = sum(ratios) / len(ratios)
                    scores[ticker] = _net_buy_ratio_to_score(avg_ratio)

            except Exception as e:
                logger.debug("ka10059 %s 실패 (수급 점수 제외): %s", ticker, e)

        return scores

    def get_today_net_buy(self, tickers: list[str]) -> dict[str, dict]:
        """ka10059 최신 영업일 외인·기관 순매수 금액(원). {ticker:{foreign,inst}}.

        get_supply_scores 와 같은 API(ka10059) 재활용 — 홈 '오늘의 수급 한 줄'용.
        items[0] = 최신일. 실패 종목은 결과에서 제외.
        """
        from datetime import date

        today = date.today().strftime("%Y%m%d")
        out: dict[str, dict] = {}
        for ticker in tickers:
            try:
                raw = self._call_api(
                    "/api/dostk/stkinfo",
                    "ka10059",
                    {
                        "stk_cd": ticker,
                        "dt": today,
                        "amt_qty_tp": "1",
                        "trde_tp": "0",
                        "unit_tp": "1",
                    },
                )
                items: list[dict] = raw.get("stk_invsr_orgn") or []
                if not items:
                    continue
                row = items[0]  # 최신 영업일
                out[ticker] = {
                    "foreign": _to_int(row.get("frgnr_invsr", 0)),
                    "inst": _to_int(row.get("orgn", 0)),
                }
            except Exception as e:  # noqa: BLE001
                logger.debug("ka10059 today %s 실패: %s", ticker, e)
        return out

    # ── 디버그 (실계좌 응답 구조 확인용) ─────────────────────────────────────

    def raw_ka10073(self, strt_dt: str, end_dt: str) -> dict:
        """ka10073 기간별실현손익 원시 응답 — /api/debug/kiwoom/ka10073 에서 호출."""
        body = {"strt_dt": strt_dt, "end_dt": end_dt, "dmst_stex_tp": "NXT"}
        try:
            resp = httpx.post(
                f"{self._base}/api/dostk/acnt",
                json=body,
                headers={
                    **self._auth_headers(),
                    "api-id": "ka10073",
                    "cont-yn": "N",
                    "next-key": "",
                },
                timeout=10,
            )
            return {
                "tried_body": body,
                "status_code": resp.status_code,
                "resp_headers": dict(resp.headers),
                "body": resp.json(),
            }
        except Exception as e:
            return {"error": str(e)}

    def raw_kt00009(self, strt_dt: str, end_dt: str, dmst_stex_tp: str = "NXT") -> dict:
        """kt00009 체결내역 원시 응답 — /api/debug/kiwoom/kt00009 에서 호출."""
        try:
            resp = httpx.post(
                f"{self._base}/api/dostk/acnt",
                json={
                    "qry_tp": "1",       # 1=전체
                    "strt_dt": strt_dt,
                    "end_dt": end_dt,
                    "dmst_stex_tp": dmst_stex_tp,
                    "stk_bond_tp": "1",  # 1=주식, 2=채권
                    "mrkt_tp": "0",      # 0=전체, 1=KOSPI, 2=KOSDAQ
                    "sell_tp": "0",      # 0=전체, 1=매수, 2=매도
                },
                headers={
                    **self._auth_headers(),
                    "api-id": "kt00009",
                    "cont-yn": "N",
                    "next-key": "",
                },
                timeout=10,
            )
            body = {
                "qry_tp": "1", "strt_dt": strt_dt, "end_dt": end_dt,
                "dmst_stex_tp": dmst_stex_tp, "stk_bond_tp": "1",
                "mrkt_tp": "0", "sell_tp": "0",
            }
            return {
                "tried_body": body,
                "status_code": resp.status_code,
                "resp_headers": dict(resp.headers),
                "body": resp.json(),
            }
        except Exception as e:
            return {"error": str(e)}

    def raw_kt00018(self, qry_tp: str = "1", dmst_stex_tp: str = "NXT") -> dict:
        """kt00018 원시 응답 반환 — /api/debug/kiwoom 에서 파라미터 탐색용."""
        try:
            body: dict = {"qry_tp": qry_tp}
            if dmst_stex_tp != "OMIT":
                body["dmst_stex_tp"] = dmst_stex_tp
            resp = httpx.post(
                f"{self._base}/api/dostk/acnt",
                json=body,
                headers={
                    **self._auth_headers(),
                    "api-id": "kt00018",
                    "cont-yn": "N",
                    "next-key": "",
                },
                timeout=10,
            )
            return {
                "tried_body": body,
                "status_code": resp.status_code,
                "resp_headers": dict(resp.headers),
                "body": resp.json(),
            }
        except Exception as e:
            return {"error": str(e)}


# ── 유틸 ─────────────────────────────────────────────────────────────────────

def _to_int(val) -> int:
    """문자열·숫자를 int 로. 콤마/공백 제거."""
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0


def _load_all_theme_keywords() -> list[str]:
    """themes.json 에서 모든 키워드를 평탄화해 반환."""
    try:
        with open(_THEMES_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return [kw for t in data.get("themes", []) for kw in t.get("keywords", [])]
    except Exception:
        return []


def _net_buy_ratio_to_score(ratio: float) -> float:
    """외인+기관 순매수비율 → 0~100 점수. tanh 정규화.

    +5% 평균 비율 ≈ 76점, 0% = 50점, -5% ≈ 24점.
    비율 기반이라 대형주·소형주 스케일 중립.
    """
    return 50.0 + 50.0 * math.tanh(ratio / 0.05)
