import fs from 'fs'
import path from 'path'
import type { FoodSearchResult } from '@coaching/types'

// ── Local file path ────────────────────────────────────────────────────────────
// Pre-processed from matvaretabellen.no/api/nb/foods.json (13MB → 294KB).
// Regenerate: curl https://www.matvaretabellen.no/api/nb/foods.json | node scripts/process-foods.js > apps/web/data/matvaretabellen-foods.json
const LOCAL_FILE = path.join(process.cwd(), 'data', 'matvaretabellen-foods.json')

// ── In-memory cache ───────────────────────────────────────────────────────────
let _cache: FoodSearchResult[] | null = null

function loadFoods(): FoodSearchResult[] {
  if (_cache) return _cache

  try {
    const raw = fs.readFileSync(LOCAL_FILE, 'utf-8')
    _cache = JSON.parse(raw) as FoodSearchResult[]
    console.log(`[matvaretabellen] Loaded ${_cache.length} foods from local file`)
    return _cache
  } catch (err) {
    console.error('[matvaretabellen] Could not read local foods file:', err)
    console.error('[matvaretabellen] Run: curl https://www.matvaretabellen.no/api/nb/foods.json | node scripts/process-foods.js > apps/web/data/matvaretabellen-foods.json')
    return []
  }
}

// ── Matching helpers ──────────────────────────────────────────────────────────

// Prepared-dish words that should be penalised when the query is a plain ingredient
const DISH_WORDS_RE = /\b(?:kake|boller?|gryte|suppe|paté|nuggets?|lasagne|pizza|burger|baguett|sandwich|taco|grateng|ferdigrett|kjøttboller?|farse|frikadell|frikassé|pannekake|vaffel|pudding|mousse|terrine|carpaccio|dipp|spread|kjeksrull|patty|panert[e]?)\b/i

// Hard exclusion: these Matvaretabellen categories must NEVER be matched regardless of score.
// Anchored patterns catch category-first naming ("Barnemat, ..."); non-anchored catch
// mid-string markers like "fra 6 mnd" (baby-food age), alcohol content, and
// restaurant/café labels ("kjøpt i kafé", "take away", "salat nicoise").
const EXCLUDE_RE =
  /^(?:barnemat|babymat|spedbarn|morsmelk(?:erstatning)?|modermelk|cider|øl|rødvin|hvitvin|ros[ée]|rosvin|brennevin|sprit|likør|aperitiff|prosecco|champagne|sekt|vodka|whisky|whiskey|cognac|brandy|dyrefor|kattemat|hundemat|fuglemat|kosttilskudd)|^vin[,\s]|^gin[,\s]|^rom[,\s]|fra\s+\d+\s*mnd|alkohol|kjøpt\s+i|take.?away|restaurant|kafé|kioskvare|ni[ck]oise|gresskar|sukker\s+pr\.?|\bkavring\b|\bbrie\b|\bcamembert\b|\bhvitmugg\b|\bblåmugg\b|\bvann\b|\bdrikkevann\b|\bspringvann\b|\bkildevann\b|\bmineralvann\b/i

// Norwegian food brands that should be preferred over foreign equivalents.
// Example: "Norvegia, gulost" beats "Appenzeller, ost" for query "ost".
const NORWEGIAN_FOOD_RE = /^(?:norvegia|jarlsberg|gudbrandsdalsost|nøkkelost|ridderost|pultost|gulost|gamalost|brunost|fløtemysost|geitost|norzola|selbu|østavind)\b/i

// Penalise composite product names ("Baguette med ost og skinke") when the query
// is a plain ingredient ("baguette"). Foods with "med … og …" are prepared variants —
// the plain ingredient is always a better match for a simple AI query.
function compoundPenalty(query: string, foodName: string): number {
  // If the query itself says "med" or "og" the user wants a composite — no penalty
  if (/\b(?:med|og)\b/i.test(query)) return 1
  // Food name lists multiple added ingredients → heavy penalty
  if (/\bmed\b.+\bog\b/i.test(foodName)) return 0.25
  // Food name has "med [ingredient]" (single extra ingredient, still composite)
  if (/,\s*med\s+\w/i.test(foodName)) return 0.5
  return 1
}

/**
 * True when `needle` appears at a word boundary inside `haystack`.
 * "ost" is a complete word in "ost, norvegia" but NOT in "ostekake".
 */
function hasWordBoundary(needle: string, haystack: string): boolean {
  const idx = haystack.indexOf(needle)
  if (idx === -1) return false
  const beforeOk = idx === 0 || /[\s,\-]/.test(haystack[idx - 1])
  const afterOk  = idx + needle.length >= haystack.length || /[\s,\-]/.test(haystack[idx + needle.length])
  return beforeOk && afterOk
}

/**
 * Multiplier: penalise matches where a simple query (≤2 words, not itself a dish)
 * hits a food name that describes a prepared dish.
 */
function dishPenalty(query: string, foodName: string): number {
  if (DISH_WORDS_RE.test(query)) return 1      // query is already for a dish → no penalty
  if (DISH_WORDS_RE.test(foodName)) return 0.4 // simple query matched a dish → heavy penalty
  return 1
}

/**
 * Multiplier: heavy penalty when a simple single-word raw-ingredient query matches
 * a food where that ingredient appears only as a secondary descriptor after the first
 * comma — meaning the food's primary category is something else.
 *
 * "laks"       → "Fiskeburger, laks"     → 0.2  (laks is secondary)
 * "laks"       → "Laks, oppdrettet, rå"  → 1.0  (laks is primary)
 * "kylling"    → "Kyllingbryst, rå"      → 1.0  (starts with kylling)
 * "fiskeburger"→ "Fiskeburger, laks"     → 1.0  (DISH_WORDS_RE skips the check)
 */
function rawIngredientMismatchPenalty(query: string, foodName: string): number {
  // Skip for dish/compound queries — if AI asks for a prepared product, secondary matches are fine
  if (DISH_WORDS_RE.test(query)) return 1
  if (/\b(?:med|og)\b/i.test(query)) return 1
  if (query.trim().includes(' ')) return 1   // multi-word query is already specific

  const ql = query.toLowerCase().trim()
  const nl = foodName.toLowerCase().trim()

  // No penalty when the food name's primary category starts with the query word
  if (nl.startsWith(ql)) return 1

  // Penalty when query appears only after the first comma (secondary-ingredient slot)
  const commaIdx = nl.indexOf(',')
  if (commaIdx !== -1 && hasWordBoundary(ql, nl.slice(commaIdx + 1).trim())) {
    return 0.2
  }

  return 1
}

// ── Search ────────────────────────────────────────────────────────────────────

function scoreFood(food: FoodSearchResult, ql: string, qWords: string[]): number {
  const nl = food.name.toLowerCase()

  // Hard exclusion: baby food, alcohol, pet food, supplements → never match
  if (EXCLUDE_RE.test(nl)) return 0

  const pen = dishPenalty(ql, nl) * compoundPenalty(ql, nl) * rawIngredientMismatchPenalty(ql, nl)
  let base = 0

  if (nl === ql) return 100

  // Food name STARTS with query word → best simple match
  // e.g. "laks" → "laks, oppdrettet, rå" (95) beats buried "…og laks…" (90)
  if (nl.startsWith(ql + ',') || nl.startsWith(ql + ' ')) {
    base = 95
  } else if (hasWordBoundary(ql, nl)) {
    // Query appears as a complete word inside the name
    base = 90
  } else if (nl.startsWith(ql)) {
    // Compound prefix ("kyllingbryst" for "kylling") — intentionally low
    base = 40
  } else if (nl.includes(ql)) {
    base = 60
  } else {
    const nWords = nl.split(/[\s,]+/)
    const allMatch = qWords.every(qw => nWords.some(nw => nw.startsWith(qw.slice(0, 4))))
    if (allMatch && qWords.length > 0) {
      base = 55
    } else {
      const matched = qWords.filter(qw => nWords.some(nw => nw.startsWith(qw.slice(0, 4)))).length
      if (matched > 0) base = Math.round((matched / qWords.length) * 45)
    }
  }

  // Norwegian food brand boost: prefer "Norvegia, gulost" over "Appenzeller, ost"
  // even though "ost" has a word boundary in "Appenzeller, ost" (score 90) but not in "gulost" (score 60)
  if (base > 0 && NORWEGIAN_FOOD_RE.test(nl) && nl.includes(ql)) {
    base = Math.max(base, 95)
  }

  return base === 0 ? 0 : Math.round(base * pen)
}

export function searchMatvaretabellen(
  q: string,
  maxResults = 10,
): FoodSearchResult[] {
  if (!q || q.length < 2) return []

  const ql = q.toLowerCase().trim()
  const qWords = ql.split(/\s+/).filter(Boolean)
  const foods = loadFoods()

  const scored = foods
    .map(food => ({ food, score: scoreFood(food, ql, qWords) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, maxResults).map(({ food }) => food)
}

// ── Single-food enrichment (used by AI meal plan generator) ───────────────────

function similarity(a: string, b: string): number {
  const al = a.toLowerCase().trim()
  const bl = b.toLowerCase().trim()

  if (al === bl) return 1

  // Hard exclusion: same guard as scoreFood — belt-and-suspenders for direct callers
  if (EXCLUDE_RE.test(bl)) return 0

  const pen = dishPenalty(al, bl) * compoundPenalty(al, bl) * rawIngredientMismatchPenalty(al, bl)

  // Food name starts with query word — highest priority simple match
  // "laks" → "laks, oppdrettet, rå" (0.95) beats "…og laks…" (0.9)
  if (bl.startsWith(al + ',') || bl.startsWith(al + ' ')) return 0.95 * pen

  // Norwegian food brand: "Norvegia, gulost" for query "ost" scores same as startsWith
  if (NORWEGIAN_FOOD_RE.test(bl) && bl.includes(al)) return 0.95 * pen

  if (hasWordBoundary(al, bl) || hasWordBoundary(bl, al)) return 0.9 * pen

  if (bl.startsWith(al) || al.startsWith(bl)) return 0.45 * pen

  if (al.includes(bl) || bl.includes(al)) return 0.65 * pen

  const wa = al.split(/\s+/)
  const wb = bl.split(/\s+/)
  const shared = wa.filter(w => wb.some(x =>
    x.startsWith(w.slice(0, 4)) || w.startsWith(x.slice(0, 4))
  ))
  return (shared.length / Math.max(wa.length, wb.length)) * 0.7 * pen
}

export function enrichFoodWithMatvare(
  foodName: string,
  amountG: number,
): { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null {
  const results = searchMatvaretabellen(foodName, 5)
  if (!results.length) return null

  const best = results
    .map(r => ({ r, score: similarity(foodName, r.name) }))
    .sort((a, b) => b.score - a.score)[0]

  if (best.score < 0.45) return null

  const f = amountG / 100
  return {
    calories:  Math.round(best.r.calories_per_100g * f),
    protein_g: Math.round(best.r.protein_per_100g  * f * 10) / 10,
    carbs_g:   Math.round(best.r.carbs_per_100g    * f * 10) / 10,
    fat_g:     Math.round(best.r.fat_per_100g      * f * 10) / 10,
  }
}
