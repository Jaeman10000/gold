// 광맥 레이더 — 보유 종목 기준 이벤트 카드 패널.
// 6개 초과 시 네이티브 가로 스크롤 캐러셀(scroll-snap) + 점 인디케이터.
// 캐러셀이라 카드(버튼) 위에서도 가로 스와이프가 먹힘(탭=카드 열기, 끌기=페이지 넘김).
// CLAUDE.md §12: 매수/매도 권유 표현 0개.
import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api/client'

const PAGE_SIZE = 6

export default function RadarPanel({ market, onSelect }) {
  const [events, setEvents] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [pageIdx, setPageIdx] = useState(0)
  const trackRef = useRef(null)

  useEffect(() => {
    setLoaded(false)
    setPageIdx(0)
    api.radar(market)
      .then(d => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoaded(true))
  }, [market])

  const onScroll = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setPageIdx(Math.round(el.scrollLeft / el.clientWidth))
  }, [])

  const goPage = useCallback((i) => {
    const el = trackRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }, [])

  if (!loaded || events.length === 0) return null

  // 6개씩 페이지 분할
  const pages = []
  for (let i = 0; i < events.length; i += PAGE_SIZE) pages.push(events.slice(i, i + PAGE_SIZE))

  return (
    <div className="radar-panel">
      <div className="radar-header">
        <span className="radar-title">광맥 레이더</span>
        <span className="radar-sub">보유종목 기준</span>
      </div>

      <div className="radar-track" ref={trackRef} onScroll={onScroll}>
        {pages.map((pageEvents, pi) => (
          <div className="radar-page" key={pi}>
            {pageEvents.map((ev, i) => (
              <button
                key={pi * PAGE_SIZE + i}
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
        ))}
      </div>

      {pages.length > 1 && (
        <div className="radar-dots">
          {pages.map((_, i) => (
            <span
              key={i}
              className={`radar-dot${i === pageIdx ? ' active' : ''}`}
              onClick={() => goPage(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
