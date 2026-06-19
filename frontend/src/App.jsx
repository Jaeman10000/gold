import { useState, useEffect } from 'react'
import { MarketProvider } from './store/marketStore'
import { DataProvider, useDataStore } from './store/dataStore'
import BottomDock from './components/BottomDock'
import MineHome from './screens/MineHome'
import Vault from './screens/Vault'
import Survey from './screens/Survey'
import Explore from './screens/Explore'
import Lab from './screens/Lab'
import Passcode from './screens/Passcode'
import LoadingMascot from './components/LoadingMascot'

const SCREENS = { mine: MineHome, vault: Vault, survey: Survey, explore: Explore, lab: Lab }
const BASE = import.meta.env.VITE_API_URL || ''

function AppInner() {
  const [active, setActive] = useState('mine')
  const { initialLoaded } = useDataStore()
  const Screen = SCREENS[active]

  return (
    <div className="app-shell">
      {!initialLoaded ? (
        <LoadingMascot fullscreen />
      ) : (
        <>
          <main className="app-main">
            <Screen />
          </main>
          <BottomDock active={active} onChange={setActive} />
        </>
      )}
    </div>
  )
}

export default function App() {
  // 'checking' | 'needed' | 'authed'
  const [authState, setAuthState] = useState('checking')

  useEffect(() => {
    const stored = localStorage.getItem('gm_passcode')
    fetch(`${BASE}/api/auth/check`, {
      headers: stored ? { 'X-Passcode': stored } : {},
    })
      .then(r => { setAuthState(r.ok ? 'authed' : 'needed') })
      .catch(() => { setAuthState('authed') }) // 네트워크 오류 = 로컬 개발, 통과
  }, [])

  // api client 가 401 디스패치하면 재인증
  useEffect(() => {
    const handler = () => { localStorage.removeItem('gm_passcode'); setAuthState('needed') }
    window.addEventListener('gm:logout', handler)
    return () => window.removeEventListener('gm:logout', handler)
  }, [])

  if (authState === 'checking') return <LoadingMascot fullscreen />
  if (authState === 'needed')   return <Passcode onAuth={() => setAuthState('authed')} />

  return (
    <MarketProvider>
      <DataProvider>
        <AppInner />
      </DataProvider>
    </MarketProvider>
  )
}
