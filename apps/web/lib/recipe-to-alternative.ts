import { recipeImageUrl } from '@/lib/food-image'
import type { MealAlternative, Food } from '@coaching/types'

// ── Types ──────────────────────────────────────────────────────────────────────
// Shape of a row from the `recipes` table, as returned by GET /api/recipes.
// Named distinctly from recipes-view.tsx's own RecipeRow (which keeps
// `ingredients: unknown[]` for its own display-only purposes) since this one
// needs the actual ingredient shape to do the macro math below.

export interface RecipeLibraryIngredient {
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

export interface RecipeLibraryRow {
  id: string
  title: string
  instructions: string | null
  image_url: string | null
  calories_per_serving: number | null
  protein_per_serving:  number | null
  carbs_per_serving:    number | null
  fat_per_serving:      number | null
  ingredients: RecipeLibraryIngredient[]
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

// ── Recipe library: scale a saved recipe to a calorie target ──────────────────
// Shared by the AI meal-plan generator (server) and the recipe drag-and-drop
// sidebar (client) — both need to turn one of a coach's saved recipes into a
// MealAlternative sized to whatever calorie budget the destination meal slot
// has, and this math must stay identical between the two call sites or the
// same recipe would come out scaled differently depending on how it got
// there.

export function recipeToAlternative(recipe: RecipeLibraryRow, targetCalories: number, seed: number): MealAlternative {
  const srcCals = recipe.calories_per_serving ?? 500
  const scale   = srcCals > 5 ? targetCalories / srcCals : 1

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

// ── Re-scale an already-built foods list to a new calorie target ──────────────
// Used when copying an EXISTING meal alternative to a different meal-type
// slot (drag-and-drop): unlike recipeToAlternative, there's no source recipe
// row here to re-derive amounts from — the foods array itself is already in
// final Food[] shape, so this scales each item's grams/macros proportionally
// from its current total instead.

export function scaleFoods(foods: Food[], fromCalories: number, toCalories: number): Food[] {
  const scale = fromCalories > 5 ? toCalories / fromCalories : 1
  return finalizeAmounts(foods.map(f => {
    const rawG = parseInt(f.amount) || 100
    const g    = Math.max(1, Math.round(rawG * scale))
    return {
      name: f.name,
      amount: `${g}g`,
      calories:  Math.round(f.calories  * scale),
      protein_g: Math.round(f.protein_g * scale * 10) / 10,
      carbs_g:   Math.round(f.carbs_g   * scale * 10) / 10,
      fat_g:     Math.round(f.fat_g     * scale * 10) / 10,
    }
  }))
}
