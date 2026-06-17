"""점수/성향/티어/미래정합성 — 스타일 중립 (CLAUDE.md 하드룰 §4, §6).

v1 은 MOCK 고정값 + 단순 매핑. 실제 산식(테마50/재무30/수급20, 히스테리시스 등)은
Phase 3 에서 PDF §6 기준으로 구현한다.

원칙(절대):
  - 점수·티어는 스타일 중립. 특정 투자철학 우대 금지.
  - XP 는 원(₩) 액수 비례 금지. 손실로 티어 강등 금지.
  - 미래정합성은 "성장테마 렌즈" 임을 명시(보편 점수 아님).
"""

# v1 MOCK 고정값 (KR)
_KR = {
    "score": 88,
    "disposition": "공격형",       # 회피/안정/공격/하이브리드 중 하나 (정체성, 우열 아님)
    "tier": {"name": "마스터", "division": 4, "emblem": "master"},
}


def vein_score(market: str) -> int:
    return _KR["score"] if market == "KR" else 0


def grade_of(score: int) -> str:
    if score >= 85:
        return "A"
    if score >= 70:
        return "B"
    if score >= 55:
        return "C"
    return "D"


def disposition(market: str) -> str:
    return _KR["disposition"]


def tier(market: str) -> dict:
    return dict(_KR["tier"])


def survey_breakdown(market: str) -> dict:
    """측량소: 미래정합성 점수 분해 + 종목 기여도 + 테마 서사 (성장 렌즈)."""
    score = vein_score(market)
    # 가중치 합 = 100 (테마50/재무30/수급20). component score 는 0~100.
    components = [
        {"key": "테마정합", "weight": 50, "score": 90, "note": "성장테마 정렬도(성장 렌즈)"},
        {"key": "재무",     "weight": 30, "score": 86, "note": "DART 재무 건전성"},
        {"key": "수급",     "weight": 20, "score": 84, "note": "기관·외인 수급(지연 가능)"},
    ]
    # 종목별 기여도 (투명 표기 — CLAUDE.md §6)
    contributions = [
        {"name": "SK하이닉스", "contribution": 31, "theme": "AI·반도체"},
        {"name": "삼성전자",   "contribution": 27, "theme": "반도체·HBM"},
        {"name": "현대차",     "contribution": 18, "theme": "전동화·로보틱스"},
        {"name": "KB금융",     "contribution": 14, "theme": "금융"},
        {"name": "삼성SDI",    "contribution": 10, "theme": "2차전지"},
    ]
    return {
        "score": score,
        "grade": grade_of(score),
        "lens": "성장테마 렌즈 — 배당·가치 포트의 낮은 점수는 결함이 아닙니다.",
        "components": components,
        "contributions": contributions,
        "themeNarrative": (
            "현재 포트폴리오는 AI·반도체 성장 테마에 강하게 정렬되어 있습니다. "
            "이는 성장 렌즈로 본 정렬도이며, 투자 스타일의 우열을 의미하지 않습니다."
        ),
    }
