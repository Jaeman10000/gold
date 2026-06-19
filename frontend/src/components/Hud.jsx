// 홈 헤더 패널 — 3단 구조 (CLAUDE.md §5 HUD).
// 1단: 레벨 배지(결정 컨셉) + 아이콘 / EXP 채굴 게이지
// 2단: 등급칩 · 시장토글 · 성향칩
// 3단: 총 평가금액
import MarketToggle from './MarketToggle'

export default function Hud({ data, goldOverride, refreshing, levelData, achievement }) {
  const { veinGrade, disposition } = data
  const goldText = goldOverride || data.goldAmountDisplay

  const symMatch = String(goldText || '').match(/^([₩$])(.+)$/)
  const goldSym = symMatch ? symMatch[1] : ''
  const goldNum = symMatch ? symMatch[2] : (goldText || '')

  // 레벨 데이터 (없으면 기본값)
  const level    = levelData?.level      ?? 1
  const curExp   = levelData?.curLevelExp ?? 0
  const needExp  = levelData?.needExp    ?? 100
  const ratio    = levelData?.ratio      ?? 0
  const isMax    = levelData?.isMax      ?? false

  // 레벨이 높을수록 배지 글로우 강해짐 (Lv1=0.28, Lv99=0.9)
  const glowA  = +(0.28 + (level / 99) * 0.62).toFixed(2)
  const badgeShadow = `0 0 10px rgba(232,179,57,${glowA}), 0 0 22px rgba(232,179,57,${+(glowA * 0.5).toFixed(2)}), 0 2px 6px rgba(0,0,0,0.6)`

  const pct      = Math.round(ratio * 100)
  const expLeft  = Math.max(0, needExp - curExp)

  return (
    <div className="home-header-panel">

      {/* 1단: 레벨 배지 + 아이콘 */}
      <div className="h-row1">
        <div className="lv-badge-wrap">
          <div className="lv-badge" style={{ boxShadow: badgeShadow }}>
            <span className="lv-label">LV</span>
            <span className="lv-num">{level}</span>
          </div>
          <div className="lv-badge-info">
            <span className="lv-badge-title">광부 레벨</span>
            <span className="lv-badge-sub">꾸준히 굴린 기록</span>
          </div>
        </div>
        <div className="h-icons">
          {refreshing && <div className="refresh-spin" style={{ margin: 0 }} />}
          <span className="h-icon" aria-label="알림">🔔</span>
          <span className="h-icon" aria-label="설정">⚙</span>
        </div>
      </div>

      {/* EXP 채굴 게이지 */}
      <div className="exp-gauge-wrap">
        <div className="exp-bar-track" aria-label={`EXP ${pct}%`}>
          <div className="exp-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="exp-info">
          <span className="exp-cur">{curExp.toLocaleString()} / {needExp.toLocaleString()} EXP</span>
          <span className="exp-next">
            {isMax ? '만렙 달성 ✦' : `다음 레벨까지 ${expLeft.toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* [C] 연속투자일·업적 한 줄 */}
      {achievement && (
        <div className="achievement-line"><span className="ach-icon">🔥</span>{achievement}</div>
      )}

      {/* 2단: 등급칩 · 시장토글 · 성향칩 */}
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
