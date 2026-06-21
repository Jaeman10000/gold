// 뉴스 아이템 Bottom Sheet — 홈 뉴스 스트립 탭 시 표시.
// 기사 링크·종목명·날짜 표시. CLAUDE.md §4: 투자권유 아님.
import { useEffect } from 'react'

export default function NewsItemSheet({ item, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!item) return null

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet news-item-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="nis-stock">{item.stockName}</div>
        <div className="nis-title">{item.title}</div>
        <div className="nis-meta">{item.press}{item.datetimeText ? ` · ${item.datetimeText}` : ''}</div>

        <a
          className="nis-link-btn"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
        >
          기사 보기 →
        </a>

        <div className="nis-disclaimer">투자권유 아님 · 정보 제공 목적</div>
      </div>
    </div>
  )
}
