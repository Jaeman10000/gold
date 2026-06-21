// 종목별 금광 무대 (CLAUDE.md §5) — 홈 씬 중앙 위에 떠서 "한 종목 = 한 금광"을 보여줌.
// 좌우 스와이프로 종목 전환(끝에서 멈춤·clamp). 수익률 → 광물(gem) 매핑 재활용.
// 탭하면 전체 보유 시트. 공용 금더미(총자산)는 씬에 고정 — 여기선 무대만 바뀜.
import { useRef, useState, useEffect } from 'react'
import { pct, profitColor, money } from '../utils/format'
import { scene } from '../assets'

// 수익률(등락률, %) → 광물 에셋. HoldingChips GEM_TIERS와 동일 기준(단일 소스 유지).
const GEM_TIERS = [
  { min: 20,        key: 'gemBlue'   },
  { min: 10,        key: 'gemPurple' },
  { min: 3,         key: 'gemGreen'  },
  { min: 0,         key: 'gemTeal'   },
  { min: -10,       key: 'gemOrange' },
  { min: -Infinity, key: 'gemGold'   },
]

function gemFor(returnRate) {
  const tier = GEM_TIERS.find((t) => returnRate >= t.min) || GEM_TIERS[GEM_TIERS.length - 1]
  return scene[tier.key]
}

const SWIPE_THRESHOLD = 42  // px — 이 이상 끌어야 종목 전환
const TAP_SLOP = 8          // px — 이 미만 이동이면 탭으로 간주

// 광물 프리로드 — 전환 시 깜빡임 방지
function useGemPreload() {
  useEffect(() => {
    GEM_TIERS.forEach(({ key }) => {
      const img = new window.Image()
      img.src = scene[key]
    })
  }, [])
}

export default function StockMineStage({ holdings, market, onOpenAll }) {
  const [index, setIndex] = useState(0)
  const [swingKey, setSwingKey] = useState(0)  // 전환 애니 트리거
  const dragRef = useRef({ x: 0, active: false })
  useGemPreload()

  const count = holdings.length
  // 보유 종목이 줄어 index가 범위 밖이면 보정
  useEffect(() => {
    if (index > count - 1) setIndex(Math.max(0, count - 1))
  }, [count, index])

  if (count === 0) return null

  const safeIdx = Math.min(index, count - 1)
  const active  = holdings[safeIdx]
  const hasPrev = safeIdx > 0
  const hasNext = safeIdx < count - 1

  const go = (dir) => {
    setIndex((i) => {
      const ni = Math.min(Math.max(i + dir, 0), count - 1)  // clamp
      if (ni !== i) setSwingKey((k) => k + 1)
      return ni
    })
  }

  // ── 포인터(터치+마우스) 스와이프 ──
  const onPointerDown = (e) => {
    dragRef.current = { x: e.clientX, active: true }
  }
  const onPointerUp = (e) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.x
    dragRef.current.active = false
    if (Math.abs(dx) < TAP_SLOP) { onOpenAll?.(); return }   // 탭 → 전체 시트
    if (dx <= -SWIPE_THRESHOLD) go(+1)                       // 좌로 끌기 → 다음
    else if (dx >= SWIPE_THRESHOLD) go(-1)                   // 우로 끌기 → 이전
  }

  const up = active.returnRate >= 0

  return (
    <div
      className="stock-stage"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { dragRef.current.active = false }}
    >
      {/* 종목 라벨 — 이름 + 수익률 + 평가금액 (무대 상단) */}
      <div className="ss-label" key={`lbl-${safeIdx}`}>
        <div className="ss-name">{active.name}</div>
        <div className="ss-rate" style={{ color: profitColor(active.returnRate) }}>
          {up ? '▲' : '▼'} {pct(active.returnRate)}
        </div>
        <div className="ss-amount">{money(market, active.evalAmount)}</div>
      </div>

      {/* 광물 — 이 종목이 캐는 중 (수익률 tier) */}
      <div className="ss-gem-zone">
        <img
          className="ss-gem"
          key={`gem-${safeIdx}-${swingKey}`}
          src={gemFor(active.returnRate)}
          alt=""
          aria-hidden="true"
        />
      </div>

      {/* 양쪽 "더 있음" 화살표 — 해당 방향에 종목 있을 때만 */}
      {count > 1 && (
        <>
          <button
            className={`ss-edge ss-edge-left ${hasPrev ? '' : 'off'}`}
            onClick={(e) => { e.stopPropagation(); go(-1) }}
            disabled={!hasPrev}
            aria-label="이전 종목"
          >‹</button>
          <button
            className={`ss-edge ss-edge-right ${hasNext ? '' : 'off'}`}
            onClick={(e) => { e.stopPropagation(); go(+1) }}
            disabled={!hasNext}
            aria-label="다음 종목"
          >›</button>
        </>
      )}

      {/* 위치 인디케이터 — 점 + N/M */}
      {count > 1 && (
        <div className="ss-indicator">
          <div className="ss-dots" aria-hidden="true">
            {holdings.map((_, i) => (
              <span key={i} className={`ss-dot ${i === safeIdx ? 'on' : ''}`} />
            ))}
          </div>
          <span className="ss-count">{safeIdx + 1} / {count}</span>
        </div>
      )}
    </div>
  )
}
