import { useState, type FormEvent } from 'react'
import { api } from '../../services/api'
import { ErrorState } from '../../components/feedback'

export function AuthScreen({
  mode,
  onModeChange,
  onSignIn,
  onBack,
}: {
  mode: 'login' | 'register'
  onModeChange: (mode: 'login' | 'register') => void
  onSignIn: (email: string) => void
  onBack: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'register') {
        await api.register({ email, password })
        try {
          await api.login({ email, password })
          onSignIn(email)
        } catch (reason) {
          onModeChange('login')
          setError(`Your account was created, but automatic sign-in failed. Please sign in. ${reason instanceof Error ? reason.message : 'Authentication request failed.'}`)
        }
      } else {
        await api.login({ email, password })
        onSignIn(email)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Authentication request failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-card">
        {mode === 'register' && <button className="back-link" onClick={onBack}><span aria-hidden="true">←</span><span>Back to sign in</span></button>}
        <div className="auth-icon" aria-hidden="true">h</div>
        <span className="eyebrow">Welcome to hiraDB</span>
        <h1>{mode === 'login' ? 'Good to see you.' : 'Create your account.'}</h1>
        <p className="auth-intro">{mode === 'login' ? 'Sign in with your school account.' : 'Register with your email and password.'}</p>
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <ErrorState message={error} />}
          <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="auth-switch">{mode === 'login' ? 'New to hiraDB?' : 'Already registered?'} <button onClick={() => { setError(''); onModeChange(mode === 'login' ? 'register' : 'login') }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
        <p className="auth-footnote">Sign-in is required to open this frontend workspace. The backend does not currently enforce token authentication on its API routes, so this frontend gate is not an API security boundary.</p>
      </section>
      <aside className="auth-aside"><div className="aside-orbit orbit-one" /><div className="aside-orbit orbit-two" /><div className="aside-content"><span className="eyebrow">Made for the people who make school</span><h2>Less looking.<br />More learning.</h2><p>One calm place to manage student records, academic journeys, classes, and staff.</p><div className="aside-dots" aria-hidden="true"><i /><i /><i /></div></div></aside>
    </div>
  )
}
