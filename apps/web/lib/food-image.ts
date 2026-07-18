// All photo IDs verified 200 from images.unsplash.com
// source.unsplash.com is deprecated (503) — never use it
const FOOD_PHOTOS: Record<string, string> = {
  // Proteins
  salmon:       'photo-1519708227418-c8fd9a32b7a2',
  chicken:      'photo-1532550907401-a500c9a57435',
  tuna:         'photo-1534482421-64566f976cfa',
  eggs:         'photo-1525351484163-7529414344d8',
  shrimp:       'photo-1565680018434-b513d5e5fd47',
  beef:         'photo-1529692236671-f1f6cf9683ba',
  pork:         'photo-1558030006-450675393462',
  // Grains / bread
  oatmeal:      'photo-1567620905732-2d1ec7ab7445',   // oatmeal bowl with berries
  rye_bread:    'photo-1509440159596-0249088772ff',
  crispbread:   'photo-1543352634-a1c51d9f1fa7',
  wrap:         'photo-1600335895229-6e75511892c8',
  pita:         'photo-1603360946369-dc9bb6258143',
  bread:        'photo-1574071318508-1cdbab80d002',
  pasta:        'photo-1473093295043-cdd812d0e601',
  rice:         'photo-1516684732162-798a0062be99',
  // Dairy
  yogurt:       'photo-1488477181946-6428a0291777',
  dairy:        'photo-1550583724-b2692b85b150',       // cottage cheese / quark
  // Other
  salad:        'photo-1512621776951-a57141f2eefd',
  smoothie:     'photo-1505252585461-04db1eb84625',
  soup:         'photo-1547592180-85f173990554',
  bowl:         'photo-1540189549336-e6e99c3679fe',
  snack:        'photo-1550317138-10000687a72b',
}

/**
 * Priority tiers for category matching.
 * Each tier is checked against ALL ingredients before moving to the next tier.
 * This ensures a protein ingredient always wins over a bread or dairy ingredient,
 * regardless of ingredient order in the recipe.
 */
const TIERS: { category: string; nor: RegExp; en?: RegExp }[] = [
  // ── Tier 1: Protein ──────────────────────────────────────────────────────────
  { category: 'salmon',  nor: /laks|ørret|røkelaks|torsk|sei|sild/ },
  { category: 'chicken', nor: /kyllingbryst|kylling|kalkun/ },
  { category: 'tuna',    nor: /tunfisk|makrell/ },
  { category: 'eggs',    nor: /\begg\b|eggerøre|røreegg|eggeplomme|eggehvite/ },
  { category: 'shrimp',  nor: /\broke\b|scampi/ },
  { category: 'beef',    nor: /kjøttdeig|biff|entrecôte|indrefilet|lammekjøtt|\blam\b/ },
  { category: 'pork',    nor: /\bsvin\b|koteletter|\bbacon\b|skinke/ },
  // ── Tier 2: Grains / bread ───────────────────────────────────────────────────
  { category: 'oatmeal',    nor: /havregryn|havreflak|havregrøt|\bgrøt\b/ },
  { category: 'rye_bread',  nor: /rugbrød|grovbrød/ },
  { category: 'crispbread', nor: /knekkebrød|ryvita|finn\s*crisp/ },
  { category: 'wrap',       nor: /\bwrap\b|tortilla/ },
  { category: 'pita',       nor: /pitabrød|\bpita\b/ },
  { category: 'pasta',      nor: /\bpasta\b|\bnudl/ },
  { category: 'rice',       nor: /\bris\b|bulgur|couscous|byggryner/ },
  { category: 'bread',      nor: /\bbrød\b|baguette|ciabatta/ },
  // ── Tier 3: Dairy ────────────────────────────────────────────────────────────
  { category: 'yogurt',  nor: /yoghurt|yogurt/ },
  { category: 'dairy',   nor: /cottage\s*cheese|kvarg|kesam/ },
  // ── Tier 4: Other ────────────────────────────────────────────────────────────
  { category: 'salad',   nor: /\bsalat\b|spinat|\bagurk\b|grønnsak/ },
  { category: 'smoothie', nor: /smoothie|juice|banan|bær|blåbær|jordbær|bringebær/ },
  { category: 'soup',    nor: /\bsuppe\b|gryte/ },
]

// Norwegian → English food term translations (used for english-name fallback)
const NO_EN: Record<string, string> = {
  'gresk yoghurt':   'greek yogurt',
  'cottage cheese':  'cottage cheese',
  'havregryngrøt':   'oatmeal porridge',
  kyllingbryst:      'chicken breast',  kylling:     'chicken',
  kalkun:            'turkey',
  laks:              'salmon',          ørret:       'trout',
  torsk:             'cod',             sei:         'pollock',
  sild:              'herring',         tunfisk:     'tuna',
  reke:              'shrimp',
  biff:              'beef steak',      kjøttdeig:   'ground beef',
  svin:              'pork',            kjøttkaker:  'meatballs',
  koteletter:        'pork chops',      skinke:      'ham',
  røkelaks:          'smoked salmon',   lammekjøtt:  'lamb',
  egg:               'eggs',            røreegg:     'scrambled eggs',
  havregryn:         'oatmeal',         grøt:        'porridge',
  müsli:             'muesli',          granola:     'granola',
  kvarg:             'quark',           kesam:       'quark',
  yoghurt:           'yogurt',          melk:        'milk',
  ost:               'cheese',          kremost:     'cream cheese',
  fløte:             'cream',           rømme:       'sour cream',
  rugbrød:           'rye bread',       knekkebrød:  'crispbread',
  ris:               'rice',            pasta:       'pasta',
  nudler:            'noodles',         potet:       'potato',
  søtpotet:          'sweet potato',    byggryner:   'barley',
  brød:              'bread',           wrap:        'wrap',
  pitabrød:          'pita bread',      baguette:    'baguette',
  brokkoli:          'broccoli',        spinat:      'spinach',
  agurk:             'cucumber',        tomat:       'tomatoes',
  paprika:           'bell pepper',     gulrot:      'carrots',
  avokado:           'avocado',         salat:       'salad',
  løk:               'onion',           hvitløk:     'garlic',
  mais:              'corn',            erter:       'peas',
  bønner:            'beans',           linser:      'lentils',
  banan:             'banana',          eple:        'apple',
  pære:              'pear',            appelsin:    'orange',
  jordbær:           'strawberries',    blåbær:      'blueberries',
  bringebær:         'raspberries',     bær:         'berries',
  druer:             'grapes',          mango:       'mango',
  ananas:            'pineapple',       sitron:      'lemon',
  mandler:           'almonds',         cashew:      'cashews',
  valnøtter:         'walnuts',         peanøtt:     'peanuts',
  chiafrø:           'chia seeds',      linfrø:      'flaxseed',
  honning:           'honey',           pesto:       'pesto',
  hummus:            'hummus',          smør:        'butter',
  olivenolje:        'olive oil',       olje:        'oil',
  sukker:            'sugar',           mel:         'flour',
  saus:              'sauce',           dressing:    'dressing',
}

export function toEnglish(name: string): string {
  const lower = name.toLowerCase().split(',')[0].trim()
  const keys = Object.keys(NO_EN).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (lower.includes(key)) return NO_EN[key]
  }
  return lower
}

function buildUrl(photoId: string): string {
  return `https://images.unsplash.com/${photoId}?w=400&h=300&fit=crop&auto=format`
}

/**
 * Returns a matching Unsplash image URL for a recipe's ingredients.
 *
 * Matching uses priority tiers so a protein ingredient always wins over
 * a bread or dairy ingredient, regardless of their order in the list.
 * Tier 1 = protein, Tier 2 = grains/bread, Tier 3 = dairy, Tier 4 = other.
 */
export function recipeImageUrl(ingredientNames: string[], seed = 0): string {
  const lowers = ingredientNames
    .slice(0, 6)
    .map(n => n.toLowerCase().split(',')[0].trim())

  for (const { category, nor } of TIERS) {
    for (const lower of lowers) {
      if (nor.test(lower) && FOOD_PHOTOS[category]) {
        const url = buildUrl(FOOD_PHOTOS[category])
        console.log(`[recipeImageUrl] "${lower}" → ${category} → ${url}`)
        return url
      }
    }
  }

  // Fallback: cycle through all photos by seed
  const all = Object.values(FOOD_PHOTOS)
  const url = buildUrl(all[seed % all.length])
  console.log(`[recipeImageUrl] fallback seed=${seed} → ${url}`)
  return url
}
