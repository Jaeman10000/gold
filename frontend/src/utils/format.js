// 통화·수익률 표기 헬퍼. CLAUDE.md §5: KR=만/억 단위, US=K/M 단위.

export function formatKRW(amount) {
  const sign = amount < 0 ? '-' : ''
  return `${sign}₩${Math.round(Math.abs(amount)).toLocaleString('ko-KR')}`
}

export function formatUSD(amount) {
  const sign = amount < 0 ? '-' : ''
  return `${sign}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// market 에 따라 자동 선택
export function formatAmount(market, amount) {
  return market === 'US' ? formatUSD(amount) : formatKRW(amount)
}

// 개별 금액 표기 (harvest 버튼, 종목 평가금액 등)
export function money(market, amount) {
  return formatAmount(market, amount)
}

export function pct(value) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

// HUD 금괴 칩 (실시간 카운트업 포함)
export function goldDisplay(market, amount) {
  return formatAmount(market, amount)
}

// 이익=초록, 손실=빨강 (CLAUDE.md §5)
export function profitColor(value) {
  if (value > 0) return 'var(--profit)'
  if (value < 0) return 'var(--loss)'
  return 'var(--text-dim)'
}
