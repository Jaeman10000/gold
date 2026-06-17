// 시장 전환 버튼 (CLAUDE.md §5). KR 보는 중 → "US 광맥 이동".
import { useMarket } from '../store/marketStore'

export default function MarketToggle() {
  const { market, toggle } = useMarket()
  const label = market === 'KR' ? 'US 광맥 이동' : 'KR 광맥 이동'
  return (
    <button className="market-toggle" onClick={toggle}>
      {label}
    </button>
  )
}
