// 금고 — 매매·배당 자동기록 장부 + 현재 시장 전종목 (CLAUDE.md §7). v1 핵심.
import { useScreenData, useDataStore } from '../store/dataStore'
import { useMarket } from '../store/marketStore'
import MarketToggle from '../components/MarketToggle'
import LockedOverlay from '../components/LockedOverlay'
import LoadingMascot from '../components/LoadingMascot'
import { money } from '../utils/format'

export default function Vault() {
  const { market } = useMarket()
  const { data, loading, refreshing, error } = useScreenData('vault', market)
  const { refresh } = useDataStore()
  const locked = data?.status === 'locked'
  const symbol = data?.currencySymbol || '₩'

  return (
    <div className="screen vault">
      <header className="screen-header">
        <h2>금고 · 장부</h2>
        <div className="header-right">
          <button
            className="refresh-btn"
            onClick={() => refresh(market)}
            disabled={refreshing}
            title="새로고침"
          >
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
          <section className="card">
            <div className="card-title">
              배당 (수레) · 합계 <b>{money(symbol, data.dividendTotal)}</b>
            </div>
            {data.dividends.map((d, i) => (
              <div className="ledger-row" key={i}>
                <span>{d.date}</span>
                <span className="lr-name">{d.name}</span>
                <span className="lr-amt profit">+{money(symbol, d.amount)}</span>
              </div>
            ))}
          </section>

          <section className="card">
            <div className="card-title">매매 기록 ({data.trades.length})</div>
            {data.trades.map((t, i) => (
              <div className="ledger-row" key={i}>
                <span>{t.date}</span>
                <span className="lr-name">{t.name}</span>
                <span className={`lr-side ${t.side === 'BUY' ? 'buy' : 'sell'}`}>{t.sideLabel}</span>
                <span className="lr-qty">{t.qty}주</span>
                <span className="lr-amt">{money(symbol, t.amount)}</span>
              </div>
            ))}
          </section>

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
