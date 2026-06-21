// 금광 세로 2칸 (CLAUDE.md §5) — "각자 다른 광맥" 변주 뷰.
// 한 화면 2개(크게) + 페이지 스와이프. 복제가 아니라 변주:
//   ① 광맥 크기·밝기 = 평가금액 비중 비례(연속 clamp)
//   ② 일꾼 모션 stagger(각자 delayMs 어긋남)
//   ③ 누적 광물 ×N = 보유 개월수(중립·시간이 쌓일수록↑), 배당은 보조 칩
//   ④ 앰비언트 반짝임 = ticker 해시 시드로 칸마다 다르게
// 수익/손실 차별 제거: 모든 광맥 금색·모든 일꾼 채굴 중. 수익률은 텍스트 숫자로만.
import { useRef, useState, useEffect, useMemo } from 'react'
import { pct, profitColor } from '../utils/format'
import { scene } from '../assets'
import Miner from './Miner'

const PAGE_SIZE = 2
const SWIPE_THRESHOLD = 45
const TAP_SLOP = 8

// 광맥 크기 — 비중(0~1)을 포트 내 최소~최대 대비 0.72~1.25로 보간(clamp).
const VEIN_MIN = 0.72
const VEIN_MAX = 1.25
function veinScale(weight, minW, maxW) {
  if (maxW <= minW) return 1.0
  const norm = Math.min(Math.max((weight - minW) / (maxW - minW), 0), 1)
  return VEIN_MIN + norm * (VEIN_MAX - VEIN_MIN)
}

// 칸 하단 평가금액 축약
function compactAmount(market, v) {
  if (v == null) return ''
  if (market === 'US') {
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
    return `$${Math.round(v)}`
  }
  if (v >= 1e8) return `₩${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1)}억`
  if (v >= 1e4) return `₩${Math.round(v / 1e4).toLocaleString()}만`
  return `₩${Math.round(v).toLocaleString()}`
}

// 보유일수 → 캔 광물 개수(개월, 최소 1)
function mineralCount(holdingDays) {
  if (!holdingDays) return 1
  return Math.max(1, Math.floor(holdingDays / 30))
}

// ticker → 결정론적 시드(앰비언트 변주용)
function seedOf(ticker) {
  let s = 0
  for (let i = 0; i < (ticker || '').length; i++) s = (s * 31 + ticker.charCodeAt(i)) % 9973
  return s
}

// ── 앰비언트 반짝임 (칸마다 시드로 타이밍·속도 다르게) ──
function VeinSparkles({ seed }) {
  const parts = useMemo(() => {
    const n = 5
    return Array.from({ length: n }).map((_, i) => {
      const r = (seed + i * 137) % 100
      return {
        left: 18 + ((seed + i * 53) % 64),       // 18~82%
        delay: ((r % 30) / 10).toFixed(2),         // 0~3.0s
        dur: (2.2 + ((seed + i * 17) % 22) / 10).toFixed(2), // 2.2~4.4s
      }
    })
  }, [seed])
  return (
    <div className="vein-sparkles" aria-hidden="true">
      {parts.map((p, i) => (
        <span
          key={i}
          className="vein-spark"
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
        />
      ))}
    </div>
  )
}

// ── 개별 금광 칸 ──────────────────────────────────────────────────────────────
function MineRow({ stock, market, minW, maxW }) {
  if (!stock) {
    return (
      <div className="mine-row empty">
        <div className="mr-empty-ore" />
        <span className="mr-empty-label">미개발 광구</span>
      </div>
    )
  }
  const up = stock.returnRate >= 0
  const weight = stock._weight ?? 0
  const scale = veinScale(weight, minW, maxW)
  // 밝기(글로우)도 크기와 함께 — 주력 종목이 더 밝음 (단, 모두 금색)
  const norm = maxW > minW ? Math.min(Math.max((weight - minW) / (maxW - minW), 0), 1) : 0.5
  const glow = (12 + norm * 26).toFixed(0)        // 12~38px
  const glowA = (0.4 + norm * 0.4).toFixed(2)      // .40~.80
  const seed = seedOf(stock.ticker)
  const minerals = mineralCount(stock.holdingDays)
  const nuggets = Math.min(3, minerals)

  return (
    <div className="mine-row">
      {/* [상] 텍스트 바 — 이름 + 수익률(텍스트로만) + 평가금액 */}
      <div className="mr-head">
        <span className="mr-name">{stock.name}</span>
        <span className="mr-rate" style={{ color: profitColor(stock.returnRate) }}>
          {up ? '▲' : '▼'} {pct(stock.returnRate)}
        </span>
        <span className="mr-amount">{compactAmount(market, stock.evalAmount)}</span>
      </div>

      {/* [중] 광맥(비중 비례 크기·밝기) + 일꾼 2명(stagger) */}
      <div className="mr-mine">
        <VeinSparkles seed={seed} />
        <img
          className="mr-vein"
          src={scene.veinGold}
          alt="" aria-hidden="true"
          style={{
            transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
            filter: `drop-shadow(0 0 ${glow}px rgba(255,210,90,${glowA}))`,
          }}
        />
        <Miner variant="vleft" delayMs={(seed % 5) * 90} />
        <Miner variant="vright" delayMs={((seed >> 2) % 5) * 90 + 140} />
      </div>

      {/* [하] 누적 광물 ×N + 배당 칩 */}
      <div className="mr-foot">
        <div className="mr-minerals">
          {Array.from({ length: nuggets }).map((_, i) => (
            <img key={i} className="mr-nugget" src={scene.gemGold} alt="" aria-hidden="true" />
          ))}
          <span className="mr-mineral-count">캔 광물 ×{minerals}</span>
        </div>
        {stock.dividendCount > 0 && (
          <span className="mr-div-chip">💧 배당 {stock.dividendCount}회</span>
        )}
      </div>
    </div>
  )
}

// ── 세로 2칸 + 페이지네이션 ───────────────────────────────────────────────────
export default function MineColumn({ holdings, market, onOpenAll }) {
  const [page, setPage] = useState(0)
  const dragRef = useRef({ x: 0, active: false })

  // 광물 프리로드
  useEffect(() => {
    const img = new window.Image(); img.src = scene.gemGold
  }, [])

  // 포트 전체 비중 + 최소/최대(광맥 크기 안정 기준)
  const { withWeight, minW, maxW } = useMemo(() => {
    const total = holdings.reduce((s, h) => s + (h.evalAmount || 0), 0) || 1
    const ww = holdings.map((h) => ({ ...h, _weight: (h.evalAmount || 0) / total }))
    const ws = ww.map((h) => h._weight)
    return { withWeight: ww, minW: Math.min(...ws), maxW: Math.max(...ws) }
  }, [holdings])

  const count = withWeight.length
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))
  useEffect(() => { if (page > pageCount - 1) setPage(pageCount - 1) }, [pageCount, page])

  const safePage = Math.min(page, pageCount - 1)
  const start = safePage * PAGE_SIZE
  const slots = [0, 1].map((i) => withWeight[start + i] || null)
  const hasPrev = safePage > 0
  const hasNext = safePage < pageCount - 1
  const goPage = (dir) => setPage((p) => Math.min(Math.max(p + dir, 0), pageCount - 1))

  const onPointerDown = (e) => { dragRef.current = { x: e.clientX, active: true } }
  const onPointerUp = (e) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.x
    dragRef.current.active = false
    if (Math.abs(dx) < TAP_SLOP) { onOpenAll?.(); return }
    if (dx <= -SWIPE_THRESHOLD) goPage(+1)
    else if (dx >= SWIPE_THRESHOLD) goPage(-1)
  }

  return (
    <div
      className="mine-col-wrap"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { dragRef.current.active = false }}
    >
      <div className="mine-col">
        {slots.map((s, i) => (
          <MineRow key={s ? s.ticker : `empty-${i}`} stock={s} market={market} minW={minW} maxW={maxW} />
        ))}
      </div>

      {pageCount > 1 && (
        <>
          {/* 화살표: 포인터 전파 차단 → wrap 탭(시트 열림) 충돌 방지 */}
          <button
            className={`mc-edge mc-edge-left ${hasPrev ? '' : 'off'}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); goPage(-1) }}
            disabled={!hasPrev}
            aria-label="이전 페이지"
          >‹</button>
          <button
            className={`mc-edge mc-edge-right ${hasNext ? '' : 'off'}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); goPage(+1) }}
            disabled={!hasNext}
            aria-label="다음 페이지"
          >›</button>

          <div className="mc-indicator">
            <div className="mc-dots" aria-hidden="true">
              {Array.from({ length: pageCount }).map((_, i) => (
                <span key={i} className={`mc-dot ${i === safePage ? 'on' : ''}`} />
              ))}
            </div>
            <span className="mc-count">{safePage + 1} / {pageCount}</span>
          </div>
        </>
      )}
    </div>
  )
}
