// 연구소 — v2 예고 화면. v1에서는 준비 중.
export default function Lab() {
  return (
    <div className="screen lab-screen">
      <header className="screen-header">
        <h2>연구소</h2>
      </header>
      <div className="lab-coming">
        <div className="lab-coming-icon">🔬</div>
        <div className="lab-coming-title">준비 중</div>
        <div className="lab-coming-desc">
          종목 심층 분석 (재무·수급·이슈) 기능은<br />
          v2에서 오픈됩니다.
        </div>
        <div className="lab-coming-badge">v2</div>
      </div>
    </div>
  )
}
