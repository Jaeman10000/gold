// 일꾼 곡괭이질 — 구조 분리(요청): 바깥 wrapper = 위치+rotate, 안쪽 = 프레임 교체.
// 4프레임을 안쪽에 겹쳐 currentFrame 하나만 보이게(나머지 opacity:0). 발 고정(bottom:0).
// variant: left | right(반전) | backleft(광맥 뒤). delayMs 로 시작 타이밍 다르게.
import { useEffect, useState } from 'react'
import { scene } from '../assets'

const SEQ = [0, 1, 2, 3, 3, 2, 1]
const CYCLE_MS = 850
const FRAME_MS = Math.round(CYCLE_MS / SEQ.length)

export default function Miner({ variant = 'left', delayMs = 0 }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    let interval
    const start = setTimeout(() => {
      interval = setInterval(() => setStep((s) => (s + 1) % SEQ.length), FRAME_MS)
    }, delayMs)
    return () => {
      clearTimeout(start)
      clearInterval(interval)
    }
  }, [delayMs])

  const frame = SEQ[step]
  const striking = step === 3

  return (
    // 바깥: 위치(+ z-index) — CSS .miner-{variant}
    <div className={`miner miner-${variant}`}>
      {/* 안쪽: rotate(진행방향) — 프레임 transform 과 분리 */}
      <div className="miner-rot">
        {scene.minerSwing.map((src, idx) => (
          <img key={idx} className="miner-frame" src={src} alt="" style={{ opacity: idx === frame ? 1 : 0 }} />
        ))}
        {striking && (
          <>
            <span className="strike-spark" />
            <span className="sweat-drop sw1" />
            <span className="sweat-drop sw2" />
            <span className="sweat-drop sw3" />
          </>
        )}
      </div>
    </div>
  )
}
