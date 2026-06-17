// US 등 잠금 시장 UI (CLAUDE.md §7). status==='locked' 일 때 흐리게 + "준비 중".
export default function LockedOverlay({ reason }) {
  return (
    <div className="locked-overlay">
      <div className="lock-icon">🔒</div>
      <div className="lock-title">준비 중</div>
      <div className="lock-reason">{reason || '데이터 소스 준비 중'}</div>
      <div className="lock-sub">US 시장은 v2 에서 실연동 예정입니다.</div>
    </div>
  )
}
