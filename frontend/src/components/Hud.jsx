// 홈 헤더 패널 — 3단 구조 (CLAUDE.md §5 HUD). 씬 위 오버레이.
// 1단: 티어 엠블럼+이름 / 아이콘
// 2단: 등급칩 · 시장토글 · 성향칩
// 3단: 총 평가금액 (₩ 골드, 숫자 크게)
import { emblems } from '../assets'
import MarketToggle from './MarketToggle'

const TIER_RANK = {
  challenger: '상위 1%', grandmaster: '상위 3%', master: '상위 8%',
  diamond: '상위 15%', platinum: '상위 25%', gold: '상위 40%',
  silver: '상위 60%', bronze: '상위 80%', iron: '상위 100%',
}

export default function Hud({ data, goldOverride, refreshing }) {
  const { veinGrade, disposition, tier, goldAmountDisplay } = data
  const emblemSrc = emblems[tier.emblem] || emblems.iron
  const goldText = goldOverride || goldAmountDisplay

  // "₩6,987,000" → { sym: '₩', num: '6,987,000' }
  const symMatch = String(goldText || '').match(/^([₩$])(.+)$/)
  const goldSym = symMatch ? symMatch[1] : ''
  const goldNum = symMatch ? symMatch[2] : (goldText || '')

  const rankLabel = TIER_RANK[tier.emblem] || '광부 등급'

  return (
    <div className="home-header-panel">
      {/* 1단: 티어 / 아이콘 */}
      <div className="h-row1">
        <div className="h-tier-left">
          <img className="h-emblem" src={emblemSrc} alt={tier.emblem} />
          <div>
            <span className="h-tier-name">{tier.name} {tier.division}</span>
            <span className="h-tier-rank">광부 등급 · {rankLabel}</span>
          </div>
        </div>
        <div className="h-icons">
          {refreshing && <div className="refresh-spin" style={{ margin: 0 }} />}
          <span className="h-icon" aria-label="알림">🔔</span>
          <span className="h-icon" aria-label="설정">⚙</span>
        </div>
      </div>

      {/* 2단: 등급칩 · 시장토글(칩 형태) · 성향칩 */}
      <div className="h-row2">
        <span className="h-chip grade">{veinGrade.label} · {veinGrade.score}</span>
        <MarketToggle />
        <span className="h-chip disp">성향 · {disposition}</span>
      </div>

      {/* 3단: 총 평가금액 (중앙) */}
      <div className="h-row3">
        <div className="h-amount-label">총 평가금액</div>
        <div className="h-amount-main">
          <span className="h-amount-symbol">{goldSym}</span>
          <span className="h-amount-num">{goldNum}</span>
        </div>
      </div>
    </div>
  )
}
