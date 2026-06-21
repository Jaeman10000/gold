// 광산 씬 — 부감 뷰 배경 (CLAUDE.md §5). 홈 재설계(2026-06-21): 중앙 큰 광맥·일꾼·금더미는
// MineGrid(칸별 광구)·AssetSummary(금더미)로 분산. 씬은 공유 배경 + 은은한 앰비언트만 담당.
import { scene } from '../assets'

export default function MineScene({ dimmed = false }) {
  return (
    <div className={`mine-scene ${dimmed ? 'dimmed' : ''}`}>
      {/* L0 배경 — 광산 전체의 동굴 벽/바닥 (고정·불변) */}
      <img className="layer l0-bg" src={scene.bgMine} alt="" />
      {/* 따뜻한 앰비언트 비네트 (금광 그리드를 받쳐주는 은은한 글로우) */}
      <div className="scene-ambient" aria-hidden="true" />
    </div>
  )
}
