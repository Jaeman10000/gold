// 로딩 인디케이터 컴포넌트. 나중에 시그니처 캐릭터/이모티콘으로 교체 가능.
// fullscreen=true: 전체 화면 블러 오버레이. false(기본): 부모 영역 내 인라인.
export default function LoadingMascot({
  fullscreen = false,
  text = '광맥을 채굴하는 중…',
}) {
  return (
    <div className={fullscreen ? 'loading-fullscreen' : 'loading-overlay'}>
      {/* ── 캐릭터 교체 포인트 ── 이 div 안의 내용을 이미지/애니메이션으로 대체 가능 */}
      <div className="loading-mascot">
        <div className="loading-spinner" />
        <p className="loading-text">{text}</p>
      </div>
    </div>
  )
}
