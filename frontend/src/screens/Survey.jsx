// 측량소 — 미래정합성 점수 분해 + 테마 서사 (CLAUDE.md §7). 성장 렌즈 명시 + disclaimer.
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { useMarket } from '../store/marketStore'
import MarketToggle from '../components/MarketToggle'
import LockedOverlay from '../components/LockedOverlay'

export default function Survey() {
  const { market } = useMarket()
  const { data, loading, error } = useApi(api.survey, market)
  const locked = data?.status === 'locked'

  return (
    <div className="screen survey">
      <header className="screen-header">
        <h2>측량소 · 미래정합성</h2>
        <MarketToggle />
      </header>

      {loading && <div className="center-msg">불러오는 중…</div>}
      {error && <div className="center-msg err">백엔드 연결 실패: {error}</div>}
      {locked && <LockedOverlay reason={data.reason} />}

      {!loading && !locked && data && (
        <div className="survey-body">
          <div className="score-hero">
            <div className="score-grade">{data.grade}</div>
            <div className="score-num">{data.score}<span>/100</span></div>
            <div className="score-lens">{data.lens}</div>
          </div>

          <section className="card">
            <div className="card-title">점수 분해 (테마50 / 재무30 / 수급20)</div>
            {data.components.map((c) => (
              <div className="comp-row" key={c.key}>
                <div className="comp-head">
                  <span>{c.key}</span>
                  <span className="comp-weight">가중 {c.weight}%</span>
                  <span className="comp-score">{c.score}</span>
                </div>
                <div className="comp-bar"><div className="comp-fill" style={{ width: `${c.score}%` }} /></div>
                <div className="comp-note">{c.note}</div>
              </div>
            ))}
          </section>

          <section className="card">
            <div className="card-title">종목별 기여도 (투명 표기)</div>
            {data.contributions.map((c) => (
              <div className="contrib-row" key={c.name}>
                <span className="cr-name">{c.name}</span>
                <span className="cr-theme">{c.theme}</span>
                <div className="cr-bar"><div className="cr-fill" style={{ width: `${c.contribution * 2}%` }} /></div>
                <span className="cr-val">{c.contribution}</span>
              </div>
            ))}
          </section>

          <section className="card narrative">{data.themeNarrative}</section>
          <div className="disclaimer-line">{data.disclaimer}</div>
        </div>
      )}
    </div>
  )
}
