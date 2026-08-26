import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getTranslator, normalizeLocale } from '@/lib/i18n/translations'
import StandaloneMealPlanEditor from './meal-plan-editor-standalone'
import { SharedMealPlanView } from './shared-meal-plan-view'

export default async function EditMealPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Meal plans an org admin has shared (see migration 061/062) are readable
  // by every coach in the org via RLS, not just the owner — so this no
  // longer restricts by coach_id. A coach viewing a plan they don't own
  // gets the read-only summary view instead of the full editor (mutations
  // on /api/meal-plans/[planId] stay owner-only).
  const { data: plan } = await supabase
    .from('meal_plans')
    .select('*, client:profiles!client_id(full_name)')
    .eq('id', planId)
    .single()

  if (!plan) notFound()

  const { data: coachProfile } = await supabase
    .from('profiles')
    .select('language')
    .eq('id', user!.id)
    .single()
  const t = getTranslator(normalizeLocale(coachProfile?.language))

  if (plan.coach_id !== user!.id) {
    return <SharedMealPlanView plan={plan} />
  }

  const client = Array.isArray(plan.client) ? plan.client[0] : plan.client

  const { data: clients } = await supabase
    .from('coach_clients')
    .select('client_id, profile:profiles!client_id(full_name)')
    .eq('coach_id', user!.id)
    .eq('status', 'active')

  const clientList = (clients ?? []).map(c => {
    const profile = Array.isArray(c.profile) ? c.profile[0] : c.profile
    return { id: c.client_id, name: profile?.full_name ?? t('common.unknown') }
  })

  return (
    <StandaloneMealPlanEditor
      clientId={plan.client_id ?? null}
      clientName={client?.full_name ?? null}
      coachId={user!.id}
      clients={clientList}
      initialPlan={plan}
    />
  )
}
