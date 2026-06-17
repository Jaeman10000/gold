// 수익률 패널 (CLAUDE.md §5: ▲ +18.4% / 평가수익 +₩1.72M). 탭하면 전종목 펼침.
import { formatAmount, pct, profitColor } from '../utils/format'

export default function ReturnPanel({ data, onExpand }) {
  const { returnRate, evalProfit, market } = data
  const up = returnRate >= 0
  const profitStr = (evalProfit > 0 ? '+' : '') + formatAmount(market, evalProfit)
  return (
    <button className="return-panel" onClick={onExpand}>
      <span className="rp-rate" style={{ color: profitColor(returnRate) }}>
        {up ? '▲' : '▼'} {pct(returnRate)}
      </span>
      <span className="rp-profit">평가수익 {profitStr}</span>
      <span className="rp-caret">›</span>
    </button>
  )
}
