"""ORM 모델 — Phase 2 영구 장부의 스키마 골격 (v1 mock 은 미사용, 테이블만 생성).

KR/US 완전 분리이므로 포트 레코드에 market 컬럼을 둔다 (CLAUDE.md §5).
레벨/EXP만 예외 — 시장 통합(CLAUDE.md §4 예외 명시).
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


class ExpEvent(Base):
    """EXP 원장 — 멱등성(중복 적립 방지) + 단조 증가 보장.

    ref_key UNIQUE → 같은 이벤트를 재조회해도 1번만 적립된다.
    exp 는 항상 ≥ 0 (감점 없음 → 손실 무강등 구조 보장).
    CLAUDE.md §4: ₩액수 비례 금지. 시장 통합(KR/US 합산, §4 예외).
    """

    __tablename__ = "exp_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String, index=True)   # "SELL" | "DIV"
    ref_key: Mapped[str] = mapped_column(String, unique=True, index=True)
    exp: Mapped[int] = mapped_column(Integer)
    meta_json: Mapped[str] = mapped_column(String, default="{}")  # 부가 정보(JSON)
    created_at: Mapped[str] = mapped_column(String)               # ISO 8601 UTC


class AppMeta(Base):
    """앱 전역 메타 키-값 (단일 사용자 v1).

    용도: first_link_date = 최초 연동일(YYYYMMDD).
    금고 '연동 이전(백필) / 연동 후(실시간)' 구분 + 복원 연출 기준.
    1회 기록 후 불변 (덮어쓰지 않음).
    """

    __tablename__ = "app_meta"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String)


class UserTheme(Base):
    """사용자 테마 설정 — 측량소 테마 모드 영속 저장.

    market 별 1행 (KR/US 분리 — CLAUDE.md §5).
    themes_json = JSON 배열: ["AI·반도체", "로봇"]
    비어있으면 기본 모드(펀더멘털 스냅샷).
    """

    __tablename__ = "user_themes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market: Mapped[str] = mapped_column(String, unique=True, index=True)
    themes_json: Mapped[str] = mapped_column(String, default="[]")
