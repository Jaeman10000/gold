// 금고 — 매매·배당 자동기록 장부 (CLAUDE.md §7). v1 핵심.
import { useRef, useState } from 'react'
import { useScreenData, useDataStore } from '../store/dataStore'
import { useMarket } from '../store/marketStore'
import MarketToggle from '../components/MarketToggle'
import LockedOverlay from '../components/LockedOverlay'
import LoadingMascot from '../components/LoadingMascot'
import { money, profitColor } from '../utils/format'

// 백엔드 exp_config와 동일한 공식 (sell_w=10, cap=30, min=1)
function calcExp(returnRate) {
  if (returnRate < 1.0) return 0
  return Math.round(10 * Math.min(returnRate, 30))
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

  const realizedTotal = (data?.realizedPnlTotal || 0) + (data?.dividendTotal || 0)
  const pnlItems = data?.realizedPnl   || []
  const divItems = data?.dividends     || []

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
            <div className="vs-label">앱 연동 후 누적 실현수익</div>
            <div className="vs-total" style={{ color: realizedTotal >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
              {realizedTotal >= 0 ? '+' : ''}{money(sym, realizedTotal)}
            </div>
            <div className="vs-breakdown">
              <div className="vs-item">
                <div className="vs-item-label">익절</div>
                <div className="vs-item-val">{money(sym, data.realizedPnlTotal)}</div>
              </div>
              <div className="vs-plus">+</div>
              <div className="vs-item">
                <div className="vs-item-label">배당</div>
                <div className="vs-item-val">{money(sym, data.dividendTotal)}</div>
              </div>
            </div>
            <div className="vs-note">투자권유 아님 · 실현확정 수익 기준</div>
          </section>

          {/* ── [2/3] 익절 기록 ─────────────────────────────────────────── */}
          <section className="card">
            <div className="card-title">
              익절 기록
              <span className="card-title-sub">최근 3개월 · {pnlItems.length}건</span>
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
                {pnlItems.map((item, i) => {
                  const exp = calcExp(item.returnRate)
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
                })}
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
