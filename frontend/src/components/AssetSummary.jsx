// 자산 요약 한 줄 (CLAUDE.md §5) — HUD 아래 씬 위에 얇게 플로팅.
// 총 평가금액(금색) + 수익률(초록/빨강). 탭 → 전체 보유 시트.
// 기존 "총 평가금액" 큰 블록 + 별도 수익률 알약을 한 줄로 통합 → 씬 공간 확보.
import { formatAmount, profitColor } from '../utils/format'

export default function AssetSummary({ data, goldOverride, onExpand }) {
  const { returnRate, evalProfit, market } = data
  const up = returnRate >= 0
  const color = profitColor(returnRate)
  const goldText = goldOverride || data.goldAmountDisplay
  const profitSign = up ? '+' : '−'
  const profitAbs = formatAmount(market, Math.abs(evalProfit))

  return (
    <button className="asset-summary" onClick={onExpand}>
      <span className="as-amount">{goldText}</span>
      <span className="as-sep" />
      <span className="as-return" style={{ color }}>
        <span className="as-arrow">{up ? '▲' : '▼'}</span>
        {Math.abs(returnRate).toFixed(1)}%
        <span className="as-profit">{profitSign}{profitAbs}</span>
      </span>
    </button>
  )
}
