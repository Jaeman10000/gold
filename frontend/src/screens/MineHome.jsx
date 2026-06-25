// 광산(홈) — 줌 시스템. CLAUDE.md §5·§7.
// 컨셉: "내가 일할 때도 내 돈이 금을 캐고 있다." 씬이 주인공.
// 줌인(detail) = plate 1층 디테일 / 줌아웃(overview) = 다층 수직 갱도 조망.
// 보유 4개 초과 → 우상단 토글로 전체 층 조망. 레이더·뉴스는 소식 탭.
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useScreenData, useDataStore } from '../store/dataStore'
import { useMarket } from '../store/marketStore'
import { api } from '../api/client'
import GwangmaekScene from '../components/GwangmaekScene'
import MineOverview from '../components/MineOverview'
import Hud from '../components/Hud'
import AssetSummary from '../components/AssetSummary'
import HoldingsSheet from '../components/HoldingsSheet'
import MinerCardSheet from '../components/MinerCardSheet'
import LockedOverlay from '../components/LockedOverlay'
import LoadingMascot from '../components/LoadingMascot'
import RestoreReveal from '../components/RestoreReveal'
import ErrorState from '../components/ErrorState'
import { goldDisplay } from '../utils/format'

export default function MineHome() {
  const { market } = useMarket()
  const { data, loading, refreshing, error, cachedAt } = useScreenData('portfolio', market)
  const { refresh, levelData } = useDataStore()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  const [highlights, setHighlights] = useState(null)
  const [visitStreak, setVisitStreak] = useState(null)

  // 헤더 높이 측정 → GwangmaekScene 에 전달 (챔버1이 헤더 바로 아래 시작)
  const overlayRef = useRef(null)
  const [headerH, setHeaderH] = useState(210)
  useEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setHeaderH(Math.round(entry.contentRect.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [data])

  useEffect(() => {
    setHighlights(null)
    api.highlights(market).then(setHighlights).catch(() => {})
  }, [market])

  useEffect(() => {
    api.visitStreak().then(setVisitStreak).catch(() => {})
  }, [])

  const locked = data?.status === 'locked'
  const goldStr = data ? goldDisplay(data.market, data.goldAmount || 0) : ''
  const streakMsg = visitStreak?.message || highlights?.achievement || '오늘도 광맥 확인 완료.'

  // 보유금액 desc 정렬 → 4개씩 "층(floor)" 분할. 마지막 층은 빈칸 패딩(overview용).
  const { floors, overviewFloors, maxEval } = useMemo(() => {
    const hs = data?.holdings ? [...data.holdings] : []
    hs.sort((a, b) => (b.evalAmount || 0) - (a.evalAmount || 0))
    const fl = []
    for (let i = 0; i < hs.length; i += 4) fl.push(hs.slice(i, i + 4))
    if (!fl.length) fl.push([])
    const padded = fl.map(f => Array.from({ length: 4 }, (_, i) => f[i] || null))
    const mx = hs.reduce((m, h) => Math.max(m, h.evalAmount || 0), 0)
    return { floors: fl, overviewFloors: padded, maxEval: mx }
  }, [data])

  const totalFloors = floors.length
  const [zoom, setZoom] = useState('detail')   // 'detail' | 'overview'
  const [currentFloor, setCurrentFloor] = useState(0)

  // 줌 전환 (방향 기록 → 진입 애니메이션 분기)
  const goZoom = useCallback((target, floor) => {
    setZoom(prev => {
      if (floor != null) setCurrentFloor(floor)
      return target
    })
  }, [])

  // 시장 전환 시 초기화
  useEffect(() => { setZoom('detail'); setCurrentFloor(0) }, [market])
  // 층 수 줄면 클램프
  useEffect(() => {
    setCurrentFloor(f => Math.min(f, Math.max(0, totalFloors - 1)))
  }, [totalFloors])

  const detailStocks = floors[currentFloor] || []

  return (
    <div className="screen mine-home">
      {/* z0: 씬 — 줌 상태에 따라 detail(plate) ↔ overview(다층 격자). key로 진입 애니메이션 */}
      <div className={`zoom-view zoom-${zoom}`} key={zoom}>
        {zoom === 'overview' ? (
          <MineOverview
            floors={overviewFloors}
            topOffset={headerH}
            maxEval={maxEval}
            onFloorSelect={(fi) => goZoom('detail', fi)}
          />
        ) : (
          <GwangmaekScene floorStocks={detailStocks} topOffset={headerH} dimmed={locked} />
        )}
      </div>

      {loading && !data && (
        <LoadingMascot text="시장 데이터를 불러오는 중…" />
      )}

      {error && !data && (
        <ErrorState message={`백엔드 연결 실패: ${error}`} onRetry={() => refresh(market)} />
      )}

      {locked && <LockedOverlay reason={data.reason} />}

      {!locked && (
        <RestoreReveal eventCount={levelData?.eventCount} level={levelData?.level} />
      )}

      {!loading && !locked && data && (
        <>
          {/* 상단 오버레이: HUD + 자산요약 */}
          <div className="home-overlay" ref={overlayRef}>
            <Hud
              data={data}
              refreshing={refreshing}
              levelData={levelData}
              onSync={() => refresh(market)}
              cachedAt={cachedAt}
              onCardOpen={() => setCardOpen(true)}
            />
            <AssetSummary
              data={data}
              goldOverride={goldStr}
              goldAmount={data.goldAmount || 0}
              onExpand={() => setSheetOpen(true)}
            />
          </div>

          {/* 우상단 줌 토글 — 층이 2개 이상일 때만 */}
          {totalFloors > 1 && (
            <button
              className="zoom-toggle"
              style={{ top: headerH + 8 }}
              onClick={() => goZoom(zoom === 'detail' ? 'overview' : 'detail')}
            >
              <span className="zoom-toggle-icon">{zoom === 'detail' ? '⊟' : '⊞'}</span>
              {zoom === 'detail' ? '전체 광산' : `${currentFloor + 1}층 보기`}
            </button>
          )}

          {/* 하단: 연속방문 */}
          <div className="home-bottom">
            {streakMsg && (
              <div className="home-streak">
                <span className="ach-icon">🔥</span>{streakMsg}
              </div>
            )}
          </div>

          <HoldingsSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            holdings={data.holdings}
            market={data.market}
          />
          <MinerCardSheet
            open={cardOpen}
            onClose={() => setCardOpen(false)}
            market={market}
          />
        </>
      )}
    </div>
  )
}
