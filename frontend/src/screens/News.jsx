// 뉴스 — 보유 종목 관련 네이버 증권 뉴스. CLAUDE.md §4: 종목 추천 아님(정보 제공).
import { useState, useEffect, useCallback } from 'react'
import { useMarket } from '../store/marketStore'
import { api } from '../api/client'
import MarketToggle from '../components/MarketToggle'
import LoadingMascot from '../components/LoadingMascot'
import ErrorState from '../components/ErrorState'
export default function News() {
  const { market } = useMarket()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback((isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true)
    setError(null)
    api.news(market)
      .then(setData)
      .catch(e => setError(String(e.message || e)))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }, [market])

  useEffect(() => { load() }, [load])

  const items = data?.items || []

  return (
    <div className="screen news-screen">
      <header className="screen-header">
        <h2 className="survey-title">뉴스 <span className="mode-badge basic-badge">보유 종목</span></h2>
        <div className="header-right">
          <button className="refresh-btn" onClick={() => load(true)} disabled={refreshing} title="새로고침">
            <span className={refreshing ? 'refresh-icon spinning' : 'refresh-icon'}>↺</span>
          </button>
          <MarketToggle />
        </div>
      </header>

      {loading && !data && <LoadingMascot text="뉴스를 모으는 중…" />}
      {error && !data && <ErrorState message={`백엔드 연결 실패: ${error}`} onRetry={() => load()} />}

      {!loading && data && (
        <div className="news-body">
          {data.locked ? (
            <div className="news-empty">{data.note || '해외 종목 뉴스는 준비 중입니다.'}</div>
          ) : items.length === 0 ? (
            <div className="news-empty">관련 뉴스를 찾지 못했어요. 잠시 후 다시 시도해 주세요.</div>
          ) : (
            <div className="news-list">
              {items.map((n, i) => (
                <a className="news-card" key={n.url || i} href={n.url} target="_blank" rel="noreferrer noopener">
                  <div className="news-card-top">
                    <span className="news-stock-tag">{n.stockName}</span>
                    <span className="news-time">{n.datetimeText}</span>
                  </div>
                  <div className="news-title">{n.title}</div>
                  <div className="news-press">{n.press}</div>
                </a>
              ))}
            </div>
          )}
          <div className="disclaimer-line">{data.disclaimer}</div>
        </div>
      )}
    </div>
  )
}
