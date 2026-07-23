import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import OnboardingFlow from './onboarding-flow'
import { getEffectiveOnboardingTemplate } from '@/lib/onboarding-template'

interface Props {
  params: Promise<{ token: string }>
}

export default async function OnboardingPage({ params }: Props) {
  const { token } = await params
  console.log('[onboarding/page] token from URL:', token)

  // Anonymous visitor — no session, so this must bypass RLS. The token in
  // the URL is the only authorization mechanism for this public page.
  const admin = createAdminClient()

  // Look up the client by onboarding token
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, full_name, email, has_account')
    .eq('onboarding_token', token)
    .single()

  console.log('[onboarding/page] profile lookup — found:', !!profile, 'error:', profileErr?.message ?? null)
  if (profile) {
    console.log('[onboarding/page] profile:', JSON.stringify({ id: profile.id, email: profile.email, has_account: profile.has_account }))
  }

  if (!profile) {
    console.warn('[onboarding/page] no profile matches this token — showing 404. Either the token is wrong/stale, or (if this just started happening) migration 050_client_auth_accounts.sql (has_account column) may not be applied yet, which would make this select fail.')
    notFound()
  }

  // Check if already submitted
  const { data: existing, error: existingErr } = await admin
    .from('onboarding_submissions')
    .select('id')
    .eq('client_id', profile.id)
    .limit(1)
    .single()

  console.log('[onboarding/page] existing submission — found:', !!existing, 'error:', existingErr?.message ?? null)

  if (existing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Skjema allerede innsendt</h1>
          <p className="text-gray-500 text-sm">
            Takk, {profile.full_name}! Vi har allerede mottatt svarene dine.
          </p>
        </div>
      </div>
    )
  }

  // Find the coach's onboarding template via coach_clients
  const { data: link, error: linkErr } = await admin
    .from('coach_clients')
    .select('coach_id')
    .eq('client_id', profile.id)
    .limit(1)
    .single()

  console.log('[onboarding/page] coach_clients link — found:', !!link, 'error:', linkErr?.message ?? null)

  if (!link) {
    console.warn('[onboarding/page] no coach_clients row for this client — showing 404. This client profile has no coach relationship.')
    notFound()
  }

  const template = await getEffectiveOnboardingTemplate(admin, link.coach_id)

  console.log('[onboarding/page] onboarding template — found:', !!template)
  console.log('[onboarding/page] rendering OnboardingFlow — hasAccount:', profile.has_account, 'email:', profile.email, 'willShowPasswordStep:', !profile.has_account && !!profile.email)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ebf5ef] to-[#ebf5ef] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <OnboardingFlow
          token={token}
          clientId={profile.id}
          fullName={profile.full_name}
          email={profile.email}
          hasAccount={profile.has_account}
          template={template ?? null}
        />
      </div>
    </div>
  )
}
