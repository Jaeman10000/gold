// 앱 전역 데이터 스토어.
// [1단계] 앱 시작: DB 캐시 즉시 표시 → [2단계] 백그라운드 Kiwoom/DART 갱신 → UI 업데이트.
// levelData는 전역 관리 — 탭 전환 시 깜박임 방지.
import { createContext, createElement, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/client'

const DataContext = createContext(null)

function mkMarket() {
  return { loaded: false, loading: false, refreshing: false, data: {}, errors: {}, cachedAt: null }
}

export function DataProvider({ children }) {
  const [state, setState]       = useState({ KR: mkMarket(), US: mkMarket() })
  const [levelData, setLevelData] = useState(null)   // 전역 — 탭 전환 후에도 유지
  const inflightRef = useRef(new Set())
  const stateRef    = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // ── 레벨 최초 로드 (앱 시작 1회) ─────────────────────────────────────────
  useEffect(() => {
    api.level(true).then(setLevelData).catch(() => {})
  }, [])

  // ── 1단계: 캐시 즉시 로드. 캐시 있으면 표시 후 2단계 백그라운드 갱신 ────
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

    const pData = portfolio.status === 'fulfilled' ? portfolio.value : null
    const vData = vault.status     === 'fulfilled' ? vault.value     : null
    const sData = survey.status    === 'fulfilled' ? survey.value    : null

    const cachedAt = pData?.cachedAt || vData?.cachedAt || sData?.cachedAt || null

    setState(s => {
      const next = {
        ...s,
        [market]: {
          loaded: true,
          loading: false,
          refreshing: !!cachedAt,
          data: { portfolio: pData, vault: vData, survey: sData },
          errors: {
            portfolio: portfolio.status === 'rejected' ? portfolio.reason?.message : null,
            vault:     vault.status     === 'rejected' ? vault.reason?.message     : null,
            survey:    survey.status    === 'rejected' ? survey.reason?.message    : null,
          },
          cachedAt,
        },
      }
      stateRef.current = next
      return next
    })
    inflightRef.current.delete(market)

    // 2단계: 캐시에서 서빙됐으면 백그라운드 fresh fetch
    if (cachedAt) {
      _bgRefresh(market, setState, stateRef, setLevelData)
    }
  }, [])

  // ── 수동 새로고침 (pull-to-refresh / 버튼) ───────────────────────────────
  const refresh = useCallback((market) => {
    setState(s => {
      const next = { ...s, [market]: { ...s[market], refreshing: true } }
      stateRef.current = next
      return next
    })
    _bgRefresh(market, setState, stateRef, setLevelData)
  }, [])

  // 앱 최초 진입: KR 로드
  useEffect(() => { fetchMarket('KR') }, [fetchMarket])

  const ensureMarket = useCallback((market) => {
    const s = stateRef.current
    if (!s[market]?.loaded && !inflightRef.current.has(market)) {
      fetchMarket(market)
    }
  }, [fetchMarket])

  const initialLoaded = state.KR.loaded

  return createElement(DataContext.Provider, {
    value: { initialLoaded, marketData: state, ensureMarket, refresh, levelData }
  }, children)
}

// ── 백그라운드 /api/refresh 호출 ─────────────────────────────────────────────
function _bgRefresh(market, setState, stateRef, setLevelData) {
  api.refresh(market)
    .then(fresh => {
      setState(s => ({
        ...s,
        [market]: {
          ...s[market],
          refreshing: false,
          data: {
            portfolio: fresh.portfolio ?? s[market].data.portfolio,
            vault:     fresh.vault     ?? s[market].data.vault,
            survey:    fresh.survey    ?? s[market].data.survey,
          },
          cachedAt: fresh.cachedAt || s[market].cachedAt,
        },
      }))
      // 갱신 후 레벨 데이터도 업데이트 (새 익절 EXP 반영)
      if (fresh.level) setLevelData(fresh.level)
    })
    .catch(() => {
      setState(s => ({ ...s, [market]: { ...s[market], refreshing: false } }))
    })
}

export function useDataStore() {
  return useContext(DataContext)
}

// 각 화면에서 사용하는 파생 훅.
export function useScreenData(screen, market) {
  const { marketData, ensureMarket } = useDataStore()

  useEffect(() => {
    ensureMarket(market)
  }, [market, ensureMarket])

  const m = marketData[market]
  if (!m?.loaded) return { data: null, loading: true, refreshing: false, error: null, cachedAt: null }
  return {
    data:       m.data[screen] ?? null,
    loading:    false,
    refreshing: m.loading || m.refreshing,
    error:      m.errors[screen] ?? null,
    cachedAt:   m.cachedAt ?? null,
  }
}
