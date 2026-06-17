광맥 (Gwangmaek) — 프로젝트 시작 패키지

[구성]
- CLAUDE.md            : 단일 진실 소스. Claude Code가 매 세션 읽음. 루트에 둘 것.
- docs/gwangmaek_spec.pdf : 사람용 상세 설계서(비주얼 포함)
- docs/home_*.png      : 확정 홈 시안 (KR / US / 펼침)
- assets/scene/        : bg_mine, vein_gold(광맥), gold_piles_3sizes(금더미 소/중/대),
                         cart(빈/찬), miner(일꾼), gold_icon_hud(HUD 금괴 아이콘)
- assets/emblems/      : 9등급 엠블럼(투명 PNG) + 미리보기

[시작]
1. 이 폴더를 그대로 프로젝트 루트로 사용 (또는 git init)
2. Claude Code 실행 후, CLAUDE.md 맨 아래 "첫 작업 프롬프트" 붙여넣기
3. 아키텍처 제안 → 승인 → 스캐폴드(목업 3화면) 순서

[다음 핵심 확인 (Phase 1)]
- 키움이 과거 매매·배당을 어디까지 주는지
- 수익률이 키움 표시값과 일치하는지 (평단 가중평균)
- 미국주식 데이터 소스 확보 여부 (안 되면 US는 잠금, KR만 실데이터)
