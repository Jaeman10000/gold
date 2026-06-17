// 하단 독 — 5칸 (CLAUDE.md §7). v1 은 광산/금고/측량소 활성, 탐사/연구소 비활성.
const ITEMS = [
  { key: 'mine', label: '광산', icon: '⛏️', enabled: true },
  { key: 'vault', label: '금고', icon: '🏰', enabled: true },
  { key: 'survey', label: '측량소', icon: '📐', enabled: true },
  { key: 'explore', label: '탐사', icon: '🧭', enabled: false },
  { key: 'lab', label: '연구소', icon: '🔬', enabled: false },
]

export default function BottomDock({ active, onChange }) {
  return (
    <nav className="bottom-dock">
      {ITEMS.map((it) => (
        <button
          key={it.key}
          className={`dock-item ${active === it.key ? 'active' : ''} ${it.enabled ? '' : 'disabled'}`}
          onClick={() => it.enabled && onChange(it.key)}
          disabled={!it.enabled}
        >
          <span className="dock-icon">{it.icon}</span>
          <span className="dock-label">{it.label}</span>
          {!it.enabled && <span className="dock-soon">v2</span>}
        </button>
      ))}
    </nav>
  )
}
