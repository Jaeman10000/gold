// 수익률 패널 (CLAUDE.md §5). 손실=레드, 수익=그린 — 테두리·숫자·금액 통일.
import { formatAmount, pct, profitColor } from '../utils/format'

export default function ReturnPanel({ data, onExpand }) {
  const { returnRate, evalProfit, market } = data
  const up = returnRate >= 0
  const color = profitColor(returnRate)
  const glowRgb = up ? '76,198,106' : '226,101,92'
  const profitStr = (evalProfit > 0 ? '+' : '') + formatAmount(market, evalProfit)

  return (
    <button
      className="return-panel"
      style={{
        borderColor: color,
        boxShadow: `0 0 10px rgba(${glowRgb},.65), 0 0 22px rgba(${glowRgb},.4), inset 0 0 12px rgba(${glowRgb},.18)`,
      }}
      onClick={onExpand}
    >
      <span className="rp-rate" style={{ color }}>
        {up ? '▲' : '▼'} {pct(returnRate)}
      </span>
      <span className="rp-profit" style={{ color }}>{profitStr}</span>
      <span className="rp-caret">›</span>
    </button>
  )
}
