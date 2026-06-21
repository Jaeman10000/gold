// 광맥 레이더 — 보유 종목 기준 이벤트 카드 패널.
// 이벤트 없으면 null 반환(패널 숨김). CLAUDE.md §12: 매수/매도 권유 표현 0개.
// selected 상태는 MineHome에서 관리 → Bottom Sheet가 home-overlay 바깥에서 렌더링됨.
import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function RadarPanel({ market, onSelect }) {
  const [events, setEvents] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    api.radar(market)
      .then(d => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoaded(true))
  }, [market])

  if (!loaded || events.length === 0) return null

  return (
    <div className="radar-panel">
      <div className="radar-header">
        <span className="radar-title">광맥 레이더</span>
        <span className="radar-sub">보유종목 기준</span>
      </div>
      <div className="radar-grid">
        {events.slice(0, 6).map((ev, i) => (
          <button
            key={i}
            className={`radar-card rc-${ev.type}`}
            onClick={() => onSelect(ev)}
          >
            <span className="rc-emoji">{ev.emoji}</span>
            <div className="rc-body">
              <span className="rc-name">{ev.name}</span>
              <span className="rc-text">{ev.text}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
