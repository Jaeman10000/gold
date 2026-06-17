// 광산(홈) — 풀블리드 금광 씬 + 그 위 오버레이(HUD/수익률/칩/디스클레이머). CLAUDE.md §7.
import { useRef, useState } from 'react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { useMarket } from '../store/marketStore'
import MineScene from '../components/MineScene'
import Hud from '../components/Hud'
import ReturnPanel from '../components/ReturnPanel'
import HoldingChips from '../components/HoldingChips'
import HoldingsSheet from '../components/HoldingsSheet'
import MarketToggle from '../components/MarketToggle'
import LockedOverlay from '../components/LockedOverlay'
import { goldDisplay } from '../utils/format'

const FLY_MS = 1200 // 수레→금더미 이동
const POP_MS = 550 // 도착 후 금더미 팝 + 카운트업

export default function MineHome() {
  const { market } = useMarket()
  const { data, loading, error } = useApi(api.portfolio, market)
  const [sheetOpen, setSheetOpen] = useState(false)
  // 배당 상태기계: 백엔드 pendingDividend 기본, null이면 override 없음. (dev 토글로 0↔양수)
  const [pendingOverride, setPendingOverride] = useState(null)
  // 수확 트윈
  const [harvesting, setHarvesting] = useState(false)
  const [goldPop, setGoldPop] = useState(false)
  const [bonus, setBonus] = useState(0) // 수확으로 누적금액에 더해진 금액(카운트업)
  const rafRef = useRef(0)

  const locked = data?.status === 'locked'
  const effectivePending = pendingOverride !== null ? pendingOverride : data?.pendingDividend || 0
  const claimable = effectivePending > 0 && !harvesting

  const displayGold = (data?.goldAmount || 0) + bonus
  const goldStr = data ? goldDisplay(data.market, displayGold) : ''

  function countUp(amount) {
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / POP_MS)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setBonus(Math.round(amount * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function handleClaim() {
    if (harvesting || !claimable) return
    const amount = effectivePending
    setHarvesting(true) // 버튼·(나)화살표 사라지고 수레가 날아감
    // 1) 수레 도착 → 금더미 팝 + 누적금액 카운트업
    setTimeout(() => {
      setGoldPop(true)
      countUp(amount)
    }, FLY_MS)
    // 2) idle 전환 (pendingDividend=0). 빈 수레는 그대로 유지(이미 페이드인됨)
    setTimeout(() => {
      setPendingOverride(0)
      setHarvesting(false)
      setGoldPop(false)
    }, FLY_MS + POP_MS + 150)
  }

  return (
    <div className="screen mine-home">
      {/* z0: 풀블리드 씬 (시장 무관 동일, 잠금 시 디밍) */}
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

      {/* 상단 중앙 시장 토글 */}
      <div className="top-center"><MarketToggle /></div>

      {/* dev 전용: 배당 상태기계 토글 (production 빌드엔 안 나옴) */}
      {import.meta.env.DEV && !locked && !harvesting && (
        <button
          className="dev-toggle"
          onClick={() => { setBonus(0); setPendingOverride(claimable ? 0 : data?.pendingDividend || 40910) }}
        >
          배당 {claimable ? '→0 (idle)' : '→+ (claimable)'}
        </button>
      )}

      {loading && <div className="center-msg">불러오는 중…</div>}
      {error && <div className="center-msg err">백엔드 연결 실패: {error}</div>}

      {locked && <LockedOverlay reason={data.reason} />}

      {!loading && !locked && data && (
        <>
          {/* z5: HUD (금괴 칩은 수확 카운트업 반영) */}
          <Hud data={data} goldOverride={goldStr} />

          {/* z6: 상단 수익률 패널 + 보유칩 (씬 위에 떠 있음) */}
          <div className="home-top-overlay">
            <ReturnPanel data={data} onExpand={() => setSheetOpen(true)} />
            <HoldingChips
              holdings={data.topHoldings}
              total={data.holdings.length}
              onExpand={() => setSheetOpen(true)}
            />
          </div>

          {/* z6: 하단 디스클레이머 (독 바로 위) */}
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
