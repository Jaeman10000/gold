// 수급 한 줄 클릭 → Bottom Sheet: 외인·기관 순매수 수치 + 관련 뉴스 3개.
// CLAUDE.md §4: 투자권유 아님 · 정보 제공 목적.
import { useState, useEffect } from 'react'
import { api } from '../api/client'

function fmtShares(val) {
  if (!val) return '0주'
  const abs = Math.abs(val)
  const sign = val > 0 ? '+' : '-'
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}만주`
  return `${sign}${abs.toLocaleString()}주`
}

export default function SupplyDetailSheet({ supply, onClose }) {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supply?.ticker) { setLoading(false); return }
    api.newsForTicker('KR', supply.ticker)
      .then(r => setNews(r.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [supply?.ticker])

  if (!supply) return null

  const isUp = supply.arrow === '↑'

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet supply-detail-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sds-title">{supply.name}</div>
        <div className="sds-subtitle">오늘의 수급 · 투자권유 아님</div>

        <div className="sds-row">
          <div className="sds-item">
            <span className="sds-label">외국인</span>
            <span className={`sds-val ${isUp ? 'up' : 'dn'}`}>{fmtShares(supply.foreign)}</span>
          </div>
          <div className="sds-divider" />
          <div className="sds-item">
            <span className="sds-label">기관</span>
            <span className={`sds-val ${isUp ? 'up' : 'dn'}`}>{fmtShares(supply.inst)}</span>
          </div>
        </div>
        <div className="sds-note">수급 데이터는 지연될 수 있습니다 · 키움 API 기준</div>

        {loading ? (
          <div className="sds-news-loading">관련 뉴스를 불러오는 중…</div>
        ) : news.length > 0 ? (
          <div className="sds-news">
            <div className="sds-news-header">관련 뉴스</div>
            {news.slice(0, 3).map((n, i) => (
              <a
                className="sds-news-item"
                key={n.url || i}
                href={n.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <div className="sni-title">{n.title}</div>
                <div className="sni-meta">{n.press} · {n.datetimeText}</div>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
