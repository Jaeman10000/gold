"""임시 조사 스크립트 — ka10001 주식기본정보 전체 필드 확인 (설계용). 실행 후 삭제."""
import httpx
import sys
sys.path.insert(0, ".")
from app.data.kiwoom_client import KiwoomClient

c = KiwoomClient()
h = {**c._auth_headers(), "api-id": "ka10001", "cont-yn": "N", "next-key": ""}

# 보유 3종목으로 객관 지표 가용성 확인
for stk_cd, nm in [("066570", "LG전자"), ("058610", "에스피지"), ("241520", "DSC인베스트먼트")]:
    resp = httpx.post("https://api.kiwoom.com/api/dostk/stkinfo", json={"stk_cd": stk_cd}, headers=h, timeout=8)
    data = resp.json()
    print(f"\n===== {nm} ({stk_cd}) rc={data.get('return_code')} =====")
    for k, v in data.items():
        if k in ("return_code", "return_msg"):
            continue
        print(f"  {k}: {v}")
