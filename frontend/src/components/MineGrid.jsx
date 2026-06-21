// 금광 그리드 (CLAUDE.md §5) — "내 광산을 내려다보는 뷰".
// 2×2 = 한 화면 금광 4개. 종목 4개 초과 시 페이지 스와이프(끝 clamp).
// 각 칸: 캔 광물(수익률 tier gem) + 광석 + 일꾼1 + 하단 텍스트 오버레이.
// 손실 종목은 글로우 약화. 빈 칸은 '미개발 광구'. 탭 → 전체 보유 시트.
import { useRef, useState, useEffect } from 'react'
import { pct, profitColor } from '../utils/format'
import { scene } from '../assets'
import Miner from './Miner'

// 수익률(등락률, %) → 광물 에셋. (StockMineStage·HoldingChips와 동일 기준)
const GEM_TIERS = [
  { min: 20,        key: 'gemBlue'   },
  { min: 10,        key: 'gemPurple' },
  { min: 3,         key: 'gemGreen'  },
  { min: 0,         key: 'gemTeal'   },
  { min: -10,       key: 'gemOrange' },
  { min: -Infinity, key: 'gemGold'   },
]
function gemFor(rate) {
  const t = GEM_TIERS.find((x) => rate >= x.min) || GEM_TIERS[GEM_TIERS.length - 1]
  return scene[t.key]
}

const PAGE_SIZE = 4
const SWIPE_THRESHOLD = 45
const TAP_SLOP = 8

// 칸 하단 평가금액 축약 — 작은 칸용. KR=만/억, US=K/M.
function compactAmount(market, v) {
  if (v === null || v === undefined) return ''
  if (market === 'US') {
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
    return `$${Math.round(v)}`
  }
  if (v >= 1e8) return `₩${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1)}억`
  if (v >= 1e4) return `₩${Math.round(v / 1e4).toLocaleString()}만`
  return `₩${Math.round(v).toLocaleString()}`
}

function useGemPreload() {
  useEffect(() => {
    GEM_TIERS.forEach(({ key }) => { const img = new window.Image(); img.src = scene[key] })
  }, [])
}

// ── 개별 금광 칸 ──────────────────────────────────────────────────────────────
function MineCell({ stock, market, slotIdx }) {
  if (!stock) {
    return (
      <div className="mine-cell empty">
        <div className="mc-empty-ore" />
        <span className="mc-empty-label">미개발 광구</span>
      </div>
    )
  }
  const up = stock.returnRate >= 0
  return (
    <div className={`mine-cell ${up ? '' : 'loss'}`}>
      {/* [상] 캔 광물 — 칸 시선 집중점 */}
      <div className="mc-gem-zone">
        <img className="mc-gem" src={gemFor(stock.returnRate)} alt="" aria-hidden="true" />
      </div>

      {/* [중] 광석 + 일꾼1 (곡괭이질) */}
      <div className="mc-mine">
        <img className="mc-ore" src={scene.veinGold} alt="" aria-hidden="true" />
        <Miner variant="cell" delayMs={(slotIdx % 4) * 190} />
      </div>

      {/* [하] 텍스트 오버레이 */}
      <div className="mc-overlay">
        <div className="mc-line1">
          <span className="mc-name">{stock.name}</span>
          <span className="mc-rate" style={{ color: profitColor(stock.returnRate) }}>
            {up ? '▲' : '▼'}{pct(stock.returnRate)}
          </span>
        </div>
        <div className="mc-amount">{compactAmount(market, stock.evalAmount)}</div>
      </div>
    </div>
  )
}

// ── 그리드 + 페이지네이션 ─────────────────────────────────────────────────────
export default function MineGrid({ holdings, market, onOpenAll }) {
  const [page, setPage] = useState(0)
  const dragRef = useRef({ x: 0, active: false })
  useGemPreload()

  const count = holdings.length
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))

  useEffect(() => { if (page > pageCount - 1) setPage(pageCount - 1) }, [pageCount, page])

  const safePage = Math.min(page, pageCount - 1)
  const start = safePage * PAGE_SIZE
  const slots = [0, 1, 2, 3].map((i) => holdings[start + i] || null)
  const hasPrev = safePage > 0
  const hasNext = safePage < pageCount - 1

  const goPage = (dir) => setPage((p) => Math.min(Math.max(p + dir, 0), pageCount - 1))

  const onPointerDown = (e) => { dragRef.current = { x: e.clientX, active: true } }
  const onPointerUp = (e) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.x
    dragRef.current.active = false
    if (Math.abs(dx) < TAP_SLOP) { onOpenAll?.(); return }   // 탭 → 전체 시트
    if (dx <= -SWIPE_THRESHOLD) goPage(+1)                   // 좌로 끌기 → 다음 페이지
    else if (dx >= SWIPE_THRESHOLD) goPage(-1)
  }

  return (
    <div
      className="mine-grid-wrap"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { dragRef.current.active = false }}
    >
      <div className="mine-grid">
        {slots.map((s, i) => (
          <MineCell key={start + i} stock={s} market={market} slotIdx={i} />
        ))}
      </div>

      {pageCount > 1 && (
        <>
          {/* 화살표 버튼: 포인터 전파 차단 → wrap의 탭 감지(시트 열림)와 충돌 방지 */}
          <button
            className={`mg-edge mg-edge-left ${hasPrev ? '' : 'off'}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); goPage(-1) }}
            disabled={!hasPrev}
            aria-label="이전 페이지"
          >‹</button>
          <button
            className={`mg-edge mg-edge-right ${hasNext ? '' : 'off'}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); goPage(+1) }}
            disabled={!hasNext}
            aria-label="다음 페이지"
          >›</button>

          <div className="mg-indicator">
            <div className="mg-dots" aria-hidden="true">
              {Array.from({ length: pageCount }).map((_, i) => (
                <span key={i} className={`mg-dot ${i === safePage ? 'on' : ''}`} />
              ))}
            </div>
            <span className="mg-count">{safePage + 1} / {pageCount}</span>
          </div>
        </>
      )}
    </div>
  )
}
