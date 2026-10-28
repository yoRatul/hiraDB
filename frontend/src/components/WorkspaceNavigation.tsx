import type { Area } from '../app/types'

const navigationItems: Array<{ key: Area; label: string; icon: string }> = [
  { key: 'dashboard', label: 'Overview', icon: '⌂' },
  { key: 'students', label: 'Students', icon: '♧' },
  { key: 'classes', label: 'Classes', icon: '▦' },
  { key: 'teachers', label: 'Teachers', icon: '♙' },
]

export function WorkspaceSidebar({
  area,
  hasSubpage,
  authMode,
  accountOpen,
  onNavigate,
  onAccount,
}: {
  area: Area
  hasSubpage: boolean
  authMode: 'login' | 'register' | null
  accountOpen: boolean
  onNavigate: (area: Area) => void
  onAccount: () => void
}) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onNavigate('dashboard')} aria-label="hiraDB overview"><span className="brand-mark">h</span><span>hira<span>DB</span><small>SCHOOL MANAGEMENT</small></span></button>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {navigationItems.map((item) => {
          const active = area === item.key && !hasSubpage && !authMode && !accountOpen
          return <button key={item.key} className={active ? 'nav-item active' : 'nav-item'} aria-current={active ? 'page' : undefined} onClick={() => onNavigate(item.key)}><span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}{item.key === 'dashboard' && <span className="nav-dot" />}</button>
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="school-badge"><span>H</span><div><strong>School workspace</strong><small>hiraDB records</small></div></div>
        <button className={accountOpen || authMode ? 'nav-item nav-help active' : 'nav-item nav-help'} aria-current={accountOpen || authMode ? 'page' : undefined} onClick={onAccount}><span className="nav-icon" aria-hidden="true">↪</span>Account</button>
      </div>
    </aside>
  )
}
