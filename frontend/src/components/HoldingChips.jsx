// 보유 종목 전체 가로 스크롤 칩 (CLAUDE.md §5). 홈 화면용.
// holdings = 전체 보유 배열. 가로 스와이프로 모든 종목 탐색.
import { pct, profitColor } from '../utils/format'

export default function HoldingChips({ holdings, onExpand }) {
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
    </div>
  )
}
