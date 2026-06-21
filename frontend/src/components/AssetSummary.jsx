// 자산 요약 한 줄 (CLAUDE.md §5) — HUD 아래 씬 위에 얇게 플로팅.
// 작은 금더미(총자산 상징, 3단계) + 총 평가금액(금색) + 수익률(초록/빨강). 탭 → 전체 보유 시트.
import { formatAmount, profitColor } from '../utils/format'
import { scene } from '../assets'

// 금더미 3단계 — 총 평가금액(원) 기준. (구 MineScene goldPileSrc 로직 이전)
function goldPileSrc(goldAmount) {
  if (goldAmount >= 100_000_000) return scene.goldLarge
  if (goldAmount >= 10_000_000) return scene.goldMedium
  return scene.goldSmall
}

export default function AssetSummary({ data, goldOverride, goldAmount = 0, onExpand }) {
  const { returnRate, evalProfit, market } = data
  const up = returnRate >= 0
  const color = profitColor(returnRate)
  const goldText = goldOverride || data.goldAmountDisplay
  const profitSign = up ? '+' : '−'
  const profitAbs = formatAmount(market, Math.abs(evalProfit))

  return (
    <button className="asset-summary" onClick={onExpand}>
      <img className="as-pile" src={goldPileSrc(goldAmount)} alt="" aria-hidden="true" />
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
