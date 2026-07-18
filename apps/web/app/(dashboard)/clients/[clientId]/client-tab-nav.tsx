'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Oversikt',          path: '' },
  { label: 'Trening',           path: '/training' },
  { label: 'Progresjon',        path: '/progression' },
  { label: 'Ernæring',          path: '/nutrition' },
  { label: 'Vaner',             path: '/habits' },
  { label: 'Progresjonsbilder', path: '/photos' },
  { label: 'Økonomi',           path: '/finance' },
]

export function ClientTabNav({ clientId }: { clientId: string }) {
  const pathname = usePathname()
  const base = `/clients/${clientId}`

  return (
    <div className="flex border-b border-gray-200 overflow-x-auto bg-white rounded-t-2xl pt-1 px-2 -mb-px">
      {TABS.map(tab => {
        const href = `${base}${tab.path}`
        const isActive = tab.path === '' ? pathname === base : pathname.startsWith(href)
        return (
          <Link
            key={tab.path}
            href={href}
            className={`relative flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              isActive
                ? 'text-[#2d8653] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#2d8653]'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
