// 홈 광산 단면 씬 — gwangmaek_plate_clean.png + 일꾼 4명 + 코드 FX
// plate는 독 바로 위에 하단 고정. 챔버2~4 항상 표시, 챔버1은 헤더 뒤로 확장.
// CLAUDE.md §5: 발광·움직임은 앰비언트 연출만. 매수/매도 추천 금지.
import { profitColor } from '../utils/format'
import { gwangmaek } from '../assets'

// ── 일꾼 배치 (plate % 기준, 발-중앙 앵커) ─────────────────────────────
// footY = 발 위치 / hFrac = 키 / cx = 수평 중앙
const MINERS = [
  { cx: 0.540, footY: 0.205, hFrac: 0.070, anim: 'gm-anim-bob'  }, // C1: 금 줍기
  { cx: 0.385, footY: 0.470, hFrac: 0.061, anim: 'gm-anim-saw'  }, // C2: 톱질
  { cx: 0.560, footY: 0.715, hFrac: 0.065, anim: 'gm-anim-sort' }, // C3: 선별
  { cx: 0.500, footY: 0.865, hFrac: 0.072, anim: 'gm-anim-pick' }, // C4: 곡괭이
]

// ── 챔버 라벨칩 위치 (챔버별 바위벽 공간)
// 플레이트 가로 = 화면 가로 (CSS cover, 오버플로우 없음) → left/right 5% 사용 가능.
// 일꾼과 반대쪽 바위벽 배치: C1·C3 왼쪽, C2·C4 오른쪽.
const CHIP_POS = [
  { left: '5%',  top: '14%' }, // C1: footY 0.205
  { right: '5%', top: '40%' }, // C2: footY 0.470
  { left: '5%',  top: '63%' }, // C3: footY 0.715
  { right: '5%', top: '77%' }, // C4: footY 0.865
]

// ── 금맥 발광 중심점 (챔버별 광맥 위치 추정) ───────────────────────────
const VEIN_GLOWS = [
  { cx: 0.71, cy: 0.145, dur: 2.8, delay: 0.0  },
  { cx: 0.52, cy: 0.405, dur: 3.1, delay: 0.7  },
  { cx: 0.66, cy: 0.625, dur: 2.6, delay: 1.4  },
  { cx: 0.50, cy: 0.838, dur: 3.3, delay: 0.4  },
]

// ── 랜턴 깜빡임 위치 ───────────────────────────────────────────────────
const LANTERNS = [
  { cx: 0.80, cy: 0.065, dur: 0.95, delay: 0.00 },
  { cx: 0.32, cy: 0.295, dur: 1.15, delay: 0.17 },
  { cx: 0.77, cy: 0.510, dur: 0.88, delay: 0.07 },
  { cx: 0.28, cy: 0.685, dur: 1.05, delay: 0.24 },
]

// ── 떠다니는 먼지·금 반짝임 파티클 ────────────────────────────────────
const DUST = [
  { l: 0.63, t: 0.13, dur: 3.2, delay: 0.0 },
  { l: 0.76, t: 0.16, dur: 2.8, delay: 0.9 },
  { l: 0.68, t: 0.19, dur: 3.5, delay: 1.7 },
  { l: 0.48, t: 0.38, dur: 3.0, delay: 0.4 },
  { l: 0.58, t: 0.42, dur: 2.6, delay: 1.3 },
  { l: 0.45, t: 0.45, dur: 2.4, delay: 2.1 },
  { l: 0.55, t: 0.60, dur: 3.4, delay: 0.6 },
  { l: 0.70, t: 0.64, dur: 2.9, delay: 1.5 },
  { l: 0.62, t: 0.67, dur: 3.3, delay: 0.2 },
  { l: 0.43, t: 0.82, dur: 3.1, delay: 1.0 },
  { l: 0.55, t: 0.86, dur: 2.7, delay: 1.8 },
  { l: 0.50, t: 0.89, dur: 3.0, delay: 0.5 },
]

// 칩용 평가금액 축약 (로컬 헬퍼)
function compactAmt(market, v) {
  if (v == null || v === 0) return ''
  if (market === 'US') {
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
    return `$${Math.round(v)}`
  }
  if (v >= 1e8) return `₩${(v / 1e8).toFixed(1)}억`
  if (v >= 1e4) return `₩${Math.round(v / 1e4)}만`
  return `₩${Math.round(v).toLocaleString()}`
}

export default function GwangmaekScene({ top4 = [], market = 'KR', topOffset = 210, dimmed = false }) {
  return (
    <div className={`gm-outer${dimmed ? ' gm-dimmed' : ''}`} aria-hidden="true">
      {/* plate 영역 — 헤더 아래 시작 (topOffset), CSS cover로 레터박스 없음 */}
      <div className="gm-plate-area" style={{ top: topOffset }}>
        <div className="gm-plate-wrap">

          {/* L0: 배경 plate */}
          <img className="gm-plate-img" src={gwangmaek.plate} alt="" draggable="false" />

          {/* L1: 금맥 발광 펄스 */}
          {VEIN_GLOWS.map((g, i) => (
            <div
              key={`vg${i}`}
              className="gm-vein-glow"
              style={{
                left: `${g.cx * 100}%`,
                top: `${g.cy * 100}%`,
                animationDuration: `${g.dur}s`,
                animationDelay: `${g.delay}s`,
              }}
            />
          ))}

          {/* L2: 랜턴 깜빡임 */}
          {LANTERNS.map((l, i) => (
            <div
              key={`ln${i}`}
              className="gm-lantern"
              style={{
                left: `${l.cx * 100}%`,
                top: `${l.cy * 100}%`,
                animationDuration: `${l.dur}s`,
                animationDelay: `${l.delay}s`,
              }}
            />
          ))}

          {/* L3: 떠다니는 먼지 파티클 */}
          <div className="gm-dust">
            {DUST.map((d, i) => (
              <span
                key={`dp${i}`}
                className="gm-dust-p"
                style={{
                  left: `${d.l * 100}%`,
                  top: `${d.t * 100}%`,
                  animationDuration: `${d.dur}s`,
                  animationDelay: `${d.delay}s`,
                }}
              />
            ))}
          </div>

          {/* L4: 일꾼 4명 (발-중앙 앵커로 % 배치) */}
          {MINERS.map((m, i) => (
            <div
              key={`mn${i}`}
              className="gm-miner-pos"
              style={{
                left: `${m.cx * 100}%`,
                top: `${(m.footY - m.hFrac) * 100}%`,
                height: `${m.hFrac * 100}%`,
              }}
            >
              <img
                className={`gm-miner-img ${m.anim}`}
                src={gwangmaek.miners[i]}
                alt=""
                draggable="false"
              />
            </div>
          ))}

          {/* L5: 챔버 종목 라벨칩 */}
          {MINERS.map((_, i) => {
            const stock = top4[i]
            if (!stock) return null
            const up = stock.returnRate >= 0
            return (
              <div key={`chip${i}`} className="gm-chip" style={CHIP_POS[i]}>
                <span className="gm-chip-name">{stock.name}</span>
                <span
                  className="gm-chip-rate"
                  style={{ color: profitColor(stock.returnRate) }}
                >
                  {up ? '▲' : '▼'} {Math.abs(stock.returnRate).toFixed(1)}%
                </span>
                <span className="gm-chip-amt">{compactAmt(market, stock.evalAmount)}</span>
              </div>
            )
          })}

        </div>
      </div>
    </div>
  )
}
