// 하단 독 — 5칸 (CLAUDE.md §7). '소식' = 광맥 레이더(수급·점수) + 보유종목 뉴스 통합.
const ITEMS = [
  { key: 'mine',    label: '광산',  icon: '⛏️' },
  { key: 'vault',   label: '금고',  icon: '🏰' },
  { key: 'survey',  label: '측량소', icon: '📐' },
  { key: 'explore', label: '탐사',  icon: '🧭' },
  { key: 'news',    label: '소식',  icon: '📡' },
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
