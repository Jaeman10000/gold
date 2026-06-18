// 측량소 — 기본/테마 2모드 점수 분해 (CLAUDE.md §6, §7).
// 하드룰: 매수/매도 조언 금지. disclaimer 항상 표시. 점수 낮음≠나쁨.
import { useState, useEffect } from 'react'
import { useScreenData, useDataStore } from '../store/dataStore'
import { useMarket } from '../store/marketStore'
import { api } from '../api/client'
import MarketToggle from '../components/MarketToggle'
import LockedOverlay from '../components/LockedOverlay'
import LoadingMascot from '../components/LoadingMascot'

// 등급별 색상 (S~F)
function gradeColor(grade) {
  if (grade === 'S') return '#f7cf5a'
  if (grade === 'A') return '#e8b339'
  if (grade === 'B') return '#d4a843'
  if (grade === 'C') return '#c8823a'
  if (grade === 'D') return '#a06030'
  return 'var(--text-dim)'
}

function scoreColor(score) {
  if (score === null || score === undefined) return 'var(--text-dim)'
  if (score >= 76) return 'var(--gold-bright)'
  if (score >= 61) return '#d4a843'
  if (score >= 41) return '#c8823a'
  if (score >= 21) return '#a06030'
  return 'var(--loss)'
}

// 플래그 → 한국어 표시
const FLAG_LABEL = {
  health_na: '재무데이터 미확보',
  supply_na: '수급데이터 미확보',
  trust_na: '시장데이터 미확보',
}

// 기본 모드 구성요소 설명
const COMP_NOTE = {
  '재무건전성': '영업이익률·부채비율·매출성장 (DART 공시)',
  '수급': '최근 20일 외인·기관 순매수 비율',
  '시장신뢰': '시총·거래대금 포트 내 분포 위치',
}

// ── 서브 컴포넌트 ───────────────────────────────────────────────────────────

function ScoreBar({ value, height = 8 }) {
  const pct = value === null || value === undefined ? 0 : Math.min(100, Math.max(0, value))
  const color = value >= 61
    ? 'linear-gradient(90deg, var(--gold-deep), var(--gold-bright))'
    : value >= 41
      ? 'linear-gradient(90deg, #8a6020, #c8932a)'
      : 'linear-gradient(90deg, rgba(226,101,92,.45), rgba(226,101,92,.8))'
  return (
    <div className="comp-bar" style={{ height }}>
      <div className="comp-fill" style={{ width: `${pct}%`, background: value !== null ? color : 'transparent' }} />
    </div>
  )
}

function SubScore({ label, value, na }) {
  const display = na ? 'N/A' : (value === null || value === undefined ? 'N/A' : Math.round(value))
  const pct = (value === null || value === undefined || na) ? 0 : Math.min(100, value)
  const fillClass = na ? 'sub-fill na' : value >= 61 ? 'sub-fill high' : value >= 41 ? 'sub-fill mid' : 'sub-fill low'
  return (
    <div className="sub-score">
      <div className="sub-label">{label}</div>
      <div className="sub-bar-wrap">
        <div className="sub-bar">
          <div className={fillClass} style={{ width: `${pct}%` }} />
        </div>
        <span className="sub-val" style={{ color: na ? 'var(--text-dim)' : scoreColor(value) }}>{display}</span>
      </div>
    </div>
  )
}

// 테마 선택 바텀시트 — 칩 선택 + 자유입력 해석(확인 단계)
function ThemeSelector({ themes, onConfirm, onCancel }) {
  const [picked, setPicked] = useState([])
  const [text, setText] = useState('')
  const [interpreting, setInterpreting] = useState(false)
  const [detected, setDetected] = useState(null)        // null=선택뷰, 배열=확인뷰
  const [pickedDetected, setPickedDetected] = useState([])
  const [note, setNote] = useState('')

  function toggle(label) {
    setPicked(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label])
  }

  async function handleInterpret() {
    if (!text.trim()) return
    setInterpreting(true)
    try {
      const r = await api.interpretTheme(text.trim())
      const d = r.detected || []
      setDetected(d)
      setPickedDetected(d.map(x => x.id))
      setNote(r.note || '')
    } catch {
      setDetected([])
    } finally {
      setInterpreting(false)
    }
  }

  function toggleDetected(id) {
    setPickedDetected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function confirmDetected() {
    const chosen = detected
      .filter(d => pickedDetected.includes(d.id))
      .map(d => ({ label: d.label, keywords: d.keywords, codes: d.codes }))
    if (chosen.length) onConfirm(chosen)
  }

  // ── 확인 뷰 ("이렇게 이해했어요") ──
  if (detected !== null) {
    return (
      <div className="sheet-backdrop" onClick={onCancel}>
        <div className="sheet theme-sheet" onClick={e => e.stopPropagation()}>
          <div className="sheet-handle" />
          <div className="sheet-title">이렇게 이해했어요</div>
          <div className="theme-sheet-note quote">"{text}"</div>
          {detected.length === 0 ? (
            <div className="detected-empty">
              감지된 테마가 없어요. 표현을 바꾸거나, 아래 "직접 고르기"에서 골라주세요.
            </div>
          ) : (
            <>
              <div className="detected-list">
                {detected.map(d => (
                  <button
                    key={d.id}
                    className={`detected-card ${pickedDetected.includes(d.id) ? 'selected' : ''}`}
                    onClick={() => toggleDetected(d.id)}
                  >
                    <div className="dc-head">
                      <span className="to-check">{pickedDetected.includes(d.id) ? '✓' : '○'}</span>
                      <span className="dc-label">{d.label}</span>
                    </div>
                    <div className="dc-kws">
                      {d.matchedKeywords.map(k => <span className="dc-kw" key={k}>{k}</span>)}
                    </div>
                  </button>
                ))}
              </div>
              <div className="theme-sheet-note small">{note}</div>
            </>
          )}
          <div className="theme-sheet-actions">
            <button className="ghost-btn" onClick={() => setDetected(null)}>← 직접 고르기</button>
            <button
              className="confirm-btn"
              disabled={pickedDetected.length === 0}
              onClick={confirmDetected}
            >
              {pickedDetected.length > 0 ? `이 렌즈로 적용 (${pickedDetected.length}개)` : '테마를 선택하세요'}
            </button>
          </div>
          <div className="theme-sheet-disclaimer">
            종목 추천이 아닙니다. 투자 판단·책임은 본인에게 있습니다.
          </div>
        </div>
      </div>
    )
  }

  // ── 선택 뷰 (자유입력 + 칩) ──
  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet theme-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">내 성장테마 렌즈 만들기</div>
        <div className="theme-sheet-note">
          추천 섹터가 아닌 렌즈 템플릿입니다. 내 포트가 선택한 방향에 얼마나 정렬됐는지 확인하는 도구입니다.
        </div>

        {/* 자유 입력 */}
        <div className="theme-freetext">
          <textarea
            className="theme-freetext-input"
            placeholder="내 생각을 적어보세요. 예: 전기차·자율주행이 미래라고 생각해서 그쪽에 투자할 거야"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
          />
          <button
            className="interpret-btn"
            disabled={!text.trim() || interpreting}
            onClick={handleInterpret}
          >
            {interpreting ? '해석 중…' : '🔭 이 방향으로 렌즈 만들기'}
          </button>
        </div>

        <div className="theme-or-divider"><span>또는 직접 선택</span></div>

        <div className="theme-option-list">
          {themes.map(t => (
            <button
              key={t.id}
              className={`theme-option-btn ${picked.includes(t.label) ? 'selected' : ''}`}
              onClick={() => toggle(t.label)}
            >
              <span className="to-check">{picked.includes(t.label) ? '✓' : '○'}</span>
              <span className="to-label">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="theme-sheet-actions">
          <button className="ghost-btn" onClick={onCancel}>취소</button>
          <button
            className="confirm-btn"
            disabled={picked.length === 0}
            onClick={() => onConfirm(picked)}
          >
            {picked.length > 0 ? `적용 (${picked.length}개)` : '테마를 선택하세요'}
          </button>
        </div>
        <div className="theme-sheet-disclaimer">
          종목 추천이 아닙니다. 투자 판단·책임은 본인에게 있습니다.
        </div>
      </div>
    </div>
  )
}

// ── 메인 화면 ────────────────────────────────────────────────────────────────

export default function Survey() {
  const { market } = useMarket()
  const { data, loading, refreshing, error } = useScreenData('survey', market)
  const { refresh } = useDataStore()

  const [showSelector, setShowSelector] = useState(false)
  const [availableThemes, setAvailableThemes] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.surveyThemes().then(r => setAvailableThemes(r.themes || [])).catch(() => {})
  }, [])

  const locked = data?.status === 'locked'
  const mode = data?.mode || 'basic'

  async function handleConfirmTheme(picked) {
    setSaving(true)
    try {
      await api.setTheme(market, picked)
      setShowSelector(false)
      refresh(market)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTheme() {
    await api.deleteTheme(market)
    refresh(market)
  }

  return (
    <div className="screen survey">
      <header className="screen-header">
        <h2 className="survey-title">
          측량소 {mode === 'theme' ? <span className="mode-badge theme-badge">AI테마</span> : <span className="mode-badge basic-badge">펀더멘털</span>}
        </h2>
        <div className="header-right">
          <button className="refresh-btn" onClick={() => refresh(market)} disabled={refreshing} title="새로고침">
            <span className={refreshing ? 'refresh-icon spinning' : 'refresh-icon'}>↺</span>
          </button>
          <MarketToggle />
        </div>
      </header>

      {loading && !data && <LoadingMascot text="측량 중…" />}
      {error && !data && <div className="center-msg err">백엔드 연결 실패: {error}</div>}
      {locked && <LockedOverlay reason={data.reason} />}

      {!loading && !locked && data && (
        <div className="survey-body">

          {/* ── 점수 히어로 ── */}
          <div className="score-hero">
            <div className="score-grade" style={{ color: gradeColor(data.grade) }}>{data.grade}</div>
            <div className="score-num">{data.score}<span>/100</span></div>
            {mode === 'theme' && data.theme && (
              <div className="theme-info-row">
                <span className="theme-tag">정렬도 {data.theme.alignment}%</span>
                {data.theme.matchedQuality !== null && (
                  <span className="theme-tag">정렬종목 품질 {data.theme.matchedQuality}</span>
                )}
              </div>
            )}
            {/* 하드룰 고정 문구 */}
            <div className="hard-rule-banner">
              투자권유 아님 · 점수 낮음≠나쁜 포트폴리오 · {mode === 'basic' ? '우열이 아닌 사실 스냅샷' : '사용자가 설정한 렌즈'}
            </div>
          </div>

          {/* ── 구성요소 분해 ── */}
          <section className="card">
            {mode === 'basic' ? (
              <>
                <div className="card-title">점수 구성 <span className="card-title-sub">재무건전성 50 · 수급 30 · 시장신뢰 20</span></div>
                {data.components.map(c => (
                  <div className="comp-row" key={c.key}>
                    <div className="comp-head">
                      <span className="comp-key">{c.key}</span>
                      <span className="comp-weight">×{c.weight}%</span>
                      <span className="comp-score" style={{ color: scoreColor(c.score) }}>
                        {c.score ?? 'N/A'}
                      </span>
                    </div>
                    <ScoreBar value={c.score} />
                    <div className="comp-desc">{COMP_NOTE[c.key] || c.note}</div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="card-title">테마 정렬 분석</div>
                {data.components.map(c => (
                  <div className="comp-row" key={c.key}>
                    <div className="comp-head">
                      <span className="comp-key">{c.key}</span>
                      <span className="comp-score" style={{ color: scoreColor(c.score) }}>
                        {c.score !== null && c.score !== undefined ? `${c.score}${c.key === '정렬도' ? '%' : ''}` : 'N/A'}
                      </span>
                    </div>
                    <ScoreBar value={c.score} />
                    <div className="comp-desc">{c.note}</div>
                  </div>
                ))}
                {data.theme?.selected?.length > 0 && (
                  <div className="active-themes-row">
                    {data.theme.selected.map(t => <span className="theme-tag" key={t}>{t}</span>)}
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── 종목별 기여도 ── */}
          <section className="card">
            <div className="card-title">
              종목별 기여도
              <span className="card-title-sub">Σ기여={data.score}</span>
            </div>
            {data.contributions.map(c => (
              <div
                className={`contrib-card ${mode === 'theme' && c.matched === false ? 'contrib-unmatched' : ''}`}
                key={c.ticker}
              >
                <div className="cc-header">
                  {mode === 'theme' && (
                    <span className={`match-badge ${c.matched ? 'matched' : 'unmatched'}`}>
                      {c.matched ? `✓ ${c.matchSource}` : '✗ 미정렬'}
                    </span>
                  )}
                  <span className="cc-name">{c.name}</span>
                  <span className="cc-weight">{c.weight}%</span>
                  <span className="cc-contrib">기여 <b style={{ color: 'var(--gold-bright)' }}>{c.contribution.toFixed(1)}</b></span>
                </div>

                {/* 테마 태그 (theme 모드) */}
                {c.themes?.length > 0 && (
                  <div className="cc-themes">
                    {c.themes.map(t => <span className="theme-tag" key={t}>{t}</span>)}
                  </div>
                )}

                {/* fund 점수 */}
                <div className="cc-fund-row">
                  <span className="cc-fund-label">펀더멘털</span>
                  <div className="cc-fund-bar-wrap">
                    <ScoreBar value={c.fund} height={6} />
                  </div>
                  <span className="cc-fund-val" style={{ color: scoreColor(c.fund) }}>
                    {c.fund !== null ? c.fund : 'N/A'}
                  </span>
                </div>

                {/* 서브 점수 3개 (기본 모드) */}
                {mode === 'basic' && (
                  <div className="cc-subs">
                    <SubScore label="재무" value={c.sub?.health} na={c.flags?.includes('health_na')} />
                    <SubScore label="수급" value={c.sub?.supply} na={c.flags?.includes('supply_na')} />
                    <SubScore label="신뢰" value={c.sub?.trust} na={c.flags?.includes('trust_na')} />
                  </div>
                )}

                {/* N/A 플래그 안내 */}
                {c.flags?.length > 0 && (
                  <div className="cc-flags">
                    {c.flags.map(f => <span className="flag-tag" key={f}>{FLAG_LABEL[f] || f}</span>)}
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* ── 렌즈 설명 ── */}
          <div className="lens-note">{data.lens}</div>

          {/* ── 테마 모드 전환 CTA ── */}
          {mode === 'basic' ? (
            <button className="theme-cta-btn" onClick={() => setShowSelector(true)} disabled={saving}>
              🔭 내 성장테마 렌즈 만들기
            </button>
          ) : (
            <button className="theme-delete-btn" onClick={handleDeleteTheme}>
              내 성장테마 삭제하기 → 기본 모드 복귀
            </button>
          )}

          <div className="disclaimer-line">{data.disclaimer}</div>
        </div>
      )}

      {showSelector && (
        <ThemeSelector
          themes={availableThemes}
          onConfirm={handleConfirmTheme}
          onCancel={() => setShowSelector(false)}
        />
      )}
    </div>
  )
}
