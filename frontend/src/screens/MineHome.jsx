// 광산(홈) — gwangmaek_plate_clean.png 단면 씬 + HUD 오버레이. CLAUDE.md §5·§7.
// 컨셉: "내가 일할 때도 내 돈이 금을 캐고 있다." 씬이 주인공.
// 종목 상위 4개 → 챔버별 라벨칩으로 표시. 레이더·뉴스는 소식 탭.
import { useState, useEffect, useRef, useMemo } from 'react'
import { useScreenData, useDataStore } from '../store/dataStore'
import { useMarket } from '../store/marketStore'
import { api } from '../api/client'
import GwangmaekScene from '../components/GwangmaekScene'
import Hud from '../components/Hud'
import AssetSummary from '../components/AssetSummary'
import HoldingsSheet from '../components/HoldingsSheet'
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
  const streakMsg = visitStreak?.message || highlights?.achievement

  // 보유금액 상위 4종목 → 챔버 매핑
  const top4 = useMemo(() => {
    if (!data?.holdings?.length) return []
    return [...data.holdings]
      .sort((a, b) => (b.evalAmount || 0) - (a.evalAmount || 0))
      .slice(0, 4)
  }, [data])

  return (
    <div className="screen mine-home">
      {/* z0: 광산 단면 씬 (헤더 아래부터 plate 시작) */}
      <GwangmaekScene top4={top4} market={market} topOffset={headerH} dimmed={locked} />

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
            />
            <AssetSummary
              data={data}
              goldOverride={goldStr}
              goldAmount={data.goldAmount || 0}
              onExpand={() => setSheetOpen(true)}
            />
          </div>

          {/* 하단: 연속방문 + disclaimer */}
          <div className="home-bottom">
            {streakMsg && (
              <div className="home-streak">
                <span className="ach-icon">🔥</span>{streakMsg}
              </div>
            )}
            <div className="home-disclaimer">{data.disclaimer}</div>
          </div>

          <HoldingsSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            holdings={data.holdings}
            market={data.market}
          />
        </>
      )}
    </div>
  )
}
