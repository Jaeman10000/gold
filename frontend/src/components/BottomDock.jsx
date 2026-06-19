// 하단 독 — 5칸 (CLAUDE.md §7). 연구소(v2)는 보유종목 '뉴스'로 교체.
const ITEMS = [
  { key: 'mine',    label: '광산',  icon: '⛏️' },
  { key: 'vault',   label: '금고',  icon: '🏰' },
  { key: 'survey',  label: '측량소', icon: '📐' },
  { key: 'explore', label: '탐사',  icon: '🧭' },
  { key: 'news',    label: '뉴스',  icon: '📰' },
]

export default function BottomDock({ active, onChange }) {
  return (
    <nav className="bottom-dock">
      {ITEMS.map((it) => (
        <button
          key={it.key}
          className={`dock-item ${active === it.key ? 'active' : ''} ${it.soon && active !== it.key ? 'soon' : ''}`}
          onClick={() => onChange(it.key)}
        >
          <span className="dock-icon">{it.icon}</span>
          <span className="dock-label">{it.label}</span>
          {it.soon && <span className="dock-soon">v2</span>}
        </button>
      ))}
    </nav>
  )
}
