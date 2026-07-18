'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChefHat, Plus, ImageIcon, Loader2, CheckCircle2, Share2, Sparkles } from 'lucide-react'
import { recipeImageUrl } from '@/lib/food-image'

export interface RecipeRow {
  id: string
  title: string
  description: string | null
  image_url: string | null
  meal_type: string | null
  servings: number
  calories_per_serving: number | null
  protein_per_serving: number | null
  carbs_per_serving: number | null
  fat_per_serving: number | null
  ingredients: unknown[]
  created_at: string
  is_org_shared?: boolean
}

const MEAL_TYPES = ['Frokost', 'Lunsj', 'Middag', 'Snack', 'Kveldsmat', 'Ettermiddag']

type BackfillState =
  | { status: 'idle' }
  | { status: 'running'; current: number; total: number; title: string }
  | { status: 'done'; updated: number; skipped: number }
  | { status: 'error' }

export function RecipesView({ recipes, loadError }: { recipes: RecipeRow[]; loadError?: string | null }) {
  const [activeTab,   setActiveTab]   = useState<string | null>(null)
  const [backfill,    setBackfill]    = useState<BackfillState>({ status: 'idle' })
  const [imageOverrides, setImageOverrides] = useState<Record<string, string>>({})
  const [generating,     setGenerating]     = useState<Record<string, boolean>>({})
  const [genError,       setGenError]       = useState<Record<string, string>>({})

  async function handleGenerateImage(e: React.MouseEvent, recipeId: string) {
    e.preventDefault()
    e.stopPropagation()
    if (generating[recipeId]) return

    setGenerating(prev => ({ ...prev, [recipeId]: true }))
    setGenError(prev => ({ ...prev, [recipeId]: '' }))

    try {
      const res = await fetch(`/api/recipes/${recipeId}/generate-image`, { method: 'POST' })
      const json = await res.json() as { image_url?: string; error?: string }
      if (!res.ok || !json.image_url) {
        setGenError(prev => ({ ...prev, [recipeId]: json.error ?? 'Kunne ikke generere bilde' }))
      } else {
        setImageOverrides(prev => ({ ...prev, [recipeId]: json.image_url! }))
      }
    } catch {
      setGenError(prev => ({ ...prev, [recipeId]: 'Kunne ikke generere bilde' }))
    } finally {
      setGenerating(prev => ({ ...prev, [recipeId]: false }))
    }
  }

  async function handleBackfill() {
    setBackfill({ status: 'running', current: 0, total: 0, title: '' })

    let res: Response
    try {
      res = await fetch('/api/recipes/backfill-images', { method: 'POST' })
    } catch {
      setBackfill({ status: 'error' })
      return
    }

    if (!res.ok || !res.body) {
      setBackfill({ status: 'error' })
      return
    }

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let   buffer  = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6)) as Record<string, unknown>
          if (event.type === 'progress') {
            setBackfill({
              status:  'running',
              current: event.current as number,
              total:   event.total   as number,
              title:   event.title   as string,
            })
          } else if (event.type === 'done') {
            setBackfill({
              status:  'done',
              updated: event.updated as number,
              skipped: event.skipped as number,
            })
          }
        } catch { /* malformed line — skip */ }
      }
    }
  }

  const filtered = activeTab
    ? recipes.filter(r => r.meal_type?.toLowerCase() === activeTab.toLowerCase())
    : recipes
  const countFor = (t: string) => recipes.filter(r => r.meal_type?.toLowerCase() === t.toLowerCase()).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a5c3a]">Oppskrifter</h1>
          <p className="text-sm text-gray-500 mt-0.5">{recipes.length} oppskrifter i biblioteket</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBackfill}
            disabled={backfill.status === 'running'}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {backfill.status === 'running'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : backfill.status === 'done'
                ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                : <ImageIcon className="w-4 h-4" />}
            Hent bilder
          </button>
          <Link
            href="/recipes/new"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-white text-sm font-semibold transition-all [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a]"
          >
            <Plus className="w-4 h-4" />
            Ny oppskrift
          </Link>
        </div>
      </div>

      {/* Backfill progress / result */}
      {backfill.status === 'running' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#ebf5ef] border border-[#cdeee3] text-sm text-[#1a5c3a]">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span className="min-w-0">
            {backfill.total > 0
              ? <><span className="font-semibold">{backfill.current}/{backfill.total}</span> — {backfill.title}</>
              : 'Starter...'}
          </span>
        </div>
      )}
      {backfill.status === 'done' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#ebf5ef] border border-[#cdeee3] text-sm text-[#1a5c3a]">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>
            <span className="font-semibold">{backfill.updated} bilder</span> hentet
            {backfill.skipped > 0 && <>, {backfill.skipped} hoppet over</>}
          </span>
        </div>
      )}
      {backfill.status === 'error' && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
          Kunne ikke hente bilder — sjekk at PEXELS_API_KEY er satt i .env.local
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab(null)}
          className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
            !activeTab ? 'border-[#2d8653] text-[#2d8653]' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Alle <span className="text-gray-400 text-xs ml-1">{recipes.length}</span>
        </button>
        {MEAL_TYPES.map(type => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === type ? 'border-[#2d8653] text-[#2d8653]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {type}
            {countFor(type) > 0 && <span className="text-gray-400 text-xs ml-1">{countFor(type)}</span>}
          </button>
        ))}
      </div>

      {/* Load error — distinct from "genuinely no recipes" so it's not silently hidden */}
      {loadError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
          Kunne ikke laste oppskrifter: {loadError}
        </div>
      )}

      {/* Empty state */}
      {!loadError && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ChefHat className="w-10 h-10 text-gray-200 mb-3" />
          <p className="font-medium text-gray-500 text-sm">Ingen oppskrifter</p>
          {activeTab && (
            <p className="text-xs text-gray-400 mt-1">Ingen {activeTab}-oppskrifter i biblioteket</p>
          )}
        </div>
      )}

      {/* Recipe grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(recipe => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="group bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              <div className="relative w-full h-40 bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageOverrides[recipe.id] ?? recipe.image_url ?? recipeImageUrl((recipe.ingredients as { name: string }[]).map(i => i.name))}
                  alt={recipe.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={e => {
                    console.error('[recipes-view] image failed to load:', (e.target as HTMLImageElement).src)
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                <button
                  onClick={e => handleGenerateImage(e, recipe.id)}
                  disabled={generating[recipe.id]}
                  className="absolute top-2 right-2 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-medium hover:bg-black/75 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {generating[recipe.id]
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Sparkles className="w-3.5 h-3.5" />}
                  Generer bilde
                </button>
                {genError[recipe.id] && (
                  <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg bg-red-600/90 text-white text-[11px] font-medium">
                    {genError[recipe.id]}
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  {recipe.meal_type && (
                    <p className="text-[10px] font-semibold text-[#2d8653] uppercase tracking-wide">{recipe.meal_type}</p>
                  )}
                  {recipe.is_org_shared && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      <Share2 className="w-2.5 h-2.5" />
                      Delt
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 flex-1">
                  {recipe.title}
                </h3>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                  {recipe.calories_per_serving != null && (
                    <span className="text-xs font-medium text-orange-600">{Math.round(recipe.calories_per_serving)} kcal</span>
                  )}
                  {recipe.protein_per_serving != null && (
                    <span className="text-xs font-medium text-[#2d8653]">{Math.round(recipe.protein_per_serving)}g P</span>
                  )}
                  {recipe.carbs_per_serving != null && (
                    <span className="text-xs font-medium text-yellow-600">{Math.round(recipe.carbs_per_serving)}g K</span>
                  )}
                  {recipe.fat_per_serving != null && (
                    <span className="text-xs font-medium text-red-500">{Math.round(recipe.fat_per_serving)}g F</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
