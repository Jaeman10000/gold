// 광맥 레이더 이벤트 Bottom Sheet.
// supply_buy / supply_sell → 외인·기관 수치 + 뉴스 3개
// score_up / score_dn → 점수 변화 상세
// MineHome 최상단에서 렌더링 → home-overlay 클리핑 없음.
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
  const isQuiet  = event.type === 'quiet'
  const wantNews = isSupply || isQuiet  // 종목 카드면 뉴스 노출
  const [news, setNews]     = useState(null)
  const [loading, setLoading] = useState(false)

  // 시트 열리는 동안 배경 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    if (!wantNews) return
    setLoading(true)
    api.newsForTicker('KR', event.ticker)
      .then(d => setNews(d.items || []))
      .catch(() => setNews([]))
      .finally(() => setLoading(false))
  }, [event.ticker, wantNews])

  const foreign = event.detail?.foreign ?? 0
  const inst    = event.detail?.inst    ?? 0

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet supply-detail-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="sds-title">
          {event.emoji} {event.name}
        </div>
        <div className="sds-subtitle">투자권유 아님</div>

        {isSupply && (
          <>
            <div className="sds-row">
              <div className="sds-item">
                <span className="sds-label">외국인</span>
                <span className={`sds-val ${foreign >= 0 ? 'up' : 'dn'}`}>{fmtShares(foreign)}</span>
              </div>
              <div className="sds-divider" />
              <div className="sds-item">
                <span className="sds-label">기관</span>
                <span className={`sds-val ${inst >= 0 ? 'up' : 'dn'}`}>{fmtShares(inst)}</span>
              </div>
            </div>
            <div className="sds-note">오늘 기준 순매수 주 수 · 수급 데이터는 지연될 수 있습니다</div>
          </>
        )}

        {isScore && (
          <>
            <div className="sds-row">
              <div className="sds-item">
                <span className="sds-label">전일 점수</span>
                <span className="sds-val">{event.detail?.prev ?? '—'}</span>
              </div>
              <div className="sds-divider" />
              <div className="sds-item">
                <span className="sds-label">변화</span>
                <span className={`sds-val ${(event.detail?.delta ?? 0) >= 0 ? 'up' : 'dn'}`}>
                  {(event.detail?.delta ?? 0) >= 0 ? '+' : ''}{event.detail?.delta ?? 0}
                </span>
              </div>
            </div>
            <div className="sds-row" style={{ marginTop: 4 }}>
              <div className="sds-item">
                <span className="sds-label">오늘 점수</span>
                <span className={`sds-val ${(event.detail?.delta ?? 0) >= 0 ? 'up' : 'dn'}`}>
                  {event.detail?.cur ?? '—'}
                </span>
              </div>
            </div>
            <div className="sds-note">측량소 기본 모드 펀더멘털 점수 · 재무·수급·시장신뢰 기반</div>
          </>
        )}

        {isQuiet && (
          <div className="sds-note" style={{ marginTop: 4 }}>
            오늘 외국인·기관 순매수 변동이 두드러지지 않았어요 · 수급 데이터는 지연될 수 있습니다
          </div>
        )}

        {wantNews && (
          <div className="sds-news">
            {loading && <div className="sds-news-loading">뉴스 불러오는 중…</div>}
            {!loading && news?.length === 0 && (
              <div className="sds-news-loading">관련 뉴스가 없습니다.</div>
            )}
            {!loading && news && news.length > 0 && (
              <>
                <div className="sds-news-header">관련 뉴스</div>
                {news.slice(0, 3).map((item, i) => (
                  <a className="sds-news-item" key={i} href={item.link || item.url} target="_blank" rel="noopener noreferrer">
                    <div className="sni-title">{item.title}</div>
                    <div className="sni-meta">{item.press || item.pubDate} · {item.datetimeText || ''}</div>
                  </a>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
