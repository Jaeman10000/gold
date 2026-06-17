"""ORM 모델 — Phase 2 영구 장부의 스키마 골격 (v1 mock 은 미사용, 테이블만 생성).

KR/US 완전 분리이므로 모든 레코드에 market 컬럼을 둔다 (CLAUDE.md §5).
"""
from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Holding(Base):
    """보유 종목 (현재 포지션). 평단=avg_price(가중평균)."""

    __tablename__ = "holdings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market: Mapped[str] = mapped_column(String, index=True)  # "KR" | "US"
    ticker: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    qty: Mapped[int] = mapped_column(Integer)
    avg_price: Mapped[float] = mapped_column(Float)       # 평단(가중평균)
    current_price: Mapped[float] = mapped_column(Float)   # 현재가(시세)


class Trade(Base):
    """매매 기록 (영구 장부). side = "BUY" | "SELL"."""

    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market: Mapped[str] = mapped_column(String, index=True)
    date: Mapped[str] = mapped_column(String)  # YYYY-MM-DD
    ticker: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    side: Mapped[str] = mapped_column(String)
    qty: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Float)


class Dividend(Base):
    """배당 기록 (수레 → 수확)."""

    __tablename__ = "dividends"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market: Mapped[str] = mapped_column(String, index=True)
    date: Mapped[str] = mapped_column(String)
    ticker: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    amount: Mapped[float] = mapped_column(Float)  # 세후 입금액
