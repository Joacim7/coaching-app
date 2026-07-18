'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Save, Sparkles, ChevronLeft, Plus, Trash2,
  ChevronDown, ChevronUp, UserPlus, X, Search, Flame,
} from 'lucide-react'
import Link from 'next/link'
import { FoodSearchInput } from '@/components/food-search-input'
import type { Meal, Food, MealPlan, MealAlternative, FoodSearchResult } from '@coaching/types'
import {
  parseAmountDisplay, unitToGrams, gramsToUnit, smartUnitFor,
  type IngredientUnit,
} from '@/lib/ingredient-units'

interface Props {
  clientId: string | null
  clientName: string | null
  coachId: string
  clients: { id: string; name: string }[]
  initialPlan: MealPlan | null
}

const MEAL_OPTIONS: { name: string; emoji: string; time: string }[] = [
  { name: 'Frokost',   emoji: '🌅', time: '07:30' },
  { name: 'Lunsj',    emoji: '🥗', time: '12:00' },
  { name: 'Middag',   emoji: '🍽️', time: '18:00' },
  { name: 'Snack',    emoji: '🍎', time: '15:00' },
  { name: 'Kveldsmat', emoji: '🌙', time: '20:30' },
]

const ALLERGEN_OPTIONS = [
  { id: 'glutenfri',    label: 'Glutenfri' },
  { id: 'melkefri',    label: 'Melkefri' },
  { id: 'laktosefri',  label: 'Laktosefri' },
  { id: 'nøttefri',   label: 'Nøttefri' },
  { id: 'eggfri',     label: 'Eggfri' },
  { id: 'skalldyrfri', label: 'Skalldyrfri' },
  { id: 'uten-fisk',   label: 'Uten fisk' },
]

function normaliseSplits(meals: string[], splits: Record<string, number>): Record<string, number> {
  if (meals.length === 0) return {}
  const total = meals.reduce((s, m) => s + (splits[m] ?? 0), 0)
  if (total < 0.001) return Object.fromEntries(meals.map(m => [m, 1 / meals.length]))
  return Object.fromEntries(meals.map(m => [m, (splits[m] ?? 0) / total]))
}

const DAY_OPTIONS = [7, 14, 21] as const

function calcCalories(p: number, c: number, f: number) {
  return Math.round(p * 4 + c * 4 + f * 9)
}

function newFood(): Food {
  return { name: '', amount: '', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
}

function emptyAlternative(): MealAlternative {
  return { foods: [newFood()] }
}

/** Derive a display name from a list of foods. Never returns a generic fallback. */
function deriveMealName(foods: Food[]): string {
  const named = foods.filter(f => f.name?.trim())
  if (named.length === 0) return 'Måltidsalternativ'
  const short = (n: string) => n.trim().split(/\s+/).slice(0, 2).join(' ')
  if (named.length === 1) return named[0].name.trim()
  return `${short(named[0].name)} med ${short(named[1].name)}`
}

// ── FoodRow ─────────────────────────────────────────────────────────────────

interface FoodRowProps {
  food: Food
  onUpdate: (field: keyof Food, value: string | number) => void
  onRemove: () => void
  onFoodSelect: (result: FoodSearchResult, amountG: number) => void
}

const UNITS: IngredientUnit[] = ['g', 'stk', 'dl', 'ml', 'ss', 'ts']

function FoodRow({ food, onUpdate, onRemove, onFoodSelect }: FoodRowProps) {
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

  function handleSelect(result: FoodSearchResult) {
    const smartUnit  = smartUnitFor(result.name)
    const newUnitAmt = gramsToUnit(amountG, smartUnit, result.name)
    const newG       = smartUnit !== 'g'
      ? Math.max(1, Math.round(unitToGrams(newUnitAmt, smartUnit, result.name)))
      : amountG
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
    }
    onFoodSelect(result, newG)
    if (smartUnit !== 'g') {
      onUpdate('amount_display', `${newUnitAmt} ${smartUnit}`)
    }
    setSearching(false)
  }

  function handleUnitChange(newUnit: IngredientUnit) {
    const raw  = gramsToUnit(amountG, newUnit, food.name)
    const safe = isNaN(raw) ? 1 : Math.max(newUnit === 'stk' ? 1 : 0, raw)
    setUnit(newUnit)
    setUnitAmount(safe)
    if (newUnit !== 'g') onUpdate('amount_display', `${safe} ${newUnit}`)
  }

  function handleUnitAmountChange(raw: number) {
    const safe = isNaN(raw) ? (unit === 'stk' ? 1 : 0.1) : Math.max(unit === 'stk' ? 1 : 0.1, raw)
    const newG = Math.max(1, Math.round(unitToGrams(safe, unit, food.name)))
    const f    = newG / 100
    setUnitAmount(safe)
    setAmountG(newG)
    onUpdate('amount',         `${newG}g`)
    if (unit !== 'g') onUpdate('amount_display', `${safe} ${unit}`)
    onUpdate('calories',       Math.round(per100.calories  * f))
    onUpdate('protein_g',      Math.round(per100.protein_g * f * 10) / 10)
    onUpdate('carbs_g',        Math.round(per100.carbs_g   * f * 10) / 10)
    onUpdate('fat_g',          Math.round(per100.fat_g     * f * 10) / 10)
  }

  function handleGramChange(newG: number) {
    const f      = newG / 100
    const newUA  = gramsToUnit(newG, unit, food.name)
    const safeUA = isNaN(newUA) ? (unit === 'stk' ? 1 : newG) : Math.max(0, newUA)
    setAmountG(newG)
    setUnitAmount(safeUA)
    onUpdate('amount',    `${newG}g`)
    if (unit !== 'g') onUpdate('amount_display', `${safeUA} ${unit}`)
    onUpdate('protein_g', Math.round(per100.protein_g * f * 10) / 10)
    onUpdate('carbs_g',   Math.round(per100.carbs_g   * f * 10) / 10)
    onUpdate('fat_g',     Math.round(per100.fat_g     * f * 10) / 10)
    onUpdate('calories',  Math.round(per100.calories  * f))
  }

  return (
    <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
      {/* Row 1: food search + amount input */}
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
              <FoodSearchInput onSelect={handleSelect} placeholder="Søk i Matvaretabellen..." />
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

      {/* Row 2: read-only macro display + delete */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-600">P <strong>{food.protein_g.toFixed(1)}</strong>g</span>
          <span className="text-orange-500">K <strong>{food.carbs_g.toFixed(1)}</strong>g</span>
          <span className="text-violet-500">F <strong>{food.fat_g.toFixed(1)}</strong>g</span>
          <span className="font-semibold text-gray-600">{food.calories} kcal</span>
        </div>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── MacroBar ─────────────────────────────────────────────────────────────────

function MacroBar({
  label, value, target, unit, color, pct,
}: {
  label: string; value: number; target: number; unit: string
  color: string; pct: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700 font-medium">{label}</span>
        <span className="text-sm text-gray-500">
          {Math.round(value)}{unit} <span className="text-gray-400">·</span> {Math.round(pct)}%
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(Math.round(pct), 100)}%` }}
        />
      </div>
    </div>
  )
}

// ── Main editor ──────────────────────────────────────────────────────────────

export default function StandaloneMealPlanEditor({
  clientId, clientName, coachId, clients, initialPlan,
}: Props) {
  const supabase = createClient()
  const router = useRouter()

  // Plan settings
  const [title, setTitle] = useState(initialPlan?.title ?? 'Ny matplan')
  const [days, setDays] = useState<7 | 14 | 21>(7)

  // Macro goals
  const [macroMode, setMacroMode] = useState<'gram' | 'pct'>('gram')
  const [protein, setProtein] = useState(initialPlan?.protein_g?.toString() ?? '150')
  const [carbs, setCarbs]     = useState(initialPlan?.carbs_g?.toString()  ?? '200')
  const [fat, setFat]         = useState(initialPlan?.fat_g?.toString()    ?? '80')
  const [targetKcal, setTargetKcal] = useState(2000)
  const [proteinPct, setProteinPct] = useState(30)
  const [carbsPct,   setCarbsPct]   = useState(40)
  const fatPct = Math.max(0, 100 - proteinPct - carbsPct)
  const caloriesFromGrams = calcCalories(Number(protein), Number(carbs), Number(fat))
  const effectiveCalories = macroMode === 'gram' ? caloriesFromGrams : targetKcal
  const effectiveProtein  = macroMode === 'gram' ? Number(protein) : Math.round(targetKcal * proteinPct / 100 / 4)
  const effectiveCarbs    = macroMode === 'gram' ? Number(carbs)   : Math.round(targetKcal * carbsPct   / 100 / 4)
  const effectiveFat      = macroMode === 'gram' ? Number(fat)     : Math.round(targetKcal * fatPct     / 100 / 9)

  // Meal selection + splits
  const initMeals = ['Frokost', 'Lunsj', 'Middag']
  const [selectedMeals, setSelectedMeals] = useState<string[]>(initMeals)
  const [mealSplits, setMealSplits] = useState<Record<string, number>>(
    () => normaliseSplits(initMeals, Object.fromEntries(initMeals.map(m => [m, 1 / initMeals.length])))
  )
  const [suggestionsPerMeal, setSuggestionsPerMeal] = useState(3)

  // Allergies & preferences
  const [selectedAllergies, setSelectedAllergies] = useState<Set<string>>(new Set())
  const [preferences, setPreferences] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [meals, setMeals] = useState<Meal[]>(initialPlan?.meals ?? [])
  const [activeMealTab, setActiveMealTab] = useState<number>(0)
  const [expandedAlt, setExpandedAlt] = useState<number | null>(null)

  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function getAlts(meal: Meal): MealAlternative[] {
    if (meal.alternatives && meal.alternatives.length > 0) return meal.alternatives
    return [{ foods: meal.foods }]
  }

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
          calories:             effectiveCalories,
          protein_g:            effectiveProtein,
          carbs_g:              effectiveCarbs,
          fat_g:                effectiveFat,
          custom_meal_names:    orderedMeals,
          meal_calorie_splits:  normaliseSplits(selectedMeals, mealSplits),
          alternatives_per_meal: suggestionsPerMeal,
          preferences:          fullPrefs || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      if (data.meals) {
        setMeals(data.meals)
        setActiveMealTab(0)
        setExpandedAlt(null)
      }
    } catch {
      setError('Nettverksfeil ved AI-generering')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Use actual food totals when available; fall back to manually entered targets
      const savedCalories = totalCals    > 0 ? Math.round(totalCals)    : effectiveCalories
      const savedProtein  = totalProtein > 0 ? Math.round(totalProtein) : effectiveProtein
      const savedCarbs    = totalCarbs   > 0 ? Math.round(totalCarbs)   : effectiveCarbs
      const savedFat      = totalFat     > 0 ? Math.round(totalFat)     : effectiveFat

      const planData = {
        title, client_id: clientId, coach_id: coachId,
        calories_target: savedCalories,
        protein_g: savedProtein, carbs_g: savedCarbs, fat_g: savedFat,
        meals, is_active: true,
      }
      if (initialPlan?.id) {
        await supabase.from('meal_plans').update(planData).eq('id', initialPlan.id)
      } else {
        const { data } = await supabase.from('meal_plans').insert(planData).select('id').single()
        if (data) router.replace(`/meal-plans/${data.id}`)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleAssign() {
    if (!selectedClientId || !initialPlan?.id) return
    setAssigning(true)
    try {
      const res = await fetch(`/api/meal-plans/${initialPlan.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId }),
      })
      const data = await res.json()
      if (data.newPlanId) router.push(`/meal-plans/${data.newPlanId}`)
    } finally {
      setAssigning(false)
      setAssignOpen(false)
    }
  }

  // ── Meal mutation helpers ──

  const updateFood = useCallback(
    (mealIdx: number, altIdx: number, foodIdx: number, field: keyof Food, value: string | number) => {
      setMeals(prev => prev.map((m, mi) => {
        if (mi !== mealIdx) return m
        const alts = getAlts(m).map((a, ai) =>
          ai !== altIdx ? a : { ...a, foods: a.foods.map((f, fi) => fi === foodIdx ? { ...f, [field]: value } : f) }
        )
        return { ...m, alternatives: alts, foods: alts[0]?.foods ?? [] }
      }))
    }, []
  )

  const handleFoodSelect = useCallback(
    (mealIdx: number, altIdx: number, foodIdx: number, result: FoodSearchResult, amountG: number) => {
      const factor = amountG / 100
      setMeals(prev => prev.map((m, mi) => {
        if (mi !== mealIdx) return m
        const alts = getAlts(m).map((a, ai) =>
          ai !== altIdx ? a : {
            ...a,
            foods: a.foods.map((f, fi) => fi !== foodIdx ? f : {
              name: result.name, amount: `${amountG}g`,
              calories: Math.round(result.calories_per_100g * factor),
              protein_g: Math.round(result.protein_per_100g * factor * 10) / 10,
              carbs_g: Math.round(result.carbs_per_100g * factor * 10) / 10,
              fat_g: Math.round(result.fat_per_100g * factor * 10) / 10,
            }),
          }
        )
        return { ...m, alternatives: alts, foods: alts[0]?.foods ?? [] }
      }))
    }, []
  )

  const removeFood = useCallback((mealIdx: number, altIdx: number, foodIdx: number) => {
    setMeals(prev => prev.map((m, mi) => {
      if (mi !== mealIdx) return m
      const alts = getAlts(m).map((a, ai) =>
        ai !== altIdx ? a : { ...a, foods: a.foods.filter((_, fi) => fi !== foodIdx) }
      )
      return { ...m, alternatives: alts, foods: alts[0]?.foods ?? [] }
    }))
  }, [])

  const addFood = useCallback((mealIdx: number, altIdx: number) => {
    setMeals(prev => prev.map((m, mi) => {
      if (mi !== mealIdx) return m
      const alts = getAlts(m).map((a, ai) =>
        ai !== altIdx ? a : { ...a, foods: [...a.foods, newFood()] }
      )
      return { ...m, alternatives: alts, foods: alts[0]?.foods ?? [] }
    }))
  }, [])

  const addAlternative = useCallback((mealIdx: number) => {
    setMeals(prev => prev.map((m, mi) => {
      if (mi !== mealIdx) return m
      const alts = [...getAlts(m), emptyAlternative()]
      setExpandedAlt(alts.length - 1)
      return { ...m, alternatives: alts, foods: alts[0]?.foods ?? [] }
    }))
  }, [])

  const removeAlternative = useCallback((mealIdx: number, altIdx: number) => {
    setMeals(prev => prev.map((m, mi) => {
      if (mi !== mealIdx) return m
      const alts = getAlts(m).filter((_, ai) => ai !== altIdx)
      if (alts.length === 0) alts.push(emptyAlternative())
      setExpandedAlt(null)
      return { ...m, alternatives: alts, foods: alts[0]?.foods ?? [] }
    }))
  }, [])

  // ── Daily totals (alt[0] of each meal) ──
  const totalCals = meals.reduce((s, m) => s + (getAlts(m)[0]?.foods ?? []).reduce((ss, f) => ss + f.calories, 0), 0)
  const totalProtein = meals.reduce((s, m) => s + (getAlts(m)[0]?.foods ?? []).reduce((ss, f) => ss + f.protein_g, 0), 0)
  const totalCarbs = meals.reduce((s, m) => s + (getAlts(m)[0]?.foods ?? []).reduce((ss, f) => ss + f.carbs_g, 0), 0)
  const totalFat = meals.reduce((s, m) => s + (getAlts(m)[0]?.foods ?? []).reduce((ss, f) => ss + f.fat_g, 0), 0)

  const displayProteinPct = totalCals > 0 ? (totalProtein * 4 / totalCals) * 100 : (effectiveProtein * 4 / effectiveCalories) * 100
  const displayCarbsPct   = totalCals > 0 ? (totalCarbs   * 4 / totalCals) * 100 : (effectiveCarbs   * 4 / effectiveCalories) * 100
  const displayFatPct     = totalCals > 0 ? (totalFat     * 9 / totalCals) * 100 : (effectiveFat     * 9 / effectiveCalories) * 100

  // Active meal for right panel detail
  const safeMealTab = Math.min(activeMealTab, Math.max(0, meals.length - 1))
  const activeMeal = meals[safeMealTab] ?? null
  const activeMealAlts = activeMeal ? getAlts(activeMeal) : []

  // Per active meal range across all alternatives
  const activeMealCalRange = activeMealAlts.length > 0
    ? {
        min: Math.min(...activeMealAlts.map(a => a.foods.reduce((s, f) => s + f.calories, 0))),
        max: Math.max(...activeMealAlts.map(a => a.foods.reduce((s, f) => s + f.calories, 0))),
      }
    : null

  const splitOk = Math.abs(Math.round(selectedMeals.reduce((s, m) => s + (mealSplits[m] ?? 0), 0) * 100) - 100) <= 1

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/meal-plans" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          {clientName && <p className="text-sm text-gray-500">{clientName}</p>}
          <h1 className="text-xl font-bold text-[#1a5c3a]">Matplan</h1>
        </div>
        <div className="flex items-center gap-2">
          {!clientId && initialPlan?.id && (
            assignOpen ? (
              <div className="flex items-center gap-2">
                <select
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                  className="h-9 text-sm border border-gray-300 rounded-md px-2 bg-white"
                >
                  <option value="">Velg klient...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Button size="sm" onClick={handleAssign} disabled={!selectedClientId || assigning}>
                  {assigning ? 'Tildeler...' : 'Tildel'}
                </Button>
                <button onClick={() => setAssignOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setAssignOpen(true)}>
                <UserPlus className="w-4 h-4" />
                Tildel til klient
              </Button>
            )
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saved ? 'Lagret!' : saving ? 'Lagrer...' : 'Lagre'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[360px_1fr] gap-6 items-start">

        {/* ── Left panel: generator settings ── */}
        <div className="space-y-3">

          {/* 1. Plan details + days */}
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
                          ? 'bg-[#1a5c3a] text-white border-[#1a5c3a]'
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

          {/* 2. Måltidsforslag */}
          <Card>
            <CardHeader className="pb-0 pt-4 px-4">
              <CardTitle className="text-sm">Måltidsforslag</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-3 space-y-4">
              {/* Meal type chips */}
              <div className="flex flex-wrap gap-2">
                {MEAL_OPTIONS.map(m => {
                  const selected = selectedMeals.includes(m.name)
                  return (
                    <button
                      key={m.name}
                      onClick={() => {
                        if (selected) {
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
                            const scaled = Object.fromEntries(selectedMeals.map(n => [n, (prev[n] ?? 0) * (1 - share)]))
                            return { ...scaled, [m.name]: share }
                          })
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        selected
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

              {/* Suggestions per meal slider */}
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

              {/* Total recipes badge */}
              {selectedMeals.length > 0 && (
                <div className="flex items-center justify-between bg-[#ebf5ef] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs text-[#2d8653] font-medium">Totalt oppskrifter som genereres</p>
                    <p className="text-xs text-[#6ecfb0] mt-0.5">{selectedMeals.length} måltider × {suggestionsPerMeal} forslag</p>
                  </div>
                  <span className="text-2xl font-bold text-[#1a5c3a]">{selectedMeals.length * suggestionsPerMeal}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Makromål */}
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
                      <Input
                        type="number" value={targetKcal} min={500} max={6000}
                        onChange={e => setTargetKcal(Number(e.target.value))}
                        className="h-8 text-sm"
                      />
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
                        <input
                          type="range" min={5} max={70} value={pct}
                          onChange={e => set(Number(e.target.value))}
                          className={`w-full h-1.5 accent-[#2d8653]`}
                        />
                      ) : (
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                        </div>
                      )}
                    </div>
                  ))}
                  {proteinPct + carbsPct + fatPct !== 100 && (
                    <p className="text-xs text-red-500">Sum: {proteinPct + carbsPct + fatPct}% (må være 100%)</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* 4. Måltidsfordeling */}
          {selectedMeals.length > 0 && (
            <Card>
              <CardHeader className="pb-0 pt-4 px-4">
                <CardTitle className="text-sm">Måltidsfordeling</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-3 space-y-2">
                {MEAL_OPTIONS.filter(m => selectedMeals.includes(m.name)).map(m => {
                  const pct     = Math.round((mealSplits[m.name] ?? 0) * 100)
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
                    onClick={() => setMealSplits(normaliseSplits(selectedMeals, Object.fromEntries(selectedMeals.map(m => [m, 1 / selectedMeals.length]))))}
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

          {/* 5. Allergier og restriksjoner */}
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

          {/* 6. Avanserte innstillinger (kollapsbar) */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <button
              onClick={() => setShowAdvanced(a => !a)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span>Avanserte innstillinger</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showAdvanced && (
              <div className="px-4 pb-4 border-t border-gray-100 space-y-3">
                <div className="mt-3">
                  <Label className="text-xs text-gray-500 block mb-1">Ekstra preferanser</Label>
                  <Input
                    value={preferences}
                    onChange={e => setPreferences(e.target.value)}
                    placeholder="Norsk mat, middelhavskjøkken, rask tilberedning..."
                    className="text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Generate */}
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

        {/* ── Right panel: Kaizo-style ── */}
        <div className="min-w-0 space-y-4">

          {meals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-72 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
              <Sparkles className="w-10 h-10 text-gray-300 mb-3" />
              <p className="font-medium text-gray-500">Ingen matplan ennå</p>
              <p className="text-sm text-gray-400 mt-1">Bruk AI-generatoren til venstre</p>
            </div>
          ) : (
            <>
              {/* ── Daglig oversikt ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Daglig oversikt</p>
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-5 h-5 text-orange-400" />
                  <span className="text-2xl font-bold text-gray-900">{totalCals > 0 ? totalCals : effectiveCalories} kcal</span>
                  <span className="text-sm text-gray-400 ml-1">/ {effectiveCalories} mål</span>
                </div>
                <div className="space-y-3">
                  <MacroBar label="Protein" value={totalProtein > 0 ? totalProtein : effectiveProtein} target={effectiveProtein} unit="g" color="bg-green-500" pct={displayProteinPct} />
                  <MacroBar label="Karbohydrater" value={totalCarbs > 0 ? totalCarbs : effectiveCarbs} target={effectiveCarbs} unit="g" color="bg-orange-400" pct={displayCarbsPct} />
                  <MacroBar label="Fett" value={totalFat > 0 ? totalFat : effectiveFat} target={effectiveFat} unit="g" color="bg-violet-400" pct={displayFatPct} />
                </div>

                {/* Per-meal breakdown */}
                {activeMeal && activeMealCalRange && (
                  <>
                    <div className="border-t border-gray-100 my-4" />
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500">
                        Viser makroer for: <span className="font-semibold text-gray-700">{activeMeal.name}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span className="text-base font-semibold text-gray-800">
                        {activeMealCalRange.min === activeMealCalRange.max
                          ? `${activeMealCalRange.min} kcal`
                          : `${activeMealCalRange.min}–${activeMealCalRange.max} kcal`}
                      </span>
                    </div>
                    {(() => {
                      const alt0 = activeMealAlts[0]
                      if (!alt0) return null
                      const mP = alt0.foods.reduce((s, f) => s + f.protein_g, 0)
                      const mK = alt0.foods.reduce((s, f) => s + f.carbs_g, 0)
                      const mF = alt0.foods.reduce((s, f) => s + f.fat_g, 0)
                      const mCal = alt0.foods.reduce((s, f) => s + f.calories, 0)
                      return (
                        <div className="space-y-2">
                          <MacroBar label="Protein" value={mP} target={effectiveProtein} unit="g" color="bg-green-500" pct={mCal > 0 ? (mP * 4 / mCal) * 100 : 0} />
                          <MacroBar label="Karbohydrater" value={mK} target={effectiveCarbs} unit="g" color="bg-orange-400" pct={mCal > 0 ? (mK * 4 / mCal) * 100 : 0} />
                          <MacroBar label="Fett" value={mF} target={effectiveFat} unit="g" color="bg-violet-400" pct={mCal > 0 ? (mF * 9 / mCal) * 100 : 0} />
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>

              {/* ── Meal tabs ── */}
              <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden">
                {meals.map((meal, idx) => {
                  const alts = getAlts(meal)
                  const isActive = idx === safeMealTab
                  return (
                    <button
                      key={idx}
                      onClick={() => { setActiveMealTab(idx); setExpandedAlt(null) }}
                      className={`flex-1 px-3 py-3 text-sm font-medium transition-colors border-b-2 ${
                        isActive
                          ? 'border-[#2d8653] text-[#2d8653] bg-white'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {meal.name}
                      <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${isActive ? 'bg-[#cdeee3] text-[#1a5c3a]' : 'bg-gray-100 text-gray-500'}`}>
                        {alts.length}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* ── Alternatives list ── */}
              {activeMeal && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      {activeMeal.name}
                      <span className="text-sm font-normal text-gray-400">{activeMealAlts.length} alternativer</span>
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { addAlternative(safeMealTab); setExpandedAlt(activeMealAlts.length) }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nytt alternativ
                    </Button>
                  </div>

                  {activeMealAlts.map((alt, altIdx) => {
                    const altCals = alt.foods.reduce((s, f) => s + f.calories, 0)
                    const altP = alt.foods.reduce((s, f) => s + f.protein_g, 0)
                    const altK = alt.foods.reduce((s, f) => s + f.carbs_g, 0)
                    const altF = alt.foods.reduce((s, f) => s + f.fat_g, 0)
                    const name = alt.name ?? deriveMealName(alt.foods)
                    const isExpanded = expandedAlt === altIdx
                    const imgUrl = alt.image_url

                    return (
                      <div key={altIdx} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        {/* Alt row header */}
                        <button
                          className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedAlt(isExpanded ? null : altIdx)}
                        >
                          {/* Image */}
                          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)]">
                            {imgUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imgUrl}
                                alt={name}
                                className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white text-2xl">🍽</div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate text-sm">{name}</p>
                            <p className="text-xs text-gray-400 mb-0.5">{activeMeal.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" />
                              <span className="font-medium">{Math.round(altCals)}</span>
                              <span className="text-green-600">P {Math.round(altP)}g</span>
                              <span className="text-orange-500">K {Math.round(altK)}g</span>
                              <span className="text-violet-500">F {Math.round(altF)}g</span>
                            </div>
                          </div>

                          {/* Expand indicator */}
                          <div className="flex-shrink-0 text-gray-400">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </button>

                        {/* Expanded edit area */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 px-4 pb-4 pt-3">

                            {/* Foods */}
                            {alt.foods.map((food, foodIdx) => (
                              <FoodRow
                                key={foodIdx}
                                food={food}
                                onUpdate={(field, value) => updateFood(safeMealTab, altIdx, foodIdx, field, value)}
                                onRemove={() => removeFood(safeMealTab, altIdx, foodIdx)}
                                onFoodSelect={(result, amountG) => handleFoodSelect(safeMealTab, altIdx, foodIdx, result, amountG)}
                              />
                            ))}

                            {/* Recipe */}
                            {alt.recipe && alt.recipe.length > 0 && (
                              <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                                <p className="text-xs font-semibold text-amber-800 mb-2">Fremgangsmåte</p>
                                <ol className="space-y-1">
                                  {alt.recipe.map((step, si) => (
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

                            {/* Actions */}
                            <div className="flex gap-2 mt-3 flex-wrap">
                              <Button variant="outline" size="sm" onClick={() => addFood(safeMealTab, altIdx)}>
                                <Plus className="w-3.5 h-3.5" />
                                Legg til matvare
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                className="text-red-500 hover:bg-red-50 ml-auto"
                                onClick={() => removeAlternative(safeMealTab, altIdx)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Slett alternativ
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Add/remove meal */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        const nextIdx = meals.length
                        const usedNames = meals.map(m => m.name)
                        const slot = MEAL_OPTIONS.find(m => !usedNames.includes(m.name))
                          ?? { name: `Måltid ${nextIdx + 1}`, time: '12:00' }
                        setMeals(prev => [...prev, {
                          name: slot.name, time: slot.time,
                          foods: [newFood()], alternatives: [{ foods: [newFood()] }],
                        }])
                        setActiveMealTab(nextIdx)
                        setExpandedAlt(0)
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      Legg til måltid
                    </Button>
                    {meals.length > 1 && (
                      <Button
                        variant="ghost"
                        className="text-red-500 hover:bg-red-50"
                        onClick={() => {
                          setMeals(prev => prev.filter((_, mi) => mi !== safeMealTab))
                          setActiveMealTab(Math.max(0, safeMealTab - 1))
                          setExpandedAlt(null)
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        Slett {activeMeal.name}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
