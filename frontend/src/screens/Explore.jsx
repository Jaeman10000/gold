// 탐사(what-if) 화면 — 가상 비중으로 활성 모드 점수 재계산 (CLAUDE.md §7).
// 하드룰: 종목 추천 없음. 사용자 직접 입력한 종목만 시뮬. 고정 문구 항상 표시.
import { useRef, useState } from 'react'
import { useMarket } from '../store/marketStore'

const FIXED_DISCLAIMER = '가정 시뮬레이션 · 투자권유 아님 · 사용자가 직접 입력한 종목 기준'

// 상태: idle → searching → selected → simulating → result | error
export default function Explore() {
  const { market } = useMarket()
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

  return (
    <div className="screen explore-screen">
      <div className="screen-header">
        <h2>탐사</h2>
        <span className="explore-badge">what-if</span>
      </div>

      <div className="explore-body">

        {/* 고정 문구 — 항상 최상단 */}
        <div className="explore-disclaimer-top">{FIXED_DISCLAIMER}</div>

        {/* ① 종목 검색 */}
        <section className="card explore-search-card">
          <div className="card-title">종목 입력</div>
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

        {/* ② 비중 슬라이더 — 종목 선택 후 표시 */}
        {selected && (
          <section className="card explore-weight-card">
            <div className="card-title">
              가상 비중 설정
              <span className="card-title-sub">재조정 후 포트폴리오 내 비중</span>
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
              {weight === 0
                ? '0% = 이 종목을 제외한 시뮬레이션'
                : `기존 종목들이 합산 ${100 - weight}%로 조정됩니다`}
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
