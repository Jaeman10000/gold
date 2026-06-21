// 광산(홈) — 풀블리드 금광 씬 + 그 위 오버레이(HUD/수익률/칩/디스클레이머). CLAUDE.md §7.
import { useState, useEffect } from 'react'
import { useScreenData, useDataStore } from '../store/dataStore'
import { useMarket } from '../store/marketStore'
import { api } from '../api/client'
import MineScene from '../components/MineScene'
import Hud from '../components/Hud'
import ReturnPanel from '../components/ReturnPanel'
import HoldingChips from '../components/HoldingChips'
import HoldingsSheet from '../components/HoldingsSheet'
import LockedOverlay from '../components/LockedOverlay'
import LoadingMascot from '../components/LoadingMascot'
import RestoreReveal from '../components/RestoreReveal'
import ErrorState from '../components/ErrorState'
import RadarPanel from '../components/RadarPanel'
import RadarDetailSheet from '../components/RadarDetailSheet'
import NewsStrip from '../components/NewsStrip'
import NewsItemSheet from '../components/NewsItemSheet'
import { goldDisplay, timeAgo } from '../utils/format'

export default function MineHome() {
  const { market } = useMarket()
  const { data, loading, refreshing, error, cachedAt } = useScreenData('portfolio', market)
  const { refresh, levelData } = useDataStore()   // 전역 — 탭 전환 후에도 유지
  const [sheetOpen, setSheetOpen] = useState(false)
  const [radarEvent, setRadarEvent] = useState(null)
  const [newsItem, setNewsItem] = useState(null)
  const [highlights, setHighlights] = useState(null)  // [B] 수급 + [C] 업적 한 줄
  const [visitStreak, setVisitStreak] = useState(null) // 연속 방문일

  useEffect(() => {
    setHighlights(null)
    api.highlights(market).then(setHighlights).catch(() => {})
  }, [market])

  // 앱 열 때 1회 방문 기록 + 연속일 조회 (market 무관)
  useEffect(() => {
    api.visitStreak().then(setVisitStreak).catch(() => {})
  }, [])

  const locked = data?.status === 'locked'
  const goldStr = data ? goldDisplay(data.market, data.goldAmount || 0) : ''

  return (
    <div className="screen mine-home">
      {/* z0: 풀블리드 씬 */}
      <MineScene
        goldAmount={locked ? 0 : data?.goldAmount || 0}
        market={data?.market || 'KR'}
        dimmed={locked}
      />

      {loading && !data && (
        <LoadingMascot text="시장 데이터를 불러오는 중…" />
      )}

      {error && !data && <ErrorState message={`백엔드 연결 실패: ${error}`} onRetry={() => refresh(market)} />}

      {locked && <LockedOverlay reason={data.reason} />}

      {/* 과거 채굴 복원 연출 — 최초 1회 (백필 레벨을 선물처럼) */}
      {!locked && (
        <RestoreReveal eventCount={levelData?.eventCount} level={levelData?.level} />
      )}

      {!loading && !locked && data && (
        <>
          {/* 헤더 패널 + 수익률 알약 + 종목 칩 (세로 스택) */}
          <div className="home-overlay">
            <Hud data={data} goldOverride={goldStr} refreshing={refreshing} levelData={levelData} achievement={visitStreak?.message || highlights?.achievement} onSync={() => refresh(market)} cachedAt={cachedAt} />
            <div className="home-pill-chips">
              <ReturnPanel data={data} onExpand={() => setSheetOpen(true)} />
              <NewsStrip market={market} onSelect={setNewsItem} />
              <HoldingChips
                holdings={data.holdings}
                onExpand={() => setSheetOpen(true)}
              />
              {/* 광맥 레이더 — 이벤트 있을 때만 표시. onSelect → top-level sheet */}
              <RadarPanel market={market} onSelect={setRadarEvent} />
            </div>
          </div>
          {cachedAt && (
            <div className="last-updated">↻ {timeAgo(cachedAt)} 업데이트</div>
          )}
          <div className="home-disclaimer">{data.disclaimer}</div>
          <HoldingsSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            holdings={data.holdings}
            market={data.market}
          />
        </>
      )}

      {newsItem && (
        <NewsItemSheet item={newsItem} onClose={() => setNewsItem(null)} />
      )}

      {radarEvent && (
        <RadarDetailSheet
          event={radarEvent}
          onClose={() => setRadarEvent(null)}
        />
      )}
    </div>
  )
}
