// 홈 줌아웃 — 다층 수직 갱도 조망(C안). 코드로 그린 격자, 새 아트 0개.
// 한 층 = 2열×2행 지그재그 격자. 층끼리 수직 갱도(사다리)로 연결. 아래로 depth haze.
// 빈 슬롯 = 불 꺼진 어두운 챔버(일꾼 없음). CLAUDE.md §7·§12.
import { gwangmaek } from '../assets'

// 셀 내부 떠다니는 금 먼지 (결정론적 위치·타이밍)
const CELL_DUST = [
  { l: 0.30, t: 0.55, dur: 3.2, delay: 0.0 },
  { l: 0.55, t: 0.42, dur: 2.7, delay: 0.9 },
  { l: 0.68, t: 0.60, dur: 3.6, delay: 1.7 },
]

// 슬롯별 일꾼 애니메이션 (줌인 detail과 동일 매핑)
const MINER_ANIM = ['gm-anim-bob', 'gm-anim-saw', 'gm-anim-sort', 'gm-anim-pick']

export default function MineOverview({ floors = [], topOffset = 210, maxEval = 0, onFloorSelect }) {
  return (
    <div className="mo-outer" style={{ top: topOffset }} aria-hidden="true">
      <div className="mo-scroll">
        {floors.map((floor, fi) => (
          <div className="mo-floor-block" key={`fl${fi}`}>
            <div className="mo-floor" style={{ '--depth': fi }}>
              <span className="mo-floor-label">{fi + 1}층</span>
              <div className="mo-grid">
                {floor.map((stock, si) => {
                  if (!stock) {
                    return <div key={si} className="mo-cell mo-cell-empty" />
                  }
                  const up = stock.returnRate >= 0
                  const weight = maxEval ? (stock.evalAmount || 0) / maxEval : 0.5
                  const w = Math.min(1, weight)
                  const glowScale = 0.62 + w * 0.83   // 0.62~1.45 (비중 차이 강화)
                  const glowOpacity = 0.5 + w * 0.5   // 0.5~1.0
                  return (
                    <button
                      key={si}
                      className="mo-cell"
                      onClick={() => onFloorSelect?.(fi)}
                    >
                      {/* 광굴 배경 (플레이트에서 잘라낸 동굴 방) */}
                      <img className="mo-chamber" src={gwangmaek.chambers[si % 4]} alt="" draggable="false" />
                      <div
                        className="mo-glow"
                        style={{
                          transform: `translate(-50%,-50%) scale(${glowScale})`,
                          opacity: glowOpacity * 0.55,
                        }}
                      />
                      <div className="mo-miner-wrap">
                        <img
                          className={`mo-miner ${MINER_ANIM[si % 4]}`}
                          src={gwangmaek.miners[si % 4]}
                          alt=""
                          draggable="false"
                        />
                      </div>
                      {CELL_DUST.map((d, di) => (
                        <span
                          key={di}
                          className="mo-dust"
                          style={{
                            left: `${d.l * 100}%`,
                            top: `${d.t * 100}%`,
                            animationDuration: `${d.dur}s`,
                            animationDelay: `${d.delay}s`,
                          }}
                        />
                      ))}
                      <div className="mo-label">
                        <span className="mo-label-name">{stock.name}</span>
                        <span className="mo-label-rate" data-dir={up ? 'up' : 'down'}>
                          <span className="mo-gem">◆</span>
                          {Math.abs(stock.returnRate).toFixed(1)}%
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            {fi < floors.length - 1 && <div className="mo-shaft" aria-hidden="true" />}
          </div>
        ))}
      </div>
    </div>
  )
}
