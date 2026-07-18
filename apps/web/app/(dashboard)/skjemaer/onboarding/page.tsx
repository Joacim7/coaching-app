import { createClient } from '@/lib/supabase/server'
import { OnboardingView, type ClientOnboardingRow } from './onboarding-view'
import type { CheckinTemplate } from '@coaching/types'

export default async function OnboardingSubmissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. All non-inactive clients
  const { data: clientLinks } = await supabase
    .from('coach_clients')
    .select('client_id, status, profile:profiles!client_id(full_name, email)')
    .eq('coach_id', user!.id)
    .neq('status', 'inactive')

  const clients = (clientLinks ?? []).map(l => {
    const p = Array.isArray(l.profile) ? l.profile[0] : l.profile
    return { id: l.client_id, status: l.status as string, name: p?.full_name ?? 'Ukjent', email: p?.email ?? null }
  })

  // 2. Onboarding submissions for those clients
  const clientIds = clients.map(c => c.id)
  const { data: submissions } = clientIds.length > 0
    ? await supabase
        .from('onboarding_submissions')
        .select('id, client_id, submitted_at, answers, template:checkin_templates(name)')
        .in('client_id', clientIds)
    : { data: [] }

  // 3. Coach's onboarding template (for reminder emails + modal question lookup)
  const { data: tplRaw } = await supabase
    .from('checkin_templates')
    .select('*')
    .eq('coach_id', user!.id)
    .eq('type', 'onboarding')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const template = tplRaw as CheckinTemplate | null

  // 4. Build rows
  const subByClient = new Map(
    (submissions ?? []).map(s => [s.client_id, s])
  )

  const rows: ClientOnboardingRow[] = clients.map(cl => {
    const sub  = subByClient.get(cl.id) ?? null
    const tRaw = sub ? (Array.isArray(sub.template) ? sub.template[0] : sub.template) : null
    const templateName = tRaw?.name ?? template?.name ?? null

    const status: ClientOnboardingRow['status'] = sub
      ? 'fullfort'
      : cl.status === 'onboarding'
      ? 'venter'
      : 'ikke_sendt'

    return {
      clientId:     cl.id,
      name:         cl.name,
      email:        cl.email,
      status,
      templateName,
      submission: sub ? {
        id:           sub.id,
        submitted_at: sub.submitted_at,
        answers:      sub.answers as Record<string, unknown>,
      } : null,
    }
  })

  return (
    <OnboardingView
      rows={rows}
      templateQuestions={template?.questions ?? []}
    />
  )
}
