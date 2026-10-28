import { PageHeading } from '../../components/feedback'

export function AccountPage({
  email,
  onSignOut,
}: {
  email: string
  onSignOut: () => void
}) {
  return (
    <>
      <PageHeading
        eyebrow="Account"
        title="Your account"
        description="Account details from your current sign-in session."
      />
      <section className="max-w-2xl rounded-xl border border-[#e7ebe7] bg-white p-6 shadow-[0_10px_32px_rgb(34_53_43_/_5%)] sm:p-8" aria-label="Signed-in account profile">
        <div className="flex items-center gap-4 border-b border-[#e7ebe7] pb-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#edf6f0] text-lg font-bold text-[#2e7b5c]" aria-hidden="true">{email.charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
            <h2 className="break-all text-base font-semibold text-[#20302d]">{email}</h2>
            <p className="mt-1 text-xs text-[#78847f]">Signed in on this device</p>
          </div>
        </div>
        <dl className="grid gap-5 py-6 sm:grid-cols-2">
          <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-[#78847f]">Email address</dt><dd className="mt-1 break-all text-sm text-[#20302d]">{email}</dd></div>
          <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-[#78847f]">Sign-in</dt><dd className="mt-1 text-sm text-[#20302d]">Remembered on this device</dd></div>
        </dl>
        <p className="mb-6 rounded-lg bg-[#f7f8f6] p-4 text-xs leading-relaxed text-[#78847f]">
          The backend confirms sign-in with an access token, but does not provide a profile endpoint or profile fields.
          This page shows the email used to sign in; it does not claim additional account details. Your sign-in remains remembered on this device until you sign out.
        </p>
        <button className="button button-outline" onClick={onSignOut}>Sign out</button>
      </section>
    </>
  )
}
