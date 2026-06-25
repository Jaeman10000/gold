"""광부 명함 데이터 집계.

표시 항목 (CLAUDE.md §11 2단계):
  레벨·EXP / 광맥등급(A·88) / 연속투자일 / 누적실현수익(익절+배당) / 익절·배당건수 / 성향
★ 총자산·평가금액 절대 포함 금지 — 규모 아닌 성장이 핵심 (CLAUDE.md §12).
"""
from app.db import SessionLocal
from app.services import common, level_service, vault_service, visit_service
from app.services import survey_service


def build_card(market: str = "KR") -> dict:
    db = SessionLocal()
    try:
        lv = level_service.get_level_summary(db)
        streak = visit_service.get_streak_current(db)
    finally:
        db.close()

    # 등급·성향: 캐시 활용 (무거운 계산 재사용)
    survey = survey_service.build_survey(market)
    grade = survey.get("grade", "?")
    score = survey.get("score", 0)
    style = (survey.get("disposition") or {}).get("type", "하이브리드")

    # 금고: 캐시 활용
    vault = vault_service.build_vault(market)
    realized_total = vault.get("realizedPnlTotal", 0)
    dividend_total = vault.get("dividendTotal", 0)
    cumulative = realized_total + dividend_total

    win_count = len([r for r in vault.get("realizedPnl", []) if r.get("realizedPnl", 0) > 0])
    div_count = len(vault.get("dividends", []))

    cur = common.currency_of(market)

    return {
        "level":            lv["level"],
        "curLevelExp":      lv["curLevelExp"],
        "needExp":          lv["needExp"],
        "ratio":            lv["ratio"],
        "isMax":            lv["isMax"],
        "grade":            grade,
        "score":            score,
        "streak":           streak,
        "cumulativePnl":    cumulative,
        "cumulativePnlDisplay": common.format_amount(market, cumulative),
        "winTradeCount":    win_count,
        "dividendCount":    div_count,
        "style":            style,
        "market":           market,
        "currency":         cur["currency"],
        "currencySymbol":   cur["symbol"],
        "disclaimer":       "투자권유 아님",
    }
