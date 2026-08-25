import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveOnboardingTemplate } from '@/lib/onboarding-template'
import { defaultLeadTemplateQuestions } from '@/lib/default-lead-template'
import { IntakeForm } from './intake-form'

// This reflects live DB state a coach can change anytime from Skjemaer
// (or that gets lazily back-filled below) — Next can otherwise cache a
// dynamic-segment page like this per coachId after its first request if it
// doesn't recognize the Supabase client's own fetch as an uncached data
// source, freezing whatever the template looked like at that first visit.
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

  // A standalone coach's own template always wins if they have one; only a
  // coach with no template of their own falls back to their org's shared
  // one (if they're in an org at all) — same resolution used everywhere
  // else onboarding templates are looked up (see lib/onboarding-template.ts).
  let template = await getEffectiveOnboardingTemplate(admin, coachId)

  // Registration auto-creates this template (see register-form.tsx), but
  // accounts created before that existed have none — back-fill it lazily
  // here rather than leaving them stuck on the bare 3-field fallback form.
  // Only for genuinely standalone coaches; an org coach with no shared
  // template is expected to rely on the org's, not get their own.
  if (!template) {
    const { data: membership } = await admin
      .from('org_members')
      .select('id')
      .eq('user_id', coachId)
      .limit(1)

    if (!membership?.length) {
      const { data: created } = await admin
        .from('checkin_templates')
        .insert({
          coach_id:  coachId,
          name:      'Oppstartsskjema',
          type:      'onboarding',
          questions: defaultLeadTemplateQuestions(),
        })
        .select('*')
        .single()

      template = created ?? null
    }
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
          {template && (
            <p className="text-gray-500 mt-1">{template.name}</p>
          )}
        </div>

        <IntakeForm coachId={coachId} template={template} />
      </div>
    </div>
  )
}
