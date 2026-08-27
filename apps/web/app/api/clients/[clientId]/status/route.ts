import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ClientStatus } from '@coaching/types'

const VALID: ClientStatus[] = ['active', 'inactive', 'new', 'onboarding', 'course', 'followup', 'app_access']

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const { clientId } = await params
  const { status } = await req.json() as { status: ClientStatus }

  if (!VALID.includes(status)) {
    return NextResponse.json({ error: 'Ugyldig status' }, { status: 400 })
  }

  const { error } = await supabase
    .from('coach_clients')
    .update({ status })
    .eq('client_id', clientId)
    .eq('coach_id', user.id)

  if (error) {
    console.error('[client-status] DB error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Gate mobile-app login on the coach-visible status: 'inactive' bans the
  // client's auth account (100-year ban, Supabase's documented pattern for
  // an indefinite block) so signInWithPassword starts failing immediately;
  // any other status un-bans it. This never changes the account's
  // email/password, so re-activating restores access with the same
  // credentials. Best-effort — some client profiles have no real auth.users
  // row (e.g. manually created, pending signup), so a failure here shouldn't
  // fail the status change itself.
  const admin = createAdminClient()
  const { error: banError } = await admin.auth.admin.updateUserById(clientId, {
    ban_duration: status === 'inactive' ? '876000h' : 'none',
  })
  if (banError) {
    console.error('[client-status] ban/unban error:', banError.message)
  }

  return NextResponse.json({ ok: true })
}
