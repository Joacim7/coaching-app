'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Search, X, ChefHat, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { RecipeLibraryRow } from '@/lib/recipe-to-alternative'

// Drag payload shape both editors' onDragEnd handlers key off of — a plain
// object (not the raw dnd-kit event), read from event.active.data.current.
export type RecipeDragData = { type: 'recipe'; recipe: RecipeLibraryRow }

function RecipeCard({ recipe }: { recipe: RecipeLibraryRow }) {
  const dragData: RecipeDragData = { type: 'recipe', recipe }
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`,
    data: dragData,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined}
      className={`flex items-center gap-2.5 p-2 rounded-xl border border-gray-100 bg-white cursor-grab active:cursor-grabbing hover:border-[#cdeee3] hover:shadow-sm transition-shadow ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      {recipe.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-[#ebf5ef] flex items-center justify-center flex-shrink-0">
          <ChefHat className="w-4 h-4 text-[#2d8653]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-900 truncate">{recipe.title}</p>
        {recipe.calories_per_serving != null && (
          <p className="text-[10px] text-gray-400">{Math.round(recipe.calories_per_serving)} kcal</p>
        )}
      </div>
    </div>
  )
}

// Renders the drag ghost that follows the cursor — a lighter copy of
// RecipeCard without the useDraggable wiring, since DragOverlay renders
// outside the normal DOM flow and manages its own positioning.
export function RecipeDragOverlayCard({ recipe }: { recipe: RecipeLibraryRow }) {
  return (
    <div className="flex items-center gap-2.5 p-2 rounded-xl border border-[#2d8653] bg-white shadow-lg w-56">
      {recipe.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-[#ebf5ef] flex items-center justify-center flex-shrink-0">
          <ChefHat className="w-4 h-4 text-[#2d8653]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-900 truncate">{recipe.title}</p>
        {recipe.calories_per_serving != null && (
          <p className="text-[10px] text-gray-400">{Math.round(recipe.calories_per_serving)} kcal</p>
        )}
      </div>
    </div>
  )
}

export function RecipeDragSidebar({ onClose }: { onClose: () => void }) {
  const [recipes, setRecipes]   = useState<RecipeLibraryRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [query, setQuery]       = useState('')

  useEffect(() => {
    fetch('/api/recipes')
      .then(res => res.ok ? res.json() : [])
      .then((data: RecipeLibraryRow[]) => setRecipes(data ?? []))
      .catch(() => setRecipes([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recipes
    return recipes.filter(r => r.title.toLowerCase().includes(q))
  }, [recipes, query])

  return (
    <div className="w-64 flex-shrink-0 border border-gray-100 rounded-2xl bg-gray-50/50 flex flex-col overflow-hidden h-fit max-h-[calc(100vh-160px)] sticky top-4">
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-100 bg-white">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <ChefHat className="w-4 h-4 text-[#2d8653]" />
          Oppskrifter
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-0.5" title="Skjul oppskrifter">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 pt-2.5 pb-2 border-b border-gray-100 bg-white">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Søk oppskrifter..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8 px-2">
            {recipes.length === 0
              ? 'Ingen lagrede oppskrifter ennå. Legg til oppskrifter under Oppskrifter i menyen.'
              : 'Ingen treff.'}
          </p>
        ) : (
          filtered.map(r => <RecipeCard key={r.id} recipe={r} />)
        )}
      </div>

      <p className="text-[10px] text-gray-400 px-3 py-2 border-t border-gray-100 bg-white">
        Dra en oppskrift til et måltid for å legge den til som alternativ.
      </p>
    </div>
  )
}
