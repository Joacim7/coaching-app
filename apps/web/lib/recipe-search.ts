'use client'

import { useEffect, useState } from 'react'
import type { RecipeLibraryRow } from '@/lib/recipe-to-alternative'

// The coach's whole recipe library — standard, own and org-shared (see /api/recipes).
export function useRecipeLibrary() {
  const [recipes, setRecipes] = useState<RecipeLibraryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/recipes')
      .then(res => res.ok ? res.json() : [])
      .then((data: RecipeLibraryRow[]) => setRecipes(data ?? []))
      .catch(() => setRecipes([]))
      .finally(() => setLoading(false))
  }, [])

  return { recipes, loading }
}

export function searchTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

// True when every search word appears in the title or one of the ingredient names.
export function matchesSearch(terms: string[], title: string | null | undefined, ingredientNames: (string | null | undefined)[]): boolean {
  if (terms.length === 0) return true
  const text = [title ?? '', ...ingredientNames.map(n => n ?? '')].join(' ').toLowerCase()
  return terms.every(t => text.includes(t))
}
