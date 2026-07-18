import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchMatvaretabellen } from '@/lib/matvaretabellen'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''

  const results = searchMatvaretabellen(q, 20)
  return NextResponse.json(results)
}
