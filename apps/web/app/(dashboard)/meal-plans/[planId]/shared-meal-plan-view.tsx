'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Copy, Loader2, Share2 } from 'lucide-react'
import { useLocale } from '@/components/locale-provider'
import type { Meal, Food, MealAlternative } from '@coaching/types'

interface PlanProp {
  id: string
  title: string
  calories_target: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  meals: Meal[]
}

function FoodLine({ food }: { food: Food }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-gray-600 py-1">
      <span className="truncate">
        {food.name}
        {food.amount_display || food.amount ? ` · ${food.amount_display ?? food.amount}` : ''}
      </span>
      <span className="text-xs text-gray-400 flex-shrink-0">{Math.round(food.calories)} kcal</span>
    </div>
  )
}

function MealCard({ meal }: { meal: Meal }) {
  const { t } = useLocale()
  const alternatives: MealAlternative[] = meal.alternatives?.length ? meal.alternatives : [{ foods: meal.foods }]
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{meal.name}</h3>
        {meal.time && <span className="text-xs text-gray-400">{meal.time}</span>}
      </div>
      {alternatives.map((alt, i) => (
        <div key={i} className={i > 0 ? 'pt-2 border-t border-gray-50' : ''}>
          {alternatives.length > 1 && (
            <p className="text-xs font-semibold text-[#2d8653] mb-1">
              {t('mealPlans.alternativeNumber', { n: i + 1 })}{alt.name ? ` — ${alt.name}` : ''}
            </p>
          )}
          {alt.foods.map((f, fi) => <FoodLine key={fi} food={f} />)}
        </div>
      ))}
    </div>
  )
}

// Read-only summary for a meal plan shared by another coach in the org
// (see migration 061/062). Deliberately not the full drag-and-drop editor —
// the coach can't edit someone else's plan directly, only copy it into their
// own library and edit the copy from there.
export function SharedMealPlanView({ plan }: { plan: PlanProp }) {
  const router = useRouter()
  const { t } = useLocale()
  const [copying, setCopying] = useState(false)
  const [error, setError]     = useState('')

  async function handleCopy() {
    setCopying(true)
    setError('')
    const res = await fetch(`/api/meal-plans/${plan.id}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'duplicate' }),
    })
    setCopying(false)
    if (res.ok) {
      const { newPlanId } = await res.json()
      router.push(`/meal-plans/${newPlanId}`)
    } else {
      setError(t('mealPlans.copyFailed'))
    }
  }

  const hasMacros = plan.calories_target || plan.protein_g || plan.carbs_g || plan.fat_g

  const macros = [
    { label: t('clientDetail.nutrition.calories'), value: plan.calories_target ? `${plan.calories_target} kcal` : '—', color: 'text-orange-600' },
    { label: t('clientDetail.nutrition.protein'),  value: plan.protein_g        ? `${plan.protein_g}g`            : '—', color: 'text-[#2d8653]' },
    { label: t('clientDetail.nutrition.carbs'),    value: plan.carbs_g          ? `${plan.carbs_g}g`               : '—', color: 'text-yellow-600' },
    { label: t('clientDetail.nutrition.fat'),      value: plan.fat_g            ? `${plan.fat_g}g`                 : '—', color: 'text-red-500' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <Link
        href="/meal-plans"
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {t('mealPlans.backToMealPlans')}
      </Link>

      <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-700 flex items-center gap-2">
        <Share2 className="w-4 h-4 flex-shrink-0" />
        {t('mealPlans.sharedByOtherCoach')}
      </div>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#1a5c3a]">{plan.title}</h1>
        <button
          onClick={handleCopy}
          disabled={copying}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[#2d8653] text-white text-sm font-semibold hover:bg-[#1a5c3a] disabled:opacity-50 transition-colors flex-shrink-0"
        >
          {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
          {copying ? t('mealPlans.copying') : t('mealPlans.copyToMine')}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {hasMacros && (
        <div className="grid grid-cols-4 gap-3">
          {macros.map(m => (
            <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {plan.meals.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">{t('mealPlans.noMealsYet')}</p>
        ) : (
          plan.meals.map((meal, i) => <MealCard key={i} meal={meal} />)
        )}
      </div>
    </div>
  )
}
