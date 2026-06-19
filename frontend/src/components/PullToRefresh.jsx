// 당겨서 새로고침 — 스크롤 최상단에서 아래로 당기면 onRefresh 호출.
import { useRef, useState } from 'react'

const THRESHOLD = 65  // px
const MAX_PULL  = 90

export default function PullToRefresh({ onRefresh, refreshing, children }) {
  const [pullY, setPullY] = useState(0)
  const startY   = useRef(0)
  const pulling  = useRef(false)
  const containerRef = useRef(null)

  function onTouchStart(e) {
    startY.current = e.touches[0].clientY
    pulling.current = false
  }

  function onTouchMove(e) {
    if (refreshing) return
    const dy = e.touches[0].clientY - startY.current
    const el = containerRef.current
    if (!el) return
    if (dy > 0 && el.scrollTop === 0) {
      pulling.current = true
      setPullY(Math.min(dy * 0.45, MAX_PULL))
    } else if (pulling.current && dy <= 0) {
      setPullY(0)
      pulling.current = false
    }
  }

  function onTouchEnd() {
    if (pulling.current && pullY >= THRESHOLD && !refreshing) {
      onRefresh()
    }
    setPullY(0)
    pulling.current = false
  }

  const triggered = pullY >= THRESHOLD
  const showIndicator = pullY > 0 || refreshing

  return (
    <div
      ref={containerRef}
      className="ptr-container"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {showIndicator && (
        <div className="ptr-bar" style={{ height: refreshing ? 44 : pullY }}>
          <span className={`ptr-icon${refreshing ? ' spinning' : ''}`}>⛏️</span>
          <span className="ptr-text">
            {refreshing ? '광맥 측량 중…' : triggered ? '놓으면 새로고침' : '당겨서 새로고침'}
          </span>
        </div>
      )}
      {children}
    </div>
  )
}
