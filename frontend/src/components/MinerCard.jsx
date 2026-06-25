// 광부 명함 — html-to-image 캡처 대상 (ref={cardRef}).
// ★ 총자산·평가금액 없음 (CLAUDE.md §12: 규모 아닌 성장).
import { scene } from '../assets'

function fmtPnl(val, symbol) {
  if (!val && val !== 0) return '─'
  const abs = Math.abs(val)
  let str
  if (abs >= 100_000_000) str = `${(abs / 100_000_000).toFixed(1)}억`
  else if (abs >= 10_000) str = `${(abs / 10_000).toFixed(0)}만`
  else str = abs.toLocaleString()
  return (val >= 0 ? '+' : '-') + symbol + str
}

export default function MinerCard({ cardRef, data }) {
  if (!data) return null

  const {
    level, curLevelExp, needExp, ratio, isMax,
    grade, score,
    streak,
    cumulativePnl, currencySymbol,
    winTradeCount, dividendCount,
    style,
  } = data

  const pct     = Math.round((ratio || 0) * 100)
  const glowA   = +(0.28 + Math.min(level, 99) / 99 * 0.62).toFixed(2)
  const shadow  = `0 0 12px rgba(232,179,57,${glowA}), 0 0 28px rgba(232,179,57,${+(glowA * 0.45).toFixed(2)})`
  const pnlStr  = fmtPnl(cumulativePnl, currencySymbol || '₩')

  return (
    <div className="mc-card" ref={cardRef}>
      {/* 배경 이미지 */}
      <img src={scene.bgMine} className="mc-bg" alt="" crossOrigin="anonymous" />
      <div className="mc-overlay" />

      <div className="mc-body">
        {/* 상단: 레벨 배지 + EXP + 성향 */}
        <div className="mc-top-row">
          <div className="mc-lv-badge" style={{ boxShadow: shadow }}>
            <span className="mc-lv-label">LV</span>
            <span className="mc-lv-num">{level}</span>
          </div>
          <div className="mc-exp-col">
            <div className="mc-title-row">
              <span className="mc-app-name">광맥</span>
              <span className="mc-style-chip">{style}</span>
            </div>
            <div className="mc-exp-bar-track">
              <div className="mc-exp-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="mc-exp-nums">
              {isMax ? '만렙 ✦' : `${curLevelExp.toLocaleString()} / ${needExp.toLocaleString()} EXP`}
            </div>
          </div>
        </div>

        <div className="mc-divider" />

        {/* 핵심 스탯 3열 */}
        <div className="mc-stats-row">
          <div className="mc-stat">
            <div className="mc-stat-label">광맥 등급</div>
            <div className="mc-stat-val">{grade} · {score}</div>
          </div>
          <div className="mc-stat-sep" />
          <div className="mc-stat">
            <div className="mc-stat-label">꾸준히 투자 유지</div>
            <div className="mc-stat-val">{streak}일</div>
          </div>
          <div className="mc-stat-sep" />
          <div className="mc-stat">
            <div className="mc-stat-label">누적 실현수익</div>
            <div className="mc-stat-val mc-pnl">{pnlStr}</div>
          </div>
        </div>

        {/* 서브 스탯 */}
        <div className="mc-sub-row">
          <span>익절 {winTradeCount}건</span>
          <span className="mc-sub-dot">·</span>
          <span>배당 {dividendCount}건</span>
        </div>

        <div className="mc-divider" />

        {/* 푸터 */}
        <div className="mc-footer-row">
          <span className="mc-tagline">✦ 잠자는 동안 캐는 내 포트폴리오 금광</span>
          <span className="mc-disclaimer">투자권유 아님</span>
        </div>
      </div>
    </div>
  )
}
