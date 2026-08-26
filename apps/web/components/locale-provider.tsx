'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import { translate, normalizeLocale, type Locale, type TranslationKey } from '@/lib/i18n/translations'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

// Provided once at the dashboard layout, seeded from profiles.language.
// setLocale() only updates in-memory state so every consumer re-renders in
// the new language immediately on selection — persisting the choice to the
// DB is a separate, explicit save (see settings-view.tsx), same as the
// other preferences on that page.
export function LocaleProvider({
  initialLocale, children,
}: {
  initialLocale: string
  children: React.ReactNode
}) {
  const [locale, setLocale] = useState<Locale>(normalizeLocale(initialLocale))

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    t: (key, vars) => translate(locale, key, vars),
  }), [locale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider')
  return ctx
}
