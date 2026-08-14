'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function PlanDeleteButton({ planId, planTitle }: { planId: string; planTitle: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Slett treningsplanen "${planTitle}"? Dette kan ikke angres.`)) return
    setDeleting(true)
    const res = await fetch(`/api/training-plans/${planId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Kunne ikke slette planen')
      setDeleting(false)
      return
    }
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title="Slett plan"
      className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
