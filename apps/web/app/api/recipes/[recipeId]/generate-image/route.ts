import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

type Ctx = { params: Promise<{ recipeId: string }> }

interface RecipeIngredient {
  name: string
}

function buildPrompt(title: string, ingredients: RecipeIngredient[]): string {
  const ingredientNames = ingredients.map(i => i?.name).filter(Boolean).join(', ')
  return (
    `A realistic food photograph of ${title}. The dish contains ${ingredientNames}. ` +
    `Shot with a professional DSLR camera, shallow depth of field, natural window lighting, ` +
    `served on a ceramic plate, ultra realistic, photographic quality, no artistic filters, no illustration style.`
  )
}

interface OpenAIImageErrorBody {
  error?: { message?: string; type?: string; code?: string }
}

type OpenAIImageResult = { url: string } | { b64: string } | { error: string; status?: number }

async function requestOpenAIImage(prompt: string, apiKey: string): Promise<OpenAIImageResult> {
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:  'gpt-image-1-mini',
        prompt,
        size:   '1024x1024',
        n:      1,
      }),
    })

    const bodyText = await res.text()

    if (!res.ok) {
      let message = bodyText
      try {
        const parsed = JSON.parse(bodyText) as OpenAIImageErrorBody
        message = parsed.error?.message ?? bodyText
      } catch { /* not JSON — keep raw text */ }
      return { error: message, status: res.status }
    }

    let json: { data?: { url?: string; b64_json?: string }[] }
    try {
      json = JSON.parse(bodyText) as { data?: { url?: string; b64_json?: string }[] }
    } catch {
      return { error: `Kunne ikke tolke svar fra OpenAI: ${bodyText}` }
    }

    // gpt-image-1(-mini) returns base64 (b64_json) rather than a hosted url —
    // dall-e-3 returns url. Support both; the base64 case gets uploaded to
    // Supabase Storage by the caller instead of being stored inline (embedding
    // it directly in recipes.image_url made rows multi-megabyte and broke the
    // recipes list query).
    const entry = json.data?.[0]
    if (entry?.url) return { url: entry.url }
    if (entry?.b64_json) return { b64: entry.b64_json }
    return { error: `Ingen bilde-URL i svaret fra OpenAI: ${bodyText}` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function POST(_req: Request, { params }: Ctx) {
  const { recipeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY mangler i .env.local' }, { status: 500 })

  const { data: recipe, error: fetchErr } = await supabase
    .from('recipes')
    .select('id, title, ingredients')
    .eq('id', recipeId)
    .eq('coach_id', user.id)
    .single()

  if (fetchErr || !recipe) return NextResponse.json({ error: 'Oppskrift ikke funnet' }, { status: 404 })

  const prompt = buildPrompt(recipe.title, (recipe.ingredients ?? []) as RecipeIngredient[])
  const logCtx = `"${recipe.title}" (${recipeId})`

  let result = await requestOpenAIImage(prompt, apiKey)

  if ('error' in result) {
    console.error(`[generate-image] attempt 1/2 failed for ${logCtx} — status=${result.status ?? 'n/a'}:`, result.error)

    // One retry — OpenAI image generation occasionally fails transiently (rate limits, timeouts).
    await new Promise(r => setTimeout(r, 800))
    result = await requestOpenAIImage(prompt, apiKey)

    if ('error' in result) {
      console.error(`[generate-image] attempt 2/2 (retry) failed for ${logCtx} — status=${result.status ?? 'n/a'}:`, result.error)
      return NextResponse.json({ error: result.error }, { status: result.status ?? 502 })
    }

    console.log(`[generate-image] retry succeeded for ${logCtx}`)
  }

  let imageUrl: string
  if ('url' in result) {
    imageUrl = result.url
  } else {
    // Upload the generated PNG to Storage instead of embedding base64 directly
    // in the recipes row — keeps rows small so the recipes list query stays fast.
    // Use the service-role client for the upload itself: we've already verified
    // above that `user` owns this recipe, so bypassing storage RLS here is safe
    // and sidesteps any mismatch between the session JWT and the bucket's
    // per-coach-folder INSERT policy (the actual cause of the RLS violation).
    const bytes = Buffer.from(result.b64, 'base64')
    const path  = `${user.id}/${recipeId}-${Date.now()}.png`

    let admin
    try {
      admin = createAdminClient()
    } catch (err) {
      console.error(`[generate-image] admin client unavailable for ${logCtx}:`, err instanceof Error ? err.message : err)
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler i .env.local' }, { status: 500 })
    }

    const { error: uploadErr } = await admin.storage
      .from('recipe-images')
      .upload(path, bytes, { contentType: 'image/png', upsert: true })

    if (uploadErr) {
      console.error(
        `[generate-image] storage upload failed for ${logCtx} — path="${path}":`,
        JSON.stringify(uploadErr, Object.getOwnPropertyNames(uploadErr))
      )
      return NextResponse.json({ error: `Kunne ikke lagre bilde: ${uploadErr.message}` }, { status: 500 })
    }

    imageUrl = admin.storage.from('recipe-images').getPublicUrl(path).data.publicUrl
  }

  const { error: updateErr } = await supabase
    .from('recipes')
    .update({ image_url: imageUrl })
    .eq('id', recipeId)
    .eq('coach_id', user.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ image_url: imageUrl })
}
