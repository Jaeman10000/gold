"""DB 캐시 — API 응답을 SQLite에 저장, cold start 즉시 표시."""
import json
from datetime import datetime, timezone

from app.db import SessionLocal
from app.models import DataCache


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get(key: str) -> tuple[dict, str] | None:
    db = SessionLocal()
    try:
        row = db.get(DataCache, key)
        if not row:
            return None
        return json.loads(row.data_json), row.cached_at
    finally:
        db.close()


def put(key: str, data: dict) -> str:
    """캐시 저장 후 cached_at 반환."""
    db = SessionLocal()
    try:
        now = _now()
        serializable = {k: v for k, v in data.items() if k != "cachedAt"}
        blob = json.dumps(serializable, ensure_ascii=False)
        row = db.get(DataCache, key)
        if row:
            row.data_json = blob
            row.cached_at = now
        else:
            db.add(DataCache(key=key, data_json=blob, cached_at=now))
        db.commit()
        return now
    finally:
        db.close()
