import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveOnboardingTemplate } from '@/lib/onboarding-template'
import { defaultLeadTemplateQuestions } from '@/lib/default-lead-template'
import { IntakeForm } from './intake-form'

// This reflects live DB state a coach can change anytime from Skjemaer —
// Next can otherwise cache a dynamic-segment page like this per coachId
// after its first request if it doesn't recognize the Supabase client's own
// fetch as an uncached data source, freezing whatever the template looked
// like at that first visit.
export const dynamic = 'force-dynamic'

export default async function StartPage({
  params,
}: {
  params: Promise<{ coachId: string }>
}) {
  const { coachId } = await params
  const admin = createAdminClient()

  // Fetch coach profile (public — name only)
  const { data: coach } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('id', coachId)
    .single()

  if (!coach) notFound()

  // A coach's own template always wins if they have one; otherwise their
  // org's shared one, if any (see lib/onboarding-template.ts). If neither
  // exists — an old standalone account that predates auto-creation on
  // registration, or an org admin/coach whose org hasn't set up a shared
  // template yet — fall back to the same default questions.
  //
  // This fallback is deliberately never persisted as the coach's own
  // template: getEffectiveOnboardingTemplate always prefers an "own"
  // template over the org's shared one, so writing one here would
  // permanently shadow a real org template an admin sets up later. A
  // standalone coach who wants an editable copy can save one from Skjemaer;
  // brand new registrations still get a real, editable one immediately
  // (see register-form.tsx).
  const template = await getEffectiveOnboardingTemplate(admin, coachId) ?? {
    id:             'default',
    coach_id:       coachId,
    name:           'Oppstartsskjema',
    type:           'onboarding' as const,
    questions:      defaultLeadTemplateQuestions(),
    schedule_days:  [],
    schedule_time:  null,
    created_at:     new Date().toISOString(),
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-[#ebf5ef]/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Coach header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#2d8653] flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
            {coach.full_name.slice(0, 1).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Kontakt {coach.full_name}</h1>
          <p className="text-gray-500 mt-1">{template.name}</p>
        </div>

        <IntakeForm coachId={coachId} template={template} />
      </div>
    </div>
  )
}
