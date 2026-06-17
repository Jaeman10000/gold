"""MOCK 시드 데이터 — KR/US 완전 분리 (CLAUDE.md §5).

v1: KR 만 실데이터 형태로 채우고, US 는 잠금(locked) → provider 가 빈/잠금 처리.
숫자는 가공된 예시이며 실제 시세가 아니다.
"""

# --- KR 보유 종목 (평단 avg_price = 가중평균) ---
KR_HOLDINGS = [
    {"ticker": "005930", "name": "삼성전자",   "qty": 10, "avg_price": 68000.0,  "current_price": 76400.0},
    {"ticker": "000660", "name": "SK하이닉스", "qty": 3,  "avg_price": 120000.0, "current_price": 178000.0},
    {"ticker": "005380", "name": "현대차",     "qty": 2,  "avg_price": 195000.0, "current_price": 238000.0},
    {"ticker": "105560", "name": "KB금융",     "qty": 8,  "avg_price": 52000.0,  "current_price": 61000.0},
    {"ticker": "006400", "name": "삼성SDI",    "qty": 1,  "avg_price": 410000.0, "current_price": 360000.0},  # 손실
]

# --- KR 매매 기록 (영구 장부 예시) ---
KR_TRADES = [
    {"date": "2026-05-12", "ticker": "005930", "name": "삼성전자",   "side": "BUY",  "qty": 10, "price": 68000.0},
    {"date": "2026-05-20", "ticker": "000660", "name": "SK하이닉스", "side": "BUY",  "qty": 3,  "price": 120000.0},
    {"date": "2026-05-28", "ticker": "005380", "name": "현대차",     "side": "BUY",  "qty": 2,  "price": 195000.0},
    {"date": "2026-06-02", "ticker": "105560", "name": "KB금융",     "side": "BUY",  "qty": 8,  "price": 52000.0},
    {"date": "2026-06-09", "ticker": "006400", "name": "삼성SDI",    "side": "BUY",  "qty": 1,  "price": 410000.0},
]

# --- KR 배당 기록 (수레 → 수확) ---
KR_DIVIDENDS = [
    {"date": "2026-04-18", "ticker": "005930", "name": "삼성전자", "amount": 3610.0},
    {"date": "2026-04-18", "ticker": "105560", "name": "KB금융",   "amount": 24800.0},
    {"date": "2026-05-30", "ticker": "005380", "name": "현대차",   "amount": 12500.0},
]
