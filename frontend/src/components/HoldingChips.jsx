// 보유 종목 미리보기 칩 — 큰 칩, 가로 스크롤 (CLAUDE.md §5).
// 화면 가로 약 1/3씩, 수익률 색상 분리. 스크롤로 전체 탐색.
import { pct, profitColor } from '../utils/format'

export default function HoldingChips({ holdings, total, onExpand }) {
  return (
    <div className="holding-chips-lg">
      {holdings.map((h) => (
        <button className="holding-chip-lg" key={h.ticker} onClick={onExpand}>
          <span className="chip-lg-name">{h.name}</span>
          <span className="chip-lg-rate" style={{ color: profitColor(h.returnRate) }}>
            {pct(h.returnRate)}
          </span>
        </button>
      ))}
      {total > holdings.length && (
        <button className="holding-chip-lg more-chip" onClick={onExpand} aria-label="전체 보기">
          <span className="chip-lg-more">+{total - holdings.length}</span>
          <span className="chip-lg-more-sub">종목 더보기</span>
        </button>
      )}
    </div>
  )
}
