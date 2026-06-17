"""SQLite + SQLAlchemy — 모델/세션 수준만 (v1 단순화, 과설계 금지).

Phase 2 에서 키움 자동기록을 이 DB 에 영구 저장한다.
v1(mock) 은 in-memory mock 데이터로 화면을 띄우고, 여기서는 테이블만 준비한다.
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# SQLite 는 멀티스레드 접근 시 옵션 필요
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """앱 시작 시 테이블 생성 (없을 때만)."""
    from app import models  # noqa: F401  (모델 등록을 위한 import)

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI 의존성용 세션."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
