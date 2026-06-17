// HUD 오버레이 (CLAUDE.md §5 HUD 구성). 풀스크린 씬 위에 떠 있음.
// 좌상단: 광맥 등급 + 성향 칩(글씨) + 금괴 칩(아이콘+금액) / 우상단: 티어 엠블럼 + 디비전 + 알림점
import { emblems, scene } from '../assets'

export default function Hud({ data, goldOverride }) {
  const { veinGrade, disposition, tier, goldAmountDisplay } = data
  const emblemSrc = emblems[tier.emblem] || emblems.iron
  const goldText = goldOverride || goldAmountDisplay
  return (
    <div className="hud">
      {/* 좌상단 */}
      <div className="hud-topleft">
        <div className="grade-chip">{veinGrade.label} · {veinGrade.score}</div>
        <div className="disp-chip">성향 · {disposition}</div>
        <div className="gold-chip">
          <img className="gold-icon" src={scene.goldIcon} alt="금괴" />
          <span>{goldText}</span>
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
