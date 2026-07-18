import { createClient } from '@/lib/supabase/server'
import { fetchPexelsImage } from '@/lib/pexels'

/**
 * POST /api/recipes/backfill-images
 *
 * Streams SSE progress events while fetching a Pexels image for every recipe
 * that has no image_url yet.  Run once after the SQL seed or whenever new
 * imageless recipes are imported.
 *
 * Event shapes:
 *   { type: 'progress', current: number, total: number, title: string }
 *   { type: 'done',     updated: number, skipped: number, failed: string[] }
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, title')
    .eq('coach_id', user.id)
    .is('image_url', null)
    .order('created_at', { ascending: true })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const enc   = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  const send = (data: object) =>
    writer.write(enc.encode(`data: ${JSON.stringify(data)}\n\n`))

  // Fire-and-forget: process recipes while the stream stays open
  ;(async () => {
    let updated = 0
    let skipped = 0
    const failed: string[] = []

    const total = recipes?.length ?? 0

    if (total === 0) {
      await send({ type: 'done', updated: 0, skipped: 0, failed: [] })
      await writer.close()
      return
    }

    for (let i = 0; i < recipes!.length; i++) {
      const recipe = recipes![i]
      await send({ type: 'progress', current: i + 1, total, title: recipe.title })

      const url = await fetchPexelsImage(recipe.title)

      if (!url) {
        failed.push(recipe.title)
        skipped++
      } else {
        const { error: upErr } = await supabase
          .from('recipes')
          .update({ image_url: url })
          .eq('id', recipe.id)
          .eq('coach_id', user.id)

        if (upErr) {
          failed.push(recipe.title)
          skipped++
        } else {
          updated++
        }
      }

      // 150 ms gap — well within Pexels free tier (200 req/hour)
      await new Promise(r => setTimeout(r, 150))
    }

    await send({ type: 'done', updated, skipped, failed })
    await writer.close()
  })()

  return new Response(readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
