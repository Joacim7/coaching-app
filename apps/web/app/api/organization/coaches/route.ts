import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/organization/coaches — list all coaches in the org
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json([])

  const { data: members } = await supabase
    .from('org_members')
    .select('id, role, joined_at, user_id, profiles!user_id(full_name, email)')
    .eq('org_id', membership.org_id)
    .order('joined_at')

  // Pending invitations are admin-only — regular coaches don't need to see
  // (or be able to infer) who else has been invited but hasn't joined yet.
  let invitations: unknown[] = []
  if (membership.role === 'admin') {
    const { data } = await supabase
      .from('org_invitations')
      .select('id, email, role, status, token, created_at, expires_at')
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: false })
    invitations = data ?? []
  }

  return NextResponse.json({ members: members ?? [], invitations })
}
