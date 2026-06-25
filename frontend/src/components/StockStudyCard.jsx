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

function fmtOgukWon(v) {
  // ka10001 단위는 억원
  if (v === null || v === undefined) return null
  if (v >= 10000) return `${(v / 10000).toFixed(1)}조`
  return `${Math.round(v).toLocaleString()}억`
}

// ── 개별 수치 행 ──────────────────────────────────────────────────────────────
// benchmarks: [{ chip: '워렌버핏 기준 10배 이하', at: 10 }, ...]
//   chip = 칩 텍스트, at = 바 위 틱 마크 위치(barCeil 단위, 선택)

function StatRow({ label, value, unit = '', meaning, formula, barCeil, benchmarks }) {
  if (value === null || value === undefined) {
    return (
      <div className="ssr">
        <div className="ssr-label">{label}</div>
        <div className="ssr-na">미제공</div>
        {meaning && <div className="ssr-meaning">{meaning}</div>}
      </div>
    )
  }
  const pct = barCeil ? Math.min(Math.max(value, 0) / barCeil * 100, 100) : 0
  const ticks = benchmarks?.filter(b => b.at !== undefined && barCeil) || []

  return (
    <div className="ssr">
      <div className="ssr-label">{label}</div>
      <div className="ssr-value">{fmtNum(value, unit === '%' ? 2 : 1)}{unit}</div>
      {barCeil !== undefined && (
        <div className="ssr-bar-wrap">
          <div className="ssr-bar-track">
            <div className="ssr-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          {ticks.map((b, i) => (
            <div
              key={i}
              className="ssr-bar-tick"
              style={{ left: `${Math.min(b.at / barCeil * 100, 100)}%` }}
            />
          ))}
        </div>
      )}
      {meaning  && <div className="ssr-meaning">{meaning}</div>}
      {benchmarks?.length > 0 && (
        <div className="ssr-benchmarks">
          <span className="ssr-bench-hd">참고 기준</span>
          {benchmarks.map((b, i) => (
            <span key={i} className="ssr-bench-chip">{b.chip}</span>
          ))}
        </div>
      )}
      {formula  && <div className="ssr-formula">산출: {formula}</div>}
    </div>
  )
}

// ── 일반 수치 행 (EPS/BPS처럼 bar 없는 것) ──────────────────────────────────

function PlainRow({ label, value, meaning, formula }) {
  if (value === null || value === undefined) return null
  return (
    <div className="ssr">
      <div className="ssr-label">{label}</div>
      <div className="ssr-value" style={{ fontSize: '16px' }}>{value}</div>
      {meaning && <div className="ssr-meaning">{meaning}</div>}
      {formula && <div className="ssr-formula">산출: {formula}</div>}
    </div>
  )
}

// ── 3년 추이 bar ─────────────────────────────────────────────────────────────

function TrendBars({ years, field, yoyField, label, meaning }) {
  const values = years.map(y => y[field]).filter(v => v !== null && v !== undefined && v > 0)
  if (!values.length) return <div className="stt-na">데이터 없음</div>
  const maxVal = Math.max(...values)

  return (
    <div className="study-trend">
      <div className="stt-label">{label}</div>
      {meaning && <div className="stt-meaning">{meaning}</div>}
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

    api.exploreStock(ticker, market)
      .then(setOverview)
      .catch(() => setOverview(null))
      .finally(() => setOvLoading(false))

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
            <span className="si-note">표준산업분류(KSIC) 기준</span>
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
            <span className="s52-lbl">52주 가격 범위</span>
            <span className="s52-range">{v.oyrLwst?.toLocaleString()}원 ─ {v.oyrHgst?.toLocaleString()}원</span>
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
          meaning="매출 100원을 팔았을 때 본업(영업활동)으로 실제 얼마가 남는지의 비율. 회사가 장사를 해서 얼마나 버는지 보여줌."
          formula="영업이익 ÷ 매출액 × 100"
          barCeil={15}
          benchmarks={[
            { chip: '코스피 제조업 평균 약 5%', at: 5 },
            { chip: '10% 이상이면 수익성 높은 편으로 분류', at: 10 },
          ]}
        />

        <StatRow
          label="자기자본이익률 (ROE)"
          value={v.roe}
          unit="%"
          meaning="주주가 투자한 돈(자기자본)을 1년 동안 굴려서 순이익으로 얼마를 만들었는지. 주주 돈 활용 효율을 나타냄. 업종마다 기준이 다름."
          formula="세후 순이익 ÷ 자기자본 × 100"
          barCeil={20}
          benchmarks={[
            { chip: '코스피 평균 약 8%', at: 8 },
            { chip: '워렌버핏이 선호한 기준: 15% 이상 지속', at: 15 },
          ]}
        />

        <PlainRow
          label="주당순이익 (EPS)"
          value={v.eps !== null && v.eps !== undefined ? `${v.eps?.toLocaleString()}원` : null}
          meaning="주식 1주가 1년 동안 벌어들인 순이익 금액. PER을 계산할 때 분모가 되는 수치."
          formula="세후 순이익 ÷ 발행주식수"
        />
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
            <TrendBars
              years={years} field="revenue" yoyField="revenueYoy" label="매출"
              meaning="회사가 1년 동안 상품·서비스 판매로 벌어들인 총 수입. 사업 규모를 나타냄. YoY는 전년 대비 증감률."
            />
            <TrendBars
              years={years} field="opIncome" yoyField="opIncomeYoy" label="영업이익"
              meaning="매출에서 원가·판매관리비를 뺀 본업 이익. 매출이 늘어도 이 수치가 줄면 수익성이 달라지고 있다는 신호."
            />
            <div className="study-trend-note">DART 사업보고서 기준 · 연간 · YoY 전년대비 증감률</div>
          </>
        ) : (
          <div className="study-na-msg">{financials?.note || 'DART 재무 데이터를 불러오지 못했습니다.'}</div>
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
            label={`부채비율 (${years[0]?.year || '최신'}년)`}
            value={financials.latestDebtRatio}
            unit="%"
            meaning="자기 돈 100원당 빌린 돈(부채)이 얼마나 되는지. 재무 구조가 얼마나 레버리지를 쓰는지 나타냄. 업종마다 통상적인 수준이 크게 다름."
            formula="부채총계 ÷ 자본총계 × 100"
            barCeil={300}
            benchmarks={[
              { chip: '보수적 기준: 100% 이하', at: 100 },
              { chip: '한국 제조업 평균 약 150%', at: 150 },
              { chip: '금융업은 구조상 높음 (업종 비교 필요)', },
            ]}
          />
        ) : (
          <div className="study-na-msg">부채비율 산출 데이터 미확보</div>
        )}
      </div>

      {/* ── 밸류에이션 ───────────────────────────────────── */}
      <div className="study-section">
        <div className="study-section-title">밸류에이션</div>

        <StatRow
          label="PER (주가수익비율)"
          value={v.per}
          unit="배"
          meaning="지금 주가가 연간 순이익(EPS)의 몇 배 수준인지. 현재 이익 기준으로 주가에 얼마만큼의 프리미엄이 붙어 있는지 보여줌. 성장 기대가 클수록 높게 형성되는 경향이 있으나, 업종마다 다름."
          formula="주가 ÷ 주당순이익(EPS)"
          barCeil={60}
          benchmarks={[
            { chip: '워렌버핏이 주목한 기준: 10배 이하', at: 10 },
            { chip: '코스피 평균 약 12배', at: 12 },
            { chip: '벤저민 그레이엄 선호 기준: 15배 이하', at: 15 },
            { chip: '적자 기업은 PER 산출 불가 (N/A)' },
          ]}
        />

        <StatRow
          label="PBR (주가순자산비율)"
          value={v.pbr}
          unit="배"
          meaning="지금 주가가 회사 장부상 순자산(BPS)의 몇 배인지. 회사를 지금 문 닫고 자산을 팔면 주가 대비 얼마나 건질 수 있는지의 관계를 나타냄. 업종 특성에 따라 해석이 달라짐."
          formula="주가 ÷ 주당순자산(BPS)"
          barCeil={5}
          benchmarks={[
            { chip: '1배 이하: 순자산보다 낮은 주가 (청산가치 이하)', at: 1 },
            { chip: '그레이엄 관심 기준: 1.5배 이하', at: 1.5 },
            { chip: '코스피 평균 약 1.0배', at: 1.0 },
          ]}
        />

        {v.ev !== null && v.ev !== undefined && (
          <PlainRow
            label="EV/EBITDA"
            value={`${fmtNum(v.ev)}배`}
            meaning="기업 전체 가치(시가총액+순부채)가 세금·이자·감가상각 전 이익의 몇 배인지. 부채 구조가 다른 기업들 사이에서 수익성을 비교할 때 쓰는 지표."
            formula="기업가치(EV) ÷ EBITDA"
          />
        )}

        <PlainRow
          label="주당순자산 (BPS)"
          value={v.bps !== null && v.bps !== undefined ? `${v.bps?.toLocaleString()}원` : null}
          meaning="주식 1주에 해당하는 회사의 장부상 순자산 금액. PBR을 계산할 때 분모가 됨."
          formula="(자산총계 - 부채총계) ÷ 발행주식수"
        />

        {v.forExhRt !== null && v.forExhRt !== undefined && (
          <PlainRow
            label="외국인 소진율"
            value={`${fmtNum(v.forExhRt)}%`}
            meaning="외국인이 살 수 있는 주식 한도(외국인 보유 한도) 중 실제로 채워진 비율. 외국인의 현재 수급 여력 파악에 참고."
            formula="외국인 실제 보유 ÷ 외국인 보유 한도 × 100"
          />
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
