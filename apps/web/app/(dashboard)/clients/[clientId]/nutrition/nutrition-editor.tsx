'use client'

import { useState, useRef, useEffect } from 'react'
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

interface Props {
  clientId: string
  clientName: string
  coachId: string
  initialPlans: MealPlan[]
  initialFoodLogs: FoodLogEntry[]
}

// ── Library recipe types (for replace modal) ──────────────────────────────────

interface LibraryIngredient {
  name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
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

  const foods: Food[] = ings.map(ing => ({
    name:      ing.name,
    amount:    `${Math.max(1, Math.round((ing.grams ?? 0) * scale))}g`,
    calories:  Math.round((ing.calories ?? 0) * scale),
    protein_g: Math.round((ing.protein  ?? 0) * scale * 10) / 10,
    carbs_g:   Math.round((ing.carbs    ?? 0) * scale * 10) / 10,
    fat_g:     Math.round((ing.fat      ?? 0) * scale * 10) / 10,
  }))

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

const ALLERGEN_OPTIONS = [
  { id: 'glutenfri',    label: 'Glutenfri' },
  { id: 'melkefri',    label: 'Melkefri' },
  { id: 'laktosefri',  label: 'Laktosefri' },
  { id: 'nøttefri',   label: 'Nøttefri' },
  { id: 'eggfri',      label: 'Eggfri' },
  { id: 'skalldyrfri', label: 'Skalldyrfri' },
  { id: 'uten-fisk',   label: 'Uten fisk' },
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

function newMeal(name: string, time: string): Meal {
  return { name, time, foods: [newFood()], alternatives: [{ foods: [newFood()] }] }
}

function getAlts(meal: Meal): MealAlternative[] {
  if (meal.alternatives && meal.alternatives.length > 0) return meal.alternatives
  return [{ foods: meal.foods }]
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
                Endre
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <FoodSearchInput onSelect={handleFoodSelect} placeholder="Søk i Matvaretabellen..." />
              {food.name && (
                <button onClick={() => setSearching(false)} className="text-xs text-gray-400 hover:text-gray-600">
                  Avbryt
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
          <span className="text-green-600">P <strong>{food.protein_g.toFixed(1)}</strong>g</span>
          <span className="text-orange-500">K <strong>{food.carbs_g.toFixed(1)}</strong>g</span>
          <span className="text-violet-500">F <strong>{food.fat_g.toFixed(1)}</strong>g</span>
          <span className="font-semibold text-gray-600">{food.calories} kcal</span>
        </div>
        <button onClick={removeFood} className="text-gray-300 hover:text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NutritionEditor({ clientId, clientName, coachId, initialPlans, initialFoodLogs }: Props) {
  const supabase = createClient()

  // ── Top-level view state ──────────────────────────────────────────────────
  type View = 'list' | 'choose' | 'edit'
  const [view,        setView]        = useState<View>('list')
  const [plans,       setPlans]       = useState<MealPlan[]>(initialPlans)
  const [editingPlan, setEditingPlan] = useState<MealPlan | null>(null)
  const [mode,        setMode]        = useState<'ai' | 'manual'>('manual')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [foodLogs,        setFoodLogs]        = useState<FoodLogEntry[]>(initialFoodLogs)
  const [selectedFoodLog, setSelectedFoodLog] = useState<FoodLogEntry | null>(null)

  // ── Editor state ──────────────────────────────────────────────────────────
  const [title,    setTitle]   = useState('Ny matplan')
  const [protein,  setProtein] = useState('150')
  const [carbs,    setCarbs]   = useState('200')
  const [fat,      setFat]     = useState('80')
  const [meals,    setMeals]   = useState<Meal[]>([])
  const [activeAlt, setActiveAlt] = useState<Record<number, number>>({})
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null)
  const [editingMealNameIdx, setEditingMealNameIdx] = useState<number | null>(null)
  const [expandedAlt, setExpandedAlt] = useState<{ mi: number; ai: number } | null>(null)
  const [editingAltName, setEditingAltName] = useState<{ mi: number; ai: number } | null>(null)
  const [editingMealTabIdx, setEditingMealTabIdx] = useState<number | null>(null)
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [savingTemplate,  setSavingTemplate]  = useState(false)
  const [templateSaved,   setTemplateSaved]   = useState(false)
  const [generating, setGenerating] = useState(false)

  // ── Replace-from-library modal ────────────────────────────────────────────
  const [replaceModal,    setReplaceModal]    = useState<{ mi: number; ai: number; mealName: string; targetCals: number } | null>(null)
  const [libraryRecipes,  setLibraryRecipes]  = useState<LibraryRecipe[]>([])
  const [librarySearch,   setLibrarySearch]   = useState('')
  const [libraryLoading,  setLibraryLoading]  = useState(false)

  async function openReplaceModal(mi: number, ai: number, mealName: string, targetCals: number) {
    setReplaceModal({ mi, ai, mealName, targetCals })
    setLibrarySearch('')
    setLibraryLoading(true)

    // Recipe library is org-wide (see migration 055) — not just this coach's own recipes
    let coachIds = [coachId]
    const { data: membership } = await supabase.from('org_members').select('org_id').eq('user_id', coachId).single()
    if (membership) {
      const { data: orgMates } = await supabase.from('org_members').select('user_id').eq('org_id', membership.org_id)
      if (orgMates?.length) coachIds = orgMates.map(m => m.user_id)
    }

    const { data } = await supabase
      .from('recipes')
      .select('id,title,instructions,image_url,meal_type,calories_per_serving,protein_per_serving,carbs_per_serving,fat_per_serving,ingredients')
      .in('coach_id', coachIds)
      .ilike('meal_type', mealName)
      .order('title', { ascending: true })
    setLibraryRecipes((data ?? []) as LibraryRecipe[])
    setLibraryLoading(false)
  }

  function replaceAlternative(recipe: LibraryRecipe) {
    if (!replaceModal) return
    const { mi, ai, targetCals } = replaceModal
    const newAlt = libraryRecipeToAlt(recipe, targetCals > 0 ? targetCals : 500)
    setMeals(prev =>
      prev.map((m, mIdx) => {
        if (mIdx !== mi) return m
        const a2 = getAlts(m).map((a, aIdx) => aIdx !== ai ? a : newAlt as MealAlternative)
        return { ...m, alternatives: a2, foods: a2[0]?.foods ?? [] }
      })
    )
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
    setEditingMealNameIdx(null)
    setError(null)
    setMode('manual')
    setView('edit')
  }

  function startNewPlan() {
    setEditingPlan(null)
    setTitle('Ny matplan')
    setProtein('150')
    setCarbs('200')
    setFat('80')
    setMeals([])
    setActiveAlt({})
    setExpandedMeal(null)
    setEditingMealNameIdx(null)
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
      setError('Kunne ikke lagre mal: ' + insertError.message)
      return
    }
    setTemplateSaved(true)
    setTimeout(() => setTemplateSaved(false), 2000)
  }

  // Auto-save: debounce 1.5s after any meals change when editing an existing plan
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!editingPlan?.id || meals.length === 0) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { handleSaveRef.current() }, 1500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [meals]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const orderedMeals = MEAL_OPTIONS.filter(m => selectedMeals.includes(m.name)).map(m => m.name)
      const allergyStr   = [...selectedAllergies].map(a => ALLERGEN_OPTIONS.find(o => o.id === a)?.label ?? a).join(', ')
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
      setError('Nettverksfeil ved AI-generering')
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
            <h1 className="text-xl font-bold text-gray-900">Matplaner</h1>
          </div>
          <Button onClick={startNewPlan}>
            <Plus className="w-4 h-4" />
            Ny matplan
          </Button>
        </div>

        {plans.length === 0 ? (
          <Card className="flex items-center justify-center h-64">
            <CardContent className="text-center text-gray-400">
              <PenLine className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p className="font-medium">Ingen matplaner ennå</p>
              <p className="text-sm mt-1">Opprett en matplan for {clientName}</p>
              <Button className="mt-4" onClick={startNewPlan}>
                <Plus className="w-4 h-4" />
                Opprett matplan
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
                              Aktiv
                            </span>
                          )}
                          <h3 className="font-semibold text-gray-900 truncate">{plan.title}</h3>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                          {plan.calories_target && (
                            <span className="font-medium text-gray-700">{plan.calories_target} kcal</span>
                          )}
                          {plan.protein_g  && <span className="text-green-600">{plan.protein_g}g P</span>}
                          {plan.carbs_g    && <span className="text-orange-500">{plan.carbs_g}g K</span>}
                          {plan.fat_g      && <span className="text-violet-500">{plan.fat_g}g F</span>}
                          {mealCount > 0   && <span>{mealCount} måltider</span>}
                          {altCount  > 1   && <span>{altCount} alt. per måltid</span>}
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
                        Rediger
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
                          Gjør inaktiv
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetActive(plan.id)}
                          className="text-green-700 border-green-200 hover:bg-green-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Sett aktiv
                        </Button>
                      )}

                      {isConfirming ? (
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-xs text-red-600">Slett denne planen?</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 h-7 px-2 text-xs"
                            onClick={() => handleDeletePlan(plan.id)}
                          >
                            Ja, slett
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Avbryt
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(plan.id)}
                          className="ml-auto text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Slett
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
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
            Loggede måltider
          </h2>

          {foodLogs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-gray-400 text-sm">
                Ingen måltider logget ennå
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
              <div className="space-y-4">
                {Array.from(byDate.entries()).map(([date, entries]) => {
                  const label = new Date(date).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'short' })
                  const dayKcal = entries.reduce((s, e) => s + (e.calories ?? 0), 0)
                  const dayProt = entries.reduce((s, e) => s + (e.protein_g ?? 0), 0)
                  return (
                    <div key={date}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-gray-500 capitalize">{label}</p>
                        <p className="text-xs text-gray-400">{Math.round(dayKcal)} kcal · {Math.round(dayProt)}g P</p>
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
                              {entry.protein_g != null && <span className="text-[#2d8653]">{entry.protein_g}g P</span>}
                              {entry.carbs_g   != null && <span className="text-yellow-600">{entry.carbs_g}g K</span>}
                              {entry.fat_g     != null && <span className="text-orange-500">{entry.fat_g}g F</span>}
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
                { label: 'Protein', val: selectedFoodLog.protein_g != null ? `${selectedFoodLog.protein_g}g` : null },
                { label: 'Karbo',   val: selectedFoodLog.carbs_g   != null ? `${selectedFoodLog.carbs_g}g`   : null },
                { label: 'Fett',    val: selectedFoodLog.fat_g     != null ? `${selectedFoodLog.fat_g}g`     : null },
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
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ingredienser</p>
                  <div className="space-y-2">
                    {selectedFoodLog.ingredients.map((ing, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{ing.name}</p>
                          <p className="text-xs text-gray-400">{ing.grams}g</p>
                        </div>
                        <div className="text-right text-xs text-gray-500 space-y-0.5">
                          <p className="font-semibold text-gray-700">{ing.calories} kcal</p>
                          <p>P {ing.protein_g}g · K {ing.carbs_g}g · F {ing.fat_g}g</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">Ingen ingredienser registrert</p>
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
            <h1 className="text-xl font-bold text-gray-900">Opprett matplan</h1>
          </div>
        </div>

        <div className="max-w-xl mx-auto mt-8 space-y-4">
          <p className="text-center text-gray-500 text-sm mb-6">
            Hvordan vil du opprette matplanen?
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
                <p className="font-semibold text-gray-900 text-lg">Bruk AI</p>
                <p className="text-sm text-gray-600 mt-1">
                  AI genererer en komplett matplan med flere alternativer per måltid basert på makromål, preferanser og allergier.
                </p>
                <p className="text-xs text-[#2d8653] font-medium mt-2">Rask og automatisk → du justerer etterpå</p>
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
                <p className="font-semibold text-gray-900 text-lg">Lag manuelt</p>
                <p className="text-sm text-gray-600 mt-1">
                  Legg til måltider og matvarer selv — full kontroll over innhold, gram og næringsinnhold.
                </p>
                <p className="text-xs text-gray-500 font-medium mt-2">Total kontroll → ideelt for spesifikke kostplaner</p>
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
            placeholder="Navn på plan"
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
              {mode === 'ai' ? 'Bytt til manuell' : 'Bytt til AI'}
            </button>
          )}
          {/* Regenerate button when plan is loaded in AI mode */}
          {meals.length > 0 && mode === 'ai' && (
            <button
              onClick={() => { setMeals([]); setExpandedMeal(null) }}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 bg-white"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Regenerer
            </button>
          )}

          {/* Delete current plan */}
          {editingPlan && (
            confirmDeleteId === editingPlan.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">Slett denne planen?</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => handleDeletePlan(editingPlan.id)}
                >
                  Ja, slett
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                  Avbryt
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(editingPlan.id)}
                className="text-sm text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 bg-white"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Slett plan
              </button>
            )
          )}

          <button
            onClick={handleSaveAsTemplate}
            disabled={savingTemplate || meals.length === 0}
            className="text-sm font-medium text-[#2d8653] border border-[#cdeee3] bg-[#ebf5ef] hover:bg-[#cdeee3] rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            {templateSaved ? 'Mal lagret ✓' : savingTemplate ? 'Lagrer...' : 'Lagre som mal'}
          </button>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saved ? 'Lagret!' : saving ? 'Lagrer...' : 'Lagre'}
          </Button>
        </div>
      </div>

      {meals.length > 0 ? (

        /* ── KAIZO LAYOUT: two-panel view when plan is loaded ──────────── */
        <div className="flex border border-gray-200 rounded-2xl overflow-hidden bg-white" style={{ minHeight: '640px' }}>

          {/* Left: all alternatives */}
          <aside className="w-72 border-r border-gray-100 overflow-y-auto flex-shrink-0 flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Alle alternativer</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {meals.reduce((s, m) => s + getAlts(m).length, 0)} totalt
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
                      setExpandedAlt(isSelected ? null : { mi, ai })
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
                  <p className="text-sm text-gray-400 mt-0.5">kcal per dag</p>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>Mål: {targetCals} kcal</p>
                </div>
              </div>
              <div className="space-y-3.5">
                {[
                  { label: 'Protein', val: Math.round(totalProtein), target: targetProt, color: 'bg-[#2d8653]',   kcalPer: 4 },
                  { label: 'Karbo',   val: Math.round(totalCarbs),   target: targetCarb, color: 'bg-yellow-400', kcalPer: 4 },
                  { label: 'Fett',    val: Math.round(totalFat),     target: targetFat,  color: 'bg-orange-400', kcalPer: 9 },
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
                    <button
                      key={mi}
                      onClick={() => { if (!isEditingTabName) setExpandedMeal(mi) }}
                      onDoubleClick={() => setEditingMealTabIdx(mi)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
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
                        <span title="Dobbeltklikk for å endre navn">{meal.name}</span>
                      )}
                      <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {altCount}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Active meal alternatives — click to expand/edit */}
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
                            setExpandedAlt(isOpen ? null : { mi: expandedMeal!, ai })
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
                                  }}
                                  title="Klikk for å endre navn"
                                >
                                  {altName}
                                </p>
                              )}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <p className="text-sm font-bold text-gray-700 pt-0.5">{Math.round(kcal)} kcal</p>
                                <button
                                  onClick={e => { e.stopPropagation(); openReplaceModal(expandedMeal!, ai, meals[expandedMeal!].name, kcal > 0 ? kcal : 500) }}
                                  className="inline-flex items-center gap-1 text-xs text-[#2d8653] hover:text-[#1a5c3a] border border-[#cdeee3] hover:border-[#6ecfb0] bg-[#ebf5ef] hover:bg-[#cdeee3] px-2 py-0.5 rounded-md transition-colors"
                                  title="Bytt ut med oppskrift fra biblioteket"
                                >
                                  <ArrowLeftRight className="w-3 h-3" />
                                  Bytt ut
                                </button>
                                {isOpen
                                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
                              </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-1 truncate">{alt.foods.map(f => f.name).join(' · ')}</p>
                            <div className="flex items-center gap-2 mt-2.5">
                              <span className="text-xs font-semibold text-[#2d8653] bg-[#ebf5ef] px-2.5 py-1 rounded-full">P {Math.round(prot)}g</span>
                              <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-full">K {Math.round(carb)}g</span>
                              <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">F {Math.round(fat)}g</span>
                            </div>
                          </div>
                        </div>

                        {/* Expanded ingredient editing */}
                        {isOpen && (
                          <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50/50">
                            {alt.foods.map((food, foodIdx) => (
                              <NutritionFoodRow
                                key={foodIdx}
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
                                <p className="text-xs font-semibold text-amber-800 mb-2">Fremgangsmåte</p>
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
                              Legg til matvare
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
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
                  <Label className="text-xs text-gray-500 block mb-1">Navn på plan</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 block mb-1.5">Antall dager</Label>
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
                        {d} dager
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-0 pt-4 px-4">
                <CardTitle className="text-sm">Måltidsforslag</CardTitle>
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
                    <Label className="text-xs text-gray-500">Forslag per måltid</Label>
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
                      <p className="text-xs text-[#2d8653] font-medium">Totalt oppskrifter</p>
                      <p className="text-xs text-[#6ecfb0] mt-0.5">
                        {selectedMeals.length} måltider × {suggestionsPerMeal} forslag
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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Makromål per dag</CardTitle>
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    {(['gram', 'pct'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setMacroMode(m)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          macroMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {m === 'gram' ? 'Gram' : '%'}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-3 space-y-3">
                {macroMode === 'gram' ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Protein', val: protein, set: setProtein, color: 'text-green-600' },
                        { label: 'Karbs',   val: carbs,   set: setCarbs,   color: 'text-orange-500' },
                        { label: 'Fett',    val: fat,     set: setFat,     color: 'text-violet-500' },
                      ].map(({ label, val, set, color }) => (
                        <div key={label}>
                          <Label className={`text-xs font-medium block mb-1 ${color}`}>{label} (g)</Label>
                          <Input type="number" value={val} onChange={e => set(e.target.value)} min={0} className="h-8 text-sm" />
                        </div>
                      ))}
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-gray-500 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-orange-400" /> Kalorier
                      </span>
                      <span className="font-bold text-gray-900">{caloriesFromGrams} kcal</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Totalt kcal per dag</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" value={targetKcal} min={500} max={6000} onChange={e => setTargetKcal(Number(e.target.value))} className="h-8 text-sm" />
                        <span className="text-xs text-gray-400 flex-shrink-0">kcal</span>
                      </div>
                    </div>
                    {[
                      { label: 'Protein', pct: proteinPct, set: (v: number) => setProteinPct(Math.min(v, 95 - carbsPct)), color: 'bg-green-500', kcalPer: 4 },
                      { label: 'Karbs',   pct: carbsPct,   set: (v: number) => setCarbsPct(Math.min(v, 95 - proteinPct)), color: 'bg-orange-400', kcalPer: 4 },
                      { label: 'Fett',    pct: fatPct,     set: null,                                                      color: 'bg-violet-400', kcalPer: 9 },
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
              </CardContent>
            </Card>

            {selectedMeals.length > 0 && (
              <Card>
                <CardHeader className="pb-0 pt-4 px-4">
                  <CardTitle className="text-sm">Måltidsfordeling</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-3 space-y-2">
                  {MEAL_OPTIONS.filter(m => selectedMeals.includes(m.name)).map(m => {
                    const pct      = Math.round((mealSplits[m.name] ?? 0) * 100)
                    const mealKcal = Math.round(effectiveCalories * (mealSplits[m.name] ?? 0))
                    return (
                      <div key={m.name} className="flex items-center gap-2">
                        <span className="text-base w-5 flex-shrink-0 text-center">{m.emoji}</span>
                        <span className="text-xs text-gray-600 w-16 flex-shrink-0 truncate">{m.name}</span>
                        <input
                          type="range" min={1} max={60} value={pct}
                          onChange={e => setMealSplits(prev => ({ ...prev, [m.name]: Number(e.target.value) / 100 }))}
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
                      onClick={() => setMealSplits(normaliseSplits(
                        selectedMeals,
                        Object.fromEntries(selectedMeals.map(m => [m, 1 / selectedMeals.length]))
                      ))}
                      className="text-xs text-[#2d8653] hover:text-[#1a5c3a]"
                    >
                      Fordel likt
                    </button>
                    <span className={`text-xs font-medium ${splitOk ? 'text-green-600' : 'text-red-500'}`}>
                      {Math.round(selectedMeals.reduce((s, m) => s + (mealSplits[m] ?? 0), 0) * 100)}%
                      {splitOk ? ' ✓' : ' ≠ 100'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-0 pt-4 px-4">
                <CardTitle className="text-sm">Allergier og restriksjoner</CardTitle>
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
                        {a.label}
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
                <span>Avanserte innstillinger</span>
                {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showAdvanced && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="mt-3">
                    <Label className="text-xs text-gray-500 block mb-1">Ekstra preferanser</Label>
                    <Input value={preferences} onChange={e => setPreferences(e.target.value)} placeholder="Norsk mat, middelhavskjøkken..." className="text-sm" />
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
                {generating ? 'Genererer matplan...' : 'Generer med AI'}
              </Button>
              {generating && (
                <p className="text-xs text-[#2d8653] text-center">
                  {suggestionsPerMeal} forslag × {selectedMeals.length} måltider — ca. {selectedMeals.length * 5}s...
                </p>
              )}
            </div>
          </div>

        ) : (

          /* Manual panel */
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <Label>Plannavn</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Makromål (per dag)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Protein (g)</Label>
                    <Input type="number" value={protein} onChange={e => setProtein(e.target.value)} className="mt-1" min={0} />
                  </div>
                  <div>
                    <Label className="text-xs">Karbo (g)</Label>
                    <Input type="number" value={carbs} onChange={e => setCarbs(e.target.value)} className="mt-1" min={0} />
                  </div>
                  <div>
                    <Label className="text-xs">Fett (g)</Label>
                    <Input type="number" value={fat} onChange={e => setFat(e.target.value)} className="mt-1" min={0} />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                  <span className="text-gray-500">Kalorier (beregnet)</span>
                  <span className="font-semibold">{manualCalories} kcal</span>
                </div>
              </CardContent>
            </Card>

            {meals.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Totalt daglig</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-2">
                    {[
                      { label: 'Kalorier', val: totalCals,    target: targetCals, unit: 'kcal' },
                      { label: 'Protein',  val: totalProtein, target: targetProt, unit: 'g' },
                      { label: 'Karbo',    val: totalCarbs,   target: targetCarb, unit: 'g' },
                      { label: 'Fett',     val: totalFat,     target: targetFat,  unit: 'g' },
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
          {meals.length === 0 ? (
            <Card className="flex items-center justify-center h-64">
              <CardContent className="text-center text-gray-400">
                {mode === 'ai' ? (
                  <>
                    <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                    <p className="font-medium">Ingen matplan ennå</p>
                    <p className="text-sm mt-1">Konfigurer innstillingene og trykk «Generer med AI»</p>
                  </>
                ) : (
                  <>
                    <PenLine className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                    <p className="font-medium">Ingen måltider ennå</p>
                    <p className="text-sm mt-1">Legg til måltider og matvarer manuelt</p>
                    <Button
                      className="mt-4" variant="outline"
                      onClick={() => { setMeals([newMeal('Frokost', '07:30')]); setExpandedMeal(0) }}
                    >
                      <Plus className="w-4 h-4" />
                      Legg til måltid
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {meals.map((meal, mealIdx) => {
                const alts     = getAlts(meal)
                const altIdx   = Math.min(activeAlt[mealIdx] ?? 0, alts.length - 1)
                const curAlt   = alts[altIdx] ?? { foods: [] }
                const mealCals = curAlt.foods.reduce((s, f) => s + f.calories, 0)
                const mealProt = curAlt.foods.reduce((s, f) => s + f.protein_g, 0)
                const isExpanded = expandedMeal === mealIdx
                const isEditingName = editingMealNameIdx === mealIdx

                const firstImg = (getAlts(meal)[0] as MealAlternative).image_url
                const curImg  = (curAlt as MealAlternative).image_url

                return (
                  <Card key={mealIdx} className="overflow-hidden">
                    {/* Image banner — shown for current alt when expanded, or first alt when collapsed */}
                    {(isExpanded ? curImg : firstImg) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={isExpanded ? curImg : firstImg}
                        alt={meal.name}
                        className="w-full h-36 object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    <div className="flex items-center justify-between px-5 py-3">
                      {/* Left side: name + stats — div (not button) to allow nested buttons */}
                      <div
                        className="flex-1 text-left min-w-0 cursor-pointer"
                        onClick={() => !isEditingName && setExpandedMeal(isExpanded ? null : mealIdx)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {isEditingName ? (
                            <input
                              autoFocus
                              value={meal.name}
                              onChange={e => setMeals(prev =>
                                prev.map((m, i) => i === mealIdx ? { ...m, name: e.target.value } : m)
                              )}
                              onBlur={() => setEditingMealNameIdx(null)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === 'Escape') setEditingMealNameIdx(null)
                              }}
                              className="font-semibold text-gray-900 border-b-2 border-[#6ecfb0] outline-none bg-transparent text-base w-full max-w-[180px]"
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <span className="font-semibold text-gray-900">{meal.name}</span>
                          )}
                          {!isEditingName && (
                            <button
                              onClick={e => { e.stopPropagation(); setEditingMealNameIdx(mealIdx) }}
                              className="text-gray-300 hover:text-[#2d8653] flex-shrink-0"
                              title="Endre navn"
                            >
                              <PenLine className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="text-sm text-gray-400">{meal.time}</span>
                        </div>
                        {/* Descriptive alt name */}
                        {!isEditingName && (curAlt as MealAlternative).name && (
                          <p className="text-sm text-gray-600 italic mb-1 truncate">
                            {(curAlt as MealAlternative).name}
                          </p>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          {alts.length > 1 && (
                            <span className="text-xs bg-[#cdeee3] text-[#1a5c3a] px-2 py-0.5 rounded-full">
                              {alts.length} alternativer
                            </span>
                          )}
                          <span className="text-xs text-gray-500">{Math.round(mealCals)} kcal</span>
                          <span className="text-xs text-gray-500">{Math.round(mealProt)}g protein</span>
                          <span className="text-xs text-gray-400">{curAlt.foods.length} matvarer</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setExpandedMeal(isExpanded ? null : mealIdx)}
                        className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>

                    {isExpanded && (
                      <CardContent className="pt-0 pb-5">
                        <div className="border-t border-gray-100 pt-4">
                          {alts.length > 1 && (
                            <div className="mb-4">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs text-gray-500 mr-1">Alternativ:</span>
                                {alts.map((a, ai) => (
                                  <button
                                    key={ai}
                                    onClick={() => setActiveAlt(prev => ({ ...prev, [mealIdx]: ai }))}
                                    title={(a as MealAlternative).name ?? `Alt ${ai + 1}`}
                                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                                      ai === altIdx
                                        ? 'bg-[#2d8653] text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    {ai + 1}
                                  </button>
                                ))}
                              </div>
                              {/* Show current alt name under the tabs */}
                              {(curAlt as MealAlternative).name && (
                                <p className="text-sm font-semibold text-gray-800 mt-2">
                                  {(curAlt as MealAlternative).name}
                                </p>
                              )}
                            </div>
                          )}

                          {curAlt.foods.map((food, foodIdx) => (
                            <NutritionFoodRow
                              key={foodIdx}
                              food={food}
                              mealIdx={mealIdx}
                              altIdx={altIdx}
                              foodIdx={foodIdx}
                              updateFood={updateFood}
                              removeFood={() => {
                                setMeals(prev =>
                                  prev.map((m, mi) => {
                                    if (mi !== mealIdx) return m
                                    const a2 = getAlts(m).map((a, ai) =>
                                      ai !== altIdx ? a : { ...a, foods: a.foods.filter((_, fi) => fi !== foodIdx) }
                                    )
                                    return { ...m, alternatives: a2, foods: a2[0]?.foods ?? [] }
                                  })
                                )
                              }}
                            />
                          ))}

                          {curAlt.recipe && curAlt.recipe.length > 0 && (
                            <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                              <p className="text-xs font-semibold text-amber-800 mb-2">Fremgangsmåte</p>
                              <ol className="space-y-1">
                                {curAlt.recipe.map((step, si) => (
                                  <li key={si} className="flex gap-2 text-sm text-amber-900">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-xs flex items-center justify-center font-medium">
                                      {si + 1}
                                    </span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="outline" size="sm"
                              onClick={() => {
                                setMeals(prev =>
                                  prev.map((m, mi) => {
                                    if (mi !== mealIdx) return m
                                    const a2 = getAlts(m).map((a, ai) =>
                                      ai !== altIdx ? a : { ...a, foods: [...a.foods, newFood()] }
                                    )
                                    return { ...m, alternatives: a2, foods: a2[0]?.foods ?? [] }
                                  })
                                )
                              }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Legg til matvare
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="text-red-500 hover:bg-red-50"
                              onClick={() => setMeals(prev => prev.filter((_, mi) => mi !== mealIdx))}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Slett måltid
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )
              })}

              <Button
                variant="outline"
                onClick={() => {
                  const idx = meals.length
                  setMeals(prev => [...prev, newMeal(`Måltid ${idx + 1}`, '12:00')])
                  setExpandedMeal(idx)
                }}
              >
                <Plus className="w-4 h-4" />
                Legg til måltid
              </Button>
            </>
          )}
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
                <p className="font-semibold text-gray-900">Bytt ut alternativ</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Velg oppskrift fra {replaceModal.mealName}-biblioteket
                </p>
              </div>
              <button onClick={() => setReplaceModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  value={librarySearch}
                  onChange={e => setLibrarySearch(e.target.value)}
                  placeholder="Søk etter oppskrift..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
                />
              </div>
            </div>

            {/* Recipe list */}
            <div className="flex-1 overflow-y-auto">
              {libraryLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                  Laster oppskrifter...
                </div>
              ) : (() => {
                const q = librarySearch.toLowerCase()
                const filtered = q
                  ? libraryRecipes.filter(r => r.title.toLowerCase().includes(q))
                  : libraryRecipes
                return filtered.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                    {librarySearch ? 'Ingen oppskrifter matcher søket' : `Ingen ${replaceModal.mealName}-oppskrifter i biblioteket`}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filtered.map(recipe => {
                      const scaledCals = Math.round((recipe.calories_per_serving ?? 0) * (replaceModal.targetCals / Math.max(recipe.calories_per_serving ?? 500, 1)))
                      return (
                        <button
                          key={recipe.id}
                          onClick={() => replaceAlternative(recipe)}
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
                              {Math.round(recipe.calories_per_serving ?? 0)} kcal → {scaledCals} kcal (skalert)
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-[#2d8653]">P {Math.round(recipe.protein_per_serving ?? 0)}g</span>
                              <span className="text-xs text-yellow-600">K {Math.round(recipe.carbs_per_serving ?? 0)}g</span>
                              <span className="text-xs text-orange-600">F {Math.round(recipe.fat_per_serving ?? 0)}g</span>
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
