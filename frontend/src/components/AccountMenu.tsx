import { useState } from 'react'

type AuthMode = 'login' | 'register' | null

export function AccountMenu({
  authMode,
  accountEmail,
  onOpenAccount,
  onSignOut,
}: {
  authMode: AuthMode
  accountEmail: string | null
  onOpenAccount: () => void
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const label = accountEmail ?? (authMode ? 'Close account' : 'Sign in / Register')
  return (
    <div className="account-menu">
      <button
        className="account-button"
        aria-haspopup={accountEmail ? 'menu' : 'dialog'}
        aria-expanded={accountEmail ? open : undefined}
        aria-label={accountEmail ? `Account menu for ${accountEmail}` : label}
        onClick={() => accountEmail ? setOpen((value) => !value) : onOpenAccount()}
      >
        <span className="account-avatar" aria-hidden="true">{accountEmail ? accountEmail.charAt(0).toUpperCase() : 'H'}</span>
        <span>{label}</span>
        {accountEmail && <span className="account-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>}
      </button>
      {accountEmail && open && (
        <div className="account-dropdown" role="menu" aria-label="Account options">
          <div className="account-dropdown-email">{accountEmail}</div>
          <button role="menuitem" onClick={() => { setOpen(false); onOpenAccount() }}>Account profile</button>
          <button role="menuitem" className="account-signout" onClick={() => { setOpen(false); onSignOut() }}>Sign out</button>
        </div>
      )}
    </div>
  )
}
