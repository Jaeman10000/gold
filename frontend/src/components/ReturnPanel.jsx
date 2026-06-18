// 수익률 알약 (CLAUDE.md §5). 손실=레드, 수익=그린.
// 형식: "▼ 2.0% 평가손실 −₩141,998" — 알약 크기, 중앙 배치.
import { formatAmount, profitColor } from '../utils/format'

export default function ReturnPanel({ data, onExpand }) {
  const { returnRate, evalProfit, market } = data
  const up = returnRate >= 0
  const color = profitColor(returnRate)
  const glowRgb = up ? '76,198,106' : '226,101,92'

  const absRateStr = Math.abs(returnRate).toFixed(1) + '%'
  const rateLabel = up ? '평가수익' : '평가손실'
  const profitSign = up ? '+' : '−'
  const profitAbs = formatAmount(market, Math.abs(evalProfit))

  return (
    <button
      className="return-pill"
      style={{
        borderColor: color,
        color,
        boxShadow: `0 0 8px rgba(${glowRgb},.5), 0 0 18px rgba(${glowRgb},.3)`,
      }}
      onClick={onExpand}
    >
      <span className="pill-arrow">{up ? '▲' : '▼'}</span>
      <span className="pill-rate">{absRateStr}</span>
      <span className="pill-label">{rateLabel}</span>
      <span className="pill-amount">{profitSign}{profitAbs}</span>
    </button>
  )
}
