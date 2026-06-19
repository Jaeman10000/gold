// 과거 채굴 복원 연출 — 최초 연동 시 딱 1회 (CLAUDE.md §1 게임화 후크).
// 3개월 백필로 채워진 레벨을 "앱이 찾아준 과거 금"으로 선물처럼 보여준다.
// localStorage 게이트 → 한 번 본 뒤 영구 생략. 백필 없으면(레벨1) 연출 자체를 건너뜀.
import { useEffect, useState } from 'react'

const SEEN_KEY = 'gm_restore_seen'

export default function RestoreReveal({ eventCount, level }) {
  // hidden → scanning → reveal → fade → done
  const [phase, setPhase] = useState('hidden')

  useEffect(() => {
    if (eventCount == null || level == null) return       // 데이터 대기
    if (localStorage.getItem(SEEN_KEY)) { setPhase('done'); return }
    // 보여줄 백필이 없으면(레벨1·0건) 연출 생략 + 본 것으로 기록
    if (eventCount <= 0 || level <= 1) {
      localStorage.setItem(SEEN_KEY, '1')
      setPhase('done')
      return
    }
    setPhase('scanning')
    const t1 = setTimeout(() => setPhase('reveal'), 1700)
    const t2 = setTimeout(() => setPhase('fade'), 4400)
    const t3 = setTimeout(() => {
      localStorage.setItem(SEEN_KEY, '1')
      setPhase('done')
    }, 5100)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [eventCount, level])

  function skip() {
    localStorage.setItem(SEEN_KEY, '1')
    setPhase('done')
  }

  if (phase === 'hidden' || phase === 'done') return null

  return (
    <div className={`restore-reveal${phase === 'fade' ? ' fade-out' : ''}`} onClick={skip}>
      <div className="rr-inner">
        {phase === 'scanning' && (
          <>
            <div className="rr-spinner" />
            <div className="rr-title">과거 채굴 기록 복원 중…</div>
            <div className="rr-sub">키움 매매·배당 내역을 캐고 있어요</div>
          </>
        )}
        {(phase === 'reveal' || phase === 'fade') && (
          <div className="rr-result">
            <div className="rr-gem">💎</div>
            <div className="rr-found">발견한 금맥 <b>{eventCount}건</b></div>
            <div className="rr-level">Lv {level} 도달!</div>
            <div className="rr-sub">지금부터 직접 캐서 더 높이 올라가요</div>
            <div className="rr-skip">탭하여 시작 →</div>
          </div>
        )}
      </div>
    </div>
  )
}
