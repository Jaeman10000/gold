// 보유 종목 카드 (CLAUDE.md §5). 홈 화면용.
// 한 번에 2개씩 페이지로 표시. › 탭으로 다음 페이지(마지막→첫 페이지 순환).
import { useState, useEffect } from 'react'
import { pct, profitColor } from '../utils/format'
import { scene } from '../assets'

// 수익률(등락률, %) → 광물 에셋. 임계값은 여기 한 곳에서 수정.
// 위에서부터 검사: r >= min 인 첫 구간 매칭.
const GEM_TIERS = [
  { min: 20,        key: 'gemBlue'   },  // +20% 이상   (대박)
  { min: 10,        key: 'gemPurple' },  // +10 ~ +20%  (큰 수익)
  { min: 3,         key: 'gemGreen'  },  // +3 ~ +10%   (수익)
  { min: 0,         key: 'gemTeal'   },  // 0 ~ +3%     (본전 근처)
  { min: -10,       key: 'gemOrange' },  // -10 ~ 0%    (손실)
  { min: -Infinity, key: 'gemGold'   },  // -10% 이하   (큰 손실)
]

function gemFor(returnRate) {
  const tier = GEM_TIERS.find((t) => returnRate >= t.min) || GEM_TIERS[GEM_TIERS.length - 1]
  return scene[tier.key]
}

const PAGE_SIZE = 2

// 광물 이미지 프리로드 — 페이지 전환 시 깜빡임 방지
function useGemPreload() {
  useEffect(() => {
    GEM_TIERS.forEach(({ key }) => {
      const img = new window.Image()
      img.src = scene[key]
    })
  }, [])
}

export default function HoldingChips({ holdings, onExpand }) {
  const [page, setPage] = useState(0)
  useGemPreload()

  const pageCount = Math.max(1, Math.ceil(holdings.length / PAGE_SIZE))
  const safePage  = page % pageCount
  const start     = safePage * PAGE_SIZE
  const visible   = holdings.slice(start, start + PAGE_SIZE)
  const hasPages  = pageCount > 1

  const nextPage = (e) => {
    e.stopPropagation()
    setPage((p) => (p + 1) % pageCount)   // 마지막 → 첫 페이지 순환
  }

  return (
    <div className="holding-chips-wrap">
      <div className="holding-chips-page">
        {visible.map((h) => (
          <button className="holding-chip-lg" key={h.ticker} onClick={onExpand}>
            <div className="chip-lg-left">
              <span className="chip-lg-name">{h.name}</span>
              <span className="chip-lg-rate" style={{ color: profitColor(h.returnRate) }}>
                {pct(h.returnRate)}
              </span>
            </div>
            <img className="chip-mineral" src={gemFor(h.returnRate)} alt="" aria-hidden="true" />
          </button>
        ))}
      </div>

      {hasPages && (
        <button className="chips-nav-btn chips-nav-right" onClick={nextPage} aria-label="다음 종목">
          ›
        </button>
      )}

      {hasPages && (
        <div className="chips-page-dots" aria-hidden="true">
          {Array.from({ length: pageCount }).map((_, i) => (
            <span key={i} className={`chips-dot ${i === safePage ? 'on' : ''}`} />
          ))}
        </div>
      )}
    </div>
  )
}
