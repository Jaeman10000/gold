// 광산(홈) — 풀블리드 금광 씬 + 그 위 오버레이(HUD/수익률/칩/디스클레이머). CLAUDE.md §7.
import { useRef, useState, useEffect } from 'react'
import { useScreenData } from '../store/dataStore'
import { useMarket } from '../store/marketStore'
import MineScene from '../components/MineScene'
import Hud from '../components/Hud'
import ReturnPanel from '../components/ReturnPanel'
import HoldingChips from '../components/HoldingChips'
import HoldingsSheet from '../components/HoldingsSheet'
import LockedOverlay from '../components/LockedOverlay'
import LoadingMascot from '../components/LoadingMascot'
import { goldDisplay } from '../utils/format'

const FLY_MS = 1200
const POP_MS = 550

export default function MineHome() {
  const { market } = useMarket()
  const { data, loading, refreshing, error } = useScreenData('portfolio', market)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingOverride, setPendingOverride] = useState(null)
  const [harvesting, setHarvesting] = useState(false)
  const [goldPop, setGoldPop] = useState(false)
  const [bonus, setBonus] = useState(0)
  const rafRef = useRef(0)
  const [levelData, setLevelData] = useState(null)

  useEffect(() => {
    fetch('/api/level').then(r => r.json()).then(setLevelData).catch(() => {})
  }, [])

  const locked = data?.status === 'locked'
  const effectivePending = pendingOverride !== null ? pendingOverride : data?.pendingDividend || 0
  const claimable = effectivePending > 0 && !harvesting

  const displayGold = (data?.goldAmount || 0) + bonus
  const goldStr = data ? goldDisplay(data.market, displayGold) : ''

  function countUp(amount) {
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / POP_MS)
      const eased = 1 - Math.pow(1 - t, 3)
      setBonus(Math.round(amount * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function handleClaim() {
    if (harvesting || !claimable) return
    const amount = effectivePending
    setHarvesting(true)
    setTimeout(() => {
      setGoldPop(true)
      countUp(amount)
    }, FLY_MS)
    setTimeout(() => {
      setPendingOverride(0)
      setHarvesting(false)
      setGoldPop(false)
    }, FLY_MS + POP_MS + 150)
  }

  return (
    <div className="screen mine-home">
      {/* z0: 풀블리드 씬 */}
      <MineScene
        goldAmount={locked ? 0 : data?.goldAmount || 0}
        market={data?.market || 'KR'}
        dimmed={locked}
        claimable={!locked && claimable}
        harvesting={harvesting}
        goldPop={goldPop}
        pendingAmount={effectivePending}
        onClaim={handleClaim}
      />

      {/* [A] 시장 전환 시 화면 내 로딩 오버레이 (독 제외) */}
      {loading && !data && (
        <LoadingMascot text="시장 데이터를 불러오는 중…" />
      )}

      {error && !data && <div className="center-msg err">백엔드 연결 실패: {error}</div>}

      {import.meta.env.DEV && !locked && !harvesting && data && (
        <button
          className="dev-toggle"
          onClick={() => { setBonus(0); setPendingOverride(claimable ? 0 : data?.pendingDividend || 40910) }}
        >
          배당 {claimable ? '→0 (idle)' : '→+ (claimable)'}
        </button>
      )}

      {locked && <LockedOverlay reason={data.reason} />}

      {!loading && !locked && data && (
        <>
          {/* 헤더 패널 + 수익률 알약 + 종목 칩 (세로 스택) */}
          <div className="home-overlay">
            <Hud data={data} goldOverride={goldStr} refreshing={refreshing} levelData={levelData} />
            <div className="home-pill-chips">
              <ReturnPanel data={data} onExpand={() => setSheetOpen(true)} />
              <HoldingChips
                holdings={data.holdings}
                onExpand={() => setSheetOpen(true)}
              />
            </div>
          </div>
          <div className="home-disclaimer">{data.disclaimer}</div>
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
