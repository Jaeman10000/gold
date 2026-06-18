import { useState } from 'react'
import { MarketProvider } from './store/marketStore'
import { DataProvider, useDataStore } from './store/dataStore'
import BottomDock from './components/BottomDock'
import MineHome from './screens/MineHome'
import Vault from './screens/Vault'
import Survey from './screens/Survey'
import Explore from './screens/Explore'
import LoadingMascot from './components/LoadingMascot'

const SCREENS = { mine: MineHome, vault: Vault, survey: Survey, explore: Explore }

function AppInner() {
  const [active, setActive] = useState('mine')
  const { initialLoaded } = useDataStore()
  const Screen = SCREENS[active]

  return (
    <div className="app-shell">
      {!initialLoaded ? (
        // [A] 앱 최초 진입 로딩 — 전체 블러 오버레이, 프리로드 완료까지 표시
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
  return (
    <MarketProvider>
      <DataProvider>
        <AppInner />
      </DataProvider>
    </MarketProvider>
  )
}
