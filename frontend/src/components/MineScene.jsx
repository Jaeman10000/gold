// 광산 씬 — 풀블리드 살아있는 디오라마 (CLAUDE.md §5). 구도 기준: docs/home_us.png
// 광맥(중앙·최대) + 오로라 + 일꾼 2명(중앙 광맥 채굴) + 금괴더미(모은 금) + 정적 수레.
// 흐름: 광맥→금더미 자동상시 (배당 수확 버튼 제거 — 자동 적립으로 대체).
import { scene } from '../assets'
import Miner from './Miner'

// 금괴더미 3단계 — 평가금액(원) 기준. KR: 1천만↓소/1천만~1억중/1억↑대
function goldPileSrc(goldAmount) {
  if (goldAmount >= 100_000_000) return scene.goldLarge
  if (goldAmount >= 10_000_000) return scene.goldMedium
  return scene.goldSmall
}

// 오로라 글로우(뒤): 펄스 + (광맥만)일렁임
function AuroraGlow({ place, strong = false }) {
  return (
    <div className={`aura-glow aura-${place}`} aria-hidden="true">
      <div className="aura-pulse" />
      {strong && <div className="aura-undulate" />}
    </div>
  )
}

// 오로라 반짝임(앞): 상승 파티클 + (광맥만)트윈클
function AuroraSparkles({ place, strong = false }) {
  const count = strong ? 10 : 4
  return (
    <div className={`aura-spark aura-${place}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="aura-particle"
          style={{
            left: `${12 + ((i * 9) % 74)}%`,
            animationDelay: `${(i * 0.37).toFixed(2)}s`,
            animationDuration: `${(2.4 + (i % 4) * 0.45).toFixed(2)}s`,
          }}
        />
      ))}
      {strong && [0, 1, 2, 3].map((i) => <span key={`t${i}`} className={`twinkle tw${i}`} />)}
    </div>
  )
}

// 곡선 경로(2차 베지어) 위에 노란 삼각형 화살표(^)를 줄지어 배치 + 순차 점등.
// 좌표는 씬 px(≈390×844) 기준 → %로 변환해 배치. 끝점이 금괴더미(≈117,521).
const SCENE_W = 390
const SCENE_H = 844
// 클러스터를 +11%(≈93px/844) 내림에 맞춰 끝점 이동.
const PATH_AUTO = [[195, 533], [140, 573], [117, 614]] // 광맥 → 금괴더미
const ARROW_ROT = 90 // 위 방향(▲) 삼각형을 진행방향으로 돌리는 보정각

function arrowsAlong([p0, p1, p2], n) {
  const out = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const mt = 1 - t
    const x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0]
    const y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]
    const dx = 2 * mt * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
    const dy = 2 * mt * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
    const rot = (Math.atan2(dy, dx) * 180) / Math.PI + ARROW_ROT
    out.push({ left: (x / SCENE_W) * 100, top: (y / SCENE_H) * 100, rot })
  }
  return out
}

// 노란 삼각형 화살표 흐름 (출발지 → 금괴더미). 흐르듯 순차 점등.
function ArrowFlow({ className, path, n }) {
  return (
    <div className={`flow-arrows ${className}`} aria-hidden="true">
      {arrowsAlong(path, n).map((a, i) => (
        <span
          key={i}
          className="flow-arrow"
          style={{
            left: `${a.left.toFixed(1)}%`,
            top: `${a.top.toFixed(1)}%`,
            transform: `translate(-50%, -50%) rotate(${a.rot.toFixed(0)}deg)`,
            animationDelay: `${(i * 0.16).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function MineScene({
  goldAmount = 0,
  dimmed = false,
}) {
  return (
    <div className={`mine-scene ${dimmed ? 'dimmed' : ''}`}>
      {/* L0 배경 */}
      <img className="layer l0-bg" src={scene.bgMine} alt="" />

      {/* 광맥 오로라(뒤) → 광맥 뒤 일꾼 → 뒤쪽 카트 2개 → 광맥 → 오로라(앞) */}
      <AuroraGlow place="vein" strong />
      <Miner variant="backleft" delayMs={620} />
      <img className="layer cart-static cart-back-left"  src={scene.cart} alt="" aria-hidden="true" />
      <img className="layer cart-static cart-back-right" src={scene.cart} alt="" aria-hidden="true" />

      <img className="layer l1-vein" src={scene.veinGold} alt="" />
      <AuroraSparkles place="vein" strong />

      {/* 일꾼 — 광맥 좌/우에 바짝 붙여 채굴 중 */}
      <Miner variant="left" delayMs={0} />
      <Miner variant="right" delayMs={380} />

      {/* 자동 화살표 흐름: 광맥 → 금괴더미 (상시) */}
      <ArrowFlow className="flow-auto" path={PATH_AUTO} n={6} />

      {/* 금괴더미 */}
      <AuroraGlow place="gold" />
      <img className="layer l1-gold" src={goldPileSrc(goldAmount)} alt="" />
      <AuroraSparkles place="gold" />
    </div>
  )
}
