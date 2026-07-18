import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST — manually create a lead from the dashboard
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, phone, notes } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Navn er påkrevd' }, { status: 400 })

  const { data, error } = await supabase.from('leads').insert({
    coach_id:  user.id,
    full_name: name.trim(),
    email:     email?.trim()  || null,
    phone:     phone?.trim()  || null,
    notes:     notes?.trim()  || null,
    status:    'ny',
    source:    'manual',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead: data })
}
