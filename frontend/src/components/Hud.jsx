// 홈 헤더 패널 — 압축 2~3단 (CLAUDE.md §5 HUD).
// 1단: 레벨 배지 + EXP 채굴 게이지 + 아이콘 (한 줄)
// 2단: 등급칩 · 시장토글 · 성향칩
// (총 평가금액·수익률은 AssetSummary로, 연속방문은 하단으로 분리 — 씬이 주인공)
import MarketToggle from './MarketToggle'
import { syncTime } from '../utils/format'

export default function Hud({ data, refreshing, levelData, onSync, cachedAt }) {
  const { veinGrade, disposition } = data

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
    <div className="home-header-panel compact">

      {/* 1단: 레벨 배지 + EXP 게이지(인라인) + 아이콘 */}
      <div className="h-row1">
        <div className="lv-badge" style={{ boxShadow: badgeShadow }}>
          <span className="lv-label">LV</span>
          <span className="lv-num">{level}</span>
        </div>

        <div className="exp-gauge-inline">
          <div className="exp-bar-track" aria-label={`EXP ${pct}%`}>
            <div className="exp-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="exp-info">
            <span className="exp-cur">Lv{level} · {curExp.toLocaleString()}/{needExp.toLocaleString()} EXP</span>
            <span className="exp-next">{isMax ? '만렙 ✦' : `다음까지 ${expLeft.toLocaleString()}`}</span>
          </div>
        </div>

        <div className="h-icons">
          <button
            className="sync-btn"
            onClick={onSync}
            disabled={refreshing}
            aria-label="동기화"
            title="데이터 새로고침"
          >
            <span className={refreshing ? 'sync-icon spinning' : 'sync-icon'}>🔄</span>
            <span className="sync-time">{refreshing ? '동기화 중…' : (syncTime(cachedAt) || '')}</span>
          </button>
          <span className="h-icon" aria-label="알림">🔔</span>
          <span className="h-icon" aria-label="설정">⚙</span>
        </div>
      </div>

      {/* 2단: 등급칩 · 시장토글 · 성향칩 */}
      <div className="h-row2">
        <span className="h-chip grade">{veinGrade.label} · {veinGrade.score}</span>
        <MarketToggle />
        <span className="h-chip disp">성향 · {disposition}</span>
      </div>

    </div>
  )
}
