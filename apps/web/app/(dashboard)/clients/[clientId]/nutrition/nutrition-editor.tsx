'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Save, Sparkles, ChevronLeft, Plus, Trash2,
  ChevronDown, ChevronUp, Search, Flame, PenLine, Check, X, ArrowLeftRight, BookmarkPlus, EyeOff,
} from 'lucide-react'
import Link from 'next/link'
import { FoodSearchInput } from '@/components/food-search-input'
import type { Meal, Food, MealPlan, MealAlternative, FoodSearchResult } from '@coaching/types'
import {
  parseAmountDisplay, unitToGrams, gramsToUnit, smartUnitFor,
  type IngredientUnit,
} from '@/lib/ingredient-units'
import { useLocale } from '@/components/locale-provider'
import type { TranslationKey } from '@/lib/i18n/translations'

type FoodLogEntry = {
  id: string
  created_at: string
  meal_name: string
  meal_type: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  ingredients: { name: string; grams: number; calories: number; protein_g: number; carbs_g: number; fat_g: number }[]
}

type FavoriteMeal = {
  id: string
  name: string
  meal_type: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  created_at: string
  ingredients: { name: string; grams: number; calories: number; protein_g: number; carbs_g: number; fat_g: number }[]
}

interface Props {
  clientId: string
  clientName: string
  coachId: string
  initialPlans: MealPlan[]
  initialFoodLogs: FoodLogEntry[]
  initialFavoriteMeals: FavoriteMeal[]
}

// ── Library recipe types (for replace modal) ──────────────────────────────────

interface LibraryIngredient {
  name: string
  // Older/seeded recipes store absolute per-serving values.
  grams?: number
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  // Recipes saved via the recipe editor store per-100g rates + a gram amount instead.
  amount_g?: number
  calories_per_100g?: number
  protein_per_100g?: number
  carbs_per_100g?: number
  fat_per_100g?: number
}

interface LibraryRecipe {
  id: string; title: string
  instructions: string | null; image_url: string | null; meal_type: string | null
  calories_per_serving: number | null; protein_per_serving: number | null
  carbs_per_serving: number | null; fat_per_serving: number | null
  ingredients: LibraryIngredient[]
}

function libraryRecipeToAlt(recipe: LibraryRecipe, targetCals: number): MealAlternative {
  const srcCals = recipe.calories_per_serving ?? 500
  const scale   = srcCals > 5 ? targetCals / srcCals : 1
  const ings    = recipe.ingredients ?? []

  const foods: Food[] = ings.map(ing => {
    // Two ingredient shapes exist in the DB — normalise per-100g rates to
    // absolute values first, then apply the same scale to both.
    const isPer100g = ing.calories_per_100g !== undefined
    const grams     = isPer100g ? (ing.amount_g ?? 0) : (ing.grams ?? 0)
    const factor    = isPer100g ? grams / 100 : 1
    const calories  = isPer100g ? (ing.calories_per_100g ?? 0) * factor : (ing.calories ?? 0)
    const protein   = isPer100g ? (ing.protein_per_100g  ?? 0) * factor : (ing.protein  ?? 0)
    const carbs     = isPer100g ? (ing.carbs_per_100g    ?? 0) * factor : (ing.carbs    ?? 0)
    const fat       = isPer100g ? (ing.fat_per_100g      ?? 0) * factor : (ing.fat      ?? 0)

    return {
      name:      ing.name,
      amount:    `${Math.max(1, Math.round(grams * scale))}g`,
      calories:  Math.round(calories * scale),
      protein_g: Math.round(protein * scale * 10) / 10,
      carbs_g:   Math.round(carbs   * scale * 10) / 10,
      fat_g:     Math.round(fat     * scale * 10) / 10,
    }
  })

  let steps: string[] = []
  if (recipe.instructions) {
    try { steps = JSON.parse(recipe.instructions) as string[] } catch { steps = [recipe.instructions] }
  }
  return { name: recipe.title, foods, recipe: steps, image_url: recipe.image_url ?? undefined }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MEAL_OPTIONS: { name: string; emoji: string; time: string }[] = [
  { name: 'Frokost',    emoji: '🌅', time: '07:30' },
  { name: 'Lunsj',     emoji: '🥗', time: '12:00' },
  { name: 'Middag',    emoji: '🍽️', time: '18:00' },
  { name: 'Snack',     emoji: '🍎', time: '15:00' },
  { name: 'Kveldsmat', emoji: '🌙', time: '20:30' },
]

const ALLERGEN_OPTIONS: { id: string; labelKey: TranslationKey }[] = [
  { id: 'glutenfri',   labelKey: 'clientDetail.nutrition.allergy.glutenFree' },
  { id: 'melkefri',    labelKey: 'clientDetail.nutrition.allergy.dairyFree' },
  { id: 'laktosefri',  labelKey: 'clientDetail.nutrition.allergy.lactoseFree' },
  { id: 'nøttefri',    labelKey: 'clientDetail.nutrition.allergy.nutFree' },
  { id: 'eggfri',      labelKey: 'clientDetail.nutrition.allergy.eggFree' },
  { id: 'skalldyrfri', labelKey: 'clientDetail.nutrition.allergy.shellfishFree' },
  { id: 'uten-fisk',   labelKey: 'clientDetail.nutrition.allergy.noFish' },
]

const DAY_OPTIONS = [7, 14, 21] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcCalories(p: number, c: number, f: number) {
  return Math.round(p * 4 + c * 4 + f * 9)
}

function normaliseSplits(meals: string[], splits: Record<string, number>): Record<string, number> {
  if (meals.length === 0) return {}
  const total = meals.reduce((s, m) => s + (splits[m] ?? 0), 0)
  if (total < 0.001) return Object.fromEntries(meals.map(m => [m, 1 / meals.length]))
  return Object.fromEntries(meals.map(m => [m, (splits[m] ?? 0) / total]))
}

function newFood(): Food {
  return { name: '', amount: '', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
}

// Proportionally scale a list of foods so their combined calories hit
// targetCals — used when a meal's calorie-distribution % changes, so the
// meal's actual ingredients (grams + macros) follow the new target instead
// of only the on-screen number.
function scaleFoodsToTarget(foods: Food[], targetCals: number): Food[] {
  const current = foods.reduce((s, f) => s + f.calories, 0)
  if (current < 1 || targetCals < 1) return foods
  const scale = targetCals / current
  return foods.map(f => {
    const grams    = parseFloat(f.amount) || null
    const newGrams = grams != null ? Math.max(1, Math.round(grams * scale)) : null

    let amount_display = f.amount_display
    const dispMatch = f.amount_display?.match(/^(-?\d+(?:\.\d+)?)\s*(\S+)$/)
    if (dispMatch) {
      const [, rawAmt, unit] = dispMatch
      const newUnitAmt = unit === 'stk'
        ? Math.max(1, Math.round(parseFloat(rawAmt) * scale))
        : Math.round(parseFloat(rawAmt) * scale * 10) / 10
      amount_display = `${newUnitAmt} ${unit}`
    }

    return {
      ...f,
      amount:    newGrams != null ? `${newGrams}g` : f.amount,
      amount_display,
      calories:  Math.round(f.calories * scale),
      protein_g: Math.round(f.protein_g * scale * 10) / 10,
      carbs_g:   Math.round(f.carbs_g   * scale * 10) / 10,
      fat_g:     Math.round(f.fat_g     * scale * 10) / 10,
    }
  })
}

function newMeal(name: string, time: string): Meal {
  return { name, time, foods: [newFood()], alternatives: [{ foods: [newFood()] }] }
}

function emptyAlternative(): MealAlternative {
  return { foods: [newFood()] }
}

function getAlts(meal: Meal): MealAlternative[] {
  if (meal.alternatives && meal.alternatives.length > 0) return meal.alternatives
  return [{ foods: meal.foods }]
}

// The meal's real calorie target, inferred from its alternatives — used when
// swapping a recipe so the replacement matches the meal as a whole, not just
// whatever the one alternative being replaced currently happens to show (which
// can be a stale/wrong outlier, e.g. from an earlier bad swap or generation).
// Median is robust against a single alt being off.
function mealTargetCals(meal: Meal): number {
  const totals = getAlts(meal)
    .map(a => a.foods.reduce((s, f) => s + f.calories, 0))
    .filter(t => t > 0)
    .sort((a, b) => a - b)
  if (!totals.length) return 500
  return totals[Math.floor(totals.length / 2)]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── NutritionFoodRow ──────────────────────────────────────────────────────────

interface NutritionFoodRowProps {
  food: Food
  mealIdx: number
  altIdx: number
  foodIdx: number
  updateFood: (mi: number, ai: number, fi: number, field: keyof Food, value: string | number) => void
  removeFood: () => void
}

const UNITS: IngredientUnit[] = ['g', 'stk', 'dl', 'ml', 'ss', 'ts']

function NutritionFoodRow({ food, mealIdx, altIdx, foodIdx, updateFood, removeFood }: NutritionFoodRowProps) {
  const { t } = useLocale()
  const [searching, setSearching] = useState(!food.name)

  const parsedDisplay  = parseAmountDisplay(food.amount_display)
  const initialG       = food.amount ? parseInt(food.amount) || 100 : 100
  const defaultUnit    = parsedDisplay?.unit ?? smartUnitFor(food.name)
  const defaultUnitAmt = parsedDisplay?.unitAmount ?? gramsToUnit(initialG, defaultUnit, food.name)
  // Snap to exact unit multiple on init (e.g. 127g rugbrød → 4 stk = 120g)
  const defaultAmountG = Math.max(1, Math.round(unitToGrams(defaultUnitAmt, defaultUnit, food.name)))

  const [amountG,    setAmountG]    = useState<number>(defaultAmountG)
  const [unit,       setUnit]       = useState<IngredientUnit>(defaultUnit)
  const [unitAmount, setUnitAmount] = useState<number>(defaultUnitAmt)

  // Stable per-100g anchor derived from the original gram amount.
  // Using state so it survives re-renders and updates correctly when a new food is selected.
  const [per100, setPer100] = useState(() => {
    const g = initialG || 100
    return {
      calories:  food.calories  / g * 100,
      protein_g: food.protein_g / g * 100,
      carbs_g:   food.carbs_g   / g * 100,
      fat_g:     food.fat_g     / g * 100,
    }
  })

  function handleFoodSelect(result: FoodSearchResult) {
    const smartUnit  = smartUnitFor(result.name)
    const newUnitAmt = gramsToUnit(amountG, smartUnit, result.name)
    const newG       = smartUnit !== 'g'
      ? Math.max(1, Math.round(unitToGrams(newUnitAmt, smartUnit, result.name)))
      : amountG
    const factor = newG / 100
    setPer100({
      calories:  result.calories_per_100g,
      protein_g: result.protein_per_100g,
      carbs_g:   result.carbs_per_100g,
      fat_g:     result.fat_per_100g,
    })
    if (smartUnit !== 'g') {
      setUnit(smartUnit)
      setUnitAmount(newUnitAmt)
      setAmountG(newG)
      updateFood(mealIdx, altIdx, foodIdx, 'amount_display', `${newUnitAmt} ${smartUnit}`)
    }
    updateFood(mealIdx, altIdx, foodIdx, 'name',      result.name)
    updateFood(mealIdx, altIdx, foodIdx, 'amount',    `${newG}g`)
    updateFood(mealIdx, altIdx, foodIdx, 'protein_g', Math.round(result.protein_per_100g  * factor * 10) / 10)
    updateFood(mealIdx, altIdx, foodIdx, 'carbs_g',   Math.round(result.carbs_per_100g    * factor * 10) / 10)
    updateFood(mealIdx, altIdx, foodIdx, 'fat_g',     Math.round(result.fat_per_100g      * factor * 10) / 10)
    updateFood(mealIdx, altIdx, foodIdx, 'calories',  Math.round(result.calories_per_100g * factor))
    setSearching(false)
  }

  function handleUnitChange(newUnit: IngredientUnit) {
    const raw  = gramsToUnit(amountG, newUnit, food.name)
    const safe = isNaN(raw) ? 1 : Math.max(newUnit === 'stk' ? 1 : 0, raw)
    setUnit(newUnit)
    setUnitAmount(safe)
    if (newUnit !== 'g') updateFood(mealIdx, altIdx, foodIdx, 'amount_display', `${safe} ${newUnit}`)
  }

  function handleUnitAmountChange(raw: number) {
    const safe = isNaN(raw) ? (unit === 'stk' ? 1 : 0.1) : Math.max(unit === 'stk' ? 1 : 0.1, raw)
    const newG = Math.max(1, Math.round(unitToGrams(safe, unit, food.name)))
    const f    = newG / 100
    setUnitAmount(safe)
    setAmountG(newG)
    updateFood(mealIdx, altIdx, foodIdx, 'amount',         `${newG}g`)
    if (unit !== 'g') updateFood(mealIdx, altIdx, foodIdx, 'amount_display', `${safe} ${unit}`)
    updateFood(mealIdx, altIdx, foodIdx, 'calories',       Math.round(per100.calories  * f))
    updateFood(mealIdx, altIdx, foodIdx, 'protein_g',      Math.round(per100.protein_g * f * 10) / 10)
    updateFood(mealIdx, altIdx, foodIdx, 'carbs_g',        Math.round(per100.carbs_g   * f * 10) / 10)
    updateFood(mealIdx, altIdx, foodIdx, 'fat_g',          Math.round(per100.fat_g     * f * 10) / 10)
  }

  function handleGramChange(newG: number) {
    const f      = newG / 100
    const newUA  = gramsToUnit(newG, unit, food.name)
    const safeUA = isNaN(newUA) ? (unit === 'stk' ? 1 : newG) : Math.max(0, newUA)
    setAmountG(newG)
    setUnitAmount(safeUA)
    updateFood(mealIdx, altIdx, foodIdx, 'amount',    `${newG}g`)
    if (unit !== 'g') updateFood(mealIdx, altIdx, foodIdx, 'amount_display', `${safeUA} ${unit}`)
    updateFood(mealIdx, altIdx, foodIdx, 'protein_g', Math.round(per100.protein_g * f * 10) / 10)
    updateFood(mealIdx, altIdx, foodIdx, 'carbs_g',   Math.round(per100.carbs_g   * f * 10) / 10)
    updateFood(mealIdx, altIdx, foodIdx, 'fat_g',     Math.round(per100.fat_g     * f * 10) / 10)
    updateFood(mealIdx, altIdx, foodIdx, 'calories',  Math.round(per100.calories  * f))
  }

  return (
    <div className="mb-2 p-3 bg-gray-50 rounded-lg space-y-2">
      <div className="grid grid-cols-[1fr_130px] gap-2 items-start">
        <div>
          {food.name && !searching ? (
            <div className="flex items-center gap-2 h-8">
              <span className="text-sm font-medium text-gray-800 truncate flex-1">{food.name}</span>
              <button
                onClick={() => setSearching(true)}
                className="text-xs text-[#2d8653] hover:text-[#1a5c3a] flex items-center gap-1 flex-shrink-0"
              >
                <Search className="w-3 h-3" />
                {t('clientDetail.nutrition.foodRow.change')}
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <FoodSearchInput onSelect={handleFoodSelect} placeholder={t('clientDetail.nutrition.foodRow.searchPlaceholder')} />
              {food.name && (
                <button onClick={() => setSearching(false)} className="text-xs text-gray-400 hover:text-gray-600">
                  {t('common.cancel')}
                </button>
              )}
            </div>
          )}
        </div>
        <div>
          <div className="flex gap-1">
            <Input
              type="number"
              value={unit === 'g' ? amountG : (isNaN(unitAmount) ? '' : unitAmount)}
              onChange={e => {
                const raw = parseFloat(e.target.value)
                if (unit === 'g') {
                  handleGramChange(Math.max(0, isNaN(raw) ? 0 : raw))
                } else {
                  handleUnitAmountChange(raw)
                }
              }}
              className="h-8 text-sm min-w-0 flex-1"
              min={unit === 'stk' ? 1 : 0}
              step={unit === 'stk' ? 1 : 0.5}
            />
            <select
              value={unit}
              onChange={e => handleUnitChange(e.target.value as IngredientUnit)}
              className="h-8 text-xs border border-input rounded-md px-1 bg-white flex-shrink-0"
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {unit !== 'g' && (
            <p className="text-[10px] text-gray-400 mt-0.5">≈ {amountG}g</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-600">{t('clientDetail.nutrition.abbrevProtein')} <strong>{food.protein_g.toFixed(1)}</strong>g</span>
          <span className="text-orange-500">{t('clientDetail.nutrition.abbrevCarbs')} <strong>{food.carbs_g.toFixed(1)}</strong>g</span>
          <span className="text-violet-500">{t('clientDetail.nutrition.abbrevFat')} <strong>{food.fat_g.toFixed(1)}</strong>g</span>
          <span className="font-semibold text-gray-600">{food.calories} kcal</span>
        </div>
        <button onClick={removeFood} className="text-gray-300 hover:text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── MacroTargetEditor ─────────────────────────────────────────────────────────
// Shared gram/percent macro-target controls — used both when first configuring
// an AI plan and (via an edit toggle) on an already-set-up plan, so the coach
// can keep adjusting the daily calorie/macro target after meals exist.

interface MacroTargetEditorProps {
  macroMode: 'gram' | 'pct'
  setMacroMode: (m: 'gram' | 'pct') => void
  protein: string
  setProtein: (v: string) => void
  carbs: string
  setCarbs: (v: string) => void
  fat: string
  setFat: (v: string) => void
  caloriesFromGrams: number
  targetKcal: number
  setTargetKcal: (v: number) => void
  proteinPct: number
  setProteinPct: (v: number) => void
  carbsPct: number
  setCarbsPct: (v: number) => void
  fatPct: number
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

function MacroTargetEditor({
  macroMode, setMacroMode, protein, setProtein, carbs, setCarbs, fat, setFat,
  caloriesFromGrams, targetKcal, setTargetKcal, proteinPct, setProteinPct, carbsPct, setCarbsPct, fatPct, t,
}: MacroTargetEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(['gram', 'pct'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMacroMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                macroMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {m === 'gram' ? t('clientDetail.nutrition.gram') : '%'}
            </button>
          ))}
        </div>
      </div>
      {macroMode === 'gram' ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: t('clientDetail.nutrition.protein'), val: protein, set: setProtein, color: 'text-green-600' },
              { label: t('clientDetail.nutrition.carbs'),   val: carbs,   set: setCarbs,   color: 'text-orange-500' },
              { label: t('clientDetail.nutrition.fat'),     val: fat,     set: setFat,     color: 'text-violet-500' },
            ].map(({ label, val, set, color }) => (
              <div key={label}>
                <Label className={`text-xs font-medium block mb-1 ${color}`}>{label} (g)</Label>
                <Input type="number" value={val} onChange={e => set(e.target.value)} min={0} className="h-8 text-sm" />
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-500 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" /> {t('clientDetail.nutrition.calories')}
            </span>
            <span className="font-bold text-gray-900">{caloriesFromGrams} kcal</span>
          </div>
        </>
      ) : (
        <>
          <div>
            <Label className="text-xs text-gray-500 block mb-1">{t('clientDetail.nutrition.totalKcalPerDay')}</Label>
            <div className="flex items-center gap-2">
              <Input type="number" value={targetKcal} min={500} max={6000} onChange={e => setTargetKcal(Number(e.target.value))} className="h-8 text-sm" />
              <span className="text-xs text-gray-400 flex-shrink-0">kcal</span>
            </div>
          </div>
          {[
            { label: t('clientDetail.nutrition.protein'), pct: proteinPct, set: (v: number) => setProteinPct(Math.min(v, 95 - carbsPct)), color: 'bg-green-500', kcalPer: 4 },
            { label: t('clientDetail.nutrition.carbs'),   pct: carbsPct,   set: (v: number) => setCarbsPct(Math.min(v, 95 - proteinPct)), color: 'bg-orange-400', kcalPer: 4 },
            { label: t('clientDetail.nutrition.fat'),     pct: fatPct,     set: null,                                                      color: 'bg-violet-400', kcalPer: 9 },
          ].map(({ label, pct, set, color, kcalPer }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-700">{label}</span>
                <span className="text-xs font-semibold text-gray-600">
                  {pct}% · {Math.round(targetKcal * pct / 100 / kcalPer)}g
                </span>
              </div>
              {set ? (
                <input type="range" min={5} max={70} value={pct} onChange={e => set(Number(e.target.value))} className="w-full h-1.5 accent-[#2d8653]" />
              ) : (
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ── MealDistributionEditor ────────────────────────────────────────────────────
// Shared per-meal calorie-split sliders — used both when first configuring an
// AI plan and (via the same edit toggle as MacroTargetEditor) on an
// already-set-up plan, keyed by whichever meals actually exist in the plan.

interface MealDistributionEditorProps {
  meals: { name: string; emoji: string }[]
  mealSplits: Record<string, number>
  onChange: (mealName: string, pct: number) => void
  onDistributeEqually: () => void
  effectiveCalories: number
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

function MealDistributionEditor({ meals, mealSplits, onChange, onDistributeEqually, effectiveCalories, t }: MealDistributionEditorProps) {
  // Live slider position while dragging, decoupled from the committed value.
  // onChange fires on every pixel of drag, and committing straight through
  // (rescaling every food in the meal + forcing a remount) on each of those
  // ticks made the shown %/kcal race the drag and land on the wrong number.
  // Only commit — and pay for the rescale — once the drag actually ends.
  const [live, setLive] = useState<Record<string, number>>({})

  const totalPct = Math.round(meals.reduce((s, m) => s + (mealSplits[m.name] ?? 0), 0) * 100)
  const splitOk  = Math.abs(totalPct - 100) <= 1

  function commit(name: string, raw: string) {
    if (!(name in live)) return // already committed (e.g. blur firing right after mouseup)
    onChange(name, Number(raw) / 100)
    setLive(prev => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  return (
    <div className="space-y-2">
      {meals.map(m => {
        const pct      = live[m.name] ?? Math.round((mealSplits[m.name] ?? 0) * 100)
        const mealKcal = Math.round(effectiveCalories * (pct / 100))
        return (
          <div key={m.name} className="flex items-center gap-2">
            <span className="text-base w-5 flex-shrink-0 text-center">{m.emoji}</span>
            <span className="text-xs text-gray-600 w-16 flex-shrink-0 truncate">{m.name}</span>
            <input
              type="range" min={1} max={60} value={pct}
              onChange={e => setLive(prev => ({ ...prev, [m.name]: Number(e.target.value) }))}
              onMouseUp={e => commit(m.name, (e.target as HTMLInputElement).value)}
              onTouchEnd={e => commit(m.name, (e.target as HTMLInputElement).value)}
              onKeyUp={e => commit(m.name, (e.target as HTMLInputElement).value)}
              onBlur={e => commit(m.name, (e.target as HTMLInputElement).value)}
              className="flex-1 accent-[#2d8653] h-1.5"
            />
            <span className="text-xs font-medium text-gray-700 w-7 text-right flex-shrink-0">{pct}%</span>
            <span className="text-xs text-[#2d8653] w-14 text-right flex-shrink-0">{mealKcal} kcal</span>
          </div>
        )
      })}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 mt-2">
        <button
          type="button"
          onClick={onDistributeEqually}
          className="text-xs text-[#2d8653] hover:text-[#1a5c3a]"
        >
          {t('clientDetail.nutrition.distributeEqually')}
        </button>
        <span className={`text-xs font-medium ${splitOk ? 'text-green-600' : 'text-red-500'}`}>
          {totalPct}%{splitOk ? ' ✓' : ' ≠ 100'}
        </span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NutritionEditor({ clientId, clientName, coachId, initialPlans, initialFoodLogs, initialFavoriteMeals }: Props) {
  const supabase = createClient()
  const { t } = useLocale()

  // ── Top-level view state ──────────────────────────────────────────────────
  type View = 'list' | 'choose' | 'edit'
  const [view,        setView]        = useState<View>('list')
  const [plans,       setPlans]       = useState<MealPlan[]>(initialPlans)
  const [editingPlan, setEditingPlan] = useState<MealPlan | null>(null)
  const [mode,        setMode]        = useState<'ai' | 'manual'>('manual')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [foodLogs,        setFoodLogs]        = useState<FoodLogEntry[]>(initialFoodLogs)
  const [selectedFoodLog, setSelectedFoodLog] = useState<FoodLogEntry | null>(null)
  const [favoriteMeals] = useState<FavoriteMeal[]>(initialFavoriteMeals)
  const [selectedFavorite, setSelectedFavorite] = useState<FavoriteMeal | null>(null)
  const [showLoggedMeals, setShowLoggedMeals] = useState(false)
  const [showFavorites,   setShowFavorites]   = useState(false)

  // ── Editor state ──────────────────────────────────────────────────────────
  const [title,    setTitle]   = useState(t('clientDetail.nutrition.newPlan'))
  const [protein,  setProtein] = useState('150')
  const [carbs,    setCarbs]   = useState('200')
  const [fat,      setFat]     = useState('80')
  const [meals,    setMeals]   = useState<Meal[]>([])
  const [activeAlt, setActiveAlt] = useState<Record<number, number>>({})
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null)
  const [expandedAlt, setExpandedAlt] = useState<{ mi: number; ai: number } | null>(null)
  const [editingAltName, setEditingAltName] = useState<{ mi: number; ai: number } | null>(null)
  const [editingTargets, setEditingTargets] = useState(false)
  // Bumped per meal-index whenever that meal's foods are rescaled by
  // rescaleMealsToSplits — forces NutritionFoodRow to remount with the new
  // amounts instead of keeping the stale per-100g anchor it captured at mount.
  const [mealRescaleVersion, setMealRescaleVersion] = useState<Record<number, number>>({})
  const [editingMealTabIdx, setEditingMealTabIdx] = useState<number | null>(null)
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [savingTemplate,  setSavingTemplate]  = useState(false)
  const [templateSaved,   setTemplateSaved]   = useState(false)
  const [generating, setGenerating] = useState(false)

  // ── Replace-from-library / new-alternative-from-library modal ─────────────
  const [replaceModal, setReplaceModal] = useState<{
    mi: number; ai: number | null; mealName: string; targetCals: number; pickerMode: 'replace' | 'new'
  } | null>(null)
  const [libraryRecipes,  setLibraryRecipes]  = useState<LibraryRecipe[]>([])
  const [librarySearch,   setLibrarySearch]   = useState('')
  const [libraryLoading,  setLibraryLoading]  = useState(false)

  async function fetchLibraryRecipes(mealName: string): Promise<LibraryRecipe[]> {
    // Recipe library is org-wide (see migration 055) — not just this coach's own recipes.
    // A coach can belong to more than one org (org_members is UNIQUE(org_id, user_id),
    // not per-user), so resolve every org they're in rather than assuming a single row.
    let coachIds = [coachId]
    const { data: memberships } = await supabase.from('org_members').select('org_id').eq('user_id', coachId)
    if (memberships?.length) {
      const orgIds = memberships.map(m => m.org_id)
      const { data: orgMates } = await supabase.from('org_members').select('user_id').in('org_id', orgIds)
      if (orgMates?.length) coachIds = [...new Set(orgMates.map(m => m.user_id))]
    }

    // Standard (seeded) recipes are visible to every coach regardless of
    // org (see migration 065), combined with the org-wide set above.
    // Recipes saved without a meal type ("Ikke valgt" in the recipe editor)
    // have meal_type = null — ilike alone excludes NULL rows, which would
    // silently hide org-shared recipes a coach forgot to tag. Include them.
    const { data } = await supabase
      .from('recipes')
      .select('id,title,instructions,image_url,meal_type,calories_per_serving,protein_per_serving,carbs_per_serving,fat_per_serving,ingredients')
      .or(`coach_id.in.(${coachIds.join(',')}),is_standard.eq.true`)
      .or(`meal_type.ilike.${mealName},meal_type.is.null`)
      .order('title', { ascending: true })
    return (data ?? []) as LibraryRecipe[]
  }

  async function openReplaceModal(mi: number, ai: number, mealName: string, targetCals: number) {
    setReplaceModal({ mi, ai, mealName, targetCals, pickerMode: 'replace' })
    setLibrarySearch('')
    setLibraryLoading(true)
    setLibraryRecipes(await fetchLibraryRecipes(mealName))
    setLibraryLoading(false)
  }

  async function openNewAlternativeModal(mi: number, mealName: string, targetCals: number) {
    setReplaceModal({ mi, ai: null, mealName, targetCals, pickerMode: 'new' })
    setLibrarySearch('')
    setLibraryLoading(true)
    setLibraryRecipes(await fetchLibraryRecipes(mealName))
    setLibraryLoading(false)
  }

  function selectLibraryRecipe(recipe: LibraryRecipe) {
    if (!replaceModal) return
    const { mi, ai, targetCals, pickerMode } = replaceModal
    const newAlt = libraryRecipeToAlt(recipe, targetCals > 0 ? targetCals : 500)

    if (pickerMode === 'replace' && ai !== null) {
      setMeals(prev =>
        prev.map((m, mIdx) => {
          if (mIdx !== mi) return m
          const a2 = getAlts(m).map((a, aIdx) => aIdx !== ai ? a : newAlt as MealAlternative)
          return { ...m, alternatives: a2, foods: a2[0]?.foods ?? [] }
        })
      )
    } else {
      const newAltIdx = getAlts(meals[mi]).length
      setMeals(prev =>
        prev.map((m, mIdx) => {
          if (mIdx !== mi) return m
          const alts = [...getAlts(m), newAlt as MealAlternative]
          return { ...m, alternatives: alts, foods: alts[0]?.foods ?? [] }
        })
      )
      setActiveAlt(prev => ({ ...prev, [mi]: newAltIdx }))
    }
    setReplaceModal(null)
  }

  // Manual-derived
  const manualCalories = calcCalories(Number(protein), Number(carbs), Number(fat))

  // ── AI state ──────────────────────────────────────────────────────────────
  const [days,             setDays]             = useState<7 | 14 | 21>(7)
  const [macroMode,        setMacroMode]        = useState<'gram' | 'pct'>('gram')
  const [targetKcal,       setTargetKcal]       = useState(2000)
  const [proteinPct,       setProteinPct]       = useState(30)
  const [carbsPct,         setCarbsPct]         = useState(40)
  const fatPct = Math.max(0, 100 - proteinPct - carbsPct)
  const caloriesFromGrams  = calcCalories(Number(protein), Number(carbs), Number(fat))
  const effectiveCalories  = macroMode === 'gram' ? caloriesFromGrams : targetKcal
  const effectiveProtein   = macroMode === 'gram' ? Number(protein) : Math.round(targetKcal * proteinPct / 100 / 4)
  const effectiveCarbs     = macroMode === 'gram' ? Number(carbs)   : Math.round(targetKcal * carbsPct   / 100 / 4)
  const effectiveFat       = macroMode === 'gram' ? Number(fat)     : Math.round(targetKcal * fatPct     / 100 / 9)
  const defaultMealNames   = ['Frokost', 'Lunsj', 'Middag']
  const [suggestionsPerMeal, setSuggestionsPerMeal] = useState(3)
  const [selectedMeals, setSelectedMeals] = useState<string[]>(defaultMealNames)
  const [mealSplits, setMealSplits] = useState<Record<string, number>>(
    normaliseSplits(defaultMealNames, Object.fromEntries(defaultMealNames.map(m => [m, 1 / defaultMealNames.length])))
  )
  const [selectedAllergies, setSelectedAllergies] = useState<Set<string>>(new Set())
  const [preferences,       setPreferences]       = useState('')
  const [showAdvanced,      setShowAdvanced]      = useState(false)

  const splitOk = Math.abs(
    Math.round(selectedMeals.reduce((s, m) => s + (mealSplits[m] ?? 0), 0) * 100) - 100
  ) <= 1

  // ── Plan management ───────────────────────────────────────────────────────

  function openPlan(plan: MealPlan) {
    setEditingPlan(plan)
    setTitle(plan.title)
    setProtein(plan.protein_g?.toString() ?? '150')
    setCarbs(plan.carbs_g?.toString() ?? '200')
    setFat(plan.fat_g?.toString() ?? '80')
    setMeals(plan.meals ?? [])
    setActiveAlt({})
    setExpandedMeal((plan.meals?.length ?? 0) > 0 ? 0 : null)
    setError(null)
    setMode('manual')
    setView('edit')
  }

  function startNewPlan() {
    setEditingPlan(null)
    setTitle(t('clientDetail.nutrition.newPlan'))
    setProtein('150')
    setCarbs('200')
    setFat('80')
    setMeals([])
    setActiveAlt({})
    setExpandedMeal(null)
    setError(null)
    setView('choose')
  }

  async function handleSetActive(planId: string) {
    await supabase.from('meal_plans').update({ is_active: false }).eq('client_id', clientId)
    await supabase.from('meal_plans').update({ is_active: true  }).eq('id', planId)
    setPlans(prev => prev.map(p => ({ ...p, is_active: p.id === planId })))
    if (editingPlan) setEditingPlan(prev => prev ? { ...prev, is_active: prev.id === planId } : null)
  }

  async function handleSetInactive(planId: string) {
    await supabase.from('meal_plans').update({ is_active: false }).eq('id', planId)
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, is_active: false } : p))
    if (editingPlan?.id === planId) setEditingPlan(prev => prev ? { ...prev, is_active: false } : null)
  }

  async function handleDeletePlan(planId: string) {
    await supabase.from('meal_plans').delete().eq('id', planId)
    setPlans(prev => prev.filter(p => p.id !== planId))
    setConfirmDeleteId(null)
    if (editingPlan?.id === planId) {
      setEditingPlan(null)
      setView('list')
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const kcal = mode === 'ai' ? effectiveCalories : manualCalories
      const prot = mode === 'ai' ? effectiveProtein  : Number(protein)
      const carb = mode === 'ai' ? effectiveCarbs    : Number(carbs)
      const fat_ = mode === 'ai' ? effectiveFat      : Number(fat)

      const planData = {
        title, client_id: clientId, coach_id: coachId,
        calories_target: kcal, protein_g: prot, carbs_g: carb, fat_g: fat_,
        meals, is_active: editingPlan?.is_active ?? true,
      }

      if (editingPlan?.id) {
        await supabase.from('meal_plans').update(planData).eq('id', editingPlan.id)
        const updated = { ...editingPlan, ...planData }
        setPlans(prev => prev.map(p => p.id === editingPlan.id ? updated : p))
        setEditingPlan(updated)
      } else {
        const { data } = await supabase
          .from('meal_plans')
          .insert({ ...planData, is_active: true })
          .select()
          .single()
        if (data) {
          const newPlan = data as MealPlan
          setPlans(prev => [newPlan, ...prev])
          setEditingPlan(newPlan)
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAsTemplate() {
    setSavingTemplate(true)
    const kcal = mode === 'ai' ? effectiveCalories : manualCalories
    const prot = mode === 'ai' ? effectiveProtein  : Number(protein)
    const carb = mode === 'ai' ? effectiveCarbs    : Number(carbs)
    const fat_ = mode === 'ai' ? effectiveFat      : Number(fat)

    const { error: insertError } = await supabase.from('meal_plans').insert({
      title,
      client_id:       null,
      coach_id:        coachId,
      calories_target: kcal,
      protein_g:       prot,
      carbs_g:         carb,
      fat_g:           fat_,
      meals,
      is_active:       false,
      is_template:     true,
    })

    setSavingTemplate(false)
    if (insertError) {
      console.error('Lagre som mal feilet:', insertError.message, insertError.code)
      setError(t('clientDetail.nutrition.saveTemplateFailed', { error: insertError.message }))
      return
    }
    setTemplateSaved(true)
    setTimeout(() => setTemplateSaved(false), 2000)
  }

  // Auto-save: debounce ~2.5s after any change to title/macros/meals,
  // including the very first change on a brand-new, not-yet-saved plan
  // (handleSave already knows how to insert vs. update). Gated on
  // view === 'edit' so it doesn't fire while merely on the "choose AI or
  // manual" screen, and skips the initial mount so opening an existing plan
  // (which sets these fields from its saved data) doesn't immediately
  // re-save it — only an actual edit starts the debounce. The Lagre
  // button's own label doubles as the auto-save indicator ("Lagrer..." /
  // "Lagret ✓") since it's driven by the same saving/saved state.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSaveRef = useRef(handleSave)
  useEffect(() => { handleSaveRef.current = handleSave })

  // Serializes save calls: if a change fires while a previous save is
  // still in flight (slow network), queue exactly one more run right
  // after it finishes instead of letting two overlapping saves race and
  // have an older, slower one overwrite a newer one with stale data.
  const saveInFlightRef = useRef<Promise<void> | null>(null)
  const saveQueuedRef = useRef(false)
  const runSave = useCallback(function runSaveImpl() {
    if (saveInFlightRef.current) { saveQueuedRef.current = true; return }
    const run = handleSaveRef.current()
    saveInFlightRef.current = run.finally(() => {
      saveInFlightRef.current = null
      if (saveQueuedRef.current) { saveQueuedRef.current = false; runSaveImpl() }
    })
  }, [])

  const isFirstRenderRef = useRef(true)
  useEffect(() => {
    if (isFirstRenderRef.current) { isFirstRenderRef.current = false; return }
    if (view !== 'edit') return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { saveTimerRef.current = null; runSave() }, 2500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, protein, carbs, fat, meals, runSave])

  // Flushes a still-pending debounced save immediately when the coach
  // navigates away (e.g. to a different client), instead of the effect
  // above silently cancelling it on unmount — previously, any edit made
  // in the last ~2.5s before leaving the page was never persisted.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        runSave()
      }
    }
  }, [runSave])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const orderedMeals = MEAL_OPTIONS.filter(m => selectedMeals.includes(m.name)).map(m => m.name)
      const allergyStr   = [...selectedAllergies].map(a => {
        const opt = ALLERGEN_OPTIONS.find(o => o.id === a)
        return opt ? t(opt.labelKey) : a
      }).join(', ')
      const fullPrefs    = [allergyStr, preferences].filter(Boolean).join('. ')

      const res = await fetch('/api/ai/generate-meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calories:              effectiveCalories,
          protein_g:             effectiveProtein,
          carbs_g:               effectiveCarbs,
          fat_g:                 effectiveFat,
          custom_meal_names:     orderedMeals,
          meal_calorie_splits:   normaliseSplits(selectedMeals, mealSplits),
          alternatives_per_meal: suggestionsPerMeal,
          preferences:           fullPrefs || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      if (data.meals) {
        setMeals(data.meals)
        setActiveAlt({})
        setExpandedMeal(0)
      }
    } catch {
      setError(t('clientDetail.nutrition.networkErrorGenerating'))
    } finally {
      setGenerating(false)
    }
  }

  function updateFood(mi: number, ai: number, fi: number, field: keyof Food, value: string | number) {
    setMeals(prev =>
      prev.map((m, mIdx) => {
        if (mIdx !== mi) return m
        const alts = getAlts(m).map((a, aIdx) =>
          aIdx !== ai ? a : {
            ...a,
            foods: a.foods.map((f, fIdx) => fIdx === fi ? { ...f, [field]: value } : f),
          }
        )
        return { ...m, alternatives: alts, foods: alts[0]?.foods ?? [] }
      })
    )
  }

  // Rescales every alternative of the given meal(s) so their actual
  // ingredients hit the new per-meal calorie target implied by `splits`
  // (mealNames === null rescales every meal currently in the plan — used by
  // "distribute equally"). Bumps mealRescaleVersion so the affected
  // NutritionFoodRow instances remount with the freshly scaled amounts.
  function rescaleMealsToSplits(mealNames: string[] | null, splits: Record<string, number>) {
    setMeals(prev => prev.map(m => {
      if (mealNames && !mealNames.includes(m.name)) return m
      const target = Math.round(effectiveCalories * (splits[m.name] ?? 0))
      if (target < 1) return m
      const alts = getAlts(m).map(a => ({ ...a, foods: scaleFoodsToTarget(a.foods, target) }))
      return { ...m, alternatives: alts, foods: alts[0]?.foods ?? [] }
    }))
    setMealRescaleVersion(prev => {
      const next = { ...prev }
      meals.forEach((m, mi) => {
        if (!mealNames || mealNames.includes(m.name)) next[mi] = (next[mi] ?? 0) + 1
      })
      return next
    })
  }

  function addMealOfType(opt: { name: string; time: string }) {
    const idx = meals.length
    setMeals(prev => [...prev, newMeal(opt.name, opt.time)])
    setExpandedMeal(idx)
  }

  function addAlternative(mealIdx: number) {
    const newAltIdx = getAlts(meals[mealIdx]).length
    setMeals(prev => prev.map((m, mi) => {
      if (mi !== mealIdx) return m
      const alts = [...getAlts(m), emptyAlternative()]
      return { ...m, alternatives: alts, foods: alts[0]?.foods ?? [] }
    }))
    setActiveAlt(prev => ({ ...prev, [mealIdx]: newAltIdx }))
  }

  function removeAlternative(mealIdx: number, altIdx: number) {
    setMeals(prev => prev.map((m, mi) => {
      if (mi !== mealIdx) return m
      const alts = getAlts(m).filter((_, ai) => ai !== altIdx)
      if (alts.length === 0) alts.push(emptyAlternative())
      return { ...m, alternatives: alts, foods: alts[0]?.foods ?? [] }
    }))
    setActiveAlt(prev => ({ ...prev, [mealIdx]: 0 }))
    setExpandedAlt(null)
  }

  function deleteMeal(mealIdx: number) {
    setMeals(prev => prev.filter((_, mi) => mi !== mealIdx))
    setExpandedMeal(prev => {
      if (prev === null || prev === mealIdx) return null
      return prev > mealIdx ? prev - 1 : prev
    })
    setActiveAlt(prev => {
      const next: Record<number, number> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const idx = Number(k)
        if (idx === mealIdx) return
        next[idx > mealIdx ? idx - 1 : idx] = v
      })
      return next
    })
    setExpandedAlt(null)
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/clients/${clientId}`} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <p className="text-sm text-gray-500">{clientName}</p>
            <h1 className="text-xl font-bold text-gray-900">{t('clientDetail.nutrition.mealPlans')}</h1>
          </div>
          <Button onClick={startNewPlan}>
            <Plus className="w-4 h-4" />
            {t('clientDetail.nutrition.newPlan')}
          </Button>
        </div>

        {plans.length === 0 ? (
          <Card className="flex items-center justify-center h-64">
            <CardContent className="text-center text-gray-400">
              <PenLine className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p className="font-medium">{t('clientDetail.nutrition.noPlansYet')}</p>
              <p className="text-sm mt-1">{t('clientDetail.nutrition.createPlanFor', { name: clientName })}</p>
              <Button className="mt-4" onClick={startNewPlan}>
                <Plus className="w-4 h-4" />
                {t('clientDetail.nutrition.createPlan')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 max-w-2xl" id="plans-list">
            {plans.map(plan => {
              const mealCount = plan.meals?.length ?? 0
              const altCount  = plan.meals?.[0]?.alternatives?.length ?? 1
              const isConfirming = confirmDeleteId === plan.id

              return (
                <Card
                  key={plan.id}
                  className={`transition-shadow hover:shadow-md ${plan.is_active ? 'border-green-200 bg-green-50/30' : ''}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {plan.is_active && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              {t('clientDetail.nutrition.active')}
                            </span>
                          )}
                          <h3 className="font-semibold text-gray-900 truncate">{plan.title}</h3>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                          {plan.calories_target && (
                            <span className="font-medium text-gray-700">{plan.calories_target} kcal</span>
                          )}
                          {plan.protein_g  && <span className="text-green-600">{plan.protein_g}g {t('clientDetail.nutrition.abbrevProtein')}</span>}
                          {plan.carbs_g    && <span className="text-orange-500">{plan.carbs_g}g {t('clientDetail.nutrition.abbrevCarbs')}</span>}
                          {plan.fat_g      && <span className="text-violet-500">{plan.fat_g}g {t('clientDetail.nutrition.abbrevFat')}</span>}
                          {mealCount > 0   && <span>{t('clientDetail.nutrition.mealsCount', { n: mealCount })}</span>}
                          {altCount  > 1   && <span>{t('clientDetail.nutrition.altsPerMeal', { n: altCount })}</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5">{fmtDate(plan.created_at)}</p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPlan(plan)}
                        className="flex-shrink-0"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        {t('clientDetail.nutrition.editPlan')}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                      {plan.is_active ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetInactive(plan.id)}
                          className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-red-600 hover:border-red-200"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          {t('clientDetail.nutrition.makeInactive')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetActive(plan.id)}
                          className="text-green-700 border-green-200 hover:bg-green-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {t('clientDetail.nutrition.setActive')}
                        </Button>
                      )}

                      {isConfirming ? (
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-xs text-red-600">{t('clientDetail.nutrition.deletePlanConfirm')}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 h-7 px-2 text-xs"
                            onClick={() => handleDeletePlan(plan.id)}
                          >
                            {t('clientDetail.nutrition.yesDelete')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            {t('common.cancel')}
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(plan.id)}
                          className="ml-auto text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* ── Loggede måltider ────────────────────────────────────────────── */}
        <div className="mt-10 max-w-2xl">
          <button
            onClick={() => setShowLoggedMeals(v => !v)}
            className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-3.5 border border-gray-100 hover:border-[#cdeee3] hover:bg-[#ebf5ef] transition-colors"
          >
            <span className="text-sm font-bold text-gray-700">
              {t('clientDetail.nutrition.loggedMeals')}
              <span className="ml-2 text-xs font-semibold text-gray-400">{foodLogs.length}</span>
            </span>
            {showLoggedMeals ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {!showLoggedMeals ? null : foodLogs.length === 0 ? (
            <Card className="mt-3">
              <CardContent className="py-10 text-center text-gray-400 text-sm">
                {t('clientDetail.nutrition.noMealsLoggedYet')}
              </CardContent>
            </Card>
          ) : (() => {
            // Group by date
            const byDate = new Map<string, FoodLogEntry[]>()
            for (const entry of foodLogs) {
              const date = entry.created_at.slice(0, 10)
              if (!byDate.has(date)) byDate.set(date, [])
              byDate.get(date)!.push(entry)
            }
            return (
              <div className="space-y-4 mt-3">
                {Array.from(byDate.entries()).map(([date, entries]) => {
                  const label = new Date(date).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'short' })
                  const dayKcal = entries.reduce((s, e) => s + (e.calories ?? 0), 0)
                  const dayProt = entries.reduce((s, e) => s + (e.protein_g ?? 0), 0)
                  return (
                    <div key={date}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-gray-500 capitalize">{label}</p>
                        <p className="text-xs text-gray-400">{Math.round(dayKcal)} kcal · {Math.round(dayProt)}g {t('clientDetail.nutrition.abbrevProtein')}</p>
                      </div>
                      <div className="space-y-1.5">
                        {entries.map(entry => (
                          <button
                            key={entry.id}
                            onClick={() => setSelectedFoodLog(entry)}
                            className="w-full flex items-center gap-4 bg-white rounded-xl px-4 py-3 text-left hover:bg-[#ebf5ef] transition-colors border border-gray-100 hover:border-[#cdeee3]"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{entry.meal_name}</p>
                              {entry.meal_type && (
                                <p className="text-xs text-gray-400 mt-0.5">{entry.meal_type}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-500">
                              {entry.calories != null && (
                                <span className="font-semibold text-gray-700">{entry.calories} kcal</span>
                              )}
                              {entry.protein_g != null && <span className="text-[#2d8653]">{entry.protein_g}g {t('clientDetail.nutrition.abbrevProtein')}</span>}
                              {entry.carbs_g   != null && <span className="text-yellow-600">{entry.carbs_g}g {t('clientDetail.nutrition.abbrevCarbs')}</span>}
                              {entry.fat_g     != null && <span className="text-orange-500">{entry.fat_g}g {t('clientDetail.nutrition.abbrevFat')}</span>}
                              <span className="text-gray-300">›</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* ── Favorittmåltider ─────────────────────────────────────────────── */}
        <div className="mt-10 max-w-2xl">
          <button
            onClick={() => setShowFavorites(v => !v)}
            className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-3.5 border border-gray-100 hover:border-[#cdeee3] hover:bg-[#ebf5ef] transition-colors"
          >
            <span className="text-sm font-bold text-gray-700">
              {t('clientDetail.nutrition.favoriteMeals')}
              <span className="ml-2 text-xs font-semibold text-gray-400">{favoriteMeals.length}</span>
            </span>
            {showFavorites ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {!showFavorites ? null : favoriteMeals.length === 0 ? (
            <Card className="mt-3">
              <CardContent className="py-10 text-center text-gray-400 text-sm">
                {t('clientDetail.nutrition.noFavoritesYet')}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5 mt-3">
              {favoriteMeals.map(fav => (
                <button
                  key={fav.id}
                  onClick={() => setSelectedFavorite(fav)}
                  className="w-full flex items-center gap-4 bg-white rounded-xl px-4 py-3 text-left hover:bg-[#ebf5ef] transition-colors border border-gray-100 hover:border-[#cdeee3]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{fav.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{fav.meal_type}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">{fav.calories} kcal</span>
                    <span className="text-[#2d8653]">{fav.protein_g}g {t('clientDetail.nutrition.abbrevProtein')}</span>
                    <span className="text-yellow-600">{fav.carbs_g}g {t('clientDetail.nutrition.abbrevCarbs')}</span>
                    <span className="text-orange-500">{fav.fat_g}g {t('clientDetail.nutrition.abbrevFat')}</span>
                    <span className="text-gray-300">›</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      {/* ── Food log detail modal ───────────────────────────────────────────── */}
      {selectedFoodLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setSelectedFoodLog(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900 text-base">{selectedFoodLog.meal_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(selectedFoodLog.created_at).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {selectedFoodLog.meal_type ? ` · ${selectedFoodLog.meal_type}` : ''}
                </p>
              </div>
              <button onClick={() => setSelectedFoodLog(null)} className="text-gray-400 hover:text-gray-600 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-around px-5 py-3 bg-[#ebf5ef]">
              {[
                { label: 'kcal',    val: selectedFoodLog.calories },
                { label: t('clientDetail.nutrition.protein'), val: selectedFoodLog.protein_g != null ? `${selectedFoodLog.protein_g}g` : null },
                { label: t('clientDetail.nutrition.carbs'),   val: selectedFoodLog.carbs_g   != null ? `${selectedFoodLog.carbs_g}g`   : null },
                { label: t('clientDetail.nutrition.fat'),     val: selectedFoodLog.fat_g     != null ? `${selectedFoodLog.fat_g}g`     : null },
              ].map(({ label, val }) => (
                <div key={label} className="text-center">
                  <p className="text-lg font-bold text-[#1a5c3a]">{val ?? '–'}</p>
                  <p className="text-xs text-[#2d8653]">{label}</p>
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {selectedFoodLog.ingredients && selectedFoodLog.ingredients.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('clientDetail.nutrition.ingredients')}</p>
                  <div className="space-y-2">
                    {selectedFoodLog.ingredients.map((ing, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{ing.name}</p>
                          <p className="text-xs text-gray-400">{ing.grams}g</p>
                        </div>
                        <div className="text-right text-xs text-gray-500 space-y-0.5">
                          <p className="font-semibold text-gray-700">{ing.calories} kcal</p>
                          <p>{t('clientDetail.nutrition.abbrevProtein')} {ing.protein_g}g · {t('clientDetail.nutrition.abbrevCarbs')} {ing.carbs_g}g · {t('clientDetail.nutrition.abbrevFat')} {ing.fat_g}g</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">{t('clientDetail.nutrition.noIngredients')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Favorite meal detail modal ──────────────────────────────────────── */}
      {selectedFavorite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setSelectedFavorite(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900 text-base">{selectedFavorite.name}</p>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">{selectedFavorite.meal_type}</p>
              </div>
              <button onClick={() => setSelectedFavorite(null)} className="text-gray-400 hover:text-gray-600 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-around px-5 py-3 bg-[#ebf5ef]">
              {[
                { label: 'kcal',    val: selectedFavorite.calories },
                { label: t('clientDetail.nutrition.protein'), val: `${selectedFavorite.protein_g}g` },
                { label: t('clientDetail.nutrition.carbs'),   val: `${selectedFavorite.carbs_g}g` },
                { label: t('clientDetail.nutrition.fat'),     val: `${selectedFavorite.fat_g}g` },
              ].map(({ label, val }) => (
                <div key={label} className="text-center">
                  <p className="text-lg font-bold text-[#1a5c3a]">{val ?? '–'}</p>
                  <p className="text-xs text-[#2d8653]">{label}</p>
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {selectedFavorite.ingredients && selectedFavorite.ingredients.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('clientDetail.nutrition.ingredients')}</p>
                  <div className="space-y-2">
                    {selectedFavorite.ingredients.map((ing, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{ing.name}</p>
                          <p className="text-xs text-gray-400">{ing.grams}g</p>
                        </div>
                        <div className="text-right text-xs text-gray-500 space-y-0.5">
                          <p className="font-semibold text-gray-700">{ing.calories} kcal</p>
                          <p>{t('clientDetail.nutrition.abbrevProtein')} {ing.protein_g}g · {t('clientDetail.nutrition.abbrevCarbs')} {ing.carbs_g}g · {t('clientDetail.nutrition.abbrevFat')} {ing.fat_g}g</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">{t('clientDetail.nutrition.noIngredients')}</p>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    )
  }

  // ── CHOOSE VIEW ───────────────────────────────────────────────────────────

  if (view === 'choose') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => setView('list')}
            className="text-gray-400 hover:text-gray-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-sm text-gray-500">{clientName}</p>
            <h1 className="text-xl font-bold text-gray-900">{t('clientDetail.nutrition.createPlan')}</h1>
          </div>
        </div>

        <div className="max-w-xl mx-auto mt-8 space-y-4">
          <p className="text-center text-gray-500 text-sm mb-6">
            {t('clientDetail.nutrition.createPlanQuestion')}
          </p>

          <button
            onClick={() => { setMode('ai'); setView('edit') }}
            className="w-full text-left group rounded-2xl border-2 border-[#cdeee3] bg-gradient-to-br from-[#ebf5ef] to-[#ebf5ef] p-6 hover:border-[#6ecfb0] hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#2d8653] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-lg">{t('clientDetail.nutrition.useAi')}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {t('clientDetail.nutrition.useAiDesc')}
                </p>
                <p className="text-xs text-[#2d8653] font-medium mt-2">{t('clientDetail.nutrition.useAiHint')}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => { setMode('manual'); setView('edit') }}
            className="w-full text-left group rounded-2xl border-2 border-gray-100 bg-white p-6 hover:border-gray-300 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <PenLine className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-lg">{t('clientDetail.nutrition.manual')}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {t('clientDetail.nutrition.manualDesc')}
                </p>
                <p className="text-xs text-gray-500 font-medium mt-2">{t('clientDetail.nutrition.manualHint')}</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ── EDIT VIEW ─────────────────────────────────────────────────────────────

  const selectedFoods = (m: Meal, mi: number) => {
    const alts = getAlts(m)
    const idx  = Math.min(activeAlt[mi] ?? 0, alts.length - 1)
    return alts[idx]?.foods ?? []
  }
  const totalCals    = meals.reduce((s, m, mi) => s + selectedFoods(m, mi).reduce((ss, f) => ss + f.calories,   0), 0)
  const totalProtein = meals.reduce((s, m, mi) => s + selectedFoods(m, mi).reduce((ss, f) => ss + f.protein_g, 0), 0)
  const totalCarbs   = meals.reduce((s, m, mi) => s + selectedFoods(m, mi).reduce((ss, f) => ss + f.carbs_g,   0), 0)
  const totalFat     = meals.reduce((s, m, mi) => s + selectedFoods(m, mi).reduce((ss, f) => ss + f.fat_g,     0), 0)

  const targetCals    = mode === 'ai' ? effectiveCalories : manualCalories
  const targetProt    = mode === 'ai' ? effectiveProtein  : Number(protein)
  const targetCarb    = mode === 'ai' ? effectiveCarbs    : Number(carbs)
  const targetFat     = mode === 'ai' ? effectiveFat      : Number(fat)

  // Distinct meals actually in the plan, for the meal-distribution editor —
  // selectedMeals/MEAL_OPTIONS only reflect the pre-generation config, not
  // meals added or loaded afterward.
  const planMealsForSplit = Array.from(new Map(meals.map(m => [m.name, m])).values())
    .map(m => ({ name: m.name, emoji: MEAL_OPTIONS.find(o => o.name === m.name)?.emoji ?? '🍽️' }))

  // mealSplits is never persisted or restored from a loaded plan (it only
  // ever existed to drive AI generation), so any meal the coach hasn't
  // touched THIS session — e.g. "Kveldsmat" — falls back to 0% instead of
  // reflecting its actual share of the plan. Derive the displayed % from
  // the meal's real current calories whenever no explicit edit exists yet.
  const displayMealSplits: Record<string, number> = Object.fromEntries(
    planMealsForSplit.map(pm => {
      if (mealSplits[pm.name] != null) return [pm.name, mealSplits[pm.name]]
      const meal = meals.find(m => m.name === pm.name)
      const kcal = meal ? (getAlts(meal)[0]?.foods.reduce((s, f) => s + f.calories, 0) ?? 0) : 0
      return [pm.name, effectiveCalories > 0 ? kcal / effectiveCalories : 0]
    })
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setView('list')}
          className="text-gray-400 hover:text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <p className="text-sm text-gray-500">{clientName}</p>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('clientDetail.nutrition.planNamePlaceholder')}
            className="text-xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-emerald-200 rounded px-1 -mx-1 w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Switch mode — only visible when configuring (no meals loaded yet) */}
          {meals.length === 0 && (
            <button
              onClick={() => setMode(mode === 'ai' ? 'manual' : 'ai')}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 bg-white"
            >
              {mode === 'ai' ? <PenLine className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              {mode === 'ai' ? t('clientDetail.nutrition.switchToManual') : t('clientDetail.nutrition.switchToAi')}
            </button>
          )}
          {/* Regenerate button when plan is loaded in AI mode */}
          {meals.length > 0 && mode === 'ai' && (
            <button
              onClick={() => { setMeals([]); setExpandedMeal(null) }}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 bg-white"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t('clientDetail.nutrition.regenerate')}
            </button>
          )}

          {/* Delete current plan */}
          {editingPlan && (
            confirmDeleteId === editingPlan.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">{t('clientDetail.nutrition.deletePlanConfirm')}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => handleDeletePlan(editingPlan.id)}
                >
                  {t('clientDetail.nutrition.yesDelete')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                  {t('common.cancel')}
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(editingPlan.id)}
                className="text-sm text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 bg-white"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('clientDetail.nutrition.deletePlan')}
              </button>
            )
          )}

          <button
            onClick={handleSaveAsTemplate}
            disabled={savingTemplate || meals.length === 0}
            className="text-sm font-medium text-[#2d8653] border border-[#cdeee3] bg-[#ebf5ef] hover:bg-[#cdeee3] rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            {templateSaved ? t('clientDetail.nutrition.templateSaved') : savingTemplate ? t('common.saving') : t('clientDetail.nutrition.saveAsTemplate')}
          </button>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saved ? t('clientDetail.nutrition.saved') : saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>

      {meals.length > 0 ? (

        /* ── KAIZO LAYOUT: two-panel view when plan is loaded ──────────── */
        <div className="flex border border-gray-200 rounded-2xl overflow-hidden bg-white" style={{ minHeight: '640px' }}>

          {/* Left: all alternatives */}
          <aside className="w-72 border-r border-gray-100 overflow-y-auto flex-shrink-0 flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('clientDetail.nutrition.allAlternatives')}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('clientDetail.nutrition.totalCount', { n: meals.reduce((s, m) => s + getAlts(m).length, 0) })}
              </p>
            </div>
            {meals.flatMap((meal, mi) =>
              getAlts(meal).map((alt, ai) => {
                const altT = alt as MealAlternative
                const kcal = alt.foods.reduce((s, f) => s + f.calories, 0)
                const prot = alt.foods.reduce((s, f) => s + f.protein_g, 0)
                const carb = alt.foods.reduce((s, f) => s + f.carbs_g, 0)
                const fat  = alt.foods.reduce((s, f) => s + f.fat_g, 0)
                const name = altT.name ?? alt.foods.slice(0, 2).map(f => f.name).join(', ')
                const isSelected = expandedAlt?.mi === mi && expandedAlt?.ai === ai
                return (
                  <button
                    key={`${mi}-${ai}`}
                    onClick={() => {
                      setExpandedMeal(mi)
                      if (isSelected) {
                        setExpandedAlt(null)
                      } else {
                        setExpandedAlt({ mi, ai })
                        setActiveAlt(prev => ({ ...prev, [mi]: ai }))
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-3 border-b border-gray-50 hover:bg-gray-50 text-left transition-colors ${
                      isSelected ? 'bg-[#ebf5ef] border-l-4 border-l-[#2d8653]' : expandedMeal === mi ? 'bg-gray-50/80' : ''
                    }`}
                  >
                    {altT.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={altT.image_url}
                        alt=""
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)]">
                        <Flame className="w-5 h-5 text-white/70" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="text-sm font-semibold text-gray-900 truncate leading-snug">{name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{meal.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {Math.round(kcal)} kcal · P {Math.round(prot)}g K {Math.round(carb)}g F {Math.round(fat)}g
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </aside>

          {/* Right: daily stats + meal tabs + active tab alternatives */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-6 space-y-5">

            {/* Daily macro overview */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-3xl font-bold text-gray-900">{Math.round(totalCals)}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{t('clientDetail.nutrition.kcalPerDay')}</p>
                </div>
                <button
                  onClick={() => setEditingTargets(v => !v)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#2d8653] transition-colors"
                >
                  <span>{t('clientDetail.nutrition.goalKcal', { n: targetCals })}</span>
                  <PenLine className="w-3.5 h-3.5" />
                </button>
              </div>
              {editingTargets && (
                <div className="mb-5 pb-5 border-b border-gray-100">
                  <MacroTargetEditor
                    macroMode={macroMode} setMacroMode={setMacroMode}
                    protein={protein} setProtein={setProtein}
                    carbs={carbs} setCarbs={setCarbs}
                    fat={fat} setFat={setFat}
                    caloriesFromGrams={caloriesFromGrams}
                    targetKcal={targetKcal} setTargetKcal={setTargetKcal}
                    proteinPct={proteinPct} setProteinPct={setProteinPct}
                    carbsPct={carbsPct} setCarbsPct={setCarbsPct}
                    fatPct={fatPct}
                    t={t}
                  />
                  {planMealsForSplit.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        {t('clientDetail.nutrition.mealDistribution')}
                      </p>
                      <MealDistributionEditor
                        meals={planMealsForSplit}
                        mealSplits={displayMealSplits}
                        onChange={(name, pct) => {
                          const next = { ...displayMealSplits, [name]: pct }
                          setMealSplits(next)
                          rescaleMealsToSplits([name], next)
                        }}
                        onDistributeEqually={() => {
                          const names = planMealsForSplit.map(m => m.name)
                          const equal = normaliseSplits(names, Object.fromEntries(names.map(n => [n, 1 / names.length])))
                          setMealSplits(equal)
                          rescaleMealsToSplits(null, equal)
                        }}
                        effectiveCalories={effectiveCalories}
                        t={t}
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-3.5">
                {[
                  { label: t('clientDetail.nutrition.protein'), val: Math.round(totalProtein), target: targetProt, color: 'bg-[#2d8653]',   kcalPer: 4 },
                  { label: t('clientDetail.nutrition.carbs'),   val: Math.round(totalCarbs),   target: targetCarb, color: 'bg-yellow-400', kcalPer: 4 },
                  { label: t('clientDetail.nutrition.fat'),     val: Math.round(totalFat),     target: targetFat,  color: 'bg-orange-400', kcalPer: 9 },
                ].map(({ label, val, target, color, kcalPer }) => {
                  const pct = Math.round(val * kcalPer / Math.max(totalCals, 1) * 100)
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium text-gray-700">{label}</span>
                        <span className="text-gray-500 text-xs">{val}g · {pct}%</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all`}
                          style={{ width: `${Math.min(target > 0 ? (val / target) * 100 : 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Meal tabs — double-click to rename */}
            <div>
              <div className="flex gap-2 mb-4 flex-wrap">
                {meals.map((meal, mi) => {
                  const altCount = getAlts(meal).length
                  const isActive = expandedMeal === mi
                  const isEditingTabName = editingMealTabIdx === mi
                  return (
                    <div
                      key={mi}
                      onClick={() => { if (!isEditingTabName) setExpandedMeal(mi) }}
                      onDoubleClick={() => setEditingMealTabIdx(mi)}
                      className={`flex items-center gap-2 pl-4 pr-2 py-2 rounded-xl text-sm font-medium transition-all border cursor-pointer ${
                        isActive
                          ? 'text-white border-transparent shadow-sm [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)]'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      {isEditingTabName ? (
                        <input
                          autoFocus
                          value={meal.name}
                          onChange={e => setMeals(prev =>
                            prev.map((m, i) => i === mi ? { ...m, name: e.target.value } : m)
                          )}
                          onBlur={() => setEditingMealTabIdx(null)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === 'Escape') setEditingMealTabIdx(null)
                          }}
                          onClick={e => e.stopPropagation()}
                          className={`outline-none bg-transparent font-medium text-sm w-20 border-b ${isActive ? 'text-white border-white/40' : 'text-gray-700 border-gray-400'}`}
                        />
                      ) : (
                        <span title={t('clientDetail.nutrition.doubleClickRename')}>{meal.name}</span>
                      )}
                      <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {altCount}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); deleteMeal(mi) }}
                        title={t('clientDetail.nutrition.deleteMealTooltip')}
                        className={`rounded-full p-0.5 transition-colors ${
                          isActive ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
                {MEAL_OPTIONS.filter(opt => !meals.some(m => m.name === opt.name)).map(opt => (
                  <button
                    key={opt.name}
                    onClick={() => addMealOfType(opt)}
                    title={t('clientDetail.nutrition.addMealPrefix', { name: opt.name })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-dashed border-gray-300 text-gray-400 hover:text-[#2d8653] hover:border-[#2d8653] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {opt.emoji} {opt.name}
                  </button>
                ))}
              </div>

              {/* Recipe alternatives — stacked vertically, one below the other */}
              {expandedMeal !== null && meals[expandedMeal] && (
                <div className="space-y-3">
                  {getAlts(meals[expandedMeal]).map((alt, ai) => {
                    const altT    = alt as MealAlternative
                    const kcal    = alt.foods.reduce((s, f) => s + f.calories, 0)
                    const prot    = alt.foods.reduce((s, f) => s + f.protein_g, 0)
                    const carb    = alt.foods.reduce((s, f) => s + f.carbs_g, 0)
                    const fat     = alt.foods.reduce((s, f) => s + f.fat_g, 0)
                    const altName = altT.name ?? alt.foods.map(f => f.name).join(' + ')
                    const isOpen  = expandedAlt?.mi === expandedMeal && expandedAlt?.ai === ai
                    const isEditingName = editingAltName?.mi === expandedMeal && editingAltName?.ai === ai

                    return (
                      <div key={ai} className={`bg-white rounded-xl overflow-hidden transition-shadow ${isOpen ? 'shadow-md ring-1 ring-[#cdeee3]' : 'shadow-sm hover:shadow-md'}`}>

                        {/* Summary row */}
                        <div
                          className="flex items-center gap-4 p-4 cursor-pointer"
                          onClick={e => {
                            if ((e.target as HTMLElement).closest('input')) return
                            if (isOpen) {
                              setExpandedAlt(null)
                            } else {
                              setExpandedAlt({ mi: expandedMeal!, ai })
                              setActiveAlt(prev => ({ ...prev, [expandedMeal!]: ai }))
                            }
                          }}
                        >
                          {altT.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={altT.image_url}
                              alt=""
                              className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-xl flex-shrink-0 flex items-center justify-center [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)]">
                              <Flame className="w-6 h-6 text-white/70" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              {/* Editable alternative name */}
                              {isEditingName ? (
                                <input
                                  autoFocus
                                  value={altT.name ?? altName}
                                  onChange={e => setMeals(prev =>
                                    prev.map((m, mi2) => {
                                      if (mi2 !== expandedMeal) return m
                                      const a2 = getAlts(m).map((a, ai2) =>
                                        ai2 !== ai ? a : { ...a, name: e.target.value } as MealAlternative
                                      )
                                      return { ...m, alternatives: a2, foods: a2[0]?.foods ?? [] }
                                    })
                                  )}
                                  onBlur={() => setEditingAltName(null)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === 'Escape') setEditingAltName(null)
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  className="font-semibold text-gray-900 border-b-2 border-[#6ecfb0] outline-none bg-transparent flex-1 text-sm leading-snug"
                                />
                              ) : (
                                <p
                                  className="font-semibold text-gray-900 leading-snug flex-1 cursor-text hover:text-[#1a5c3a] transition-colors"
                                  onClick={e => {
                                    e.stopPropagation()
                                    setEditingAltName({ mi: expandedMeal!, ai })
                                    setExpandedAlt({ mi: expandedMeal!, ai })
                                    setActiveAlt(prev => ({ ...prev, [expandedMeal!]: ai }))
                                  }}
                                  title={t('clientDetail.nutrition.clickToRename')}
                                >
                                  {altName}
                                </p>
                              )}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <p className="text-sm font-bold text-gray-700 pt-0.5">{Math.round(kcal)} kcal</p>
                                <button
                                  onClick={e => { e.stopPropagation(); openReplaceModal(expandedMeal!, ai, meals[expandedMeal!].name, mealTargetCals(meals[expandedMeal!])) }}
                                  className="inline-flex items-center gap-1 text-xs text-[#2d8653] hover:text-[#1a5c3a] border border-[#cdeee3] hover:border-[#6ecfb0] bg-[#ebf5ef] hover:bg-[#cdeee3] px-2 py-0.5 rounded-md transition-colors"
                                  title={t('clientDetail.nutrition.swapWithLibraryTooltip')}
                                >
                                  <ArrowLeftRight className="w-3 h-3" />
                                  {t('clientDetail.nutrition.swapOut')}
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); removeAlternative(expandedMeal!, ai) }}
                                  className="text-gray-300 hover:text-red-500"
                                  title={t('clientDetail.nutrition.deleteAlternativeTooltip')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                {isOpen
                                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
                              </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-1 truncate">{alt.foods.map(f => f.name).join(' · ')}</p>
                            <div className="flex items-center gap-2 mt-2.5">
                              <span className="text-xs font-semibold text-[#2d8653] bg-[#ebf5ef] px-2.5 py-1 rounded-full">{t('clientDetail.nutrition.abbrevProtein')} {Math.round(prot)}g</span>
                              <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-full">{t('clientDetail.nutrition.abbrevCarbs')} {Math.round(carb)}g</span>
                              <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">{t('clientDetail.nutrition.abbrevFat')} {Math.round(fat)}g</span>
                            </div>
                          </div>
                        </div>

                        {/* Expanded ingredient editing */}
                        {isOpen && (
                          <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50/50">
                            {alt.foods.map((food, foodIdx) => (
                              <NutritionFoodRow
                                key={`${foodIdx}-${mealRescaleVersion[expandedMeal!] ?? 0}`}
                                food={food}
                                mealIdx={expandedMeal!}
                                altIdx={ai}
                                foodIdx={foodIdx}
                                updateFood={updateFood}
                                removeFood={() => {
                                  setMeals(prev =>
                                    prev.map((m, mi2) => {
                                      if (mi2 !== expandedMeal) return m
                                      const a2 = getAlts(m).map((a, ai2) =>
                                        ai2 !== ai ? a : { ...a, foods: a.foods.filter((_, fi) => fi !== foodIdx) }
                                      )
                                      return { ...m, alternatives: a2, foods: a2[0]?.foods ?? [] }
                                    })
                                  )
                                }}
                              />
                            ))}
                            {altT.recipe && altT.recipe.length > 0 && (
                              <div className="mt-3 mb-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                                <p className="text-xs font-semibold text-amber-800 mb-2">{t('clientDetail.nutrition.method')}</p>
                                <ol className="space-y-1.5">
                                  {altT.recipe.map((step, si) => (
                                    <li key={si} className="flex gap-2 text-sm text-amber-900">
                                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-xs flex items-center justify-center font-medium mt-0.5">
                                        {si + 1}
                                      </span>
                                      <span className="leading-snug">{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                            <Button
                              variant="outline" size="sm" className="mt-2"
                              onClick={() => {
                                setMeals(prev =>
                                  prev.map((m, mi2) => {
                                    if (mi2 !== expandedMeal) return m
                                    const a2 = getAlts(m).map((a, ai2) =>
                                      ai2 !== ai ? a : { ...a, foods: [...a.foods, newFood()] }
                                    )
                                    return { ...m, alternatives: a2, foods: a2[0]?.foods ?? [] }
                                  })
                                )
                              }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {t('clientDetail.nutrition.addFood')}
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <Button
                    variant="outline" size="sm"
                    onClick={() => openNewAlternativeModal(expandedMeal, meals[expandedMeal].name, 500)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('clientDetail.nutrition.newAlternative')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

      ) : (

        /* ── CONFIGURE / GENERATE LAYOUT: grid when no plan loaded yet ──── */
        <div className="grid grid-cols-[340px_1fr] gap-6 items-start">

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        {mode === 'ai' ? (

          /* AI panel */
          <div className="space-y-3">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label className="text-xs text-gray-500 block mb-1">{t('clientDetail.nutrition.planNamePlaceholder')}</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 block mb-1.5">{t('clientDetail.nutrition.days')}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {DAY_OPTIONS.map(d => (
                      <button
                        key={d}
                        onClick={() => setDays(d)}
                        className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                          days === d
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {t('clientDetail.nutrition.daysOption', { n: d })}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-0 pt-4 px-4">
                <CardTitle className="text-sm">{t('clientDetail.nutrition.mealSuggestions')}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-3 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {MEAL_OPTIONS.map(m => {
                    const sel = selectedMeals.includes(m.name)
                    return (
                      <button
                        key={m.name}
                        onClick={() => {
                          if (sel) {
                            const next = selectedMeals.filter(n => n !== m.name)
                            setSelectedMeals(next)
                            setMealSplits(prev => {
                              const { [m.name]: _, ...rest } = prev
                              return normaliseSplits(next, rest)
                            })
                          } else {
                            const next = [...selectedMeals, m.name]
                            setSelectedMeals(next)
                            setMealSplits(prev => {
                              const share = 1 / next.length
                              const scaled = Object.fromEntries(
                                selectedMeals.map(n => [n, (prev[n] ?? 0) * (1 - share)])
                              )
                              return { ...scaled, [m.name]: share }
                            })
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          sel
                            ? 'bg-[#2d8653] text-white border-[#2d8653] shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#6ecfb0] hover:text-[#2d8653]'
                        }`}
                      >
                        <span>{m.emoji}</span>
                        {m.name}
                      </button>
                    )
                  })}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-gray-500">{t('clientDetail.nutrition.suggestionsPerMeal')}</Label>
                    <span className="text-sm font-bold text-gray-900">{suggestionsPerMeal}</span>
                  </div>
                  <input
                    type="range" min={2} max={10} step={1} value={suggestionsPerMeal}
                    onChange={e => setSuggestionsPerMeal(Number(e.target.value))}
                    className="w-full accent-[#2d8653] h-1.5"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>2</span><span>10</span>
                  </div>
                </div>

                {selectedMeals.length > 0 && (
                  <div className="flex items-center justify-between bg-[#ebf5ef] rounded-xl px-4 py-3">
                    <div>
                      <p className="text-xs text-[#2d8653] font-medium">{t('clientDetail.nutrition.totalRecipes')}</p>
                      <p className="text-xs text-[#6ecfb0] mt-0.5">
                        {t('clientDetail.nutrition.mealsTimesSuggestions', { meals: selectedMeals.length, sugg: suggestionsPerMeal })}
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-[#1a5c3a]">
                      {selectedMeals.length * suggestionsPerMeal}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-0 pt-4 px-4">
                <CardTitle className="text-sm">{t('clientDetail.nutrition.dailyMacroTargets')}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-3">
                <MacroTargetEditor
                  macroMode={macroMode} setMacroMode={setMacroMode}
                  protein={protein} setProtein={setProtein}
                  carbs={carbs} setCarbs={setCarbs}
                  fat={fat} setFat={setFat}
                  caloriesFromGrams={caloriesFromGrams}
                  targetKcal={targetKcal} setTargetKcal={setTargetKcal}
                  proteinPct={proteinPct} setProteinPct={setProteinPct}
                  carbsPct={carbsPct} setCarbsPct={setCarbsPct}
                  fatPct={fatPct}
                  t={t}
                />
              </CardContent>
            </Card>

            {selectedMeals.length > 0 && (
              <Card>
                <CardHeader className="pb-0 pt-4 px-4">
                  <CardTitle className="text-sm">{t('clientDetail.nutrition.mealDistribution')}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-3">
                  <MealDistributionEditor
                    meals={MEAL_OPTIONS.filter(m => selectedMeals.includes(m.name))}
                    mealSplits={mealSplits}
                    onChange={(name, pct) => setMealSplits(prev => ({ ...prev, [name]: pct }))}
                    onDistributeEqually={() => setMealSplits(normaliseSplits(
                      selectedMeals,
                      Object.fromEntries(selectedMeals.map(m => [m, 1 / selectedMeals.length]))
                    ))}
                    effectiveCalories={effectiveCalories}
                    t={t}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-0 pt-4 px-4">
                <CardTitle className="text-sm">{t('clientDetail.nutrition.allergiesRestrictions')}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-3">
                <div className="flex flex-wrap gap-2">
                  {ALLERGEN_OPTIONS.map(a => {
                    const active = selectedAllergies.has(a.id)
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAllergies(prev => {
                          const next = new Set(prev)
                          if (active) next.delete(a.id); else next.add(a.id)
                          return next
                        })}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          active
                            ? 'bg-red-50 text-red-700 border-red-300'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {t(a.labelKey)}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => setShowAdvanced(a => !a)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>{t('clientDetail.nutrition.advancedSettings')}</span>
                {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showAdvanced && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="mt-3">
                    <Label className="text-xs text-gray-500 block mb-1">{t('clientDetail.nutrition.extraPreferences')}</Label>
                    <Input value={preferences} onChange={e => setPreferences(e.target.value)} placeholder={t('clientDetail.nutrition.preferencesPlaceholder')} className="text-sm" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 pb-4">
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}
              <Button
                className="w-full bg-[#2d8653] hover:bg-[#1a5c3a] h-11 text-base"
                onClick={handleGenerate}
                disabled={generating || selectedMeals.length === 0 || !splitOk}
              >
                <Sparkles className="w-4 h-4" />
                {generating ? t('clientDetail.nutrition.generating') : t('clientDetail.nutrition.generateWithAi')}
              </Button>
              {generating && (
                <p className="text-xs text-[#2d8653] text-center">
                  {t('clientDetail.nutrition.generatingEta', { sugg: suggestionsPerMeal, meals: selectedMeals.length, sec: selectedMeals.length * 5 })}
                </p>
              )}
            </div>
          </div>

        ) : (

          /* Manual panel */
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <Label>{t('clientDetail.nutrition.planNameLabel')}</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('clientDetail.nutrition.dailyMacroTargets')}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">{t('clientDetail.nutrition.protein')} (g)</Label>
                    <Input type="number" value={protein} onChange={e => setProtein(e.target.value)} className="mt-1" min={0} />
                  </div>
                  <div>
                    <Label className="text-xs">{t('clientDetail.nutrition.carbs')} (g)</Label>
                    <Input type="number" value={carbs} onChange={e => setCarbs(e.target.value)} className="mt-1" min={0} />
                  </div>
                  <div>
                    <Label className="text-xs">{t('clientDetail.nutrition.fat')} (g)</Label>
                    <Input type="number" value={fat} onChange={e => setFat(e.target.value)} className="mt-1" min={0} />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                  <span className="text-gray-500">{t('clientDetail.nutrition.caloriesCalculated')}</span>
                  <span className="font-semibold">{manualCalories} kcal</span>
                </div>
              </CardContent>
            </Card>

            {meals.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{t('clientDetail.nutrition.totalPerDay')}</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-2">
                    {[
                      { label: t('clientDetail.nutrition.calories'), val: totalCals,    target: targetCals, unit: 'kcal' },
                      { label: t('clientDetail.nutrition.protein'),  val: totalProtein, target: targetProt, unit: 'g' },
                      { label: t('clientDetail.nutrition.carbs'),    val: totalCarbs,   target: targetCarb, unit: 'g' },
                      { label: t('clientDetail.nutrition.fat'),      val: totalFat,     target: targetFat,  unit: 'g' },
                    ].map(({ label, val, target, unit }) => {
                      const pct     = Math.min(val / Math.max(target, 1) * 100, 100)
                      const over    = val / target > 1.05
                      return (
                        <div key={label}>
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>{label}</span>
                            <span>{Math.round(val)} / {target} {unit}</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : 'bg-[#2d8653]'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Right panel: meals ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="flex items-center justify-center h-64">
            <CardContent className="text-center text-gray-400">
              {mode === 'ai' ? (
                <>
                  <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  <p className="font-medium">{t('clientDetail.nutrition.noMealPlanYet')}</p>
                  <p className="text-sm mt-1">{t('clientDetail.nutrition.configureAndGenerate')}</p>
                </>
              ) : (
                <>
                  <PenLine className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  <p className="font-medium">{t('clientDetail.nutrition.noMealsYet')}</p>
                  <p className="text-sm mt-1">{t('clientDetail.nutrition.addMealsManually')}</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {MEAL_OPTIONS.map(opt => (
                      <Button key={opt.name} variant="outline" size="sm" onClick={() => addMealOfType(opt)}>
                        <Plus className="w-3.5 h-3.5" />
                        {opt.emoji} {opt.name}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      )} {/* end meals.length > 0 ternary */}

      {/* ── Replace-from-library modal ───────────────────────────────────── */}
      {replaceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setReplaceModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="font-semibold text-gray-900">
                  {replaceModal.pickerMode === 'new' ? t('clientDetail.nutrition.newAlternativeModalTitle') : t('clientDetail.nutrition.replaceAlternativeModalTitle')}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('clientDetail.nutrition.pickFromLibrary', { meal: replaceModal.mealName })}
                </p>
              </div>
              <button onClick={() => setReplaceModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  value={librarySearch}
                  onChange={e => setLibrarySearch(e.target.value)}
                  placeholder={t('clientDetail.nutrition.searchRecipePlaceholder')}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
                />
              </div>
              {replaceModal.pickerMode === 'new' && (
                <button
                  onClick={() => { addAlternative(replaceModal.mi); setReplaceModal(null) }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-gray-500 border border-dashed border-gray-300 rounded-lg hover:text-[#2d8653] hover:border-[#2d8653] transition-colors"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  {t('clientDetail.nutrition.startBlankInstead')}
                </button>
              )}
            </div>

            {/* Recipe list */}
            <div className="flex-1 overflow-y-auto">
              {libraryLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                  {t('clientDetail.nutrition.loadingRecipes')}
                </div>
              ) : (() => {
                const q = librarySearch.toLowerCase()
                const filtered = q
                  ? libraryRecipes.filter(r => r.title.toLowerCase().includes(q))
                  : libraryRecipes
                return filtered.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                    {librarySearch ? t('clientDetail.nutrition.noRecipesMatchSearch') : t('clientDetail.nutrition.noRecipesInLibrary', { meal: replaceModal.mealName })}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filtered.map(recipe => {
                      const scaledCals = Math.round((recipe.calories_per_serving ?? 0) * (replaceModal.targetCals / Math.max(recipe.calories_per_serving ?? 500, 1)))
                      return (
                        <button
                          key={recipe.id}
                          onClick={() => selectLibraryRecipe(recipe)}
                          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#ebf5ef] text-left transition-colors"
                        >
                          {recipe.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={recipe.image_url}
                              alt=""
                              className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)]">
                              <Flame className="w-5 h-5 text-white/70" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm leading-snug">{recipe.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {t('clientDetail.nutrition.scaledKcal', { orig: Math.round(recipe.calories_per_serving ?? 0), scaled: scaledCals })}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-[#2d8653]">{t('clientDetail.nutrition.abbrevProtein')} {Math.round(recipe.protein_per_serving ?? 0)}g</span>
                              <span className="text-xs text-yellow-600">{t('clientDetail.nutrition.abbrevCarbs')} {Math.round(recipe.carbs_per_serving ?? 0)}g</span>
                              <span className="text-xs text-orange-600">{t('clientDetail.nutrition.abbrevFat')} {Math.round(recipe.fat_per_serving ?? 0)}g</span>
                            </div>
                          </div>
                          <ArrowLeftRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
