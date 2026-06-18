"""레벨 / EXP 서비스 (CLAUDE.md §4: ₩비례 금지, 손실 무강등, 스타일 중립).

EXP 소스 v1:
  ① 배당(CSV/DB) — 이벤트당 고정 EXP, ₩ 완전 무관.
  ② 익절(ka10073) — 실현수익률(%) 기반, ₩ 무관. 손실 = 0.
  ③ 행동·연속성 = v2.

멱등성 보장: ref_key UNIQUE → 재조회해도 중복 적립 없음.
단조 증가: exp 열은 항상 ≥ 0 (감점 없음).

설계 근거: docs/level_exp_design.md
"""
import json
import math
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Dividend, ExpEvent
from app.services.exp_config import (
    DIV_BASE,
    LV_BASE,
    LV_MAX,
    LV_POW,
    SELL_CAP_PCT,
    SELL_MIN_PCT,
    SELL_W,
)

# ── 레벨 곡선 ─────────────────────────────────────────────────────────────────

def need_exp(level: int) -> int:
    """레벨 L → L+1 에 필요한 EXP. need(L) = round(LV_BASE × L^LV_POW)."""
    return max(1, round(LV_BASE * (level ** LV_POW)))


def exp_to_level(total_exp: int) -> dict:
    """누적 EXP → {level, curLevelExp, needExp, ratio, isMax}."""
    remaining = max(0, total_exp)
    level = 1
    while level < LV_MAX:
        n = need_exp(level)
        if remaining < n:
            break
        remaining -= n
        level += 1
    is_max = level >= LV_MAX
    n = need_exp(level) if not is_max else 0
    ratio = round(min(1.0, remaining / n), 4) if n > 0 else 1.0
    return {
        "level": level,
        "curLevelExp": remaining,
        "needExp": n,
        "ratio": ratio,
        "isMax": is_max,
    }


# ── EXP 계산 ─────────────────────────────────────────────────────────────────

def compute_sell_exp(return_rate_pct: float) -> int:
    """익절 EXP — 수익률(%) 기반, ₩ 무관.

    손실(returnRate ≤ 0) = 0. SELL_MIN_PCT 미만 = 0 (파밍 차단).
    상한 SELL_CAP_PCT 적용 → 한 방 대박이 레벨을 지배하지 않음.
    """
    if return_rate_pct < SELL_MIN_PCT:
        return 0
    capped = min(float(return_rate_pct), SELL_CAP_PCT)
    return round(SELL_W * capped)


def compute_div_exp() -> int:
    """배당 EXP — 이벤트당 고정, ₩ 완전 무관."""
    return DIV_BASE


# ── 원장 적립 ─────────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _insert_if_new(
    db: Session, source: str, ref_key: str, exp: int, meta: dict
) -> bool:
    """ref_key 없을 때만 INSERT → True. 이미 있으면 False (멱등)."""
    if db.query(ExpEvent).filter_by(ref_key=ref_key).first():
        return False
    db.add(ExpEvent(
        source=source,
        ref_key=ref_key,
        exp=exp,
        meta_json=json.dumps(meta, ensure_ascii=False),
        created_at=_now_iso(),
    ))
    return True


def sync_sell_exp(provider, db: Session) -> int:
    """ka10073 실현손익 → 신규 익절 EXP 적립. 반환: 신규 적립 건수."""
    if not hasattr(provider, "get_realized_pnl"):
        return 0
    items = provider.get_realized_pnl("KR")
    inserted = 0
    for item in items:
        return_rate = float(item.get("returnRate", 0))
        ticker = str(item.get("ticker", ""))
        date_str = str(item.get("date", ""))
        sell_qty = int(item.get("sellQty", 0))
        sell_price = int(item.get("sellPrice", 0))
        buy_price = int(item.get("buyPrice", 0))
        # ref_key: 날짜+종목+수량+매도가+매수가 → 트랜잭션 식별
        ref_key = f"SELL|{date_str}|{ticker}|{sell_qty}|{sell_price}|{buy_price}"
        exp = compute_sell_exp(return_rate)
        if exp <= 0:
            continue
        meta = {
            "date": date_str,
            "ticker": ticker,
            "returnRate": return_rate,
            "sellQty": sell_qty,
            "sellPrice": sell_price,
            "market": "KR",
        }
        if _insert_if_new(db, "SELL", ref_key, exp, meta):
            inserted += 1
    db.commit()
    return inserted


def sync_div_exp(db: Session) -> int:
    """DB 배당 레코드 → 신규 배당 EXP 적립. 반환: 신규 적립 건수."""
    dividends = db.query(Dividend).all()
    inserted = 0
    for d in dividends:
        # amount를 정수화 — 같은 배당이 중복 임포트돼도 1번만 적립
        amount_int = int(round(d.amount))
        ref_key = f"DIV|{d.date}|{d.ticker}|{amount_int}"
        meta = {
            "ticker": d.ticker,
            "name": getattr(d, "name", ""),
            "date": d.date,
            "market": d.market,
        }
        if _insert_if_new(db, "DIV", ref_key, compute_div_exp(), meta):
            inserted += 1
    db.commit()
    return inserted


# ── 요약 조회 ─────────────────────────────────────────────────────────────────

def get_level_summary(db: Session) -> dict:
    """현재 레벨·EXP·소스 내역 반환."""
    events = (
        db.query(ExpEvent)
        .order_by(ExpEvent.created_at.desc())
        .all()
    )
    total_exp = sum(e.exp for e in events)
    lv = exp_to_level(total_exp)

    # 소스별 집계
    by_source: dict[str, int] = {}
    for e in events:
        by_source[e.source] = by_source.get(e.source, 0) + e.exp

    # 최근 10건 (최신순)
    recent = [
        {
            "source": e.source,
            "exp": e.exp,
            "refKey": e.ref_key,
            "meta": json.loads(e.meta_json or "{}"),
            "at": e.created_at,
        }
        for e in events[:10]
    ]

    return {
        "level": lv["level"],
        "totalExp": total_exp,
        "curLevelExp": lv["curLevelExp"],
        "needExp": lv["needExp"],
        "ratio": lv["ratio"],
        "isMax": lv["isMax"],
        "expBySource": by_source,
        "eventCount": len(events),
        "recentEvents": recent,
        "levelCurve": {
            "needExpNext": lv["needExp"],
            "formula": f"need(L) = round({LV_BASE} × L^{LV_POW})",
            "lvMax": LV_MAX,
        },
        "note": "레벨은 투자 실력·우열이 아니라 '꾸준히 굴린 기록'입니다. 투자권유 아님.",
    }
