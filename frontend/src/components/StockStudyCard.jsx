// 탐사 종목 이해 도구 — 재무 사실 정보 카드 (5섹션).
// 하드룰 (CLAUDE.md §4·§7): 투자권유 아님. "높다/낮다/좋다/나쁘다" 텍스트 0개.
// 수치 + 지표 설명만. 색 중립(금색/차콜). 판단은 투자자 본인 몫.
import { useState, useEffect } from 'react'
import { api } from '../api/client'

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function fmtNum(v, digits = 1) {
  if (v === null || v === undefined) return null
  return Number(v).toFixed(digits)
}

function fmtLargeWon(v) {
  // DART는 원(KRW) 단위. 조원/억원으로 변환.
  if (v === null || v === undefined) return null
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${(v / 1e12).toFixed(1)}조`
  if (abs >= 1e8)  return `${Math.round(v / 1e8)}억`
  return String(v)
}

function fmtOgukWon(v) {
  // ka10001 단위는 억원
  if (v === null || v === undefined) return null
  if (v >= 10000) return `${(v / 10000).toFixed(1)}조`
  return `${Math.round(v).toLocaleString()}억`
}

// ── 개별 수치 행 (숫자=주인공, bar=보조) ────────────────────────────────────

function StatRow({ label, value, unit = '', desc, barCeil }) {
  if (value === null || value === undefined) {
    return (
      <div className="ssr">
        <div className="ssr-label">{label}</div>
        <div className="ssr-na">미제공</div>
      </div>
    )
  }
  // bar: value를 ceiling 대비 비율로 표현. ceiling을 명시하지 않아 "나쁨" 오해 차단.
  const pct = barCeil ? Math.min(Math.max(value, 0) / barCeil * 100, 100) : 0

  return (
    <div className="ssr">
      <div className="ssr-label">{label}</div>
      <div className="ssr-value">{fmtNum(value, unit === '%' ? 2 : 1)}{unit}</div>
      {barCeil !== undefined && (
        <div className="ssr-bar-track">
          <div className="ssr-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
      {desc && <div className="ssr-desc">{desc}</div>}
    </div>
  )
}

// ── 3년 추이 bar ────────────────────────────────────────────────────────────

function TrendBars({ years, field, yoyField, label }) {
  const values = years.map(y => y[field]).filter(v => v !== null && v !== undefined && v > 0)
  if (!values.length) return <div className="stt-na">데이터 없음</div>
  const maxVal = Math.max(...values)

  return (
    <div className="study-trend">
      <div className="stt-label">{label}</div>
      {years.map((y, i) => {
        const val = y[field]
        const pct = (val && maxVal > 0) ? Math.min(val / maxVal * 100, 100) : 0
        const yoy = y[yoyField]
        return (
          <div key={y.year} className="stt-row">
            <span className="stt-year">{y.year}</span>
            <div className="stt-bar-track">
              <div className="stt-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="stt-yoy">
              {yoy !== null && yoy !== undefined
                ? (yoy > 0 ? `+${yoy}%` : `${yoy}%`)
                : (i === years.length - 1 ? '─' : '')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function StockStudyCard({ ticker, name, market }) {
  const [overview, setOverview] = useState(null)
  const [financials, setFinancials] = useState(null)
  const [ovLoading, setOvLoading] = useState(true)
  const [finLoading, setFinLoading] = useState(true)

  useEffect(() => {
    if (!ticker) return
    setOverview(null); setFinancials(null)
    setOvLoading(true); setFinLoading(true)

    // Phase 1 즉시
    api.exploreStock(ticker, market)
      .then(setOverview)
      .catch(() => setOverview(null))
      .finally(() => setOvLoading(false))

    // Phase 2 lazy (별도, 느림)
    api.exploreFinancials(ticker, market)
      .then(setFinancials)
      .catch(() => setFinancials(null))
      .finally(() => setFinLoading(false))
  }, [ticker, market])

  if (ovLoading) {
    return (
      <div className="study-card card">
        <div className="study-loading">📊 정보 조회 중…</div>
      </div>
    )
  }

  if (!overview?.available) {
    return (
      <div className="study-card card">
        <div className="study-na-msg">키움 연동 후 데이터를 불러올 수 있습니다.</div>
      </div>
    )
  }

  const v = overview.valuation || {}
  const c = overview.corpInfo || {}
  const years = financials?.years || []

  return (
    <div className="study-card card">
      {/* ── 기본 정보 ──────────────────────────────────────── */}
      <div className="study-section">
        <div className="study-section-title">기본 정보</div>

        {c.indutyName && (
          <div className="study-industry">
            <span className="si-name">{c.indutyName}</span>
            <span className="si-note">표준산업분류(KSIC) 기준 · 상세 사업 소개는 추후</span>
          </div>
        )}

        <div className="study-basic-grid">
          {c.ceoNm && (
            <div className="sbg-item"><span className="sbg-lbl">대표</span><span className="sbg-val">{c.ceoNm}</span></div>
          )}
          {c.estDt && (
            <div className="sbg-item"><span className="sbg-lbl">설립</span><span className="sbg-val">{c.estDt}</span></div>
          )}
          {c.accMt && (
            <div className="sbg-item"><span className="sbg-lbl">결산</span><span className="sbg-val">{c.accMt}월</span></div>
          )}
          {v.mac !== null && v.mac !== undefined && (
            <div className="sbg-item"><span className="sbg-lbl">시가총액</span><span className="sbg-val">{fmtOgukWon(v.mac)}</span></div>
          )}
        </div>

        {v.oyrHgst && v.oyrLwst && (
          <div className="study-52w">
            <span className="s52-lbl">52주 범위</span>
            <span className="s52-range">
              {v.oyrLwst?.toLocaleString()}원 ─ {v.oyrHgst?.toLocaleString()}원
            </span>
          </div>
        )}
      </div>

      {/* ── 수익성 ────────────────────────────────────────── */}
      <div className="study-section">
        <div className="study-section-title">수익성</div>
        <StatRow
          label="영업이익률"
          value={v.opMargin}
          unit="%"
          desc="영업이익 ÷ 매출액"
          barCeil={15}
        />
        <StatRow
          label="자기자본이익률 (ROE)"
          value={v.roe}
          unit="%"
          desc="세후 순이익 ÷ 자기자본"
          barCeil={20}
        />
        {v.eps !== null && v.eps !== undefined && (
          <div className="ssr">
            <div className="ssr-label">주당순이익 (EPS)</div>
            <div className="ssr-value">{v.eps?.toLocaleString()}원</div>
            <div className="ssr-desc">1주당 세후 순이익</div>
          </div>
        )}
      </div>

      {/* ── 성장성 ────────────────────────────────────────── */}
      <div className="study-section">
        <div className="study-section-title">
          성장성
          {finLoading && <span className="study-loading-badge">조회 중…</span>}
        </div>
        {finLoading ? (
          <div className="study-fin-loading">DART 재무 불러오는 중 (최대 15초)…</div>
        ) : years.length > 0 ? (
          <>
            <TrendBars years={years} field="revenue"  yoyField="revenueYoy"  label="매출" />
            <TrendBars years={years} field="opIncome" yoyField="opIncomeYoy" label="영업이익" />
            <div className="study-trend-note">DART 사업보고서 기준 · 연간 비교 · YoY 전년대비</div>
          </>
        ) : (
          <div className="study-na-msg">
            {financials?.note || 'DART 재무 데이터를 불러오지 못했습니다.'}
          </div>
        )}
      </div>

      {/* ── 안정성 ────────────────────────────────────────── */}
      <div className="study-section">
        <div className="study-section-title">
          안정성
          {finLoading && <span className="study-loading-badge">조회 중…</span>}
        </div>
        {finLoading ? (
          <div className="study-fin-loading">조회 중…</div>
        ) : financials?.latestDebtRatio !== null && financials?.latestDebtRatio !== undefined ? (
          <StatRow
            label={`부채비율 (${years[0]?.year || '최신'}년 기준)`}
            value={financials.latestDebtRatio}
            unit="%"
            desc="부채총계 ÷ 자본총계 × 100"
            barCeil={300}
          />
        ) : (
          <div className="study-na-msg">부채비율 산출 데이터 미확보</div>
        )}
      </div>

      {/* ── 밸류에이션 ───────────────────────────────────── */}
      <div className="study-section">
        <div className="study-section-title">밸류에이션</div>
        <StatRow label="PER" value={v.per} unit="배" desc="주가 ÷ 주당순이익(EPS)" barCeil={60} />
        <StatRow label="PBR" value={v.pbr} unit="배" desc="주가 ÷ 주당순자산(BPS)" barCeil={5} />
        {v.ev !== null && v.ev !== undefined && (
          <div className="ssr">
            <div className="ssr-label">EV/EBITDA</div>
            <div className="ssr-value">{fmtNum(v.ev)}배</div>
            <div className="ssr-desc">기업가치 ÷ 영업이익+감가상각</div>
          </div>
        )}
        {v.bps !== null && v.bps !== undefined && (
          <div className="ssr">
            <div className="ssr-label">주당순자산 (BPS)</div>
            <div className="ssr-value">{v.bps?.toLocaleString()}원</div>
          </div>
        )}
        {v.forExhRt !== null && v.forExhRt !== undefined && (
          <div className="ssr">
            <div className="ssr-label">외국인 소진율</div>
            <div className="ssr-value">{fmtNum(v.forExhRt)}%</div>
            <div className="ssr-desc">외국인 보유 한도 대비 실제 보유 비율</div>
          </div>
        )}
      </div>

      {/* ── 중립 안내 + 면책 ──────────────────────────────── */}
      <div className="study-footer">
        <div className="study-neutral-note">⚖️ {overview.neutralNote}</div>
        <div className="study-disclaimer">{overview.disclaimer}</div>
      </div>
    </div>
  )
}
