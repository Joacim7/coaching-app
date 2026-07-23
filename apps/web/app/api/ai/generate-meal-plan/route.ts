import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchMatvaretabellen } from '@/lib/matvaretabellen'
import { lookupApprovedIngredient } from '@/lib/approved-ingredients'
import { recipeImageUrl } from '@/lib/food-image'
import type { MealPlanGenerateRequest, Meal, MealAlternative, Food, MealStructure } from '@coaching/types'

// ── Meal structure definitions ─────────────────────────────────────────────────

const MEAL_STRUCTURES: Record<MealStructure, { name: string; time: string }[]> = {
  '3':        [{ name: 'Frokost', time: '07:30' }, { name: 'Lunsj', time: '12:30' }, { name: 'Middag', time: '18:00' }],
  '3+snack':  [{ name: 'Frokost', time: '07:30' }, { name: 'Lunsj', time: '12:00' }, { name: 'Snack', time: '15:30' }, { name: 'Middag', time: '18:30' }],
  '4':        [{ name: 'Frokost', time: '07:30' }, { name: 'Lunsj', time: '12:00' }, { name: 'Ettermiddag', time: '15:30' }, { name: 'Middag', time: '18:30' }],
  '4+snacks': [{ name: 'Frokost', time: '07:30' }, { name: 'Formiddagssnack', time: '10:00' }, { name: 'Lunsj', time: '13:00' }, { name: 'Ettermiddagssnack', time: '16:00' }, { name: 'Middag', time: '19:00' }],
}

// Per-meal guides: explicitly separates sweet vs savory categories
const MEAL_GUIDES: Record<string, string> = {

  Frokost: `Norsk frokost er enten SØTT (grøt/yoghurt/frukt) ELLER SALT (brød/egg) — aldri begge deler.

SØTTE frokostalternativer — velg ETT av disse mønstrene:
  1. Havregryn + helmelk + banan + kanel
  2. Havregryn + vann + blåbær + chiafrø
  3. Havregryn + helmelk + eple + valnøtter
  4. Gresk yoghurt + granola + jordbær
  5. Gresk yoghurt + müsli + banan
  6. Kvarg + blåbær + honning
  7. Cottage cheese + müsli + ferskenbiter
  8. Smoothie: banan + gresk yoghurt + havregryn + helmelk

SALTE frokostalternativer — velg ETT av disse mønstrene:
  1. Rugbrød + røkelaks + kremost + agurk
  2. Rugbrød + hardkokt egg + ost + tomat
  3. Knekkebrød + avokado + hardkokt egg + salt + pepper
  4. Scramblede egg + skinke + tomat
  5. Rugbrød + makrell i tomat + agurk + sitron
  6. Rugbrød + ost + skinke + paprika
  7. Kokt egg + knekkebrød + smør + salt
  8. Rugbrød + avokado + røkelaks + sitron

ABSOLUTT FORBUDT til frokost:
  ✗ Ris, pasta eller kokte poteter (dette er middagsmat)
  ✗ Kyllingbryst, laks, biff eller svinekjøtt (dette er middagsmat)
  ✗ Søtt + salt i samme alternativ: bær+skinke=FEIL, honning+egg=FEIL, banan+ost=FEIL, frukt+røkelaks=FEIL
  ✗ Suppe, gryte, wok eller gryterett
  ✗ Nøtter UTEN meieri/grøt (nøtter er tilbehør, ikke base)`,

  Lunsj: `Norsk lunsj er ALLTID SALT — brød/wrap/salat med protein og grønnsaker. Aldri frokostmat til lunsj.

BASE (velg ETT): rugbrødskive, knekkebrød, wrap, pitabrød, grønn salat (ruccola/isbergsalat)
PROTEIN (velg ETT): tunfisk, strimlet kyllingbryst, skinke, reker, hardkokt egg, laks, makrell, ost
GRØNNSAKER (velg 1–2): agurk, tomat, salat, paprika, avokado, reddik, spinat, maiskorn
DRESSING/SMØR (valgfritt): majones, pesto, hummus, tzatziki, sennep, kremost, olivenolje

Realistiske lunsj-kombinasjoner (ETT av disse mønstrene per alternativ):
  1. Rugbrød + tunfisk + majones + tomat + agurk
  2. Rugbrød + skinke + ost + salat + tomat
  3. Knekkebrød + cottage cheese + agurk + reddik
  4. Wrap + kyllingbryst + salat + avokado + tomat
  5. Rugbrød + makrell i tomat + agurk + sitron
  6. Salat (ruccola) + kyllingbryst + fetaost + agurk + tomat + olivenolje
  7. Rugbrød + reker + majones + sitron + agurk
  8. Pitabrød + hummus + kyllingbryst + salat + tomat
  9. Knekkebrød + hardkokt egg + ost + agurk
  10. Rugbrød + avokado + røkelaks + sitron

ABSOLUTT FORBUDT til lunsj:
  ✗ Søte ingredienser: bær, honning, syltetøy, müsli, frukt som hoved (dette er frokost)
  ✗ Ris, pasta eller kokte poteter som base (dette er middagsret)
  ✗ Havregryngrøt eller yoghurt (dette er frokost)
  ✗ Kylling + ris + brokkoli uten brødbase (dette er middag)`,

  Middag: `Norsk middag er ALLTID SALT med tre obligatoriske komponenter: PROTEIN + STIVELSE + GRØNNSAKER.

PROTEIN (velg alltid ETT): kyllingbryst, laksfilet, torsk, sei, hyse, karbonadedeig, svinekotelett, biff, reker
STIVELSE (velg alltid ETT): kokte poteter, hvit ris, fullkornsris, pasta, søtpotet, byggryner
GRØNNSAKER (velg 1–2): brokkoli, gulrot, spinat, paprika, zucchini, asparges, blomkål, sukkererter, bønneskudd

Realistiske middag-kombinasjoner (ETT av disse mønstrene per alternativ):
  1. Kyllingbryst + hvit ris + brokkoli + hvitløk + olivenolje
  2. Laksfilet + kokte poteter + asparges + sitronsmør
  3. Karbonadedeig + pasta + tomatsaus + parmesan
  4. Torsk + kokte poteter + gulrøtter + persille + smør
  5. Svinekoteletter + kokte poteter + blomkål + sennep
  6. Kyllingbryst + søtpotet + spinat + hvitløk + olivenolje
  7. Sei + hvit ris + paprika + sitron + olivenolje
  8. Kyllingbryst + pasta + fløte + sopp + parmesan
  9. Karbonadedeig + hvit ris + paprika + brokkoli + soyasaus
  10. Laksfilet + byggryner + spinat + sitron + hvitløk

ABSOLUTT FORBUDT til middag:
  ✗ Rugbrød, knekkebrød eller wrap som base (dette er lunsj)
  ✗ Søte smaker: honning, bær, syltetøy, frukt i samme rett
  ✗ Havregryn (i enhver form) — havregryn er BARE til frokost, ALDRI til middag
  ✗ Müsli, granola, yoghurt eller cottage cheese (dette er frokost/snack)
  ✗ Bare protein uten stivelse OG grønnsaker — alle tre komponenter MÅ være med`,

  Snack: `Norsk snack er LETT og rask — enten SØTT (frukt + meieri) ELLER SALT (protein + lite karbo). Aldri fullstendig måltid.

SØTTE snack-alternativer:
  1. Banan + mandler (20g)
  2. Eple + peanøttsmør
  3. Gresk yoghurt + blåbær
  4. Kvarg + honning + valnøtter
  5. Appelsin + cashewnøtter
  6. Pære + mandler
  7. Banan + gresk yoghurt

SALTE snack-alternativer:
  1. Cottage cheese + agurk + knekkebrød
  2. Hardkokt egg + knekkebrød + salt
  3. Riskakor + peanøttsmør
  4. Kvarg + dill/gressløk + knekkebrød
  5. Edamame (saltet)
  6. Cottage cheese + reddik

ABSOLUTT FORBUDT som snack:
  ✗ Søtt + salt blandet i samme alternativ (banan + cottage cheese med pepper = FEIL)
  ✗ Fullstendig middag (kylling + ris + brokkoli hører ikke hjemme som snack)
  ✗ Brødmat med mange lag (rugbrød + skinke + ost + tomat er lunsj, ikke snack)
  ✗ Pasta eller ris`,

  Kveldsmat: `"Kveldsmat" is a light Norwegian protein snack eaten 1–2 hours before bed. It is small and easy to digest — never a full dinner.

Realistiske kveldsmat-alternativer:
  1. Cottage cheese + knekkebrød + agurk
  2. Kvarg + valnøtter + blåbær
  3. Gresk yoghurt naturell + chiafrø + litt honning
  4. Hardkokt egg + knekkebrød + ost
  5. Reker + knekkebrød + sitron + agurk
  6. Kvarg + mandler
  7. Cottage cheese + agurk + reddik
  8. Gresk yoghurt + mandler + bær

ABSOLUTT FORBUDT til kveldsmat:
  ✗ Full middag (kylling + ris + brokkoli er for tungt)
  ✗ Søte desserter, kaker, syltetøy
  ✗ Havregryngrøt (for tungt og kaloririk rett før sengetid)
  ✗ Bare frukt uten protein`,

  Ettermiddag:
    `Let ettermiddagssnack — samme regler som Snack. Protein + frukt eller lite karbo.
SØTT: gresk yoghurt + bær, kvarg + honning + valnøtter, banan + mandler, eple + peanøttsmør.
SALT: cottage cheese + agurk, hardkokt egg + knekkebrød, riskakor + peanøttsmør.
ALDRI: søtt + salt blandet, fullstendig middag, pasta eller ris.`,

  Formiddagssnack:
    `Let snack mellom frokost og lunsj — søtt og energigivende, maks 2–3 råvarer.
Eksempler: banan + mandler, eple + peanøttsmør, gresk yoghurt + granola, appelsin + cashewnøtter.
ALDRI: salt mat, kjøtt, brød med pålegg.`,

  Ettermiddagssnack:
    `Let snack mellom lunsj og middag — søtt eller salt, aldri begge.
SØTT: kvarg + bær, gresk yoghurt + honning, banan + valnøtter.
SALT: cottage cheese + agurk, riskakor + peanøttsmør, hardkokt egg.
ALDRI: søtt + salt blandet, fullstendig middag.`,
}

// ── Image lookup ───────────────────────────────────────────────────────────────

// Long-form keys checked first so "gresk yoghurt" beats "yoghurt"
// Derive a short, descriptive Norwegian name for a meal alternative
function deriveAltName(rawFoodNames: string[]): string {
  if (!rawFoodNames.length) return 'Måltidsalternativ'
  const cap = (s: string) => s.trim().charAt(0).toUpperCase() + s.trim().slice(1).toLowerCase()
  const names = rawFoodNames.slice(0, 3).map(s => s.trim().toLowerCase())
  if (names.length === 1) return cap(names[0])
  if (names.length === 2) return `${cap(names[0])} med ${names[1]}`
  return `${cap(names[0])} med ${names[1]} og ${names[2]}`
}


// ── Types ──────────────────────────────────────────────────────────────────────

interface MealTarget { name: string; time: string; protein: number; carbs: number; fat: number; calories: number }
interface ErrCtx { message: string | null; status: number }

// AI only outputs food NAMES + recipe — amounts/macros are computed from Matvaretabellen
type RawAlt = { foods: string[]; recipe?: string[] }

const GROQ_MODEL = 'llama-3.1-8b-instant'
const MAX_TOKENS = 4000

// ── Macro helpers ──────────────────────────────────────────────────────────────

function kcal(p: number, c: number, f: number) { return Math.round(p * 4 + c * 4 + f * 9) }

function buildMealTargets(
  slots: { name: string; time: string }[],
  P: number, C: number, F: number, totalKcal: number,
  splits?: Record<string, number>,
): MealTarget[] {
  const n = slots.length
  const rawSum = splits ? Object.values(splits).reduce((s, v) => s + v, 0) : 0
  return slots.map(slot => {
    const frac = (rawSum > 0.01 && splits?.[slot.name]) ? splits[slot.name] / rawSum : 1 / n
    return {
      name:     slot.name,
      time:     slot.time,
      protein:  Math.round(P * frac),
      carbs:    Math.round(C * frac),
      fat:      Math.round(F * frac),
      calories: Math.round(totalKcal * frac),
    }
  })
}

// ── Matvaretabellen lookup + initial portion sizing ────────────────────────────

// Initial gram amount: start at midpoint of category limits so solver adjusts gently
function defaultPortionG(name: string, cal_per_100g: number): number {
  const { min, max } = portionLimits(name)
  const mid = Math.round((min + max) / 2)
  // For very energy-dense foods start lower so we don't overshoot
  if (cal_per_100g > 700) return min          // oils: 5g
  if (cal_per_100g > 450) return Math.min(mid, 20) // nuts: ~20g
  return mid
}

// Keyword-based fallback when Matvaretabellen lookup fails
function fallbackNutrition(name: string) {
  const n = name.toLowerCase()
  if (/olje|smør|margarin/.test(n)) return { calories_per_100g: 884, protein_per_100g: 0,  carbs_per_100g: 0,  fat_per_100g: 100 }
  if (/kylling|kalkun/.test(n))     return { calories_per_100g: 110, protein_per_100g: 23, carbs_per_100g: 0,  fat_per_100g: 2   }
  if (/laks|ørret/.test(n))         return { calories_per_100g: 200, protein_per_100g: 20, carbs_per_100g: 0,  fat_per_100g: 13  }
  if (/torsk|sei|hyse/.test(n))     return { calories_per_100g: 82,  protein_per_100g: 18, carbs_per_100g: 0,  fat_per_100g: 1   }
  if (/tunfisk/.test(n))            return { calories_per_100g: 116, protein_per_100g: 26, carbs_per_100g: 0,  fat_per_100g: 1   }
  if (/egg/.test(n))                return { calories_per_100g: 155, protein_per_100g: 13, carbs_per_100g: 1,  fat_per_100g: 11  }
  if (/havre|gryn/.test(n))         return { calories_per_100g: 367, protein_per_100g: 13, carbs_per_100g: 58, fat_per_100g: 7   }
  if (/ris(?!kakor)/.test(n))       return { calories_per_100g: 360, protein_per_100g: 7,  carbs_per_100g: 78, fat_per_100g: 1   }
  if (/pasta|nudel/.test(n))        return { calories_per_100g: 350, protein_per_100g: 12, carbs_per_100g: 72, fat_per_100g: 1.5 }
  if (/brød|knekk|rugbrød/.test(n)) return { calories_per_100g: 260, protein_per_100g: 9,  carbs_per_100g: 48, fat_per_100g: 3   }
  if (/proteinyoghurt/.test(n))              return { calories_per_100g: 67, protein_per_100g: 9.2, carbs_per_100g: 3.2, fat_per_100g: 1.8 }
  if (/proteinmelk/.test(n))                return { calories_per_100g: 46, protein_per_100g: 6,   carbs_per_100g: 4.8, fat_per_100g: 0.2 }
  if (/yoghurt|kvarg|cottage|kesam/.test(n)) return { calories_per_100g: 60, protein_per_100g: 10, carbs_per_100g: 4, fat_per_100g: 0.5 }
  if (/mandel|nøtt|cashew|valnøtt/.test(n))  return { calories_per_100g: 580, protein_per_100g: 21, carbs_per_100g: 22, fat_per_100g: 50 }
  if (/banan/.test(n))              return { calories_per_100g: 89,  protein_per_100g: 1.1,carbs_per_100g: 23, fat_per_100g: 0.3 }
  if (/eple|pære/.test(n))          return { calories_per_100g: 52,  protein_per_100g: 0.3,carbs_per_100g: 14, fat_per_100g: 0.2 }
  if (/bær|jordbær|blåbær/.test(n)) return { calories_per_100g: 40,  protein_per_100g: 0.8,carbs_per_100g: 9,  fat_per_100g: 0.3 }
  if (/potet|søtpotet/.test(n))     return { calories_per_100g: 86,  protein_per_100g: 2,  carbs_per_100g: 20, fat_per_100g: 0.1 }
  // Default: generic vegetable
  return { calories_per_100g: 40, protein_per_100g: 2, carbs_per_100g: 7, fat_per_100g: 0.5 }
}

const DISH_WORDS_RE = /\b(?:kake|boller?|gryte|suppe|paté|nuggets?|lasagne|pizza|burger|baguett|sandwich|taco|grateng|ferdigrett|kjøttboller?|farse|frikadell|frikassé|pannekake|vaffel|pudding|mousse|terrine|carpaccio|dipp|spread|patty|panert[e]?)\b/i

// Must mirror matvaretabellen.ts — keeps excluded foods out of similarity re-ranking too
const EXCLUDE_RE =
  /^(?:barnemat|babymat|spedbarn|morsmelk(?:erstatning)?|modermelk|cider|øl|rødvin|hvitvin|ros[ée]|rosvin|brennevin|sprit|likør|aperitiff|prosecco|champagne|sekt|vodka|whisky|whiskey|cognac|brandy|dyrefor|kattemat|hundemat|fuglemat|kosttilskudd)|^vin[,\s]|^gin[,\s]|^rom[,\s]|fra\s+\d+\s*mnd|alkohol|kjøpt\s+i|take.?away|restaurant|kafé|kioskvare|ni[ck]oise|gresskar|sukker\s+pr\.?|\bkavring\b|\bbrie\b|\bcamembert\b|\bhvitmugg\b|\bblåmugg\b|\bvann\b|\bdrikkevann\b|\bspringvann\b|\bkildevann\b|\bmineralvann\b/i

// AI ingredient names to drop entirely before nutrition lookup.
// These are zero-calorie non-foods that break the calorie solver and have no nutritional value.
const SKIP_INGREDIENTS = new Set([
  'vann', 'drikkevann', 'springvann', 'mineralvann', 'kildevann', 'isvann',
  'varmt vann', 'kaldt vann',
])

const NORWEGIAN_FOOD_RE = /^(?:norvegia|jarlsberg|gudbrandsdalsost|nøkkelost|ridderost|pultost|gulost|gamalost|brunost|fløtemysost|geitost|norzola|selbu|østavind)\b/i

function compoundPenalty(query: string, foodName: string): number {
  if (/\b(?:med|og)\b/i.test(query)) return 1
  if (/\bmed\b.+\bog\b/i.test(foodName)) return 0.25
  if (/,\s*med\s+\w/i.test(foodName)) return 0.5
  return 1
}

function hasWordBoundary(needle: string, haystack: string): boolean {
  const idx = haystack.indexOf(needle)
  if (idx === -1) return false
  const beforeOk = idx === 0 || /[\s,\-]/.test(haystack[idx - 1])
  const afterOk  = idx + needle.length >= haystack.length || /[\s,\-]/.test(haystack[idx + needle.length])
  return beforeOk && afterOk
}

function dishPenalty(query: string, foodName: string): number {
  if (DISH_WORDS_RE.test(query)) return 1      // query is itself a dish name → no penalty
  if (DISH_WORDS_RE.test(foodName)) return 0.4 // simple query hit a prepared dish → penalise
  return 1
}

function rawIngredientMismatchPenalty(query: string, foodName: string): number {
  if (DISH_WORDS_RE.test(query)) return 1
  if (/\b(?:med|og)\b/i.test(query)) return 1
  if (query.trim().includes(' ')) return 1

  const ql = query.toLowerCase().trim()
  const nl = foodName.toLowerCase().trim()

  if (nl.startsWith(ql)) return 1

  const commaIdx = nl.indexOf(',')
  if (commaIdx !== -1 && hasWordBoundary(ql, nl.slice(commaIdx + 1).trim())) {
    return 0.2
  }

  return 1
}

function similarity(a: string, b: string): number {
  const al = a.toLowerCase().trim()
  const bl = b.toLowerCase().trim()
  if (al === bl) return 1

  // Hard exclusion — same guard as scoreFood in matvaretabellen.ts
  if (EXCLUDE_RE.test(bl)) return 0

  const pen = dishPenalty(al, bl) * compoundPenalty(al, bl) * rawIngredientMismatchPenalty(al, bl)

  // Food name starts with query word → best simple match
  if (bl.startsWith(al + ',') || bl.startsWith(al + ' ')) return 0.95 * pen

  // Norwegian food brand: "Norvegia, gulost" for query "ost" scores same as startsWith
  if (NORWEGIAN_FOOD_RE.test(bl) && bl.includes(al)) return 0.95 * pen

  if (hasWordBoundary(al, bl) || hasWordBoundary(bl, al)) return 0.9 * pen
  if (bl.startsWith(al) || al.startsWith(bl)) return 0.45 * pen
  if (al.includes(bl) || bl.includes(al)) return 0.65 * pen

  const wa = al.split(/\s+/)
  const wb = bl.split(/\s+/)
  const shared = wa.filter(w => wb.some(x => x.startsWith(w.slice(0, 4)) || w.startsWith(x.slice(0, 4))))
  return (shared.length / Math.max(wa.length, wb.length)) * 0.7 * pen
}

// ── Direct ingredient → exact Matvaretabellen name lookup ─────────────────────
// When AI chooses a key from this map, we search with the mapped exact name and
// take the top hit directly — no fuzzy similarity re-ranking needed.
// This prevents "laks" matching "Fiskeburger, laks" or "biff" matching "Biff stroganoff".

const SIMPLE_INGREDIENTS: Record<string, string> = {
  // Fisk
  'laks':          'Laks, oppdrettet, rå',
  'laksfilet':     'Laks, oppdrettet, rå',
  'ørret':         'Ørret, oppdrettet, rå',
  'ørretfilet':    'Ørret, oppdrettet, rå',
  'torsk':         'Torsk, filet, rå',
  'torskfilet':    'Torsk, filet, rå',
  'sei':           'Sei, rå',
  'seifilet':      'Sei, rå',
  'hyse':          'Hyse, rå',
  'hysefilet':     'Hyse, rå',
  'sild':          'Sild, rå',
  'makrell':       'Makrell, rå',
  'tunfisk':       'Tunfisk, hermetisk i vann',
  // Kjøtt
  'kylling':       'Kyllingbryst, rå',
  'kyllingbryst':  'Kyllingbryst, rå',
  'kyllingfilet':  'Kyllingbryst, rå',
  'biff':          'Storfekjøtt, indrefilet, rå',
  'indrefilet':    'Storfekjøtt, indrefilet, rå',
  'kjøttdeig':     'Kjøttdeig, storfe, rå',
  'kalkun':        'Kalkun, bryst, rå',
  'kalkunbryst':   'Kalkun, bryst, rå',
  'svinefilet':    'Svinekjøtt, filet, rå',
  'svinekjøtt':    'Svinekjøtt, filet, rå',
  'lam':           'Lammekjøtt, bog, rå',
  'lammekjøtt':    'Lammekjøtt, bog, rå',
  // Egg og meieri
  'egg':           'Egg, høne, rå',
  'helmelk':       'Helmelk',
  'lettmelk':      'Lettmelk',
  'skummetmelk':   'Skummetmelk',
  'melk':          'Ytt Proteinmelk Kakao',
  'rømme':         'Rømme, 20%',
  'kremfløte':     'Kremfløte',
  'smør':          'Smør, usaltet',
  'kesam':         'Kesam',
  'cottage cheese':'Cottage cheese',
  'kvarg':         'Kvarg',
  // Ost — "ost"/"hvitost"/"gulost" → Norvegia; kremost → Philadelphia.
  // "brunost" is NOT listed here so it falls through to fuzzy matching (intentional).
  'ost':           'Norvegia, 27 %',
  'hvitost':       'Norvegia, 27 %',
  'gulost':        'Norvegia, 27 %',
  'kremost':       'Kremost, Philadelphia',
  // Grønnsaker
  'brokkoli':      'Brokkoli, rå',
  'gulrot':        'Gulrot, rå',
  'paprika':       'Paprika, rød, rå',
  'tomat':         'Tomat, rå',
  'agurk':         'Agurk, rå',
  'spinat':        'Spinat, rå',
  'løk':           'Løk, rå',
  'hvitløk':       'Hvitløk, rå',
  'blomkål':       'Blomkål, rå',
  'asparges':      'Asparges, rå',
  // Korn og brød
  'havregryn':     'Havregryn',
  'ris':           'Ris, hvit, rå',
  'pasta':         'Pasta, hvit, rå',
  'brød':          'Brød, grovt (50-75 %), kjøpt',
  'grovbrød':      'Brød, grovt (50-75 %), kjøpt',
  'knekkebrød':    'Knekkebrød, Husman',
  'pitabrød':      'Pitabrød, Hatting',
  'pita':          'Pitabrød, Hatting',
  // Frukt
  'banan':         'Banan, rå',
  'eple':          'Eple, rå',
  'jordbær':       'Jordbær, rå',
  'blåbær':        'Blåbær, rå',
  'appelsin':      'Appelsin, rå',
  // Nøtter og fett
  'mandel':        'Mandel, tørket',
  'valnøtt':       'Valnøtt, tørket',
  'olivenolje':    'Olivenolje',
  'rapsolje':      'Rapsolje',
  // Proteinmelk
  'proteinmelk':      'Yt Proteinmelk',
  'yt proteinmelk':   'Yt Proteinmelk',
}

// ── Core: look up foods in Matvaretabellen, then solve for correct gram amounts ─

async function enrichAndSolve(foodNames: string[], target: MealTarget): Promise<Food[]> {
  // Drop non-food items (water etc.) before nutrition lookup — they have 0 kcal and break the solver
  const skipped = foodNames.filter(n => SKIP_INGREDIENTS.has(n.toLowerCase().trim()))
  if (skipped.length) console.log(`[enrichAndSolve] Skipping non-food ingredients: ${skipped.join(', ')}`)
  const validNames = foodNames.filter(n => !SKIP_INGREDIENTS.has(n.toLowerCase().trim()))

  // Step 1: look up each food (now synchronous — reads from local file)
  const lookups = await Promise.allSettled(
    validNames.map(async (rawName) => {
      // 0. Approved ingredient list — deterministic, no fuzzy matching
      const approved = lookupApprovedIngredient(rawName)
      if (approved) {
        return {
          displayName: approved.displayName,
          nutrition: {
            calories_per_100g: approved.calories_per_100g,
            protein_per_100g:  approved.protein_per_100g,
            carbs_per_100g:    approved.carbs_per_100g,
            fat_per_100g:      approved.fat_per_100g,
          },
          fromDB: true,
        }
      }

      // 1. SIMPLE_INGREDIENTS direct mapping (covers edge cases not in approved list)
      const exactMatvare = SIMPLE_INGREDIENTS[rawName.toLowerCase().trim()]

      let bestHit: { name: string; calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number } | null = null

      if (exactMatvare) {
        // Search using the canonical Matvaretabellen name — should score 100 (exact match)
        const hits = searchMatvaretabellen(exactMatvare, 3)
        if (hits.length) bestHit = hits[0]
        // If exact name not found in DB (shouldn't happen), fall through to fuzzy below
      }

      if (!bestHit) {
        const hits = searchMatvaretabellen(rawName, 5)
        if (!hits.length) return { displayName: rawName, nutrition: fallbackNutrition(rawName), fromDB: false }

        const ranked = hits
          .map(h => ({ h, score: similarity(rawName, h.name) }))
          .sort((a, b) => b.score - a.score)[0]

        if (ranked.score < 0.3) {
          console.log(`[enrichAndSolve] Low match (${ranked.score.toFixed(2)}) for "${rawName}" → "${ranked.h.name}", using fallback`)
          return { displayName: rawName, nutrition: fallbackNutrition(rawName), fromDB: false }
        }
        bestHit = ranked.h
      }

      return {
        displayName: bestHit.name,
        nutrition: {
          calories_per_100g: bestHit.calories_per_100g,
          protein_per_100g:  bestHit.protein_per_100g,
          carbs_per_100g:    bestHit.carbs_per_100g,
          fat_per_100g:      bestHit.fat_per_100g,
        },
        fromDB: true,
      }
    })
  )

  // Step 2: build Food[] with initial amounts based on caloric density
  const foods: Food[] = lookups.map((result, i) => {
    const { displayName, nutrition } = result.status === 'fulfilled'
      ? result.value
      : { displayName: validNames[i], nutrition: fallbackNutrition(validNames[i]) }

    const g = defaultPortionG(displayName, nutrition.calories_per_100g)
    return {
      name:      displayName,
      amount:    `${g}g`,
      calories:  Math.round(nutrition.calories_per_100g * g / 100),
      protein_g: Math.round(nutrition.protein_per_100g  * g / 100 * 10) / 10,
      carbs_g:   Math.round(nutrition.carbs_per_100g    * g / 100 * 10) / 10,
      fat_g:     Math.round(nutrition.fat_per_100g      * g / 100 * 10) / 10,
    }
  })

  const initCal = foods.reduce((s, f) => s + f.calories, 0)
  console.log(`[enrichAndSolve] Initial portions: ${foods.map(f => `${f.name}=${f.amount}`).join(', ')} → ${initCal}kcal (target ${target.calories})`)

  // Step 3: adjust amounts mathematically to hit macro targets
  return finalizeAmounts(correctMacros(foods, target))
}

// ── Macro solver (operates on real Matvaretabellen data) ──────────────────────
// scaleFood and adjustAnchor work proportionally from current amounts —
// since those amounts are now built from real per-100g data, the results are accurate.

// Realistic per-serving min/max (grams) keyed by food category
function portionLimits(name: string): { min: number; max: number } {
  const n = name.toLowerCase()
  if (/olje|smør|margarin/.test(n))                                             return { min: 5,   max: 15  }
  if (/mandel|cashew|valnøtt|peanøtt|chiafrø|linfrø|sesamfrø|pistachio/.test(n)) return { min: 10,  max: 30  }
  if (/nøtt/.test(n))                                                            return { min: 10,  max: 30  }
  if (/havregryn|havre/.test(n))                                                 return { min: 40,  max: 80  }
  if (/ris(?!kakor)/.test(n))                                                    return { min: 50,  max: 100 }
  if (/pasta|nudel/.test(n))                                                     return { min: 50,  max: 100 }
  if (/bygg|quinoa/.test(n))                                                     return { min: 50,  max: 100 }
  if (/linser|kikerter|bønner/.test(n))                                          return { min: 60,  max: 150 }
  if (/rugbrød|knekkebrød|brød|bolle|pitabrød|wrap/.test(n))                   return { min: 30,  max: 100 }
  if (/kylling|kalkun/.test(n))                                                  return { min: 100, max: 220 }
  if (/laks|ørret|torsk|sei|hyse|sild/.test(n))                                return { min: 100, max: 220 }
  if (/tunfisk/.test(n))                                                         return { min: 80,  max: 180 }
  if (/reke/.test(n))                                                            return { min: 80,  max: 180 }
  if (/biff|svin|kjøttdeig|karbonadedeig|koteletter/.test(n))                  return { min: 100, max: 200 }
  if (/potet|søtpotet/.test(n))                                                  return { min: 100, max: 250 }
  if (/yoghurt|kvarg|cottage|kesam/.test(n))                                    return { min: 100, max: 250 }
  if (/melk/.test(n))                                                            return { min: 100, max: 250 }
  if (/ost(?!ekake)/.test(n))                                                   return { min: 15,  max: 50  }
  if (/egg/.test(n))                                                             return { min: 50,  max: 200 }
  if (/avokado/.test(n))                                                         return { min: 50,  max: 100 }
  if (/banan/.test(n))                                                           return { min: 80,  max: 150 }
  if (/eple|pære|appelsin|nektarin|fersken/.test(n))                            return { min: 100, max: 200 }
  if (/jordbær|blåbær|bringebær|bær/.test(n))                                  return { min: 50,  max: 150 }
  if (/brokkoli|blomkål|rosenkål/.test(n))                                      return { min: 80,  max: 200 }
  if (/spinat|ruccola|salat/.test(n))                                            return { min: 30,  max: 100 }
  if (/agurk|tomat|paprika|gulrot|selleri|reddik/.test(n))                      return { min: 50,  max: 150 }
  if (/løk/.test(n))                                                             return { min: 10,  max: 50  }
  if (/hvitløk/.test(n))                                                         return { min: 3,   max: 15  }
  return { min: 30, max: 200 }
}

function scaleFood(food: Food, s: number): Food {
  const g = parseInt(food.amount) || 100
  const { min, max } = portionLimits(food.name)
  const ng = Math.round(Math.max(min, Math.min(max, g * s)))
  const ns = ng / g
  return {
    ...food,
    amount:    `${ng}g`,
    calories:  Math.round(food.calories  * ns),
    protein_g: Math.round(food.protein_g * ns * 10) / 10,
    carbs_g:   Math.round(food.carbs_g   * ns * 10) / 10,
    fat_g:     Math.round(food.fat_g     * ns * 10) / 10,
  }
}

function adjustAnchor(
  items: Food[],
  get: (f: Food) => number,
  target: number,
  tolerance: number,
  excludeIdx = -1,
): Food[] {
  const sum = items.reduce((s, f) => s + get(f), 0)
  if (Math.abs(sum - target) <= tolerance) return items

  // Pick the food with the highest density of this macro (skip the excluded index)
  const ai = items.reduce((best, f, i) => {
    if (i === excludeIdx) return best
    return get(f) > get(items[best]) ? i : best
  }, items.findIndex((_, i) => i !== excludeIdx))

  if (ai < 0) return items
  const anchorVal = get(items[ai])
  if (anchorVal < 0.5) return items

  const othersSum = sum - anchorVal
  const needed    = target - othersSum
  if (needed <= 0) {
    const updated = [...items]
    updated[ai] = scaleFood(items[ai], Math.max(0.1, needed / anchorVal))
    return updated
  }
  const updated = [...items]
  updated[ai] = scaleFood(items[ai], Math.min(5.0, needed / anchorVal))
  return updated
}

// Final proportional scale to a calorie target — does NOT clamp to portionLimits.
// Called after macro adjustments to correct any calorie drift they introduced.
function scaleProportional(foods: Food[], targetCal: number): Food[] {
  const actual = foods.reduce((s, f) => s + f.calories, 0)
  if (actual < 5 || Math.abs(actual - targetCal) <= 5) return foods
  const s = targetCal / actual
  return foods.map(f => {
    const g = parseInt(f.amount) || 100
    const ng = Math.max(1, Math.round(g * s))
    const ns = ng / g
    return {
      ...f,
      amount:    `${ng}g`,
      calories:  Math.round(f.calories  * ns),
      protein_g: Math.round(f.protein_g * ns * 10) / 10,
      carbs_g:   Math.round(f.carbs_g   * ns * 10) / 10,
      fat_g:     Math.round(f.fat_g     * ns * 10) / 10,
    }
  })
}

// ── Smart amount display labels ───────────────────────────────────────────────

function stk(grams: number, perPiece: number) {
  return `${Math.max(1, Math.round(grams / perPiece))} stk`
}

function smartAmountLabel(name: string, grams: number): string {
  const n = name.toLowerCase()
  if (n.includes('egg'))                                                              return stk(grams, 60)
  if (n.includes('knekkebrød'))                                                      return stk(grams, 10)
  if (n.includes('rugbrød') || n.includes('grovbrød') || n.includes('brødskive'))   return stk(grams, 35)
  if (n.includes('banan'))                                                           return stk(grams, 120)
  if (n.includes('appelsin'))                                                        return stk(grams, 150)
  if (n.includes('eple'))                                                            return stk(grams, 150)
  if (n.includes('skinkeskive') || n.includes('skinke'))                             return stk(grams, 6)
  if (n.includes('salamiskive') || n.includes('salami'))                             return stk(grams, 6)
  if (n.includes('osteskive') || n.includes('norvegia') || n.includes('jarlsberg')) return stk(grams, 12)
  if (n.includes('ost') && !n.includes('toast'))                                    return stk(grams, 12)
  if (n.includes('proteinyoghurt'))                                                  return `${grams}g`
  if (n.includes('proteinmelk') || n.includes('yoghurt') || n.includes('melk')) {
    const dl = grams / 100
    return `${Number.isInteger(dl) ? dl : dl.toFixed(1)} dl`
  }
  if (n.includes('olje')) {
    const ss = Math.max(1, Math.round(grams / 15))
    return `${ss} ss`
  }
  return `${grams}g`
}

function finalizeAmounts(foods: Food[]): Food[] {
  return foods.map(f => ({
    ...f,
    amount_display: smartAmountLabel(f.name, parseInt(f.amount) || 0),
  }))
}

function correctMacros(foods: Food[], t: MealTarget): Food[] {
  if (!foods.length) return foods
  const sumCal = foods.reduce((s, f) => s + f.calories, 0)
  if (sumCal < 5) return foods

  // Pass 1: scale all proportionally to calorie target (always apply — drop 0.03 threshold)
  const calScale = Math.max(0.1, Math.min(6.0, t.calories / sumCal))
  let result = foods.map(f => scaleFood(f, calScale))

  // Passes 2–3: fine-tune protein and carbs via anchor (two rounds for convergence)
  for (let round = 0; round < 2; round++) {
    const proteinAnchorIdx = result.reduce((best, f, i) => f.protein_g > result[best].protein_g ? i : best, 0)
    result = adjustAnchor(result, f => f.protein_g, t.protein, 3)
    result = adjustAnchor(result, f => f.carbs_g,   t.carbs,   5, proteinAnchorIdx)
  }

  // Recompute calories from actual macros (protein/carb anchoring may have drifted fat)
  result = result.map(f => ({ ...f, calories: kcal(f.protein_g, f.carbs_g, f.fat_g) }))

  // Final pass: proportionally scale to bring total back to calorie target exactly.
  // This corrects drift from portionLimits clamping and macro anchor adjustments.
  return scaleProportional(result, t.calories)
}

// ── Prompt: ask AI for food names + recipe ONLY ───────────────────────────────
// Amounts and macros are computed from Matvaretabellen — not invented by the AI.

function buildPrompt(target: MealTarget, count: number, preferences: string | undefined, batchNum: number): string {
  const guide = MEAL_GUIDES[target.name] ?? MEAL_GUIDES[target.name.replace('mat', '')] ?? 'Bruk vanlige norske råvarer som passer til dette måltidet.'
  const batchNote = batchNum > 1 ? `VIKTIG: Sett ${batchNum} — bruk HELT ANDRE matvarer enn sett 1 for god variasjon.\n` : ''

  const EXAMPLES: Record<string, string> = {
    Frokost:            '{"foods":["havregryn","helmelk","banan"],"recipe":["Kok opp 2,5 dl melk.","Rør inn havregryn og la det tykne 4–5 min.","Hell i bolle og topp med skivede bananer."]}',
    Lunsj:              '{"foods":["rugbrød","tunfisk","agurk"],"recipe":["Legg to rugbrødskiver på en tallerken.","Fordel tunfisk over brødet.","Legg agurk-skiver på toppen."]}',
    Middag:             '{"foods":["kyllingbryst","hvit ris","brokkoli"],"recipe":["Kok ris etter pakken.","Krydre kylling med salt og pepper; stek 6–7 min per side.","Kok brokkoli lett og server ved siden av."]}',
    Snack:              '{"foods":["gresk yoghurt","blåbær"],"recipe":["Ha gresk yoghurt i en skål.","Topp med friske blåbær."]}',
    Kveldsmat:          '{"foods":["cottage cheese","knekkebrød","agurk"],"recipe":["Ha cottage cheese i en skål.","Server med 2 knekkebrød og agurk-skiver."]}',
    Ettermiddag:        '{"foods":["kvarg","blåbær"],"recipe":["Ha kvarg i en skål.","Topp med blåbær."]}',
    Formiddagssnack:    '{"foods":["banan","mandler"],"recipe":["Spis en banan og en liten håndfull mandler."]}',
    Ettermiddagssnack:  '{"foods":["cottage cheese","agurk"],"recipe":["Ha cottage cheese i en skål.","Skjær agurk i skiver og server ved siden av."]}',
  }
  const exampleJson = EXAMPLES[target.name] ?? EXAMPLES['Snack']

  // Meal-type-specific carb sources — injected into rule 8 so the AI only sees valid options
  const CARB_SOURCES: Record<string, string> = {
    Frokost:           'havregryn, müsli, granola, rugbrød, knekkebrød',
    Lunsj:             'rugbrød, knekkebrød, wrap, pitabrød',
    Middag:            'hvit ris, fullkornsris, pasta, kokte poteter, søtpotet, byggryner',
    Snack:             'frukt, nøtter, riskakor, knekkebrød',
    Kveldsmat:         'knekkebrød',
    Ettermiddag:       'frukt, nøtter, knekkebrød',
    Formiddagssnack:   'frukt, nøtter',
    Ettermiddagssnack: 'frukt, nøtter, knekkebrød',
  }
  const carbSources = CARB_SOURCES[target.name] ?? 'brød, ris, potet, frukt'

  return `Du er en norsk ernæringsfysiolog. Svar KUN med gyldig JSON — ingen tekst utenfor JSON-blokken.
${batchNote}
Lag NØYAKTIG ${count} ulike og REALISTISKE ${target.name}-alternativer for en norsk matplan.
${preferences ? `Klientpreferanser: ${preferences}` : ''}
Bruk enkle, vanlige norske råvarer (kyllingbryst, laks, egg, havregryn, rugbrød, ris, pasta, grønnsaker osv.).

UFRAVIKELIGE REGLER:
1. Ingrediensene i hvert alternativ MÅ smake naturlig SAMMEN — som et ekte norsk måltid.
2. ALDRI bland søte og salte smaker i samme alternativ (bær+skinke=FEIL, honning+egg=FEIL, banan+ost=FEIL).
3. Velg enten ET søtt ELLER ET salt alternativ — aldri begge deler.
4. Kun virkelige norske råvarer som faktisk serveres til ${target.name} i Norge.
5. Kun ENKLE råvarer — aldri bearbeidede produkter, kjøttboller, nuggets, farse eller sammensatte retter. Bruk alltid den enkleste råvaren (f.eks. "kyllingbryst" ikke "kjøttboller kylling").
6. INGREDIENSER MÅ MATCHE RETTEN EKSAKT — dette er den viktigste regelen:
   • Bestem FØRST hvilken rett du lager (f.eks. "Knekkebrød med ost og salat").
   • List KUN ingrediensene som inngår i akkurat det navnet — ingenting annet.
   • "Knekkebrød med ost og salat" → foods: ["knekkebrød","ost","salat"] — IKKE "brød", "frokostblanding" eller noe ekstra.
   • "Wrap med kylling og avokado" → foods: ["wrap","kyllingbryst","avokado"] — STOPP der, ikke legg til majones, gulrot o.l.
   • Maks 4 ingredienser. En ingrediens som IKKE ville stått i rettens navn tilhører ikke her.
   • ⛔ FORBUDT å legge til «ekstra» ingredienser bare for å fylle opp — 2–3 ingredienser er alltid nok.
7. SELVSJEKK — Spør deg selv to ganger før du skriver JSON:
   (a) "Ville en vanlig norsk person spist akkurat denne kombinasjonen til ${target.name}?"
   (b) "Er ALLE ingrediensene jeg lister faktisk en del av rettens kjerne — ingen tilfeldige tillegg?"
   Svar nei på ett spørsmål → start på nytt og forenkle.
8. VARIASJONSKRAV — De ${count} alternativene MÅ være 100% unike. Planlegg alle mentalt FØR du skriver JSON:
   • Ulik PROTEINKILDE i hvert alternativ (kyllingbryst, laks, torsk, sei, egg, tunfisk, reker, biff, karbonadedeig, skinke, røkelaks — aldri samme protein to ganger).
   • Ulik KARBOHYDRATKILDE i hvert alternativ — velg KUN fra denne listen for ${target.name}: ${carbSources}.
   • Ulike GRØNNSAKER på tvers av alternativene (brokkoli, gulrot, spinat, paprika, agurk, tomat, asparges, blomkål, zucchini — varier).
   • Ulike TILBEREDNINGSMÅTER: fordel mellom steke, koke, ovnsbake, wok, grille — minst 3 ulike metoder totalt.
9. KARBOHYDRATTABELL — obligatorisk, aldri bryt disse reglene:
   FROKOST   → havregryn, müsli, granola, rugbrød, knekkebrød (IKKE ris, pasta, potet)
   LUNSJ     → rugbrød, knekkebrød, wrap, pitabrød (IKKE ris, pasta, havregryn)
   MIDDAG    → ris, pasta, potet, søtpotet, byggryner (IKKE havregryn, IKKE brød)
   SNACK     → frukt, nøtter, riskakor, knekkebrød (IKKE ris, pasta, havregryn)
   KVELDSMAT → knekkebrød (IKKE ris, pasta, havregryn)
   ⛔ HAVREGRYN TILHØRER KUN FROKOST — bruk det ALDRI i lunsj, middag, snack eller kveldsmat.
   ⛔ RIS/PASTA TILHØRER KUN MIDDAG — bruk dem ALDRI i frokost, lunsj, snack eller kveldsmat.

Veiledning for ${target.name} (følg disse eksemplene nøye):
${guide}

Hvert alternativ SKAL ha:
- "foods": NØYAKTIG 2–4 matvarenavn på norsk (kun navn, INGEN mengder eller gram, MAKS 4 ingredienser)
- "recipe": 2–3 konkrete tilberedningssteg på norsk

Eksempel på riktig format for ${target.name} (legg merke til at det kun er 2–3 ingredienser):
{"alternatives":[${exampleJson}]}

Generer nå NØYAKTIG ${count} slike alternativer (arrayen skal ha ${count} elementer). Start JSON:`
}

// ── Groq call ──────────────────────────────────────────────────────────────────

function extractAlternatives(rawText: string, callId: string): RawAlt[] | null {
  if (!rawText) { console.log(`[${callId}] ❌ Empty response`); return null }

  console.log(`[${callId}] RAW (${rawText.length} chars): ${rawText.slice(0, 400)}`)

  // Strip markdown code fences
  const text = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  let candidates: unknown[]

  // Format A: model returned a raw array  [{"foods":[...]}, ...]
  const arrStart = text.indexOf('[')
  const arrEnd   = text.lastIndexOf(']')
  // Format B: model wrapped it            {"alternatives":[...]}
  const objStart = text.indexOf('{')
  const objEnd   = text.lastIndexOf('}')

  // Prefer whichever starts first (handles leading whitespace / bom)
  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    // Try array format first
    if (arrEnd <= arrStart) {
      console.log(`[${callId}] ❌ Malformed array — no closing ]`)
      return null
    }
    try {
      candidates = JSON.parse(text.slice(arrStart, arrEnd + 1)) as unknown[]
      console.log(`[${callId}] Parsed as bare array, length=${candidates.length}`)
    } catch (e) {
      console.log(`[${callId}] ❌ Array parse failed: ${e}`)
      // Fall through to object parse
      candidates = []
    }
    // If array parse failed or gave empty, try object
    if (!candidates.length && objStart !== -1 && objEnd > objStart) {
      candidates = tryParseObject(text.slice(objStart, objEnd + 1), callId)
    }
  } else if (objStart !== -1 && objEnd > objStart) {
    candidates = tryParseObject(text.slice(objStart, objEnd + 1), callId)
    // Fallback: also try bare array if object gave nothing
    if (!candidates.length && arrStart !== -1 && arrEnd > arrStart) {
      try {
        candidates = JSON.parse(text.slice(arrStart, arrEnd + 1)) as unknown[]
        console.log(`[${callId}] Parsed as bare array (fallback), length=${candidates.length}`)
      } catch { /* ignore */ }
    }
  } else {
    console.log(`[${callId}] ❌ No JSON structure found in response`)
    return null
  }

  // Validate each element
  const alts = (candidates ?? []).filter((a): a is RawAlt => {
    const ok = typeof a === 'object' && a !== null && Array.isArray((a as RawAlt).foods) && (a as RawAlt).foods.length > 0
    if (!ok) console.log(`[${callId}] ⚠️ Skipping invalid alt: ${JSON.stringify(a).slice(0, 100)}`)
    return ok
  })

  console.log(`[${callId}] ✅ ${alts.length} valid alternatives extracted`)
  return alts
}

function tryParseObject(slice: string, callId: string): unknown[] {
  try {
    const parsed = JSON.parse(slice) as Record<string, unknown>
    console.log(`[${callId}] Parsed as object, keys: ${Object.keys(parsed).join(', ')}`)
    // Look for the alternatives array under any key that holds an array
    if (Array.isArray(parsed.alternatives)) return parsed.alternatives as unknown[]
    // Model might use a different key — find the first array value
    for (const val of Object.values(parsed)) {
      if (Array.isArray(val) && val.length > 0) {
        console.log(`[${callId}] Using first array value (${val.length} items) as alternatives`)
        return val as unknown[]
      }
    }
    console.log(`[${callId}] ❌ No array found in object`)
  } catch (e) {
    console.log(`[${callId}] ❌ Object parse failed: ${e}`)
  }
  return []
}

async function callGroq(
  groq: Groq,
  prompt: string,
  temperature: number,
  callId: string,
  errCtx: ErrCtx,
): Promise<RawAlt[] | null> {
  try {
    const completion = await groq.chat.completions.create({
      model:      GROQ_MODEL,
      max_tokens: MAX_TOKENS,
      temperature,
      messages: [{ role: 'user', content: prompt }],
    })
    const rawText      = completion.choices[0]?.message?.content ?? ''
    const finishReason = completion.choices[0]?.finish_reason
    const usage        = completion.usage
    console.log(`[${callId}] finish_reason=${finishReason} tokens: prompt=${usage?.prompt_tokens} completion=${usage?.completion_tokens} total=${usage?.total_tokens}`)
    if (finishReason === 'length') console.warn(`[${callId}] ⚠️ Response TRUNCATED — increase MAX_TOKENS`)
    return extractAlternatives(rawText, callId)
  } catch (err) {
    if (err instanceof Groq.RateLimitError) {
      const waitMatch  = err.message.match(/Please try again in ([\w.]+)/)
      const waitSuffix = waitMatch ? ` Prøv igjen om ${waitMatch[1]}.` : ''
      const isDaily    = /per.?day|TPD/i.test(err.message)
      errCtx.message   = isDaily
        ? `Groq daglig kvote brukt opp.${waitSuffix}`
        : `Groq minutt-kvote nådd.${waitSuffix}`
      errCtx.status    = 429
      console.error(`[${callId}] RateLimitError:`, err.message)
    } else if (err instanceof Groq.AuthenticationError) {
      errCtx.message = 'Ugyldig GROQ_API_KEY — sjekk .env.local'
      errCtx.status  = 401
      console.error(`[${callId}] AuthenticationError:`, err.message)
    } else if (err instanceof Groq.APIError) {
      errCtx.message = `Groq API-feil (${err.status}): ${err.message.slice(0, 150)}`
      errCtx.status  = err.status ?? 500
      console.error(`[${callId}] APIError (${err.status}):`, err.message)
    } else {
      const msg = err instanceof Error ? err.message : String(err)
      errCtx.message = `Uventet feil: ${msg.slice(0, 150)}`
      errCtx.status  = 500
      console.error(`[${callId}] Unexpected:`, msg)
    }
    return null
  }
}

// ── Recipe library: scale saved recipes to calorie target ────────────────────

interface RecipeLibIngredient {
  name: string
  // New format (recipe editor + AI generator): per-100g values + gram amount
  amount_g?: number
  calories_per_100g?: number
  protein_per_100g?: number
  carbs_per_100g?: number
  fat_per_100g?: number
  // Legacy format
  grams?: number
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
}

interface RecipeLibRow {
  id: string
  title: string
  instructions: string | null
  image_url: string | null
  calories_per_serving: number | null
  protein_per_serving:  number | null
  carbs_per_serving:    number | null
  fat_per_serving:      number | null
  ingredients: RecipeLibIngredient[]
}

function recipeToAlternative(recipe: RecipeLibRow, target: MealTarget, seed: number): MealAlternative {
  const srcCals = recipe.calories_per_serving ?? 500
  const scale   = srcCals > 5 ? target.calories / srcCals : 1

  const ingredients = recipe.ingredients ?? []

  const foods: Food[] = finalizeAmounts(ingredients.filter(ing => ing != null).map(ing => {
    const rawG = ing.amount_g ?? ing.grams ?? 100
    const g    = Math.max(1, Math.round(rawG * scale))
    const f    = g / 100
    // Prefer per-100g format (recipe editor + AI generator); fall back to absolute values (legacy)
    const hasPer100  = ing.calories_per_100g != null
    const calories   = hasPer100 ? Math.round((ing.calories_per_100g ?? 0) * f)          : Math.round((ing.calories ?? 0) * scale)
    const protein_g  = hasPer100 ? Math.round((ing.protein_per_100g  ?? 0) * f * 10) / 10 : Math.round((ing.protein  ?? 0) * scale * 10) / 10
    const carbs_g    = hasPer100 ? Math.round((ing.carbs_per_100g    ?? 0) * f * 10) / 10 : Math.round((ing.carbs    ?? 0) * scale * 10) / 10
    const fat_g      = hasPer100 ? Math.round((ing.fat_per_100g      ?? 0) * f * 10) / 10 : Math.round((ing.fat      ?? 0) * scale * 10) / 10
    return { name: ing.name, amount: `${g}g`, calories, protein_g, carbs_g, fat_g }
  }))

  let steps: string[] = []
  if (recipe.instructions) {
    try { steps = JSON.parse(recipe.instructions) as string[] } catch { steps = [recipe.instructions] }
  }

  // Use stored image only — Pexels images are fetched at recipe save/backfill time, not at display time
  const image_url = recipe.image_url
    ?? recipeImageUrl(ingredients.map(i => i.name.split(',')[0]), seed)

  return { name: recipe.title, foods, recipe: steps, image_url }
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Main protein source of a recipe, used to keep alternatives for the same
// meal from all repeating the same protein (e.g. three "kjøttdeig" middager).
const PROTEIN_KEYWORDS: [RegExp, string][] = [
  [/kjøttdeig|karbonadedeig/,                     'kjøttdeig'],
  [/laks|ørret/,                                  'laks'],
  [/torsk|sei|hyse/,                              'torsk'],
  [/biff|storfe|indrefilet|entrecote|mørbrad/,     'biff'],
  [/kylling|kalkun/,                              'kylling'],
  [/svin|koteletter|bacon|skinke/,                'svin'],
  [/reke/,                                        'reker'],
  [/tunfisk/,                                     'tunfisk'],
  [/egg/,                                         'egg'],
]

function mainProteinOf(recipe: RecipeLibRow): string | null {
  const haystack = [recipe.title, ...(recipe.ingredients ?? []).map(i => i?.name ?? '')]
    .join(' ')
    .toLowerCase()
  for (const [re, label] of PROTEIN_KEYWORDS) {
    if (re.test(haystack)) return label
  }
  return null
}

// Pick `count` recipes favouring protein-source variety: shuffle, then greedily
// take recipes whose main protein hasn't been used yet, only allowing repeats
// once every available protein source has already been picked once.
function pickWithProteinVariety(candidates: RecipeLibRow[], count: number): RecipeLibRow[] {
  const pool = shuffled(candidates)
  const picked: RecipeLibRow[] = []
  const usedProteins = new Set<string>()

  for (const r of pool) {
    if (picked.length >= count) break
    const p = mainProteinOf(r)
    if (p && usedProteins.has(p)) continue
    picked.push(r)
    if (p) usedProteins.add(p)
  }

  if (picked.length < count) {
    for (const r of pool) {
      if (picked.length >= count) break
      if (!picked.includes(r)) picked.push(r)
    }
  }

  return picked
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchFromLibrary(supabase: any, coachIds: string[], mealType: string, target: MealTarget, count: number): Promise<MealAlternative[] | null> {
  console.log(`[fetchFromLibrary] CALLED — mealType="${mealType}" coachIds=${JSON.stringify(coachIds)} target=${target.calories}kcal want=${count}`)

  try {
    // Diagnostic: count ALL recipes visible to this org (or just this coach,
    // if not in one) so we know if the issue is "no recipes in DB" vs
    // "recipes exist but meal_type doesn't match"
    const { count: totalCount } = await supabase
      .from('recipes')
      .select('id', { count: 'exact', head: true })
      .in('coach_id', coachIds)
    console.log(`[fetchFromLibrary] "${mealType}": org has ${totalCount ?? '?'} total recipes in DB`)

    const { data, error } = await supabase
      .from('recipes')
      .select('id,title,instructions,image_url,calories_per_serving,protein_per_serving,carbs_per_serving,fat_per_serving,ingredients,meal_type')
      .in('coach_id', coachIds)
      .ilike('meal_type', mealType)
      .limit(100)

    if (error) {
      console.error(`[fetchFromLibrary] DB error querying meal_type="${mealType}":`, error.message)
      return null
    }

    console.log(`[fetchFromLibrary] "${mealType}": query returned ${data?.length ?? 0} rows`)

    if (!data || data.length === 0) {
      // Fetch distinct meal_type values so we can see the mismatch
      const { data: allTypes } = await supabase
        .from('recipes')
        .select('meal_type')
        .in('coach_id', coachIds)
        .limit(200)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const distinct = [...new Set((allTypes ?? []).map((r: any) => r.meal_type))]
      console.log(`[fetchFromLibrary] "${mealType}": no match — distinct meal_types in DB: ${JSON.stringify(distinct)}`)
      return null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const foundTypes = [...new Set(data.map((r: any) => r.meal_type))]
    console.log(`[fetchFromLibrary] "${mealType}": matched meal_type values: ${JSON.stringify(foundTypes)}`)

    const pool = data as RecipeLibRow[]
    const withCals = pool.filter(r => (r.calories_per_serving ?? 0) > 0)
    console.log(`[fetchFromLibrary] ${target.name}: ${withCals.length}/${pool.length} have calories_per_serving > 0`)

    if (!withCals.length) {
      console.log(`[fetchFromLibrary] ${target.name}: all recipes have null/0 calories, falling back to AI`)
      return null
    }

    // Filter to recipes whose scaled protein lands within ±30% of the per-meal protein target.
    // Fall back to unfiltered pool if the filter leaves fewer than `count` candidates.
    const withinRange = withCals.filter(r => {
      const scaledProt = (r.protein_per_serving ?? 0) * (target.calories / (r.calories_per_serving ?? 1))
      return Math.abs(scaledProt - target.protein) / Math.max(target.protein, 1) <= 0.30
    })
    const candidates = withinRange.length >= count ? withinRange : withCals
    console.log(`[fetchFromLibrary] ${target.name}: ${withinRange.length} within ±30% protein — using ${candidates === withinRange ? 'filtered' : 'full'} pool (${candidates.length})`)

    // Shuffle for randomness, but favour protein-source variety across alternatives
    // (e.g. don't serve "kjøttdeig" for every middag alternative if laks/kylling/torsk/biff options exist).
    const picked = pickWithProteinVariety(candidates, Math.min(count, candidates.length))

    console.log(`[fetchFromLibrary] ${target.name}: returning ${picked.length} alternatives (wanted ${count})`)
    return picked.map((r, i) => recipeToAlternative(r, target, i))
  } catch (err) {
    console.error(`[fetchFromLibrary] Uncaught exception for ${target.name}:`, err)
    return null
  }
}

async function fetchBatch(
  groq: Groq,
  target: MealTarget,
  count: number,
  preferences: string | undefined,
  batchNum: number,
  mealIdx: number,
  errCtx: ErrCtx,
): Promise<RawAlt[]> {
  const callId = `meal[${mealIdx}:${target.name}] batch${batchNum}`
  const prompt = buildPrompt(target, count, preferences, batchNum)

  console.log(`[${callId}] Requesting ${count} food-name alternatives`)
  let alts = await callGroq(groq, prompt, 0.6, callId, errCtx)

  if (!alts || alts.length < count) {
    console.log(`[${callId}] Got ${alts?.length ?? 0}/${count}, retrying`)
    const retry = await callGroq(groq, prompt, 0.2, `${callId}-retry`, errCtx)
    if (retry && retry.length > (alts?.length ?? 0)) alts = retry
  }

  return (alts ?? []).slice(0, count)
}

// ── Process one alternative: Matvaretabellen lookup → solve → image ───────────

async function processAlt(
  alt: RawAlt,
  target: MealTarget,
  mealIdx: number,
  altIdx: number,
): Promise<MealAlternative> {
  let foods: Food[]
  try {
    foods = await Promise.race([
      enrichAndSolve(alt.foods, target),
      new Promise<Food[]>(resolve => setTimeout(() => resolve([]), 10_000)),
    ])
  } catch {
    foods = []
  }

  if (foods.length > 0) {
    const tot = { p: foods.reduce((s,f)=>s+f.protein_g,0), c: foods.reduce((s,f)=>s+f.carbs_g,0), f: foods.reduce((s,f)=>s+f.fat_g,0), cal: foods.reduce((s,f)=>s+f.calories,0) }
    console.log(`[processAlt meal${mealIdx} alt${altIdx}] solved: p=${tot.p.toFixed(1)}/${target.protein} c=${tot.c.toFixed(1)}/${target.carbs} f=${tot.f.toFixed(1)}/${target.fat} cal=${tot.cal}/${target.calories}`)
  }

  const altName   = deriveAltName(alt.foods)
  const image_url = recipeImageUrl(alt.foods, mealIdx * 100 + altIdx)
  return { name: altName, foods, recipe: alt.recipe, image_url }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  console.log('[generate-meal-plan] POST received — model:', GROQ_MODEL)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY mangler i .env.local' }, { status: 500 })

  const groq    = new Groq({ apiKey })
  const errCtx: ErrCtx = { message: null, status: 500 }
  const body: MealPlanGenerateRequest = await req.json()

  const {
    protein_g, carbs_g, fat_g,
    meal_structure = '4',
    custom_meal_names,
    meal_calorie_splits,
    alternatives_per_meal = 7,
    preferences,
  } = body

  const totalKcal = body.calories || kcal(protein_g, carbs_g, fat_g)

  console.log('[generate-meal-plan] REQUEST BODY:', JSON.stringify({
    calories: totalKcal, protein_g, carbs_g, fat_g,
    meal_structure, custom_meal_names, alternatives_per_meal, preferences,
    meal_calorie_splits,
  }))

  const DEFAULT_TIMES: Record<string, string> = {
    Frokost: '07:30', Lunsj: '12:00', Middag: '18:00',
    Kveldsmat: '20:30', Kvelds: '20:30', Snack: '15:00',
    Ettermiddag: '15:30', Formiddagssnack: '10:00', Ettermiddagssnack: '16:00',
  }
  const rawSlots = custom_meal_names?.length
    ? custom_meal_names.map(name => ({ name, time: DEFAULT_TIMES[name] ?? '12:00' }))
    : (MEAL_STRUCTURES[meal_structure as MealStructure] ?? MEAL_STRUCTURES['4'])

  const mealTargets = buildMealTargets(rawSlots, protein_g, carbs_g, fat_g, totalKcal, meal_calorie_splits)

  console.log('[generate-meal-plan] MEAL TARGETS:', mealTargets.map(t => `[${t.name}] ${t.calories}kcal P${t.protein} C${t.carbs} F${t.fat}`).join(' | '))

  // Recipe library covers the whole org, not just this coach — a new coach
  // should immediately see recipes their org-mates (e.g. the admin) created.
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user!.id)
    .single()

  let coachIds = [user!.id]
  if (membership) {
    const { data: orgMates } = await supabase
      .from('org_members')
      .select('user_id')
      .eq('org_id', membership.org_id)
    if (orgMates?.length) coachIds = orgMates.map((m: { user_id: string }) => m.user_id)
  }
  console.log(`[generate-meal-plan] Recipe library scope — coachIds: ${JSON.stringify(coachIds)}`)

  // Check recipe library before AI generation — skip AI for meal types with enough recipes
  console.log(`[generate-meal-plan] Checking recipe library for ${mealTargets.length} meal slots...`)
  const libAltsMap = new Map<number, MealAlternative[]>()
  for (let mi = 0; mi < mealTargets.length; mi++) {
    const lib = await fetchFromLibrary(supabase, coachIds, mealTargets[mi].name, mealTargets[mi], alternatives_per_meal)
    if (lib) {
      libAltsMap.set(mi, lib)
    }
  }
  console.log(`[generate-meal-plan] Library summary: ${libAltsMap.size}/${mealTargets.length} meal slots covered by DB recipes`)
  mealTargets.forEach((t, mi) => {
    const lib = libAltsMap.get(mi)
    console.log(`  [${t.name}]: ${lib ? `${lib.length} library alts` : 'AI fallback'}`)
  })

  // Fully sequential: one Groq call at a time, 500ms pause between meals.
  // Groq free tier rejects concurrent calls even at low concurrency.
  const BATCH      = 7
  const numBatches = Math.ceil(alternatives_per_meal / BATCH)
  const MAX_RETRIES = 2
  const mealRawAlts: RawAlt[][] = mealTargets.map(() => [])

  for (let b = 0; b < numBatches; b++) {
    const batchCount = Math.min(BATCH, alternatives_per_meal - b * BATCH)
    console.log(`[generate-meal-plan] Batch ${b + 1}/${numBatches}: ${batchCount} alts × ${mealTargets.length} meals (sequential)`)

    for (let mealIdx = 0; mealIdx < mealTargets.length; mealIdx++) {
      if (libAltsMap.has(mealIdx)) continue  // library covers this meal type

      const target = mealTargets[mealIdx]

      // Try up to MAX_RETRIES times for each meal
      let alts: RawAlt[] = []
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const attemptCtx: ErrCtx = { message: null, status: 500 }
        alts = await fetchBatch(groq, target, batchCount, preferences, b + 1, mealIdx, attemptCtx)
        if (alts.length > 0) break
        console.log(`[generate-meal-plan] ${target.name} attempt ${attempt} got 0 alts${attemptCtx.message ? ': ' + attemptCtx.message : ''}, retrying...`)
        if (attemptCtx.message) errCtx.message = attemptCtx.message
        // Longer pause before retry to let Groq rate limit window reset
        await new Promise(r => setTimeout(r, 1000 * attempt))
      }

      mealRawAlts[mealIdx].push(...alts)

      // 500ms pause between meals to avoid burst rate limits
      if (mealIdx < mealTargets.length - 1) await new Promise(r => setTimeout(r, 500))
    }

    if (errCtx.message && mealRawAlts.every(a => a.length === 0)) break
  }

  const meals: Meal[] = await Promise.all(
    mealTargets.map(async (target, mealIdx) => {
      const rawAlts = mealRawAlts[mealIdx]
      console.log(`[generate-meal-plan] Processing ${rawAlts.length} alts for ${target.name}`)

      // Prefer library recipes over AI-generated ones
      const libAlts = libAltsMap.get(mealIdx)
      if (libAlts?.length) {
        return {
          name:         target.name,
          time:         target.time,
          foods:        libAlts[0].foods,
          alternatives: libAlts,
          image_url:    libAlts[0].image_url,
          recipe:       libAlts[0].recipe,
        } satisfies Meal
      }

      if (rawAlts.length === 0) {
        return { name: target.name, time: target.time, foods: [], alternatives: [] } satisfies Meal
      }

      const alts = await Promise.all(
        rawAlts.map((alt, altIdx) => processAlt(alt, target, mealIdx, altIdx))
      )

      return {
        name:         target.name,
        time:         target.time,
        foods:        alts[0]?.foods ?? [],
        alternatives: alts,
        image_url:    alts[0]?.image_url,
        recipe:       alts[0]?.recipe,
      } satisfies Meal
    })
  )

  const generatedCount = meals.reduce((s, m) => s + (m.alternatives?.length ?? 0), 0)
  console.log('[generate-meal-plan] Done:', meals.map(m => `${m.name}(${m.alternatives?.length ?? 0})`).join(', '))

  if (generatedCount === 0) {
    const msg = errCtx.message ?? 'Groq returnerte ingen alternativer — sjekk server-loggene.'
    return NextResponse.json({ error: msg }, { status: errCtx.status })
  }

  return NextResponse.json({ meals })
}
