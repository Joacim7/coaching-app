'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/components/locale-provider'
import type { TranslationKey } from '@/lib/i18n/translations'

const TABS: { labelKey: TranslationKey; path: string }[] = [
  { labelKey: 'clientDetail.tabs.overview',    path: '' },
  { labelKey: 'clientDetail.tabs.training',    path: '/training' },
  { labelKey: 'clientDetail.tabs.progression', path: '/progression' },
  { labelKey: 'clientDetail.tabs.nutrition',   path: '/nutrition' },
  { labelKey: 'clientDetail.tabs.habits',      path: '/habits' },
  { labelKey: 'clientDetail.tabs.photos',      path: '/photos' },
  { labelKey: 'clientDetail.tabs.finance',     path: '/finance' },
]

export function ClientTabNav({ clientId }: { clientId: string }) {
  const pathname = usePathname()
  const { t } = useLocale()
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
            {t(tab.labelKey)}
          </Link>
        )
      })}
    </div>
  )
}
