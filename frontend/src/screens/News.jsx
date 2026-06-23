// 소식 — 광맥 레이더(수급·점수변화) + 보유 종목 뉴스 통합. CLAUDE.md §4·§9·§12.
// 홈에서 레이더·뉴스를 걷어내고 여기 한 곳으로. "내 종목에 무슨 일 생겼나"를 확인하는 탭.
import { useState, useEffect, useCallback, useRef } from 'react'
import { useMarket } from '../store/marketStore'
import { api } from '../api/client'
import MarketToggle from '../components/MarketToggle'
import LoadingMascot from '../components/LoadingMascot'
import ErrorState from '../components/ErrorState'
import RadarPanel from '../components/RadarPanel'
import RadarDetailSheet from '../components/RadarDetailSheet'

export default function News() {
  const { market } = useMarket()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [radarEvent, setRadarEvent] = useState(null)

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

  // 뉴스 4개씩 가로 스크롤 캐러셀 (레이더와 동일 패턴)
  const NEWS_PAGE_SIZE = 4
  const [newsPage, setNewsPage] = useState(0)
  const newsTrackRef = useRef(null)
  useEffect(() => { setNewsPage(0) }, [market])
  const onNewsScroll = useCallback(() => {
    const el = newsTrackRef.current
    if (el) setNewsPage(Math.round(el.scrollLeft / el.clientWidth))
  }, [])
  const goNewsPage = useCallback((i) => {
    const el = newsTrackRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }, [])
  const newsPages = []
  for (let i = 0; i < items.length; i += NEWS_PAGE_SIZE) newsPages.push(items.slice(i, i + NEWS_PAGE_SIZE))

  return (
    <div className="screen news-screen">
      <header className="screen-header">
        <h2 className="survey-title">소식 <span className="mode-badge basic-badge">보유 종목</span></h2>
        <div className="header-right">
          <button className="refresh-btn" onClick={() => load(true)} disabled={refreshing} title="새로고침">
            <span className={refreshing ? 'refresh-icon spinning' : 'refresh-icon'}>↺</span>
          </button>
          <MarketToggle />
        </div>
      </header>

      <div className="news-body">
        {/* 광맥 레이더 — 수급·점수변화 이벤트 (이벤트 없으면 자동 숨김) */}
        <RadarPanel market={market} onSelect={setRadarEvent} />

        {/* 보유 종목 뉴스 */}
        <div className="feed-section-title">📰 보유 종목 뉴스</div>

        {loading && !data && <LoadingMascot text="소식을 모으는 중…" />}
        {error && !data && <ErrorState message={`백엔드 연결 실패: ${error}`} onRetry={() => load()} />}

        {!loading && data && (
          <>
            {data.locked ? (
              <div className="news-empty">{data.note || '해외 종목 뉴스는 준비 중입니다.'}</div>
            ) : items.length === 0 ? (
              <div className="news-empty">관련 뉴스를 찾지 못했어요. 잠시 후 다시 시도해 주세요.</div>
            ) : (
              <>
                <div className="news-track" ref={newsTrackRef} onScroll={onNewsScroll}>
                  {newsPages.map((pageItems, pi) => (
                    <div className="news-page" key={pi}>
                      {pageItems.map((n, i) => (
                        <a className="news-card" key={n.url || `${pi}-${i}`} href={n.url} target="_blank" rel="noreferrer noopener">
                          <div className="news-card-top">
                            <span className="news-stock-tag">{n.stockName}</span>
                            <span className="news-time">{n.datetimeText}</span>
                          </div>
                          <div className="news-title">{n.title}</div>
                          <div className="news-press">{n.press}</div>
                        </a>
                      ))}
                    </div>
                  ))}
                </div>
                {newsPages.length > 1 && (
                  <div className="radar-dots news-dots">
                    {newsPages.map((_, i) => (
                      <span
                        key={i}
                        className={`radar-dot${i === newsPage ? ' active' : ''}`}
                        onClick={() => goNewsPage(i)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="disclaimer-line">{data.disclaimer}</div>
          </>
        )}
      </div>

      {radarEvent && (
        <RadarDetailSheet event={radarEvent} onClose={() => setRadarEvent(null)} />
      )}
    </div>
  )
}
