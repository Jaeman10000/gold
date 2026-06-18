// 앱 전역 데이터 프리로드 스토어.
// 앱 진입 시 KR 3화면 데이터를 한 번에 fetch → 탭 전환 시 캐시 즉시 사용.
// market 전환 시에만 해당 시장 신규 fetch. 수동 refresh 가능.
import { createContext, createElement, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/client'

const DataContext = createContext(null)

function mkMarket() {
  return { loaded: false, loading: false, data: {}, errors: {} }
}

export function DataProvider({ children }) {
  const [state, setState] = useState({ KR: mkMarket(), US: mkMarket() })
  const inflightRef = useRef(new Set())
  // stateRef: 최신 state 참조 (stale closure 방지)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  const fetchMarket = useCallback(async (market) => {
    if (inflightRef.current.has(market)) return
    inflightRef.current.add(market)
    setState(s => {
      const next = { ...s, [market]: { ...s[market], loading: true } }
      stateRef.current = next
      return next
    })

    const [portfolio, vault, survey] = await Promise.allSettled([
      api.portfolio(market),
      api.vault(market),
      api.survey(market),
    ])

    setState(s => {
      const next = {
        ...s,
        [market]: {
          loaded: true,
          loading: false,
          data: {
            portfolio: portfolio.status === 'fulfilled' ? portfolio.value : null,
            vault: vault.status === 'fulfilled' ? vault.value : null,
            survey: survey.status === 'fulfilled' ? survey.value : null,
          },
          errors: {
            portfolio: portfolio.status === 'rejected' ? portfolio.reason?.message : null,
            vault: vault.status === 'rejected' ? vault.reason?.message : null,
            survey: survey.status === 'rejected' ? survey.reason?.message : null,
          },
        },
      }
      stateRef.current = next  // 동기 갱신 (stale closure 방지)
      return next
    })
    inflightRef.current.delete(market)
  }, [])

  // 앱 최초 진입: KR 3화면 일괄 fetch
  useEffect(() => { fetchMarket('KR') }, [fetchMarket])

  // 새 시장이 처음 요청됐을 때만 fetch (탭 전환은 no-op)
  const ensureMarket = useCallback((market) => {
    const s = stateRef.current
    if (!s[market]?.loaded && !inflightRef.current.has(market)) {
      fetchMarket(market)
    }
  }, [fetchMarket])

  // 수동 새로고침 — 기존 데이터 유지하면서 백그라운드 재fetch
  const refresh = useCallback((market) => {
    inflightRef.current.delete(market)
    fetchMarket(market)
  }, [fetchMarket])

  const initialLoaded = state.KR.loaded

  return createElement(DataContext.Provider, { value: { initialLoaded, marketData: state, ensureMarket, refresh } }, children)
}

export function useDataStore() {
  return useContext(DataContext)
}

// 각 화면에서 사용하는 파생 훅. 새 시장 진입 시 자동 로드.
export function useScreenData(screen, market) {
  const { marketData, ensureMarket } = useDataStore()

  useEffect(() => {
    ensureMarket(market)
  }, [market, ensureMarket])

  const m = marketData[market]
  if (!m?.loaded) return { data: null, loading: true, refreshing: false, error: null }
  return {
    data: m.data[screen] ?? null,
    loading: false,
    refreshing: m.loading, // 재fetch 중 (기존 data 유지)
    error: m.errors[screen] ?? null,
  }
}
