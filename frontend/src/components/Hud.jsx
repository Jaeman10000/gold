// HUD 오버레이 (CLAUDE.md §5 HUD 구성). 풀스크린 씬 위에 떠 있음.
// 좌상단: 금액(메인 크게) + 등급·성향(보조 작게) / 우상단: 티어 엠블럼 + 디비전 + 알림점
import { emblems, scene } from '../assets'

export default function Hud({ data, goldOverride }) {
  const { veinGrade, disposition, tier, goldAmountDisplay } = data
  const emblemSrc = emblems[tier.emblem] || emblems.iron
  const goldText = goldOverride || goldAmountDisplay
  return (
    <div className="hud">
      {/* 좌상단: 금액 메인 → 등급·성향 보조 */}
      <div className="hud-topleft">
        <div className="hud-main-amount">
          <img className="gold-icon-hud" src={scene.goldIcon} alt="금괴" />
          <span className="hud-amount-text">{goldText}</span>
        </div>
        <div className="hud-secondary">
          <span className="grade-chip-sm">{veinGrade.label} · {veinGrade.score}</span>
          <span className="disp-chip-sm">성향 · {disposition}</span>
        </div>
      </div>

      {/* 우상단 */}
      <div className="hud-topright">
        <img className="emblem" src={emblemSrc} alt={tier.emblem} />
        <span className="tier-label">{tier.name} {tier.division}</span>
        <span className="notif-dot" />
      </div>
    </div>
  )
}
