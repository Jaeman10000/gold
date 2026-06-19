// 광맥 레이더 이벤트 Bottom Sheet.
// supply_buy / supply_sell → 외인·기관 수치 + 뉴스 3개 (SupplyDetailSheet 와 동일 구조)
// score_up / score_dn → 점수 변화 상세
import { useState, useEffect } from 'react'
import { api } from '../api/client'

function fmtShares(val) {
  const sign = val >= 0 ? '+' : '-'
  const abs  = Math.abs(val)
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}만주`
  return `${sign}${abs.toLocaleString()}주`
}

export default function RadarDetailSheet({ event, onClose }) {
  const isSupply = event.type === 'supply_buy' || event.type === 'supply_sell'
  const isScore  = event.type === 'score_up'  || event.type === 'score_dn'
  const [news, setNews]   = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isSupply) return
    setLoading(true)
    api.newsForTicker('KR', event.ticker)
      .then(d => setNews(d.items || []))
      .catch(() => setNews([]))
      .finally(() => setLoading(false))
  }, [event.ticker, isSupply])

  const foreign = event.detail?.foreign ?? 0
  const inst    = event.detail?.inst    ?? 0

  return (
    <div className="supply-detail-sheet" onClick={onClose}>
      <div className="sds-content" onClick={e => e.stopPropagation()}>
        <div className="sds-title">
          {event.emoji} {event.name}
        </div>

        {isSupply && (
          <>
            <div className="sds-row">
              <span className="sds-item">외국인</span>
              <span className={`sds-val ${foreign >= 0 ? 'up' : 'dn'}`}>{fmtShares(foreign)}</span>
            </div>
            <div className="sds-row">
              <span className="sds-item">기관</span>
              <span className={`sds-val ${inst >= 0 ? 'up' : 'dn'}`}>{fmtShares(inst)}</span>
            </div>
            <div className="sds-disclaimer">투자권유 아님 · 오늘 기준 순매수 주 수</div>
          </>
        )}

        {isScore && (
          <>
            <div className="sds-row">
              <span className="sds-item">전일 점수</span>
              <span className="sds-val">{event.detail?.prev ?? '—'}</span>
            </div>
            <div className="sds-row">
              <span className="sds-item">오늘 점수</span>
              <span className={`sds-val ${(event.detail?.delta ?? 0) >= 0 ? 'up' : 'dn'}`}>
                {event.detail?.cur ?? '—'}
              </span>
            </div>
            <div className="sds-row">
              <span className="sds-item">변화</span>
              <span className={`sds-val ${(event.detail?.delta ?? 0) >= 0 ? 'up' : 'dn'}`}>
                {(event.detail?.delta ?? 0) >= 0 ? '+' : ''}{event.detail?.delta ?? 0}
              </span>
            </div>
            <div className="sds-disclaimer">투자권유 아님 · 측량소 기본 모드 펀더멘털 점수 · 재무·수급·시장신뢰 기반</div>
          </>
        )}

        {isSupply && (
          <div className="sds-news">
            {loading && <div className="sni-loading">뉴스 불러오는 중…</div>}
            {!loading && news?.length === 0 && (
              <div className="sni-empty">관련 뉴스가 없습니다.</div>
            )}
            {!loading && news?.map((item, i) => (
              <a className="sds-news-item" key={i} href={item.link} target="_blank" rel="noopener noreferrer">
                <div className="sni-title">{item.title}</div>
                <div className="sni-meta">{item.pubDate}</div>
              </a>
            ))}
          </div>
        )}

        <button className="sds-close-btn" onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}
