// 탐사(what-if) 화면 — 가상 비중으로 활성 모드 점수 재계산 (CLAUDE.md §7).
// 하드룰: 종목 추천 없음. 사용자 직접 입력한 종목만 시뮬. 고정 문구 항상 표시.
import { useRef, useState, useMemo } from 'react'
import { useMarket } from '../store/marketStore'
import { useScreenData } from '../store/dataStore'

// 한국어 조사 선택: 받침 있으면 "이", 없으면 "가"
function particle(name) {
  if (!name) return '이'
  const code = name.charCodeAt(name.length - 1)
  if (code < 0xAC00 || code > 0xD7A3) return '이'
  return (code - 0xAC00) % 28 === 0 ? '가' : '이'
}

const FIXED_DISCLAIMER = '가정 시뮬레이션 · 투자권유 아님 · 사용자가 직접 입력한 종목 기준'

// 상태: idle → searching → selected → simulating → result | error
export default function Explore() {
  const { market } = useMarket()
  const { data: portfolioData } = useScreenData('portfolio', market)
  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState('idle') // 'idle'|'loading'|'done'
  const [searchResults, setSearchResults] = useState([])
  const [searchNote, setSearchNote] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const [selected, setSelected] = useState(null) // {ticker, name}
  const [weight, setWeight] = useState(10)       // 1~50%

  const [simState, setSimState] = useState('idle') // 'idle'|'loading'|'done'|'error'
  const [simResult, setSimResult] = useState(null)
  const [simError, setSimError] = useState('')

  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  // ── 검색 ─────────────────────────────────────────────────────────────────

  function handleQueryChange(e) {
    const v = e.target.value
    setQuery(v)
    setSelected(null)
    setSimState('idle')
    setSimResult(null)

    clearTimeout(debounceRef.current)
    if (!v.trim()) {
      setShowDropdown(false)
      setSearchResults([])
      return
    }
    setSearchState('loading')
    setShowDropdown(true)
    debounceRef.current = setTimeout(() => runSearch(v.trim()), 350)
  }

  async function runSearch(q) {
    try {
      const res = await fetch(`/api/explore/search?q=${encodeURIComponent(q)}&market=${market}`)
      const data = await res.json()
      setSearchResults(data.results || [])
      setSearchNote(data.note || '')
      setSearchState('done')
    } catch {
      setSearchResults([])
      setSearchState('done')
    }
  }

  function handleSelect(item) {
    setSelected(item)
    setQuery(item.name || item.ticker)
    setShowDropdown(false)
    setSimState('idle')
    setSimResult(null)
  }

  function handleClear() {
    setSelected(null)
    setQuery('')
    setSearchResults([])
    setShowDropdown(false)
    setSimState('idle')
    setSimResult(null)
    inputRef.current?.focus()
  }

  // ── 시뮬레이션 ──────────────────────────────────────────────────────────

  async function handleSimulate() {
    if (!selected) return
    setSimState('loading')
    setSimResult(null)
    setSimError('')
    try {
      const res = await fetch('/api/explore/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market,
          ticker: selected.ticker,
          name: selected.name,
          targetWeight: weight,
        }),
      })
      const data = await res.json()
      if (data.status === 'error') {
        setSimError(data.msg || '시뮬레이션 오류')
        setSimState('error')
      } else {
        setSimResult(data)
        setSimState('done')
      }
    } catch (e) {
      setSimError('서버 연결 실패')
      setSimState('error')
    }
  }

  // ── 렌더 ─────────────────────────────────────────────────────────────────

  const deltaAbs = simResult ? Math.abs(simResult.delta) : 0
  const deltaSign = simResult && simResult.delta > 0 ? '▲ +' : simResult && simResult.delta < 0 ? '▼ −' : '─ '

  const isIdle = !selected && simState === 'idle'

  // 선택 종목의 현재 실제 비중 (보유 중인 경우에만)
  const currentWeight = useMemo(() => {
    if (!selected || !portfolioData?.holdings?.length) return null
    const h = portfolioData.holdings.find(h => h.ticker === selected.ticker)
    if (!h) return null
    const total = portfolioData.holdings.reduce((s, x) => s + (x.evalAmount || 0), 0)
    if (!total) return null
    return Math.round((h.evalAmount / total) * 100)
  }, [selected, portfolioData])

  return (
    <div className="screen explore-screen">
      <div className="screen-header">
        <h2>탐사</h2>
        <span className="explore-badge">what-if</span>
      </div>

      <div className="explore-body">

        {/* 소개 — 처음 본 사용자용 */}
        <div className="explore-intro">
          <div className="explore-intro-title">만약에 시뮬레이션</div>
          <div className="explore-intro-desc">
            종목을 넣어 가상으로 비중을 조정하면, 내 광맥 점수가 어떻게 달라지는지 미리 볼 수 있습니다.
            실제 매매와는 무관한 가정입니다.
          </div>
        </div>

        {/* 고정 문구 */}
        <div className="explore-disclaimer-top">{FIXED_DISCLAIMER}</div>

        {/* ① 종목 검색 */}
        <section className="card explore-search-card">
          <div className="card-title">종목 입력</div>

          {/* 사용법 힌트 — 종목 선택 전에만 */}
          {isIdle && (
            <div className="explore-steps">
              <span className="ex-step"><span className="ex-step-num">①</span>종목 입력</span>
              <span className="ex-step-arrow">→</span>
              <span className="ex-step"><span className="ex-step-num">②</span>비중 설정</span>
              <span className="ex-step-arrow">→</span>
              <span className="ex-step"><span className="ex-step-num">③</span>점수 비교</span>
            </div>
          )}

          <div className="explore-search-note">
            추천 종목 없음 · 직접 입력한 종목만 시뮬
          </div>

          <div className="explore-input-row">
            <input
              ref={inputRef}
              className="explore-input"
              type="text"
              placeholder="종목명 또는 6자리 코드"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => { if (searchResults.length) setShowDropdown(true) }}
              autoComplete="off"
            />
            {selected && (
              <button className="explore-clear-btn" onClick={handleClear} aria-label="취소">✕</button>
            )}
          </div>

          {/* 드롭다운 — 이름+코드만, 설명 없음 */}
          {showDropdown && (
            <div className="explore-dropdown">
              {searchState === 'loading' && (
                <div className="explore-drop-item loading">검색 중…</div>
              )}
              {searchState === 'done' && searchResults.length === 0 && (
                <div className="explore-drop-item empty">{searchNote}</div>
              )}
              {searchResults.map((r) => (
                <button
                  key={r.ticker}
                  className="explore-drop-item"
                  onClick={() => handleSelect(r)}
                >
                  <span className="drop-name">{r.name || r.ticker}</span>
                  <span className="drop-ticker">{r.ticker}</span>
                </button>
              ))}
            </div>
          )}

          {/* 선택 확인 칩 */}
          {selected && (
            <div className="explore-selected-chip">
              <span className="esc-name">{selected.name}</span>
              <span className="esc-ticker">{selected.ticker}</span>
            </div>
          )}
        </section>

        {/* 빈 상태 안내 — 검색어도 선택도 없을 때 */}
        {!selected && !query && simState === 'idle' && (
          <div className="explore-empty-state">
            <div className="explore-empty-icon">🧭</div>
            <p className="explore-empty-text">
              보유 종목의 비중을 바꾸거나,<br />새 종목을 더했을 때를 가정해 보세요.
            </p>
          </div>
        )}

        {/* ② 비중 슬라이더 — 종목 선택 후 표시 */}
        {selected && (
          <section className="card explore-weight-card">
            <div className="card-title">가상 비중 설정</div>

            {/* 현재 → 가정 비중 표시 */}
            <div className="explore-weight-arrow-row">
              {currentWeight !== null
                ? <><span className="ewa-cur">현재 <b>{currentWeight}%</b></span><span className="ewa-arr">→</span></>
                : <><span className="ewa-cur">신규 종목</span><span className="ewa-arr">→</span></>
              }
              <span className="ewa-target">가정 <b className="ewa-target-num">{weight}%</b></span>
            </div>

            <div className="explore-weight-row">
              <input
                type="range"
                className="explore-slider"
                min={1} max={50} step={1}
                value={weight}
                onChange={(e) => { setWeight(Number(e.target.value)); setSimState('idle'); setSimResult(null) }}
              />
              <span className="explore-weight-val">{weight}%</span>
            </div>

            <div className="explore-weight-note">
              {selected.name}{particle(selected.name)} 포트폴리오의 <b>{weight}%</b>를 차지한다고 가정합니다.
              나머지 종목들의 비중은 자동으로 줄어들어 전체 합이 100%가 됩니다.
            </div>

            <button
              className="explore-sim-btn"
              onClick={handleSimulate}
              disabled={simState === 'loading'}
            >
              {simState === 'loading' ? '계산 중…' : '점수 재계산'}
            </button>
          </section>
        )}

        {/* ③ 시뮬 중 — Case B 신규 종목 */}
        {simState === 'loading' && (
          <div className="explore-simulating">
            <div className="sim-spinner" />
            <span>가상 데이터 계산 중…</span>
            <span className="sim-sub">(DART · 수급 조회 중, 최대 15초)</span>
          </div>
        )}

        {/* ③ 시뮬 결과 */}
        {simState === 'done' && simResult && (
          <>
            {/* 결과 비교 카드 */}
            <section className="card explore-result-card">
              <div className="card-title">
                시뮬레이션 결과
                <span className="card-title-sub">가정 · 사실만 표시</span>
              </div>

              <div className="explore-stock-row">
                <span className="esr-label">종목</span>
                <span className="esr-name">{simResult.stock.name}</span>
                <span className="esr-ticker">{simResult.stock.ticker}</span>
                {simResult.stock.isNew && <span className="esr-new-badge">신규</span>}
              </div>
              <div className="explore-stock-row">
                <span className="esr-label">가상 비중</span>
                <span className="esr-val">{simResult.targetWeight}%</span>
              </div>
              {simResult.stock.isNew && simResult.stock.fundScore !== null && (
                <div className="explore-stock-row">
                  <span className="esr-label">종목 fund</span>
                  <span className="esr-val">{simResult.stock.fundScore}</span>
                  {!simResult.stock.dataAvailable && (
                    <span className="esr-na">데이터 없음(N/A)</span>
                  )}
                </div>
              )}

              {/* 점수 비교 */}
              <div className="explore-score-compare">
                <div className="esc-col">
                  <div className="esc-label">현재</div>
                  <div className="esc-grade">{simResult.current.label}</div>
                </div>
                <div className="esc-arrow">
                  <span className={`esc-delta ${simResult.delta > 0 ? 'pos' : simResult.delta < 0 ? 'neg' : 'flat'}`}>
                    {deltaSign}{deltaAbs > 0 ? deltaAbs : '±0'}
                  </span>
                </div>
                <div className="esc-col">
                  <div className="esc-label">이 가정에서는</div>
                  <div className={`esc-grade sim ${simResult.delta > 0 ? 'pos' : simResult.delta < 0 ? 'neg' : ''}`}>
                    {simResult.simulated.label}
                  </div>
                </div>
              </div>

              <div className="explore-change-desc">{simResult.changeDesc}</div>

              {/* 하드룰 note */}
              <div className="explore-sim-note">{simResult.note}</div>
              {simResult.trustNote && (
                <div className="explore-trust-note">{simResult.trustNote}</div>
              )}
            </section>

            {/* 케이스 설명 */}
            <div className="explore-case-note">
              {simResult.case === 'A'
                ? '기존 보유 종목의 비중을 변경한 시뮬레이션입니다.'
                : '현재 미보유 종목을 추가한 가정입니다. 기존 종목들은 비례 축소됩니다.'}
            </div>

            {/* disclaimer */}
            <div className="explore-disclaimer-bottom">{simResult.disclaimer}</div>
          </>
        )}

        {simState === 'error' && (
          <div className="explore-error">{simError}</div>
        )}

      </div>
    </div>
  )
}
