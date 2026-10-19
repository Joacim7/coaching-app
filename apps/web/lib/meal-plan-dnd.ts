import { pointerWithin, rectIntersection, type CollisionDetection, type UniqueIdentifier } from '@dnd-kit/core'

// Drop target ids shared by both meal plan editors:
//   meal-<mi>        a meal-type tab        → add to the end of that meal
//   body-<mi>        the open meal's list   → add to the end of that meal
//   slot-<mi>-<ai>   an alternative card    → insert at / move to that position
export type MealDropTarget = { mealIdx: number; pos: number | null; kind: 'tab' | 'body' | 'slot' }

export function parseMealDropTarget(id: UniqueIdentifier): MealDropTarget | null {
  const m = String(id).match(/^(meal|body|slot)-(\d+)(?:-(\d+))?$/)
  if (!m) return null
  const kind = m[1] === 'meal' ? 'tab' : (m[1] as 'body' | 'slot')
  return { mealIdx: Number(m[2]), pos: m[3] != null ? Number(m[3]) : null, kind }
}

// Alternative cards sit inside the meal's list droppable, so whatever is
// under the pointer wins, most specific first (card, then tab, then list).
const RANK = { slot: 0, tab: 1, body: 2 } as const
export const mealPlanCollision: CollisionDetection = args => {
  const hits = pointerWithin(args)
  if (hits.length === 0) return rectIntersection(args)
  const rank = (id: UniqueIdentifier) => RANK[parseMealDropTarget(id)?.kind ?? 'body']
  return [...hits].sort((a, b) => rank(a.id) - rank(b.id))
}

export function insertAt<T>(arr: T[], item: T, pos: number | null): T[] {
  const next = [...arr]
  next.splice(pos ?? next.length, 0, item)
  return next
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr]
  const [item] = next.splice(from, 1)
  next.splice(Math.min(to, next.length), 0, item)
  return next
}
