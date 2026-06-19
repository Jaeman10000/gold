// US 등 잠금 시장 UI (CLAUDE.md §7). status==='locked' 일 때 흐리게 + "준비 중".
import { useMarket } from '../store/marketStore'

export default function LockedOverlay({ reason }) {
  const { setMarket } = useMarket()
  return (
    <div className="locked-overlay">
      <div className="lock-icon">🔒</div>
      <div className="lock-title">미국 광맥은 준비 중입니다</div>
      <div className="lock-reason">
        {reason || '현재 키움증권이 개인 투자자용 해외주식 REST API를 제공하지 않아, 미국 주식 자동 연동을 준비 중입니다.'}
      </div>
      <div className="lock-sub">미국 주식 연동은 향후 업데이트에서 제공될 예정입니다.</div>
      <button className="lock-back-btn" onClick={() => setMarket('KR')}>
        ← KR 광맥으로 돌아가기
      </button>
    </div>
  )
}
