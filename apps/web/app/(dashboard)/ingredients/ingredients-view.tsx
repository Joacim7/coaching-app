'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Plus, Trash2, Loader2, X, Leaf, Check } from 'lucide-react'
import type { FoodSearchResult } from '@coaching/types'

export interface CustomIngredient {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  created_at: string
}

interface Props {
  initialCustom: CustomIngredient[]
}

// ── Macro chip ────────────────────────────────────────────────────────────────

function MacroRow({ item }: { item: { calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number } }) {
  return (
    <div className="flex items-center gap-3 text-xs text-gray-500">
      <span className="text-orange-600 font-medium">{Math.round(item.calories_per_100g)} kcal</span>
      <span>{item.protein_per_100g.toFixed(1)}g protein</span>
      <span>{item.carbs_per_100g.toFixed(1)}g karbo</span>
      <span>{item.fat_per_100g.toFixed(1)}g fett</span>
      <span className="text-gray-400">per 100g</span>
    </div>
  )
}

// ── Search result row (with save button) ─────────────────────────────────────

function SearchResultRow({
  food,
  alreadySaved,
  onSave,
}: {
  food: FoodSearchResult
  alreadySaved: boolean
  onSave: (ing: CustomIngredient) => void
}) {
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSavedFl] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/ingredients', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:              food.name,
        calories_per_100g: food.calories_per_100g,
        protein_per_100g:  food.protein_per_100g,
        carbs_per_100g:    food.carbs_per_100g,
        fat_per_100g:      food.fat_per_100g,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const ing = await res.json()
      onSave(ing)
      setSavedFl(true)
    }
  }

  const isSaved = saved || alreadySaved

  return (
    <div className="px-5 py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{food.name}</p>
        <MacroRow item={food} />
      </div>
      <button
        onClick={handleSave}
        disabled={saving || isSaved}
        title={isSaved ? 'Allerede lagret' : 'Lagre til Mine ingredienser'}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
          isSaved
            ? 'bg-[#ebf5ef] text-[#1a5c3a] cursor-default'
            : 'bg-gray-100 text-gray-600 hover:bg-[#ebf5ef] hover:text-[#1a5c3a]'
        }`}
      >
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isSaved ? (
          <>
            <Check className="w-3.5 h-3.5" />
            Lagret
          </>
        ) : (
          <>
            <Plus className="w-3.5 h-3.5" />
            Lagre
          </>
        )}
      </button>
    </div>
  )
}

// ── Add custom ingredient form ────────────────────────────────────────────────

function AddForm({ onSaved }: { onSaved: (ing: CustomIngredient) => void }) {
  const [open,    setOpen]    = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [name,    setName]    = useState('')
  const [kcal,    setKcal]    = useState('')
  const [protein, setProtein] = useState('')
  const [carbs,   setCarbs]   = useState('')
  const [fat,     setFat]     = useState('')

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const res = await fetch('/api/ingredients', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:              name.trim(),
        calories_per_100g: parseFloat(kcal)    || 0,
        protein_per_100g:  parseFloat(protein) || 0,
        carbs_per_100g:    parseFloat(carbs)   || 0,
        fat_per_100g:      parseFloat(fat)     || 0,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const ing = await res.json()
      onSaved(ing)
      setOpen(false)
      setName(''); setKcal(''); setProtein(''); setCarbs(''); setFat('')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Legg til ingrediens
      </button>
    )
  }

  return (
    <div className="bg-[#ebf5ef] border border-[#cdeee3] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Ny egendefinert ingrediens</p>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-gray-500">Verdier per 100g</p>

      <div className="space-y-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Navn på ingrediens *"
          className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
          autoFocus
        />
        <div className="grid grid-cols-4 gap-2">
          {([
            { placeholder: 'Kcal',    value: kcal,    setter: setKcal    },
            { placeholder: 'Protein', value: protein, setter: setProtein },
            { placeholder: 'Karbo',   value: carbs,   setter: setCarbs   },
            { placeholder: 'Fett',    value: fat,     setter: setFat     },
          ]).map(f => (
            <input
              key={f.placeholder}
              type="number"
              min="0"
              value={f.value}
              onChange={e => f.setter(e.target.value)}
              placeholder={f.placeholder}
              className="h-9 px-2 rounded-lg border border-gray-200 bg-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => setOpen(false)}
          className="h-8 px-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Avbryt
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="h-8 px-4 rounded-lg bg-[#2d8653] text-white text-sm font-semibold hover:bg-[#2d8653] disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Lagre
        </button>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function IngredientsView({ initialCustom }: Props) {
  const [query,       setQuery]     = useState('')
  const [results,     setResults]   = useState<FoodSearchResult[]>([])
  const [searching,   setSearching] = useState(false)
  const [custom,      setCustom]    = useState<CustomIngredient[]>(initialCustom)
  const [deleting,    setDeleting]  = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/food-search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch(`/api/ingredients/${id}`, { method: 'DELETE' })
    setCustom(prev => prev.filter(i => i.id !== id))
    setDeleting(null)
  }

  const showSearch = query.length >= 2

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a5c3a]">Ingredienser</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Søk i Matvaretabellen eller legg til egne ingredienser
          </p>
        </div>
        <AddForm onSaved={ing => setCustom(prev => [ing, ...prev])} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Søk i Matvaretabellen (f.eks. laks, havregryn)..."
          className="w-full h-11 pl-10 pr-10 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
        {!searching && query && (
          <button
            onClick={() => { setQuery(''); setResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Matvaretabellen results */}
      {showSearch && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Matvaretabellen</p>
            {!searching && <p className="text-xs text-gray-400">{results.length} resultater</p>}
          </div>
          {searching ? (
            <div className="py-8 flex items-center justify-center text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              Ingen resultater for &quot;{query}&quot;
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {results.map(food => (
                <SearchResultRow
                  key={food.id}
                  food={food}
                  alreadySaved={custom.some(c => c.name.toLowerCase() === food.name.toLowerCase())}
                  onSave={ing => setCustom(prev => [ing, ...prev.filter(c => c.name.toLowerCase() !== ing.name.toLowerCase())])}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom ingredients */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Mine ingredienser</h2>
          <span className="text-xs text-gray-400">{custom.length} ingredienser</span>
        </div>

        {custom.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-14 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
              <Leaf className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">Ingen egendefinerte ingredienser</p>
            <p className="text-xs text-gray-400 mt-0.5">Klikk &quot;Legg til ingrediens&quot; for å lage egne</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {custom.map(ing => (
              <div key={ing.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{ing.name}</p>
                  <MacroRow item={ing} />
                </div>
                <button
                  onClick={() => handleDelete(ing.id)}
                  disabled={deleting === ing.id}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  {deleting === ing.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
