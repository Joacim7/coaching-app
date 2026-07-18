import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@/lib/supabase/server'
import { lookupApprovedIngredient } from '@/lib/approved-ingredients'

export const maxDuration = 300

const GROQ_MODEL = 'llama-3.1-8b-instant'

const MEAL_INGREDIENTS: Record<string, string[]> = {
  Frokost:     ['havregryn','gresk yoghurt','cottage cheese','egg','rugbrød','knekkebrød','banan','blåbær','jordbær','eple','helmelk','kvarg','müsli','granola','honning','mandler','røkelaks','kremost','norvegia ost','skinke'],
  Lunsj:       ['rugbrød','knekkebrød','wrap','pitabrød','tunfisk','laks','røkelaks','skinke','egg','norvegia ost','kremost','hummus','avokado','tomat','agurk','salat','paprika','gulrot'],
  Middag:      ['kyllingbryst','laks','torsk','kjøttdeig','biff','hvit ris','pasta','potet','søtpotet','brokkoli','gulrot','spinat','paprika','blomkål','tomat','løk','olivenolje'],
  Snack:       ['gresk yoghurt','cottage cheese','kvarg','banan','eple','jordbær','blåbær','mandler','valnøtter','knekkebrød','hummus','gulrot','agurk'],
  Kveldsmat:   ['rugbrød','knekkebrød','norvegia ost','skinke','egg','cottage cheese','røkelaks','kremost','tomat','agurk','salat'],
  Ettermiddag: ['gresk yoghurt','kvarg','banan','blåbær','mandler','cottage cheese','knekkebrød','eple'],
}

interface ParsedRecipe {
  name: string
  ingredients: { name: string; grams: number }[]
  instructions: string[]
}

function extractRecipe(text: string): ParsedRecipe | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const p = JSON.parse(match[0]) as ParsedRecipe
    if (!p.name || !Array.isArray(p.ingredients) || !p.ingredients.length) return null
    return p
  } catch { return null }
}

function calcNutrition(ings: { name: string; grams: number }[]) {
  let cals = 0, prot = 0, carbs = 0, fat = 0
  const enriched: object[] = []
  for (const ing of ings) {
    const a = lookupApprovedIngredient(ing.name)
    if (!a || !ing.grams) continue
    const g = ing.grams / 100
    cals  += a.calories_per_100g * g
    prot  += a.protein_per_100g  * g
    carbs += a.carbs_per_100g    * g
    fat   += a.fat_per_100g      * g
    enriched.push({
      name: a.displayName,
      amount_g: ing.grams,
      calories_per_100g: a.calories_per_100g,
      protein_per_100g:  a.protein_per_100g,
      carbs_per_100g:    a.carbs_per_100g,
      fat_per_100g:      a.fat_per_100g,
      source: 'approved',
    })
  }
  return {
    enriched,
    cals:  Math.round(cals),
    prot:  Math.round(prot  * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat:   Math.round(fat   * 10) / 10,
  }
}

function imageUrl(name: string, seed: number): string {
  const term = encodeURIComponent(name.toLowerCase().split(' ').slice(0, 2).join(','))
  return `https://source.unsplash.com/400x300/?food,${term}&sig=${seed}`
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY missing' }, { status: 500 })

  let body: { mealType?: string; count?: number }
  try { body = await req.json() } catch { body = {} }
  const { mealType, count = 20 } = body

  if (!mealType) return NextResponse.json({ error: 'mealType required' }, { status: 400 })
  const available = MEAL_INGREDIENTS[mealType] ?? MEAL_INGREDIENTS['Middag']
  const groq = new Groq({ apiKey })
  const generatedNames: string[] = []
  const encoder = new TextEncoder()
  const total = Math.min(count, 20)

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      for (let i = 0; i < total; i++) {
        try {
          const avoid = generatedNames.length
            ? ` Ikke lag: ${generatedNames.slice(-6).join(', ')}.`
            : ''
          const prompt =
            `Lag én unik norsk ${mealType.toLowerCase()}-oppskrift.${avoid}\n` +
            `Velg 2-4 ingredienser fra: ${available.join(', ')}.\n` +
            `JSON kun: {"name":"...","ingredients":[{"name":"kyllingbryst","grams":150}],"instructions":["Steg 1","Steg 2","Steg 3"]}\n` +
            `Realistiske norske porsjonsstørrelser.`

          const resp = await groq.chat.completions.create({
            model: GROQ_MODEL,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 400,
            temperature: 0.85,
          })

          const text = resp.choices[0]?.message?.content ?? ''
          const parsed = extractRecipe(text)
          if (!parsed) { send({ error: `Parse failed for recipe ${i + 1}` }); continue }

          generatedNames.push(parsed.name)
          const { enriched, cals, prot, carbs, fat } = calcNutrition(parsed.ingredients)
          if (!enriched.length) { send({ error: `No valid ingredients for recipe ${i + 1}` }); continue }

          const { data: saved, error: dbErr } = await supabase
            .from('recipes')
            .insert({
              coach_id:             user.id,
              title:                parsed.name,
              instructions:         JSON.stringify(parsed.instructions ?? []),
              image_url:            imageUrl(parsed.name, Date.now() + i),
              servings:             1,
              meal_type:            mealType,
              is_ai_generated:      true,
              ingredients:          enriched,
              calories_per_serving: cals,
              protein_per_serving:  prot,
              carbs_per_serving:    carbs,
              fat_per_serving:      fat,
            })
            .select()
            .single()

          if (dbErr) { send({ error: `DB: ${dbErr.message}` }); continue }
          send({ recipe: saved, index: i + 1, total })
        } catch (err) {
          send({ error: `Error ${i + 1}: ${err instanceof Error ? err.message : String(err)}` })
        }

        if (i < total - 1) await new Promise(r => setTimeout(r, 300))
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
