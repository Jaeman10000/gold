"""앱 전역 메타 (AppMeta) 접근 — 단일 사용자 v1.

first_link_date: 최초 연동일(YYYYMMDD). 1회 기록 후 불변.
  - 금고: item.date < first_link_date → '연동 이전(백필)', 이후 → '연동 후(실시간)'.
  - 홈: 복원 연출 기준.
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import AppMeta

FIRST_LINK_DATE = "first_link_date"


def get_meta(db: Session, key: str) -> str | None:
    row = db.query(AppMeta).filter_by(key=key).first()
    return row.value if row else None


def set_meta_if_absent(db: Session, key: str, value: str) -> str:
    """없을 때만 기록 → 기존값 보존(불변). 항상 현재 유효값 반환."""
    row = db.query(AppMeta).filter_by(key=key).first()
    if row:
        return row.value
    db.add(AppMeta(key=key, value=value))
    db.commit()
    return value


def ensure_first_link_date(db: Session) -> str:
    """최초 연동일을 보장 — 처음이면 오늘로 고정. YYYYMMDD."""
    today = datetime.now().strftime("%Y%m%d")
    return set_meta_if_absent(db, FIRST_LINK_DATE, today)


def get_first_link_date(db: Session) -> str | None:
    return get_meta(db, FIRST_LINK_DATE)
