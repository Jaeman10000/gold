// KR/US 시장 토글 전역 상태 (CLAUDE.md §5). 홈에서 바꾸면 모든 화면에 반영.
import { createContext, createElement, useContext, useState } from 'react'

const MarketContext = createContext(null)

export function MarketProvider({ children }) {
  const [market, setMarket] = useState('KR')
  const toggle = () => setMarket((m) => (m === 'KR' ? 'US' : 'KR'))
  return createElement(MarketContext.Provider, { value: { market, setMarket, toggle } }, children)
}

export function useMarket() {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used within MarketProvider')
  return ctx
}
