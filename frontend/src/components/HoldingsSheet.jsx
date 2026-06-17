// 전체 보유 종목 바텀시트 (CLAUDE.md §5 펼침). 이름·평가금액·수익률, 스크롤.
import { money, pct, profitColor } from '../utils/format'

export default function HoldingsSheet({ open, onClose, holdings, market }) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">보유 종목 · 전체 ({holdings.length})</div>
        <div className="sheet-list">
          {holdings.map((h) => (
            <div className="sheet-row" key={h.ticker}>
              <span className="sr-name">{h.name}</span>
              <span className="sr-amount">{money(market, h.evalAmount)}</span>
              <span className="sr-rate" style={{ color: profitColor(h.returnRate) }}>{pct(h.returnRate)}</span>
            </div>
          ))}
        </div>
        <button className="sheet-close" onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}
