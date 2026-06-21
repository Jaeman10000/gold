// 홈 뉴스 스트립 — 보유종목 최신 뉴스를 가로 스크롤 알약으로 표시.
// 뉴스 없으면 null(숨김). 투자권유 아님. CLAUDE.md §4.
import { useState, useEffect } from 'react'
import { api } from '../api/client'

// 제목을 종목명 없이 짧게 (최대 22자)
function shortTitle(title, maxLen = 22) {
  if (!title) return ''
  return title.length > maxLen ? title.slice(0, maxLen) + '…' : title
}

export default function NewsStrip({ market, onSelect }) {
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setItems([])
    api.news(market)
      .then(d => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoaded(true))
  }, [market])

  if (!loaded || items.length === 0) return null

  return (
    <div className="news-strip-wrap">
      <div className="news-strip">
        {items.map((item, i) => (
          <button
            key={item.url || i}
            className="news-pill"
            onClick={() => onSelect(item)}
          >
            📰 <span className="np-stock">{item.stockName}</span>
            <span className="np-sep">, </span>
            <span className="np-title">{shortTitle(item.title)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
