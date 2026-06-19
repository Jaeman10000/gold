// 금고 — 매매·배당 자동기록 장부 (CLAUDE.md §7). v1 핵심.
import { useRef, useState, useEffect } from 'react'
import { useScreenData, useDataStore } from '../store/dataStore'
import { useMarket } from '../store/marketStore'
import MarketToggle from '../components/MarketToggle'
import LockedOverlay from '../components/LockedOverlay'
import LoadingMascot from '../components/LoadingMascot'
import { money, profitColor } from '../utils/format'

// 백엔드 exp_config와 동일한 공식 (sell_w=10, cap=30, min=1)
// realizedPnl=0 이면 키움 매수단가 미확보 → EXP 0
function calcExp(returnRate, realizedPnl) {
  if (realizedPnl <= 0) return 0
  if (returnRate < 1.0) return 0
  return Math.round(10 * Math.min(returnRate, 30))
}

// 날짜+종목 기준 분할 체결 합산 — 키움 ka10073이 체결 단위로 쪼개서 반환
function groupPnl(items) {
  const map = {}
  for (const item of items) {
    const key = `${item.date}|${item.ticker}`
    if (!map[key]) {
      map[key] = { ...item, sellQty: 0, realizedPnl: 0, _wRate: 0 }
    }
    const g = map[key]
    g.realizedPnl += item.realizedPnl
    g.sellQty     += item.sellQty
    g._wRate      += item.returnRate * item.sellQty
  }
  return Object.values(map)
    .map(g => ({ ...g, returnRate: g.sellQty ? Math.round(g._wRate / g.sellQty * 10) / 10 : 0 }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

// "20260617" → "06/17"
function fmtDate(str) {
  if (!str || str.length < 8) return str || ''
  return `${str.slice(4, 6)}/${str.slice(6, 8)}`
}

export default function Vault() {
  const { market } = useMarket()
  const { data, loading, refreshing, error } = useScreenData('vault', market)
  const { refresh } = useDataStore()
  const tradesRef = useRef(null)
  const divsRef   = useRef(null)
  const [importMsg, setImportMsg] = useState(null)
  const [importing, setImporting] = useState(false)
  const [period, setPeriod] = useState('all')

  // 금고 진입 시 EXP 동기화 (최신 익절 기록 DB 반영)
  useEffect(() => {
    fetch('/api/level/sync', { method: 'POST' }).catch(() => {})
  }, [])

  const locked = data?.status === 'locked'
  const sym    = data?.currencySymbol || '₩'

  async function handleImport(file, endpoint) {
    if (!file) return
    setImporting(true)
    setImportMsg(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`/api/import/${endpoint}?market=${market}`, {
        method: 'POST', body: form,
      })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setImportMsg(`✓ ${d.inserted}건 추가, ${d.skipped}건 중복 건너뜀`)
      refresh(market)
    } catch (e) {
      setImportMsg(`가져오기 실패: ${e.message}`)
    } finally {
      setImporting(false)
    }
  }

  const allPnlItems = groupPnl(data?.realizedPnl || [])
  const divItems    = data?.dividends || []

  // 기간 필터 — YYYYMMDD 비교
  const PERIODS = [
    { key: '1w', label: '1주' },
    { key: '1m', label: '1달' },
    { key: '3m', label: '3달' },
    { key: '6m', label: '6달' },
    { key: '1y', label: '1년' },
  ]
  function periodStartDate(p) {
    const d = new Date()
    if (p === '1w') d.setDate(d.getDate() - 7)
    else if (p === '1m') d.setMonth(d.getMonth() - 1)
    else if (p === '3m') d.setMonth(d.getMonth() - 3)
    else if (p === '6m') d.setMonth(d.getMonth() - 6)
    else if (p === '1y') d.setFullYear(d.getFullYear() - 1)
    return d.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
  }
  const pnlItems = period === 'all'
    ? allPnlItems
    : allPnlItems.filter(item => item.date >= periodStartDate(period))

  // 연동일 기준 분기 — date < firstLinkDate = 백필(연동 이전), 이상 = 실시간(연동 후)
  const firstLink = data?.firstLinkDate || null
  const liveItems   = firstLink ? pnlItems.filter(i => i.date >= firstLink) : pnlItems
  const backfillItems = firstLink ? pnlItems.filter(i => i.date <  firstLink) : []

  // 누적 요약 — 전체 기간은 항상 금색(단조 증가 의미), 기간 필터 시 양/음 색상
  const fullPnlTotal = data?.realizedPnlTotal || 0
  const fullDivTotal = data?.dividendTotal || 0
  const filteredPnl  = pnlItems.reduce((s, i) => s + i.realizedPnl, 0)
  const filteredDiv  = period === 'all'
    ? fullDivTotal
    : divItems.filter(d => d.date.replace(/-/g, '') >= periodStartDate(period))
              .reduce((s, d) => s + d.amount, 0)
  const displayTotal = period === 'all'
    ? fullPnlTotal + fullDivTotal
    : filteredPnl + filteredDiv
  const totalColor = period === 'all'
    ? 'var(--gold)'
    : displayTotal >= 0 ? 'var(--profit)' : 'var(--loss)'

  // 익절 1행 렌더 (연동 전/후 섹션 공용)
  function renderPnlRow(item, i) {
    const exp = calcExp(item.returnRate, item.realizedPnl)
    const rateColor = profitColor(item.returnRate)
    const pnlColor  = profitColor(item.realizedPnl)
    return (
      <div className="pnl-row" key={i}>
        <span className="pnl-date">{fmtDate(item.date)}</span>
        <span className="pnl-name">{item.name || item.ticker}</span>
        <span className="pnl-rate" style={{ color: rateColor }}>
          {item.returnRate > 0 ? '+' : ''}{item.returnRate.toFixed(1)}%
        </span>
        <span className="pnl-pnl" style={{ color: pnlColor }}>
          {item.realizedPnl >= 0 ? '+' : ''}{money(sym, item.realizedPnl)}
        </span>
        <span className={`pnl-exp-chip ${exp > 0 ? 'pos' : 'zero'}`}>
          {exp > 0 ? `+${exp}` : '—'}
        </span>
      </div>
    )
  }

  return (
    <div className="screen vault">
      <header className="screen-header">
        <h2>금고 · 장부</h2>
        <div className="header-right">
          <button className="refresh-btn" onClick={() => refresh(market)} disabled={refreshing} title="새로고침">
            <span className={refreshing ? 'refresh-icon spinning' : 'refresh-icon'}>↺</span>
          </button>
          <MarketToggle />
        </div>
      </header>

      {loading && !data && <LoadingMascot text="금고를 열고 있는 중…" />}
      {error && !data && <div className="center-msg err">백엔드 연결 실패: {error}</div>}
      {locked && <LockedOverlay reason={data.reason} />}

      {!loading && !locked && data && (
        <div className="vault-body">

          {/* ── [1] 누적 실현수익 요약 카드 ─────────────────────────────── */}
          <section className="vault-summary-card">
            <div className="vs-header-row">
              <div className="vs-label">앱 연동 후 누적 실현수익</div>
              <div className="vs-period-btns">
                {PERIODS.map(p => (
                  <button
                    key={p.key}
                    className={`vs-period-btn${period === p.key ? ' active' : ''}`}
                    onClick={() => setPeriod(period === p.key ? 'all' : p.key)}
                  >{p.label}</button>
                ))}
              </div>
            </div>
            <div className="vs-total" style={{ color: totalColor }}>
              {displayTotal >= 0 ? '+' : ''}{money(sym, displayTotal)}
            </div>
            <div className="vs-breakdown">
              <div className="vs-item">
                <div className="vs-item-label">익절</div>
                <div className="vs-item-val">{money(sym, period === 'all' ? fullPnlTotal : filteredPnl)}</div>
              </div>
              <div className="vs-plus">+</div>
              <div className="vs-item">
                <div className="vs-item-label">배당</div>
                <div className="vs-item-val">{money(sym, filteredDiv)}</div>
              </div>
            </div>
            <div className="vs-note">투자권유 아님 · 실현확정 수익 기준{period !== 'all' ? ` · ${PERIODS.find(p=>p.key===period)?.label} 기준` : ''}</div>
          </section>

          {/* ── [2/3] 익절 기록 ─────────────────────────────────────────── */}
          <section className="card">
            <div className="card-title">
              익절 기록
              <span className="card-title-sub">
                {period === 'all' ? '최근 3개월' : PERIODS.find(p=>p.key===period)?.label} · {pnlItems.length}건
              </span>
            </div>

            {pnlItems.length === 0 ? (
              <div className="vault-empty">
                <div className="vault-empty-icon">📋</div>
                <p>최근 2개월 매매기록이 없습니다.</p>
                <p className="vault-empty-sub">과거 기록은 HTS에서 CSV로 가져올 수 있습니다.</p>
                <input ref={tradesRef} type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => { handleImport(e.target.files[0], 'trades'); e.target.value = '' }} />
                <button className="vault-import-btn" onClick={() => tradesRef.current?.click()} disabled={importing}>
                  {importing ? '업로드 중…' : '📂 매매내역 CSV 가져오기'}
                </button>
              </div>
            ) : (
              <div className="pnl-table">
                <div className="pnl-header">
                  <span className="ph-date">날짜</span>
                  <span className="ph-name">종목</span>
                  <span className="ph-rate">수익률</span>
                  <span className="ph-pnl">실현손익</span>
                  <span className="ph-exp">EXP</span>
                </div>

                {/* 연동 후(실시간) — firstLink 없으면 구분 없이 전체가 여기로 */}
                {liveItems.length > 0 && firstLink && (
                  <div className="pnl-divider live">── 연동 후 · 실시간 채굴 ──</div>
                )}
                {liveItems.map(renderPnlRow)}

                {/* 연동 이전(백필·복원) */}
                {backfillItems.length > 0 && (
                  <div className="pnl-divider backfill">── 연동 이전 기록 · 복원 ──</div>
                )}
                {backfillItems.map(renderPnlRow)}
              </div>
            )}
          </section>

          {/* ── 배당 기록 ──────────────────────────────────────────────────── */}
          <section className="card">
            <div className="card-title">
              배당 기록
              <span className="card-title-sub">합계 {money(sym, data.dividendTotal)}</span>
            </div>

            {divItems.length === 0 ? (
              <div className="vault-empty">
                <div className="vault-empty-icon">🌾</div>
                <p>배당 내역이 없습니다.</p>
                <p className="vault-empty-sub">HTS에서 배당 내역 CSV를 가져오면 레벨 EXP도 함께 적립됩니다.</p>
                <input ref={divsRef} type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => { handleImport(e.target.files[0], 'dividends'); e.target.value = '' }} />
                <button className="vault-import-btn" onClick={() => divsRef.current?.click()} disabled={importing}>
                  {importing ? '업로드 중…' : '📂 배당내역 CSV 가져오기'}
                </button>
              </div>
            ) : (
              divItems.map((d, i) => (
                <div className="ledger-row" key={i}>
                  <span className="lr-date">{d.date}</span>
                  <span className="lr-name">{d.name || d.ticker}</span>
                  <span className="lr-amt profit">+{money(sym, d.amount)}</span>
                  <span className="pnl-exp-chip pos">+100</span>
                </div>
              ))
            )}
          </section>

          {importMsg && <div className="vault-import-msg">{importMsg}</div>}

          <div className="export-row">
            <button className="ghost-btn" disabled>Excel Export (Phase 2)</button>
            <button className="ghost-btn" disabled>PDF Export (Phase 2)</button>
          </div>
          <div className="disclaimer-line">{data.disclaimer}</div>
        </div>
      )}
    </div>
  )
}
