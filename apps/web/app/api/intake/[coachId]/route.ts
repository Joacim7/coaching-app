import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public endpoint — no auth required.
// Creates a lead when someone submits the public oppstartsskjema at /start/[coachId].
export async function POST(
  req: Request,
  { params }: { params: Promise<{ coachId: string }> }
) {
  const { coachId } = await params
  const admin = createAdminClient()

  // Verify the coach exists
  const { data: coach } = await admin
    .from('profiles')
    .select('id')
    .eq('id', coachId)
    .single()

  if (!coach) {
    return NextResponse.json({ error: 'Coach ikke funnet' }, { status: 404 })
  }

  const body = await req.json()
  const { name, email, phone, notes, formAnswers } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Navn er påkrevd' }, { status: 400 })
  }

  const { error } = await admin.from('leads').insert({
    coach_id:     coachId,
    full_name:    name.trim(),
    email:        email?.trim()  || null,
    phone:        phone?.trim()  || null,
    notes:        notes?.trim()  || null,
    status:       'ny',
    source:       'oppstartsskjema',
    form_answers: formAnswers ?? null,
  })

  if (error) {
    console.error('[intake] insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
