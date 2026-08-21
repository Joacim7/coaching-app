import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchMatvaretabellen } from '@/lib/matvaretabellen'
import { APPROVED_INGREDIENTS } from '@/lib/approved-ingredients'
import type { FoodSearchResult } from '@coaching/types'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const ql = q.toLowerCase()

  const { data: customRows } = await supabase
    .from('custom_ingredients')
    .select('id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g')
    .eq('coach_id', user.id)
    .ilike('name', `%${q}%`)
    .limit(10)

  const customResults: FoodSearchResult[] = (customRows ?? []).map(row => ({
    ...row,
    source: 'custom',
  }))

  const approvedResults: FoodSearchResult[] = APPROVED_INGREDIENTS
    .filter(i => i.displayName.toLowerCase().includes(ql) || i.aiName.includes(ql))
    .slice(0, 10)
    .map(i => ({
      id: `approved-${i.aiName}`,
      name: i.displayName,
      calories_per_100g: i.calories_per_100g,
      protein_per_100g: i.protein_per_100g,
      carbs_per_100g: i.carbs_per_100g,
      fat_per_100g: i.fat_per_100g,
      source: 'approved',
    }))

  const matvareResults = searchMatvaretabellen(q, 20)

  // Custom and approved ingredients are curated for this coach — surface them
  // first, then fall back to Matvaretabellen. Dedupe by name so a custom
  // ingredient shadows an identically-named Matvaretabellen entry.
  const seen = new Set<string>()
  const merged: FoodSearchResult[] = []
  for (const food of [...customResults, ...approvedResults, ...matvareResults]) {
    const key = food.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(food)
  }

  return NextResponse.json(merged.slice(0, 25))
}
