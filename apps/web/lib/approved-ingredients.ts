export interface ApprovedIngredient {
  aiName: string             // exact name the AI must use (injected into prompt)
  displayName: string        // display name shown to the user
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  category: 'protein' | 'karbohydrater' | 'meieri' | 'grønnsaker' | 'frukt' | 'fett' | 'annet'
}

export const APPROVED_INGREDIENTS: ApprovedIngredient[] = [
  // ── PROTEIN ─────────────────────────────────────────────────────────────────
  { aiName: 'kyllingbryst',  displayName: 'Kyllingbryst, rå',            calories_per_100g: 165, protein_per_100g: 23,  carbs_per_100g: 0,  fat_per_100g: 8,   category: 'protein' },
  { aiName: 'kalkun',        displayName: 'Kalkun, bryst, rå',           calories_per_100g: 120, protein_per_100g: 24,  carbs_per_100g: 0,  fat_per_100g: 2,   category: 'protein' },
  { aiName: 'laks',          displayName: 'Laks, oppdrettet, rå',        calories_per_100g: 208, protein_per_100g: 20,  carbs_per_100g: 0,  fat_per_100g: 14,  category: 'protein' },
  { aiName: 'ørret',         displayName: 'Ørret, oppdrettet, rå',       calories_per_100g: 175, protein_per_100g: 20,  carbs_per_100g: 0,  fat_per_100g: 11,  category: 'protein' },
  { aiName: 'torsk',         displayName: 'Torsk, filet, rå',            calories_per_100g: 82,  protein_per_100g: 18,  carbs_per_100g: 0,  fat_per_100g: 1,   category: 'protein' },
  { aiName: 'sei',           displayName: 'Sei, rå',                     calories_per_100g: 80,  protein_per_100g: 18,  carbs_per_100g: 0,  fat_per_100g: 1,   category: 'protein' },
  { aiName: 'sild',          displayName: 'Sild, rå',                    calories_per_100g: 189, protein_per_100g: 18,  carbs_per_100g: 0,  fat_per_100g: 12,  category: 'protein' },
  { aiName: 'tunfisk',       displayName: 'Tunfisk, hermetisk i vann',   calories_per_100g: 116, protein_per_100g: 25,  carbs_per_100g: 0,  fat_per_100g: 2,   category: 'protein' },
  { aiName: 'makrell',       displayName: 'Makrell, hermetisk i tomat',  calories_per_100g: 170, protein_per_100g: 16,  carbs_per_100g: 3,  fat_per_100g: 10,  category: 'protein' },
  { aiName: 'røkelaks',      displayName: 'Røkelaks',                    calories_per_100g: 190, protein_per_100g: 20,  carbs_per_100g: 0,  fat_per_100g: 12,  category: 'protein' },
  { aiName: 'reker',         displayName: 'Reker, kokte',                calories_per_100g: 99,  protein_per_100g: 18,  carbs_per_100g: 0,  fat_per_100g: 2,   category: 'protein' },
  { aiName: 'skinke',        displayName: 'Skinke, kokt',                calories_per_100g: 145, protein_per_100g: 18,  carbs_per_100g: 2,  fat_per_100g: 7,   category: 'protein' },
  { aiName: 'egg',           displayName: 'Egg, høne, rå',               calories_per_100g: 155, protein_per_100g: 13,  carbs_per_100g: 1,  fat_per_100g: 11,  category: 'protein' },
  { aiName: 'kjøttdeig',     displayName: 'Kjøttdeig, storfe, rå',       calories_per_100g: 200, protein_per_100g: 18,  carbs_per_100g: 0,  fat_per_100g: 14,  category: 'protein' },
  { aiName: 'karbonadedeig', displayName: 'Karbonadedeig, storfe',       calories_per_100g: 135, protein_per_100g: 20,  carbs_per_100g: 0,  fat_per_100g: 6,   category: 'protein' },
  { aiName: 'biff',          displayName: 'Storfekjøtt, indrefilet, rå', calories_per_100g: 150, protein_per_100g: 22,  carbs_per_100g: 0,  fat_per_100g: 7,   category: 'protein' },

  // ── MEIERI ──────────────────────────────────────────────────────────────────
  { aiName: 'proteinyoghurt',   displayName: 'Ytt Proteinyoghurt',        calories_per_100g: 67,  protein_per_100g: 9.2, carbs_per_100g: 3.2, fat_per_100g: 1.8, category: 'meieri' },
  { aiName: 'proteinmelk',       displayName: 'Yt Proteinmelk',          calories_per_100g: 50,  protein_per_100g: 6.3, carbs_per_100g: 5,   fat_per_100g: 0.5, category: 'meieri' },
  { aiName: 'proteinmelk kakao', displayName: 'Ytt Proteinmelk Kakao',   calories_per_100g: 46,  protein_per_100g: 6,   carbs_per_100g: 4.8, fat_per_100g: 0.2, category: 'meieri' },
  { aiName: 'gresk yoghurt', displayName: 'Gresk yoghurt, 10% fett',     calories_per_100g: 97,  protein_per_100g: 10,  carbs_per_100g: 4,  fat_per_100g: 5,   category: 'meieri' },
  { aiName: 'cottage cheese',displayName: 'Cottage cheese',              calories_per_100g: 98,  protein_per_100g: 11,  carbs_per_100g: 4,  fat_per_100g: 4,   category: 'meieri' },
  { aiName: 'helmelk',       displayName: 'Helmelk',                     calories_per_100g: 61,  protein_per_100g: 3.4, carbs_per_100g: 5,  fat_per_100g: 3,   category: 'meieri' },
  { aiName: 'lettmelk',      displayName: 'Lettmelk',                    calories_per_100g: 42,  protein_per_100g: 3,   carbs_per_100g: 5,  fat_per_100g: 1,   category: 'meieri' },
  { aiName: 'norvegia ost',  displayName: 'Norvegia, 27 %',              calories_per_100g: 370, protein_per_100g: 27,  carbs_per_100g: 0,  fat_per_100g: 29,  category: 'meieri' },
  { aiName: 'kremost',       displayName: 'Kremost, Philadelphia',       calories_per_100g: 342, protein_per_100g: 7,   carbs_per_100g: 2,  fat_per_100g: 34,  category: 'meieri' },
  { aiName: 'kvarg',         displayName: 'Kvarg',                       calories_per_100g: 67,  protein_per_100g: 11,  carbs_per_100g: 5,  fat_per_100g: 0,   category: 'meieri' },
  { aiName: 'kesam',         displayName: 'Kesam',                       calories_per_100g: 72,  protein_per_100g: 8,   carbs_per_100g: 4,  fat_per_100g: 3,   category: 'meieri' },
  { aiName: 'rømme',         displayName: 'Rømme, 20%',                  calories_per_100g: 182, protein_per_100g: 3,   carbs_per_100g: 3,  fat_per_100g: 18,  category: 'meieri' },

  // ── KARBOHYDRATER ───────────────────────────────────────────────────────────
  { aiName: 'havregryn',     displayName: 'Havregryn',                   calories_per_100g: 370, protein_per_100g: 13,  carbs_per_100g: 58, fat_per_100g: 7,   category: 'karbohydrater' },
  { aiName: 'rugbrød',       displayName: 'Rugbrød',                     calories_per_100g: 220, protein_per_100g: 7,   carbs_per_100g: 41, fat_per_100g: 3,   category: 'karbohydrater' },
  { aiName: 'knekkebrød',    displayName: 'Knekkebrød, mørkt',           calories_per_100g: 370, protein_per_100g: 10,  carbs_per_100g: 69, fat_per_100g: 6,   category: 'karbohydrater' },
  { aiName: 'hvit ris',      displayName: 'Ris, hvit, rå',               calories_per_100g: 360, protein_per_100g: 7,   carbs_per_100g: 81, fat_per_100g: 1,   category: 'karbohydrater' },
  { aiName: 'fullkornsris',  displayName: 'Ris, fullkorn, rå',           calories_per_100g: 350, protein_per_100g: 8,   carbs_per_100g: 74, fat_per_100g: 3,   category: 'karbohydrater' },
  { aiName: 'pasta',         displayName: 'Pasta, hvit, rå',             calories_per_100g: 370, protein_per_100g: 12,  carbs_per_100g: 76, fat_per_100g: 2,   category: 'karbohydrater' },
  { aiName: 'pitabrød',      displayName: 'Pitabrød',                    calories_per_100g: 265, protein_per_100g: 8,   carbs_per_100g: 52, fat_per_100g: 3,   category: 'karbohydrater' },
  { aiName: 'wrap',          displayName: 'Tortilla, hvete',             calories_per_100g: 310, protein_per_100g: 8,   carbs_per_100g: 53, fat_per_100g: 8,   category: 'karbohydrater' },
  { aiName: 'fullkornsbrød', displayName: 'Grovbrød',                    calories_per_100g: 220, protein_per_100g: 8,   carbs_per_100g: 39, fat_per_100g: 3,   category: 'karbohydrater' },
  { aiName: 'müsli',         displayName: 'Müsli',                       calories_per_100g: 380, protein_per_100g: 10,  carbs_per_100g: 65, fat_per_100g: 9,   category: 'karbohydrater' },
  { aiName: 'granola',       displayName: 'Granola',                     calories_per_100g: 410, protein_per_100g: 8,   carbs_per_100g: 58, fat_per_100g: 17,  category: 'karbohydrater' },
  { aiName: 'potet',         displayName: 'Potet, rå',                   calories_per_100g: 77,  protein_per_100g: 2,   carbs_per_100g: 17, fat_per_100g: 0,   category: 'karbohydrater' },
  { aiName: 'søtpotet',      displayName: 'Søtpotet, rå',                calories_per_100g: 86,  protein_per_100g: 2,   carbs_per_100g: 19, fat_per_100g: 0,   category: 'karbohydrater' },
  { aiName: 'byggryner',     displayName: 'Byggryner',                   calories_per_100g: 350, protein_per_100g: 10,  carbs_per_100g: 72, fat_per_100g: 2,   category: 'karbohydrater' },

  // ── GRØNNSAKER ──────────────────────────────────────────────────────────────
  { aiName: 'brokkoli',      displayName: 'Brokkoli, rå',                calories_per_100g: 34,  protein_per_100g: 3,   carbs_per_100g: 5,  fat_per_100g: 0,   category: 'grønnsaker' },
  { aiName: 'gulrot',        displayName: 'Gulrot, rå',                  calories_per_100g: 41,  protein_per_100g: 1,   carbs_per_100g: 9,  fat_per_100g: 0,   category: 'grønnsaker' },
  { aiName: 'spinat',        displayName: 'Spinat, rå',                  calories_per_100g: 23,  protein_per_100g: 2.9, carbs_per_100g: 2,  fat_per_100g: 0,   category: 'grønnsaker' },
  { aiName: 'tomat',         displayName: 'Tomat, rå',                   calories_per_100g: 18,  protein_per_100g: 0.9, carbs_per_100g: 3,  fat_per_100g: 0,   category: 'grønnsaker' },
  { aiName: 'agurk',         displayName: 'Agurk, rå',                   calories_per_100g: 15,  protein_per_100g: 0.7, carbs_per_100g: 3,  fat_per_100g: 0,   category: 'grønnsaker' },
  { aiName: 'paprika',       displayName: 'Paprika, rød, rå',            calories_per_100g: 31,  protein_per_100g: 1,   carbs_per_100g: 6,  fat_per_100g: 0,   category: 'grønnsaker' },
  { aiName: 'blomkål',       displayName: 'Blomkål, rå',                 calories_per_100g: 25,  protein_per_100g: 1.9, carbs_per_100g: 4,  fat_per_100g: 0,   category: 'grønnsaker' },
  { aiName: 'salat',         displayName: 'Salat, isbergsalat',          calories_per_100g: 14,  protein_per_100g: 1.4, carbs_per_100g: 2,  fat_per_100g: 0,   category: 'grønnsaker' },
  { aiName: 'løk',           displayName: 'Løk, rå',                     calories_per_100g: 40,  protein_per_100g: 1,   carbs_per_100g: 9,  fat_per_100g: 0,   category: 'grønnsaker' },
  { aiName: 'hvitløk',       displayName: 'Hvitløk, rå',                 calories_per_100g: 149, protein_per_100g: 6,   carbs_per_100g: 33, fat_per_100g: 1,   category: 'grønnsaker' },
  { aiName: 'asparges',      displayName: 'Asparges, rå',                calories_per_100g: 20,  protein_per_100g: 2,   carbs_per_100g: 4,  fat_per_100g: 0,   category: 'grønnsaker' },
  { aiName: 'zucchini',      displayName: 'Zucchini, rå',                calories_per_100g: 17,  protein_per_100g: 1,   carbs_per_100g: 3,  fat_per_100g: 0,   category: 'grønnsaker' },
  { aiName: 'mais',          displayName: 'Mais, hermetisk',             calories_per_100g: 95,  protein_per_100g: 3,   carbs_per_100g: 19, fat_per_100g: 1,   category: 'grønnsaker' },
  { aiName: 'erter',         displayName: 'Erter, rå',                   calories_per_100g: 81,  protein_per_100g: 5,   carbs_per_100g: 14, fat_per_100g: 1,   category: 'grønnsaker' },
  { aiName: 'grønnkål',      displayName: 'Grønnkål, rå',               calories_per_100g: 49,  protein_per_100g: 4,   carbs_per_100g: 9,  fat_per_100g: 1,   category: 'grønnsaker' },
  { aiName: 'rødbeter',      displayName: 'Rødbeter, rå',               calories_per_100g: 43,  protein_per_100g: 2,   carbs_per_100g: 10, fat_per_100g: 0,   category: 'grønnsaker' },

  // ── FRUKT ───────────────────────────────────────────────────────────────────
  { aiName: 'banan',         displayName: 'Banan, rå',                   calories_per_100g: 89,  protein_per_100g: 1,   carbs_per_100g: 21, fat_per_100g: 0,   category: 'frukt' },
  { aiName: 'eple',          displayName: 'Eple, rå',                    calories_per_100g: 52,  protein_per_100g: 0.3, carbs_per_100g: 14, fat_per_100g: 0,   category: 'frukt' },
  { aiName: 'appelsin',      displayName: 'Appelsin, rå',                calories_per_100g: 47,  protein_per_100g: 1,   carbs_per_100g: 12, fat_per_100g: 0,   category: 'frukt' },
  { aiName: 'jordbær',       displayName: 'Jordbær, rå',                 calories_per_100g: 33,  protein_per_100g: 1,   carbs_per_100g: 7,  fat_per_100g: 0,   category: 'frukt' },
  { aiName: 'blåbær',        displayName: 'Blåbær, rå',                  calories_per_100g: 56,  protein_per_100g: 1,   carbs_per_100g: 13, fat_per_100g: 1,   category: 'frukt' },
  { aiName: 'bringebær',     displayName: 'Bringebær, rå',               calories_per_100g: 52,  protein_per_100g: 1,   carbs_per_100g: 12, fat_per_100g: 1,   category: 'frukt' },
  { aiName: 'kiwi',          displayName: 'Kiwi, rå',                    calories_per_100g: 61,  protein_per_100g: 1,   carbs_per_100g: 14, fat_per_100g: 1,   category: 'frukt' },
  { aiName: 'pære',          displayName: 'Pære, rå',                    calories_per_100g: 58,  protein_per_100g: 0,   carbs_per_100g: 15, fat_per_100g: 0,   category: 'frukt' },
  { aiName: 'mango',         displayName: 'Mango, rå',                   calories_per_100g: 65,  protein_per_100g: 1,   carbs_per_100g: 17, fat_per_100g: 0,   category: 'frukt' },

  // ── FETT / NØTTER ───────────────────────────────────────────────────────────
  { aiName: 'olivenolje',    displayName: 'Olivenolje',                  calories_per_100g: 884, protein_per_100g: 0,   carbs_per_100g: 0,  fat_per_100g: 100, category: 'fett' },
  { aiName: 'rapsolje',      displayName: 'Rapsolje',                    calories_per_100g: 884, protein_per_100g: 0,   carbs_per_100g: 0,  fat_per_100g: 100, category: 'fett' },
  { aiName: 'smør',          displayName: 'Smør, usaltet',               calories_per_100g: 717, protein_per_100g: 1,   carbs_per_100g: 1,  fat_per_100g: 81,  category: 'fett' },
  { aiName: 'avokado',       displayName: 'Avokado',                     calories_per_100g: 160, protein_per_100g: 2,   carbs_per_100g: 2,  fat_per_100g: 16,  category: 'fett' },
  { aiName: 'mandler',       displayName: 'Mandel, tørket',              calories_per_100g: 579, protein_per_100g: 21,  carbs_per_100g: 22, fat_per_100g: 50,  category: 'fett' },
  { aiName: 'valnøtter',     displayName: 'Valnøtt, tørket',            calories_per_100g: 654, protein_per_100g: 15,  carbs_per_100g: 14, fat_per_100g: 65,  category: 'fett' },
  { aiName: 'cashewnøtter',  displayName: 'Cashewnøtt, tørket',         calories_per_100g: 553, protein_per_100g: 18,  carbs_per_100g: 30, fat_per_100g: 44,  category: 'fett' },
  { aiName: 'peanøtter',     displayName: 'Peanøtt, tørket',            calories_per_100g: 567, protein_per_100g: 26,  carbs_per_100g: 16, fat_per_100g: 49,  category: 'fett' },
  { aiName: 'chiafrø',       displayName: 'Chiafrø',                     calories_per_100g: 486, protein_per_100g: 17,  carbs_per_100g: 42, fat_per_100g: 31,  category: 'fett' },
  { aiName: 'solsikkefrø',   displayName: 'Solsikkefrø',                 calories_per_100g: 584, protein_per_100g: 21,  carbs_per_100g: 20, fat_per_100g: 51,  category: 'fett' },

  // ── ANNET ───────────────────────────────────────────────────────────────────
  { aiName: 'hummus',        displayName: 'Hummus',                      calories_per_100g: 166, protein_per_100g: 8,   carbs_per_100g: 14, fat_per_100g: 10,  category: 'annet' },
  { aiName: 'pesto',         displayName: 'Pesto',                       calories_per_100g: 490, protein_per_100g: 5,   carbs_per_100g: 4,  fat_per_100g: 50,  category: 'annet' },
  { aiName: 'honning',       displayName: 'Honning',                     calories_per_100g: 304, protein_per_100g: 0,   carbs_per_100g: 82, fat_per_100g: 0,   category: 'annet' },
  { aiName: 'soyasaus',      displayName: 'Soyasaus',                    calories_per_100g: 53,  protein_per_100g: 8,   carbs_per_100g: 5,  fat_per_100g: 1,   category: 'annet' },
  { aiName: 'crème fraîche', displayName: 'Crème fraîche',               calories_per_100g: 209, protein_per_100g: 3,   carbs_per_100g: 3,  fat_per_100g: 21,  category: 'annet' },
  { aiName: 'sitronsaft',    displayName: 'Sitronsaft',                  calories_per_100g: 22,  protein_per_100g: 0,   carbs_per_100g: 7,  fat_per_100g: 0,   category: 'annet' },
]

// Alternative spellings / shortened forms the AI might output → canonical aiName
const ALIASES: Record<string, string> = {
  'kylling':            'kyllingbryst',
  'kyllingfilet':       'kyllingbryst',
  'kalkunbryst':        'kalkun',
  'kalkunfilet':        'kalkun',
  'laksfilet':          'laks',
  'ørretfilet':         'ørret',
  'torskfilet':         'torsk',
  'seifilet':           'sei',
  'reke':               'reker',
  'tunfisk i vann':     'tunfisk',
  'makrell i tomat':    'makrell',
  'ost':                'norvegia ost',
  'hvitost':            'norvegia ost',
  'gulost':             'norvegia ost',
  'norvegia':           'norvegia ost',
  'norvegia 27%':       'norvegia ost',
  'philadelphia':       'kremost',
  'smøreost':           'kremost',
  'ytt proteinyoghurt':   'proteinyoghurt',
  'ytt':                  'proteinyoghurt',
  'yt proteinmelk':        'proteinmelk',
  'ytt proteinmelk kakao': 'proteinmelk kakao',
  'melk':               'helmelk',
  'skummetmelk':        'lettmelk',
  'ris':                'hvit ris',
  'hvitris':            'hvit ris',
  'brun ris':           'fullkornsris',
  'tortilla':           'wrap',
  'lefse':              'wrap',
  'isbergsalat':        'salat',
  'grønn salat':        'salat',
  'ruccula':            'salat',
  'mandel':             'mandler',
  'valnøtt':            'valnøtter',
  'cashew':             'cashewnøtter',
  'peanøtt':            'peanøtter',
  'creme fraiche':      'crème fraîche',
  'crème fraiche':      'crème fraîche',
  'sitron':             'sitronsaft',
  'bønner':             'erter',
}

// Look up an AI-generated ingredient name in the approved list.
// Returns null if not found — caller should fall through to Matvaretabellen matching.
export function lookupApprovedIngredient(name: string): ApprovedIngredient | null {
  const key = name.toLowerCase().trim()
  const canonical = ALIASES[key] ?? key
  return APPROVED_INGREDIENTS.find(i => i.aiName === canonical) ?? null
}

// Full list for reference / tooling (not sent to AI — too large).
export function getIngredientListForPrompt(): string {
  const groups: Record<string, string[]> = {}
  for (const ing of APPROVED_INGREDIENTS) {
    if (!groups[ing.category]) groups[ing.category] = []
    groups[ing.category].push(ing.aiName)
  }
  return [
    'GODKJENTE INGREDIENSER — bruk KUN disse norske navnene i "foods"-listen. Ingen andre.',
    `PROTEIN (velg én per alternativ): ${groups['protein'].join(' · ')}`,
    `MEIERI: ${groups['meieri'].join(' · ')}`,
    `KARBOHYDRATER: ${groups['karbohydrater'].join(' · ')}`,
    `GRØNNSAKER: ${groups['grønnsaker'].join(' · ')}`,
    `FRUKT: ${groups['frukt'].join(' · ')}`,
    `FETT/NØTTER: ${groups['fett'].join(' · ')}`,
    `ANNET: ${groups['annet'].join(' · ')}`,
    '⛔ Skriv navnene NØYAKTIG slik de står — ikke skriv "kylling" når du mener "kyllingbryst", ikke "ost" når du mener "norvegia ost".',
  ].join('\n')
}

// Compact 40-ingredient list sent to the AI — covers all common meals without bloating the prompt.
export function getShortIngredientListForPrompt(): string {
  const top40 = [
    // protein
    'kyllingbryst', 'laks', 'torsk', 'tunfisk', 'egg', 'skinke', 'røkelaks', 'kjøttdeig',
    // meieri
    'gresk yoghurt', 'cottage cheese', 'helmelk', 'norvegia ost', 'kremost', 'kvarg',
    // karbohydrater
    'havregryn', 'rugbrød', 'knekkebrød', 'hvit ris', 'pasta', 'pitabrød', 'wrap', 'müsli', 'potet',
    // grønnsaker
    'brokkoli', 'gulrot', 'spinat', 'tomat', 'agurk', 'paprika', 'salat', 'blomkål',
    // frukt
    'banan', 'eple', 'jordbær', 'blåbær', 'appelsin',
    // fett
    'avokado', 'mandler', 'olivenolje',
    // annet
    'honning', 'hummus',
  ]
  return `Bruk KUN disse ingrediensene (skriv navnene nøyaktig slik): ${top40.join(', ')}`
}
