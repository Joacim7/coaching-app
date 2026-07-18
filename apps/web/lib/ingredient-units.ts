export type IngredientUnit = 'g' | 'stk' | 'dl' | 'ml' | 'ss' | 'ts'

export const UNIT_LABELS: Record<IngredientUnit, string> = {
  g: 'g', stk: 'stk', dl: 'dl', ml: 'ml', ss: 'ss', ts: 'ts',
}

export function gPerPiece(name: string): number {
  const n = name.toLowerCase()
  if (n.includes('egg'))                                                              return 60
  if (n.includes('knekkebrød'))                                                      return 10
  if (n.includes('pitabrød') || n.includes('pita'))                                   return 80
  if (n.includes('wrap'))                                                              return 40
  if (n.includes('rugbrød') || n.includes('grovbrød') || n.includes('brødskive') || n.includes('brød')) return 35
  if (n.includes('banan'))                                                           return 120
  if (n.includes('appelsin'))                                                        return 150
  if (n.includes('eple'))                                                            return 150
  if (n.includes('skinkeskive') || n.includes('skinke'))                            return 6
  if (n.includes('salamiskive') || n.includes('salami'))                            return 6
  if (n.includes('osteskive') || n.includes('norvegia') || n.includes('jarlsberg')) return 12
  if (n.includes('ost') && !n.includes('toast'))                                    return 12
  return 100
}

export function unitToGrams(amount: number, unit: IngredientUnit, name: string): number {
  switch (unit) {
    case 'g':   return amount
    case 'ml':  return amount
    case 'dl':  return amount * 100
    case 'ss':  return amount * 15
    case 'ts':  return amount * 5
    case 'stk': return amount * gPerPiece(name)
  }
}

export function gramsToUnit(grams: number, unit: IngredientUnit, name: string): number {
  switch (unit) {
    case 'g':   return grams
    case 'ml':  return grams
    case 'dl':  return grams / 100
    case 'ss':  return grams / 15
    case 'ts':  return grams / 5
    case 'stk': return Math.max(1, Math.round(grams / gPerPiece(name)))
  }
}

// Default unit based on food name
export function smartUnitFor(name: string): IngredientUnit {
  const n = name.toLowerCase()
  if (n.includes('egg'))                                                               return 'stk'
  if (n.includes('pitabrød') || n.includes('pita') || n.includes('wrap'))             return 'stk'
  if (n.includes('knekkebrød') || n.includes('rugbrød') || n.includes('grovbrød') || n.includes('brød')) return 'stk'
  if (n.includes('banan') || n.includes('eple') || n.includes('appelsin'))            return 'stk'
  if (n.includes('skinkeskive') || n.includes('skinke'))                              return 'stk'
  if (n.includes('salamiskive') || n.includes('salami'))                              return 'stk'
  if (n.includes('osteskive') || n.includes('norvegia') || n.includes('jarlsberg'))  return 'stk'
  if (n.includes('ost') && !n.includes('toast') && !n.includes('kremost'))           return 'stk'
  if (n.includes('yoghurt'))                                                         return 'g'
  if (n.includes('melk') || n.includes('proteinmelk'))                                return 'dl'
  if (n.includes('olje'))                                                              return 'ss'
  return 'g'
}

// Parse "2 stk" | "1.5 dl" | "1 ss" → { unit, unitAmount }
// Returns null for plain gram strings ("120g") or undefined.
export function parseAmountDisplay(
  display: string | undefined,
): { unit: IngredientUnit; unitAmount: number } | null {
  if (!display) return null
  const parts = display.trim().split(/\s+/)
  if (parts.length === 2) {
    const unitAmount = parseFloat(parts[0])
    const unit = parts[1] as IngredientUnit
    if (!isNaN(unitAmount) && unit !== 'g' && Object.keys(UNIT_LABELS).includes(unit)) {
      return { unit, unitAmount }
    }
  }
  return null
}
