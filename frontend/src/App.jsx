import { useState } from 'react'
import { MarketProvider } from './store/marketStore'
import BottomDock from './components/BottomDock'
import MineHome from './screens/MineHome'
import Vault from './screens/Vault'
import Survey from './screens/Survey'

const SCREENS = { mine: MineHome, vault: Vault, survey: Survey }

export default function App() {
  const [active, setActive] = useState('mine')
  const Screen = SCREENS[active]
  return (
    <MarketProvider>
      <div className="app-shell">
        <main className="app-main">
          <Screen />
        </main>
        <BottomDock active={active} onChange={setActive} />
      </div>
    </MarketProvider>
  )
}
