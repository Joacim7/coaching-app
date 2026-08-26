'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FoodSearchInput } from '@/components/food-search-input'
import { Trash2, ChevronLeft, Loader2, Upload } from 'lucide-react'
import type { FoodSearchResult } from '@coaching/types'
import { useLocale } from '@/components/locale-provider'

// ── Types ─────────────────────────────────────────────────────────────────────

export type IngredientUnit = 'g' | 'stk' | 'dl' | 'ml' | 'ss' | 'ts'

export interface RecipeIngredient {
  id: string
  name: string
  amount_g: number   // canonical grams used for macro calculations
  unit: IngredientUnit
  unit_amount: number // display amount in the chosen unit
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

export interface RecipeData {
  id?: string
  title: string
  description: string
  instructions: string
  image_url: string
  servings: number
  meal_type?: string | null
  ingredients: RecipeIngredient[]
}

interface Props {
  initial?: RecipeData
  readOnly?: boolean
  isStandard?: boolean
}

// ── Unit conversion ───────────────────────────────────────────────────────────

const UNIT_LABELS: Record<IngredientUnit, string> = {
  g: 'g', stk: 'stk', dl: 'dl', ml: 'ml', ss: 'ss', ts: 'ts',
}

// Grams per 1 "stk" for common foods (matched by ingredient name)
function gPerPiece(foodName: string): number {
  const n = foodName.toLowerCase()
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

// Default unit for a newly-added ingredient
function smartUnitFor(name: string): IngredientUnit {
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

function unitToGrams(amount: number, unit: IngredientUnit, name: string): number {
  switch (unit) {
    case 'g':   return amount
    case 'ml':  return amount
    case 'dl':  return amount * 100
    case 'ss':  return amount * 15
    case 'ts':  return amount * 5
    case 'stk': return amount * gPerPiece(name)
  }
}

function gramsToUnit(grams: number, unit: IngredientUnit, name: string): number {
  switch (unit) {
    case 'g':   return grams
    case 'ml':  return grams
    case 'dl':  return grams / 100
    case 'ss':  return grams / 15
    case 'ts':  return grams / 5
    case 'stk': return Math.max(1, Math.round(grams / gPerPiece(name)))
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toFixed(1) }

function computeTotals(ingredients: RecipeIngredient[], servings: number) {
  const total = ingredients.reduce((acc, ing) => {
    const f = ing.amount_g / 100
    return {
      calories: acc.calories + ing.calories_per_100g * f,
      protein:  acc.protein  + ing.protein_per_100g  * f,
      carbs:    acc.carbs    + ing.carbs_per_100g    * f,
      fat:      acc.fat      + ing.fat_per_100g      * f,
    }
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const s = Math.max(servings, 1)
  return {
    calories: total.calories / s,
    protein:  total.protein  / s,
    carbs:    total.carbs    / s,
    fat:      total.fat      / s,
  }
}

// ── Editor ────────────────────────────────────────────────────────────────────

export function RecipeEditor({ initial, readOnly = false, isStandard = false }: Props) {
  const router = useRouter()
  const { t } = useLocale()
  const isEdit = !!initial?.id

  const [title,        setTitle]        = useState(initial?.title        ?? '')
  const [description,  setDescription]  = useState(initial?.description  ?? '')
  const [instructions, setInstructions] = useState(initial?.instructions ?? '')
  const [imageUrl,     setImageUrl]     = useState(initial?.image_url    ?? '')
  const [servings,     setServings]     = useState(initial?.servings     ?? 1)
  const [mealType,     setMealType]     = useState(initial?.meal_type    ?? '')
  const [ingredients,  setIngredients]  = useState<RecipeIngredient[]>(
    (initial?.ingredients ?? []).filter(ing => ing != null).map(ing => ({
      ...ing,
      unit:        (ing.unit        || 'g') as IngredientUnit,
      unit_amount: (ing.unit_amount || ing.amount_g),
    }))
  )
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [error,        setError]        = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError,    setUploadError]    = useState('')

  const totals = useMemo(() => computeTotals(ingredients, servings), [ingredients, servings])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    setUploadError('')
    setUploadingImage(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t('recipes.notLoggedIn'))

      const ext  = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('recipe-images')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (uploadErr) throw uploadErr

      const { data: pub } = supabase.storage.from('recipe-images').getPublicUrl(path)
      setImageUrl(pub.publicUrl)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t('recipes.uploadImageFailed'))
    } finally {
      setUploadingImage(false)
    }
  }

  function addIngredient(food: FoodSearchResult) {
    const unit        = smartUnitFor(food.name)
    const unit_amount = unit === 'g' ? 100 : Math.max(1, Math.round(gramsToUnit(100, unit, food.name)))
    const amount_g    = unitToGrams(unit_amount, unit, food.name)
    setIngredients(prev => [
      ...prev,
      {
        id:                food.id,
        name:              food.name,
        amount_g:          isNaN(amount_g) ? 100 : amount_g,
        unit,
        unit_amount,
        calories_per_100g: food.calories_per_100g,
        protein_per_100g:  food.protein_per_100g,
        carbs_per_100g:    food.carbs_per_100g,
        fat_per_100g:      food.fat_per_100g,
      }
    ])
  }

  function updateUnitAmount(index: number, unitAmount: number) {
    const safe = isNaN(unitAmount) ? 0 : Math.max(0, unitAmount)
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== index) return ing
      const amount_g = Math.max(0, unitToGrams(safe, ing.unit, ing.name))
      return { ...ing, unit_amount: safe, amount_g }
    }))
  }

  function updateUnit(index: number, newUnit: IngredientUnit) {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== index) return ing
      const safeG         = isNaN(ing.amount_g) || ing.amount_g === 0 ? 100 : ing.amount_g
      const rawUnitAmount = gramsToUnit(safeG, newUnit, ing.name)
      const newUnitAmount = isNaN(rawUnitAmount) ? 1 : Math.max(0, rawUnitAmount)
      const rawAmountG    = unitToGrams(newUnitAmount, newUnit, ing.name)
      const newAmountG    = isNaN(rawAmountG) ? 0 : Math.max(0, rawAmountG)
      return { ...ing, unit: newUnit, unit_amount: newUnitAmount, amount_g: newAmountG }
    }))
  }

  function removeIngredient(index: number) {
    setIngredients(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!title.trim()) { setError(t('recipes.titleRequired')); return }
    setSaving(true)
    setError('')

    const payload = {
      title:                title.trim(),
      description:          description  || null,
      instructions:         instructions || null,
      image_url:            imageUrl || null,   // API route fetches from Pexels if null
      servings,
      meal_type:            mealType || null,
      ingredients,
      calories_per_serving: totals.calories,
      protein_per_serving:  totals.protein,
      carbs_per_serving:    totals.carbs,
      fat_per_serving:      totals.fat,
    }

    const res = await fetch(
      isEdit ? `/api/recipes/${initial!.id}` : '/api/recipes',
      {
        method:  isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      }
    )

    setSaving(false)
    if (res.ok) {
      router.push('/recipes')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? t('common.somethingWentWrong'))
    }
  }

  async function handleDelete() {
    if (!isEdit) return
    if (!confirm(t('recipes.deleteConfirm', { title }))) return
    setDeleting(true)
    await fetch(`/api/recipes/${initial!.id}`, { method: 'DELETE' })
    router.push('/recipes')
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {t('recipes.backToRecipes')}
      </button>

      <div>
        <h1 className="text-2xl font-bold text-[#1a5c3a]">
          {isEdit ? t('recipes.editRecipe') : t('recipes.newRecipe')}
        </h1>
      </div>

      {readOnly && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-700">
          {isStandard
            ? t('recipes.standardReadOnly')
            : t('recipes.sharedReadOnly')}
        </div>
      )}

      <fieldset disabled={readOnly} className="space-y-6">

      {/* Basic info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">{t('recipes.basicInfo')}</h2>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">{t('recipes.recipeTitle')} *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('recipes.titlePlaceholder')}
            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">{t('recipes.shortDescription')}</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('recipes.descriptionPlaceholder')}
            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">{t('recipes.servings')}</label>
            <input
              type="number"
              min="1"
              value={servings}
              onChange={e => setServings(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">{t('recipes.mealType')}</label>
            <select
              value={mealType}
              onChange={e => setMealType(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653] bg-white"
            >
              {/* Meal-type values are persisted to the DB and shared with the mobile app — never translate them. */}
              <option value="">{t('recipes.notSelected')}</option>
              <option value="Frokost">Frokost</option>
              <option value="Lunsj">Lunsj</option>
              <option value="Middag">Middag</option>
              <option value="Snack">Snack</option>
              <option value="Kveldsmat">Kveldsmat</option>
              <option value="Ettermiddag">Ettermiddag</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600">{t('recipes.image')}</label>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
              {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingImage ? t('recipes.uploading') : t('recipes.uploadImage')}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploadingImage}
              />
            </label>
            {imageUrl && (
              <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt={t('recipes.preview')} className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

          <p className="text-xs text-gray-400 pt-1">{t('recipes.orPasteUrl')}</p>
          <input
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
          />
        </div>
      </div>

      {/* Ingredients */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">{t('recipes.ingredients')}</h2>
          {ingredients.length > 0 && (
            <span className="text-xs text-gray-400">{t('recipes.ingredientCount', { n: ingredients.length })}</span>
          )}
        </div>

        <FoodSearchInput onSelect={addIngredient} placeholder={t('recipes.searchIngredient')} />

        {ingredients.length > 0 && (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[1fr_136px_48px_44px_44px_28px] gap-2 px-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              <span>{t('recipes.ingredient')}</span>
              <span>{t('recipes.amount')}</span>
              <span className="text-right">{t('recipes.kcalAbbrev')}</span>
              <span className="text-right">{t('recipes.proteinAbbrev')}</span>
              <span className="text-right">{t('recipes.carbsAbbrev')}</span>
              <span />
            </div>

            {ingredients.map((ing, i) => {
              const unit     = ing.unit ?? 'g'
              const showHint = unit !== 'g'
              return (
                <div key={i} className="grid grid-cols-[1fr_136px_48px_44px_44px_28px] gap-2 items-center px-2 py-1.5 rounded-lg hover:bg-gray-50">
                  {/* Name + gram hint */}
                  <div className="min-w-0">
                    <span className="text-sm text-gray-800 truncate block">{ing.name}</span>
                    {showHint && (
                      <span className="text-[10px] text-gray-400">≈ {Math.round(ing.amount_g)}g</span>
                    )}
                  </div>

                  {/* Amount input + unit selector */}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      value={isNaN(ing.unit_amount ?? NaN) ? 0 : (ing.unit_amount ?? 0)}
                      onChange={e => { const parsed = parseFloat(e.target.value); const safe = isNaN(parsed) ? 0 : parsed; updateUnitAmount(i, safe) }}
                      className="h-7 w-14 px-2 rounded border border-gray-200 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#2d8653]"
                    />
                    <select
                      value={unit}
                      onChange={e => updateUnit(i, e.target.value as IngredientUnit)}
                      className="h-7 rounded border border-gray-200 text-xs px-1 focus:outline-none focus:ring-1 focus:ring-[#2d8653] bg-white text-gray-700"
                    >
                      {(Object.keys(UNIT_LABELS) as IngredientUnit[]).map(u => (
                        <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                      ))}
                    </select>
                  </div>

                  <span className="text-xs text-gray-500 text-right">{Math.round((ing.calories_per_100g || 0) * (ing.amount_g || 0) / 100)}</span>
                  <span className="text-xs text-gray-500 text-right">{fmt((ing.protein_per_100g || 0) * (ing.amount_g || 0) / 100)}</span>
                  <span className="text-xs text-gray-500 text-right">{fmt((ing.carbs_per_100g || 0) * (ing.amount_g || 0) / 100)}</span>
                  <button onClick={() => removeIngredient(i)} className="flex items-center justify-center w-6 h-6 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Totals */}
        {ingredients.length > 0 && (
          <div className="mt-2 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              {servings > 1 ? t('recipes.perServingOf', { n: servings }) : t('recipes.perServingSingle')}
            </p>
            <div className="grid grid-cols-4 gap-3">
              {([
                { label: t('recipes.calories'), value: `${Math.round(totals.calories)} kcal`, color: 'text-orange-600' },
                { label: t('recipes.protein'),  value: `${fmt(totals.protein)}g`,  color: 'text-[#2d8653]'   },
                { label: t('recipes.carbs'),    value: `${fmt(totals.carbs)}g`,    color: 'text-yellow-600' },
                { label: t('recipes.fat'),     value: `${fmt(totals.fat)}g`,      color: 'text-red-500'    },
              ]).map(m => (
                <div key={m.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                  <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">{t('recipes.method')}</h2>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          rows={7}
          placeholder={t('recipes.methodPlaceholder')}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
        />
      </div>

      </fieldset>

      {/* Actions */}
      {!readOnly && (
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between pb-8">
            <div>
              {isEdit && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 h-9 px-4 rounded-xl text-red-600 border border-red-200 hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? t('common.deleting') : t('recipes.deleteRecipe')}
                </button>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex items-center gap-2 h-9 px-5 rounded-xl bg-[#2d8653] text-white text-sm font-semibold hover:bg-[#2d8653] disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? t('common.saving') : (isEdit ? t('recipes.saveChanges') : t('recipes.createRecipe'))}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
