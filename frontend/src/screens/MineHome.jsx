// 광산(홈) — 풀블리드 금광 씬 + 종목별 금광 캐러셀. CLAUDE.md §5·§7.
// 컨셉: "내가 일할 때도 내 돈이 금을 캐고 있다." 씬이 주인공.
// 종목 하나 = 금광 하나(스와이프 전환). 레이더·뉴스는 소식 탭으로 이동.
import { useState, useEffect } from 'react'
import { useScreenData, useDataStore } from '../store/dataStore'
import { useMarket } from '../store/marketStore'
import { api } from '../api/client'
import MineScene from '../components/MineScene'
import Hud from '../components/Hud'
import AssetSummary from '../components/AssetSummary'
import MineColumn from '../components/MineColumn'
import HoldingsSheet from '../components/HoldingsSheet'
import LockedOverlay from '../components/LockedOverlay'
import LoadingMascot from '../components/LoadingMascot'
import RestoreReveal from '../components/RestoreReveal'
import ErrorState from '../components/ErrorState'
import { goldDisplay } from '../utils/format'

export default function MineHome() {
  const { market } = useMarket()
  const { data, loading, refreshing, error, cachedAt } = useScreenData('portfolio', market)
  const { refresh, levelData } = useDataStore()   // 전역 — 탭 전환 후에도 유지
  const [sheetOpen, setSheetOpen] = useState(false)
  const [highlights, setHighlights] = useState(null)   // [C] 업적 한 줄
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
  const streakMsg = visitStreak?.message || highlights?.achievement

  return (
    <div className="screen mine-home">
      {/* z0: 풀블리드 씬 배경 (부감 뷰 — 동굴 벽/바닥) */}
      <MineScene dimmed={locked} />

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
          {/* 상단 오버레이: 압축 HUD + 자산 요약 한 줄 */}
          <div className="home-overlay">
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

          {/* 중앙: 세로 2칸 금광 (각자 다른 광맥 변주, 페이지 스와이프) */}
          {data.holdings?.length > 0 && (
            <MineColumn
              holdings={data.holdings}
              market={data.market}
              onOpenAll={() => setSheetOpen(true)}
            />
          )}

          {/* 하단: 연속방문 한 줄 + disclaimer */}
          <div className="home-bottom">
            {streakMsg && (
              <div className="home-streak"><span className="ach-icon">🔥</span>{streakMsg}</div>
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
