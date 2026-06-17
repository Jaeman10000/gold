"""CSV 임포트 — 키움 HTS에서 내보낸 매매·배당 내역을 SQLite에 영구 저장.

지원 형식 (헤더 자동 감지):
  매매: 체결일|종목코드|종목명|매매구분|체결수량|체결단가  (또는 영문 헤더)
  배당: 지급일|종목코드|종목명|배당금액(세후)  (또는 영문 헤더)

중복 행은 건너뜀 (동일 (market, date, ticker, side, qty, price)).
"""
import csv
import io
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Dividend, Trade

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/import", tags=["import"])

# ── 컬럼 별칭 매핑 (키움 한글 헤더 → 내부 키) ──────────────────────────────
_TRADE_COL = {
    "체결일": "date", "date": "date",
    "종목코드": "ticker", "ticker": "ticker",
    "종목명": "name", "name": "name",
    "매매구분": "side", "side": "side",
    "체결수량": "qty", "qty": "qty",
    "체결단가": "price", "price": "price",
}

_DIV_COL = {
    "지급일": "date", "date": "date",
    "배당지급일": "date",
    "종목코드": "ticker", "ticker": "ticker",
    "종목명": "name", "name": "name",
    "배당금액(세후)": "amount", "현금배당금액(세후)": "amount",
    "세후배당금": "amount", "amount": "amount",
}

_SIDE_MAP = {
    "매수": "BUY", "buy": "BUY", "1": "BUY",
    "매도": "SELL", "sell": "SELL", "2": "SELL",
}


def _parse_csv(content: bytes) -> list[dict]:
    """UTF-8 또는 EUC-KR CSV 파싱. 인코딩 자동 감지."""
    for enc in ("utf-8-sig", "euc-kr", "utf-8"):
        try:
            text = content.decode(enc)
            reader = csv.DictReader(io.StringIO(text))
            return [row for row in reader]
        except (UnicodeDecodeError, Exception):
            continue
    raise ValueError("CSV 인코딩을 인식할 수 없습니다 (UTF-8 또는 EUC-KR 필요)")


def _to_int(val: str) -> int:
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0


def _to_float(val: str) -> float:
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0


def _norm_date(val: str) -> str:
    """'20260101' 또는 '2026-01-01' → 'YYYY-MM-DD'."""
    v = str(val).strip().replace("/", "-")
    if len(v) == 8 and v.isdigit():
        return f"{v[:4]}-{v[4:6]}-{v[6:]}"
    return v


def _norm_ticker(val: str) -> str:
    v = str(val).strip()
    return v[1:] if v.startswith("A") else v


@router.post("/trades")
def import_trades(
    market: Annotated[str, Query(pattern="^(KR|US)$")] = "KR",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    """키움 체결내역 CSV → DB 저장. 중복 건너뜀."""
    rows = _parse_csv(file.file.read())
    if not rows:
        return {"inserted": 0, "skipped": 0, "message": "CSV가 비어 있습니다"}

    # 헤더 → 내부 키 매핑
    header_map = {h.strip(): _TRADE_COL.get(h.strip()) for h in rows[0].keys()}
    missing = [k for k, v in {"date": None, "ticker": None, "side": None, "qty": None, "price": None}.items()
               if k not in header_map.values()]
    if missing:
        return {"error": f"필수 컬럼 없음: {missing}. 지원 헤더: {list(_TRADE_COL.keys())}"}

    inserted = skipped = 0
    for raw in rows:
        mapped = {v: raw[k] for k, v in header_map.items() if v}
        date = _norm_date(mapped.get("date", ""))
        ticker = _norm_ticker(mapped.get("ticker", ""))
        name = str(mapped.get("name", "")).strip()
        side_raw = str(mapped.get("side", "")).strip().lower()
        side = _SIDE_MAP.get(side_raw)
        qty = _to_int(mapped.get("qty", 0))
        price = _to_int(mapped.get("price", 0))

        if not (date and ticker and side and qty and price):
            skipped += 1
            continue

        exists = db.query(Trade).filter_by(
            market=market, date=date, ticker=ticker, side=side, qty=qty, price=price
        ).first()
        if exists:
            skipped += 1
            continue

        db.add(Trade(market=market, date=date, ticker=ticker, name=name,
                     side=side, qty=qty, price=float(price)))
        inserted += 1

    db.commit()
    logger.info("임포트 완료: trades 삽입 %d, 건너뜀 %d", inserted, skipped)
    return {"inserted": inserted, "skipped": skipped}


@router.post("/dividends")
def import_dividends(
    market: Annotated[str, Query(pattern="^(KR|US)$")] = "KR",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    """키움 배당내역 CSV → DB 저장. 중복 건너뜀."""
    rows = _parse_csv(file.file.read())
    if not rows:
        return {"inserted": 0, "skipped": 0, "message": "CSV가 비어 있습니다"}

    header_map = {h.strip(): _DIV_COL.get(h.strip()) for h in rows[0].keys()}
    missing = [k for k in ("date", "ticker", "amount") if k not in header_map.values()]
    if missing:
        return {"error": f"필수 컬럼 없음: {missing}. 지원 헤더: {list(_DIV_COL.keys())}"}

    inserted = skipped = 0
    for raw in rows:
        mapped = {v: raw[k] for k, v in header_map.items() if v}
        date = _norm_date(mapped.get("date", ""))
        ticker = _norm_ticker(mapped.get("ticker", ""))
        name = str(mapped.get("name", "")).strip()
        amount = _to_float(mapped.get("amount", 0))

        if not (date and ticker and amount):
            skipped += 1
            continue

        exists = db.query(Dividend).filter_by(
            market=market, date=date, ticker=ticker
        ).first()
        if exists:
            skipped += 1
            continue

        db.add(Dividend(market=market, date=date, ticker=ticker, name=name, amount=amount))
        inserted += 1

    db.commit()
    logger.info("임포트 완료: dividends 삽입 %d, 건너뜀 %d", inserted, skipped)
    return {"inserted": inserted, "skipped": skipped}
