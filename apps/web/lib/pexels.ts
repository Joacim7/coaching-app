// Server-side only — uses PEXELS_API_KEY env var (never NEXT_PUBLIC_)

const STOP = new Set([
  'med', 'og', 'på', 'i', 'av', 'til', 'fra', 'en', 'et', 'den',
  'det', 'de', 'som', 'er', 'ei', 'å', 'for', 'om', 'uten', 'ved',
])

const DICT: Record<string, string> = {
  // multi-word (checked first because of longest-match)
  'gresk yoghurt':  'greek yogurt',
  'cottage cheese': 'cottage cheese',
  'havregryngrøt':  'oatmeal porridge',
  'søt potet':      'sweet potato',
  // proteins
  kyllingbryst: 'chicken breast', kylling: 'chicken', kalkun: 'turkey',
  laks: 'salmon', røkelaks: 'smoked salmon', ørret: 'trout', torsk: 'cod',
  sei: 'pollock', sild: 'herring', tunfisk: 'tuna', makrell: 'mackerel',
  reke: 'shrimp', scampi: 'scampi', krabbe: 'crab',
  biff: 'beef', kjøttdeig: 'ground beef', svin: 'pork', skinke: 'ham',
  bacon: 'bacon', koteletter: 'pork chops', kjøttkaker: 'meatballs',
  lammekjøtt: 'lamb', entrecôte: 'entrecote', indrefilet: 'tenderloin',
  egg: 'egg', eggerøre: 'scrambled eggs', røreegg: 'scrambled eggs',
  // grains / bread
  havregryn: 'oatmeal', havregrøt: 'oatmeal', grøt: 'porridge',
  rugbrød: 'rye bread', grovbrød: 'dark bread', knekkebrød: 'crispbread',
  brød: 'bread', wrap: 'wrap', tortilla: 'tortilla',
  pitabrød: 'pita bread', baguette: 'baguette', ciabatta: 'ciabatta',
  ris: 'rice', pasta: 'pasta', nudler: 'noodles', spaghetti: 'spaghetti',
  bulgur: 'bulgur', couscous: 'couscous', byggryner: 'barley',
  potet: 'potato', søtpotet: 'sweet potato',
  granola: 'granola', müsli: 'muesli',
  // dairy
  yoghurt: 'yogurt', kvarg: 'quark', kesam: 'quark',
  melk: 'milk', proteinmelk: 'milk', havremelk: 'oat milk',
  fløte: 'cream', rømme: 'sour cream',
  ost: 'cheese', kremost: 'cream cheese', mozzarella: 'mozzarella',
  smør: 'butter',
  // vegetables
  brokkoli: 'broccoli', spinat: 'spinach', agurk: 'cucumber',
  tomat: 'tomato', paprika: 'bell pepper', gulrot: 'carrot',
  avokado: 'avocado', salat: 'salad', løk: 'onion', hvitløk: 'garlic',
  mais: 'corn', erter: 'peas', bønner: 'beans', linser: 'lentils',
  sopp: 'mushroom', blomkål: 'cauliflower', grønnsaker: 'vegetables',
  squash: 'zucchini', aubergine: 'eggplant', purre: 'leek',
  kål: 'cabbage', rosenkål: 'brussels sprouts',
  // fruit
  banan: 'banana', eple: 'apple', pære: 'pear', appelsin: 'orange',
  jordbær: 'strawberry', blåbær: 'blueberry', bringebær: 'raspberry',
  mango: 'mango', ananas: 'pineapple', sitron: 'lemon', lime: 'lime',
  druer: 'grapes', aprikos: 'apricot', fersken: 'peach',
  // nuts / seeds
  mandler: 'almonds', cashew: 'cashews', valnøtter: 'walnuts',
  peanøtt: 'peanuts', chiafrø: 'chia seeds', linfrø: 'flaxseed',
  sesamfrø: 'sesame', solsikkekjerner: 'sunflower seeds',
  // condiments / misc
  honning: 'honey', pesto: 'pesto', hummus: 'hummus',
  olivenolje: 'olive oil', olje: 'oil',
  saus: 'sauce', dressing: 'dressing', majones: 'mayonnaise',
  proteinpulver: 'protein powder',
}

const _sortedKeys = Object.keys(DICT).sort((a, b) => b.length - a.length)

/** Translate a Norwegian recipe title to English search terms, dropping stop words. */
export function titleToEnglish(title: string): string {
  let rem = title.toLowerCase().trim()
  const out: string[] = []

  while (rem.length > 0) {
    // Skip non-alpha leading chars (spaces, punctuation, numbers)
    const skip = rem.match(/^[^a-zæøå]+/)
    if (skip) { rem = rem.slice(skip[0].length); continue }

    // Longest-match dictionary lookup
    let hit = false
    for (const key of _sortedKeys) {
      if (rem.startsWith(key)) {
        const next = rem[key.length]
        if (!next || !/[a-zæøå]/.test(next)) {
          out.push(DICT[key])
          rem = rem.slice(key.length)
          hit = true
          break
        }
      }
    }
    if (hit) continue

    // Unknown word — keep if not a stop word
    const word = rem.match(/^[a-zæøå]+/)
    if (word) {
      if (!STOP.has(word[0]) && word[0].length > 2) out.push(word[0])
      rem = rem.slice(word[0].length)
    } else {
      rem = rem.slice(1)
    }
  }

  return out.filter(Boolean).join(' ')
}

/**
 * Fetch a food image from Pexels for the given Norwegian recipe title.
 * Returns the medium-size URL, or null if the key is missing or the call fails.
 * seed shifts the result page (0–2) so different alternatives get different photos.
 */
export async function fetchPexelsImage(norwegianTitle: string, seed = 0): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    console.warn('[pexels] PEXELS_API_KEY not set')
    return null
  }

  const translated = titleToEnglish(norwegianTitle)
  if (!translated.trim()) return null

  const query   = `${translated} food`
  const page    = (seed % 3) + 1

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&page=${page}&orientation=landscape`,
      {
        headers: { Authorization: apiKey },
        next:    { revalidate: 86400 },   // cache 24h per unique query+page
      }
    )

    console.log(`[pexels] "${norwegianTitle}" → "${query}" (page ${page}) → ${res.status}`)
    if (!res.ok) return null

    const json = await res.json() as { photos: { src: { medium: string } }[] }
    const url  = json.photos?.[0]?.src?.medium ?? null
    if (url) console.log(`[pexels] → ${url}`)
    return url
  } catch (err) {
    console.error('[pexels] fetch error:', err)
    return null
  }
}
