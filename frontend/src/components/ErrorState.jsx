// 공통 에러·빈 상태 UI — 모든 탭에서 동일하게 사용.
export default function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state">
      <div className="error-state-icon">⚠️</div>
      <div className="error-state-msg">{message || '데이터를 불러올 수 없습니다.'}</div>
      {onRetry && (
        <button className="error-retry-btn" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  )
}
