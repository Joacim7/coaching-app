import { ListChecks } from 'lucide-react'

export default function HabitsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center mb-4">
        <ListChecks className="w-7 h-7 text-teal-600" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">Vaner</h3>
      <p className="text-sm text-gray-400 max-w-xs">
        Vanetracking kommer snart. Her vil du se klientens daglige vaner og etterlevelse.
      </p>
    </div>
  )
}
