// 보유 종목 상위 3 미리보기 칩 (CLAUDE.md §5: 코드가 그림, 씬에 안 구움).
// 넘치면 › 로 펼침 유도.
import { pct, profitColor } from '../utils/format'

export default function HoldingChips({ holdings, total, onExpand }) {
  return (
    <div className="holding-chips">
      {holdings.map((h) => (
        <span className="holding-chip" key={h.ticker}>
          {h.name} <b style={{ color: profitColor(h.returnRate) }}>{pct(h.returnRate)}</b>
        </span>
      ))}
      {/* 더 있으면 줄바꿈 없이 끝에 › 하나만 */}
      {total > holdings.length && (
        <button className="holding-chip more" onClick={onExpand} aria-label="전체 보기">›</button>
      )}
    </div>
  )
}
