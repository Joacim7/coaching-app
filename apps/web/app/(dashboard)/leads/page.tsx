import { createClient } from '@/lib/supabase/server'
import { LeadsView } from './leads-view'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: leads } = await supabase
    .from('leads')
    .select('id, full_name, email, phone, status, source, notes, form_answers, created_at')
    .eq('coach_id', user!.id)
    .order('created_at', { ascending: false })

  return <LeadsView initialLeads={leads ?? []} coachId={user!.id} />
}
