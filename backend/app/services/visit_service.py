"""연속 방문일 카운트.

앱 열 때마다 GET /api/visit/streak 호출 → 오늘 날짜 upsert → 연속일 계산 → 문구 반환.
끊겨도 스트레스 주지 않는 문구 설계. CLAUDE.md §13 감정 설계 철학.
"""
from datetime import date

from sqlalchemy.orm import Session

from app.models import VisitLog


def log_and_get_streak(db: Session, user_id: str = "default") -> dict:
    """오늘 방문 기록 (idempotent) + 연속 방문일 반환."""
    today     = date.today()
    today_str = today.strftime("%Y%m%d")

    # 오늘 방문 중복 방지
    existing = db.query(VisitLog).filter_by(date=today_str, user_id=user_id).first()
    if not existing:
        db.add(VisitLog(date=today_str, user_id=user_id))
        db.commit()

    # 최근 방문 날짜 내림차순 (최대 400일 분)
    visits: list[str] = [
        v.date
        for v in db.query(VisitLog)
        .filter_by(user_id=user_id)
        .order_by(VisitLog.date.desc())
        .limit(400)
    ]

    is_first = len(visits) <= 1

    # 이전 방문일 확인
    prev_date = visits[1] if len(visits) > 1 else None
    days_since_last: int | None = None
    if prev_date:
        prev_d = date(int(prev_date[:4]), int(prev_date[4:6]), int(prev_date[6:8]))
        days_since_last = (today - prev_d).days

    # 연속일 계산: 오늘부터 하루씩 역방향으로 확인
    streak = 1
    check  = today
    for v in visits[1:]:
        v_date = date(int(v[:4]), int(v[4:6]), int(v[6:8]))
        if (check - v_date).days == 1:
            streak += 1
            check = v_date
        else:
            break

    return {
        "streak":       streak,
        "message":      _get_message(streak, days_since_last, is_first),
        "daysSinceLast": days_since_last,
    }


def get_streak_current(db: Session, user_id: str = "default") -> int:
    """방문 로그 없이 현재 연속 방문일만 조회."""
    today = date.today()
    visits: list[str] = [
        v.date for v in db.query(VisitLog)
        .filter_by(user_id=user_id)
        .order_by(VisitLog.date.desc())
        .limit(400)
    ]
    if not visits:
        return 0
    streak = 0
    check = today
    for v in visits:
        v_date = date(int(v[:4]), int(v[4:6]), int(v[6:8]))
        diff = (check - v_date).days
        if diff == 0 or diff == 1:
            streak += 1
            check = v_date
        else:
            break
    return streak


def _get_message(streak: int, days_since_last: int | None, is_first: bool) -> str:
    if is_first:
        return "오늘 광맥 첫 방문이에요. 투자 습관의 시작입니다."
    if days_since_last is not None and days_since_last > 1:
        return f"{days_since_last}일 만에 돌아오셨군요."
    if streak >= 30:
        return f"{streak}일 연속 채굴 기록 달성!"
    if streak >= 7:
        return f"{streak}일 연속 투자 습관 유지 중."
    if streak >= 2:
        return f"{streak}일 연속 광맥 확인 중. 좋은 습관이 쌓이고 있어요."
    return "오늘도 광맥 확인 완료."
