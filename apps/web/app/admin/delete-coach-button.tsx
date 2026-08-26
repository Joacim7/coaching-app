'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function DeleteCoachButton({ coachId, coachName }: { coachId: string; coachName: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(
      `Slette ${coachName} og all data de eier (treningsplaner, matplaner, faser, mål, kontrakter, maler, øvelser, dokumenter osv.)?\n\nKlientene deres blir IKKE slettet, kun koblingen til denne coachen.\n\nDette kan ikke angres.`
    )) return
    setDeleting(true)
    const res = await fetch(`/api/admin/coaches/${coachId}`, { method: 'DELETE' })
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Kunne ikke slette coachen')
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title="Slett coach"
      className="text-gray-300 hover:text-red-500 disabled:opacity-50 transition-colors"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
