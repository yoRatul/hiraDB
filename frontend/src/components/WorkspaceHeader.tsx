import type { Area } from '../app/types'
import { AccountMenu } from './AccountMenu'

const areaLabels: Record<Area, string> = {
  dashboard: 'Overview',
  students: 'Students',
  classes: 'Classes',
  teachers: 'Teachers',
}

export function WorkspaceHeader({
  area,
  authMode,
  accountEmail,
  breadcrumb,
  onAccountClick,
  onSignOut,
}: {
  area: Area
  authMode: 'login' | 'register' | null
  accountEmail: string | null
  breadcrumb: 'Student profile' | 'Class details' | 'Teacher profile' | 'Account' | null
  onAccountClick: () => void
  onSignOut: () => void
}) {
  const label = authMode ? authMode === 'login' ? 'Sign in' : 'Register' : breadcrumb ?? areaLabels[area]
  return (
    <header className="topbar">
      <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{label}</strong></div>
      <div className="top-actions"><span className="api-indicator"><i /> API workspace</span><AccountMenu authMode={authMode} accountEmail={accountEmail} onOpenAccount={onAccountClick} onSignOut={onSignOut} /></div>
    </header>
  )
}
