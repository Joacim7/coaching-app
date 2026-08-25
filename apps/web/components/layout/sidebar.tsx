'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  Video, Home, Users, MessageSquare, FileText, UserPlus, BarChart2,
  Dumbbell, UtensilsCrossed, DollarSign, FolderOpen, Building2,
  Settings, LogOut, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRecording } from '@/components/recording-provider'
import { useLocale } from '@/components/locale-provider'
import type { TranslationKey } from '@/lib/i18n/translations'

// ── Brand colors ───────────────────────────────────────────────────────────────
const NOVA_DARK       = '#1a5c3a'
const NOVA_MID        = '#2d8653'
const NOVA_MINT       = '#6ecfb0'
const NOVA_ACTIVE_BG  = '#1a5c3a20'   // ~12% opacity dark green
const NOVA_AVATAR_BG  = '#cdeee3'     // light mint for avatar

// ── Nav data ──────────────────────────────────────────────────────────────────
// `key` is a stable, non-localized identifier used for expand/collapse state
// and path-matching — only `labelKey` (resolved via t()) changes with locale.

type Child = { href: string; labelKey: TranslationKey }
type NavItem = {
  href?: string
  key: string
  labelKey: TranslationKey
  icon: React.ElementType
  children?: Child[]
}
type Section = { labelKey: TranslationKey; items: NavItem[] }

const sections: Section[] = [
  {
    labelKey: 'sidebar.section.clients',
    items: [
      { href: '/dashboard', key: 'home',     labelKey: 'sidebar.home',     icon: Home },
      { href: '/clients',   key: 'clients',  labelKey: 'sidebar.clients',  icon: Users },
      { href: '/messages',  key: 'messages', labelKey: 'sidebar.messages', icon: MessageSquare },
      {
        key: 'forms', labelKey: 'sidebar.forms', icon: FileText,
        children: [
          { href: '/check-in-templates',        labelKey: 'sidebar.forms.templates' },
          { href: '/skjemaer/ukentlig-oversikt', labelKey: 'sidebar.forms.weeklyOverview' },
          { href: '/skjemaer/onboarding',        labelKey: 'sidebar.forms.onboardingSubmissions' },
        ],
      },
      { href: '/leads',     key: 'leads',     labelKey: 'sidebar.leads',     icon: UserPlus },
      { href: '/analytics', key: 'analytics', labelKey: 'sidebar.analytics', icon: BarChart2 },
    ],
  },
  {
    labelKey: 'sidebar.section.planning',
    items: [
      {
        key: 'training', labelKey: 'sidebar.training', icon: Dumbbell,
        children: [
          { href: '/training-plans',   labelKey: 'sidebar.training.plans' },
          { href: '/exercise-library', labelKey: 'sidebar.training.exerciseLibrary' },
        ],
      },
      {
        key: 'nutrition', labelKey: 'sidebar.nutrition', icon: UtensilsCrossed,
        children: [
          { href: '/recipes',     labelKey: 'sidebar.nutrition.recipes' },
          { href: '/ingredients', labelKey: 'sidebar.nutrition.ingredients' },
          { href: '/meal-plans',  labelKey: 'sidebar.nutrition.mealPlans' },
        ],
      },
    ],
  },
  {
    labelKey: 'sidebar.section.admin',
    items: [
      { href: '/finance',      key: 'finance',      labelKey: 'sidebar.finance',      icon: DollarSign },
      { href: '/documents',    key: 'documents',    labelKey: 'sidebar.documents',    icon: FolderOpen },
      { href: '/organization', key: 'organization', labelKey: 'sidebar.organization', icon: Building2 },
    ],
  },
]

const TRENING_PATHS   = ['/training-plans', '/exercise-library']
const KOSTHOLD_PATHS  = ['/recipes', '/ingredients', '/meal-plans']
const SKJEMAER_PATHS  = ['/check-in-templates', '/skjemaer']

// ── Component ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { openRecordModal, stage, timer } = useRecording()
  const { t } = useLocale()

  const [userName, setUserName]         = useState('')
  const [userInitials, setUserInitials] = useState('?')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    training: TRENING_PATHS.some(p  => pathname.startsWith(p)),
    nutrition: KOSTHOLD_PATHS.some(p => pathname.startsWith(p)),
    forms:    SKJEMAER_PATHS.some(p => pathname.startsWith(p)),
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const name = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Bruker'
      setUserName(name)
      const parts = name.trim().split(/\s+/)
      setUserInitials(
        parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : name.slice(0, 2).toUpperCase()
      )
    })
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  function toggleExpand(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Inline style helpers
  const activeStyle   = { backgroundColor: NOVA_ACTIVE_BG, color: NOVA_DARK }
  const activeIcon    = { color: NOVA_MID }
  const activeChevron = { color: NOVA_MINT }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100 flex flex-col z-50">

      {/* Logo */}
      <div className="flex items-center px-5 py-5 border-b border-gray-100">
        <Image
          src="/nova-performance-logo.png"
          alt="Nova Performance"
          width={180}
          height={60}
          className="object-contain"
          priority
        />
      </div>

      {/* Record */}
      <div className="px-3 pt-3 pb-1">
        <div>
          <button
            onClick={openRecordModal}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              stage === 'recording'
                ? 'bg-red-50 text-red-700'
                : isActive('/recordings')
                ? ''
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
            style={stage !== 'recording' && isActive('/recordings') ? activeStyle : undefined}
          >
            <div className="relative flex-shrink-0">
              <Video
                className="w-4 h-4"
                style={
                  stage === 'recording'
                    ? { color: '#dc2626' }
                    : isActive('/recordings')
                    ? activeIcon
                    : { color: '#9ca3af' }
                }
              />
              {stage === 'recording' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </div>
            <span className="flex-1 text-left">{t('sidebar.record')}</span>
            {stage === 'recording' && (
              <span className="text-[10px] font-mono text-red-500 font-semibold">
                {String(Math.floor(timer / 60)).padStart(2,'0')}:{String(timer % 60).padStart(2,'0')}
              </span>
            )}
          </button>

          <div className="mt-0.5 ml-7 pl-3 border-l border-gray-100 space-y-0.5">
            <Link
              href="/recordings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={isActive('/recordings') ? activeStyle : undefined}
            >
              <span className={isActive('/recordings') ? '' : 'text-gray-500 hover:text-gray-900'}>
                {t('sidebar.myRecordings')}
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Nav-seksjoner */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-4">
        {sections.map(section => (
          <div key={section.labelKey}>
            <p className="px-3 mb-1 text-[10px] font-semibold text-gray-400 tracking-wider uppercase">
              {t(section.labelKey)}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                // ── Expandable parent (has children, no href) ──
                if (item.children) {
                  const isOpen     = !!expanded[item.key]
                  const groupActive = item.children.some(c => isActive(c.href))
                  const Icon = item.icon
                  return (
                    <div key={item.key}>
                      <button
                        onClick={() => toggleExpand(item.key)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          groupActive ? '' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        )}
                        style={groupActive ? activeStyle : undefined}
                      >
                        <Icon
                          className="w-4 h-4 flex-shrink-0"
                          style={groupActive ? activeIcon : { color: '#9ca3af' }}
                        />
                        <span className="flex-1 text-left">{t(item.labelKey)}</span>
                        <ChevronRight
                          className={cn('w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0', isOpen ? 'rotate-90' : '')}
                          style={groupActive ? activeChevron : { color: '#d1d5db' }}
                        />
                      </button>

                      {isOpen && (
                        <div className="mt-0.5 ml-7 pl-3 border-l border-gray-100 space-y-0.5">
                          {item.children.map(child => {
                            const childActive = isActive(child.href)
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={cn(
                                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                                  childActive ? '' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                )}
                                style={childActive ? activeStyle : undefined}
                              >
                                {t(child.labelKey)}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                // ── Regular link ──
                const active = isActive(item.href!)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href!}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      active ? '' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                    style={active ? activeStyle : undefined}
                  >
                    <Icon
                      className="w-4 h-4 flex-shrink-0"
                      style={active ? activeIcon : { color: '#9ca3af' }}
                    />
                    {t(item.labelKey)}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Brukerinfo */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2 px-2 py-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: NOVA_AVATAR_BG }}
          >
            <span className="text-xs font-semibold" style={{ color: NOVA_DARK }}>{userInitials}</span>
          </div>
          <span className="flex-1 text-sm font-medium text-gray-800 truncate min-w-0">{userName}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link
              href="/settings"
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title={t('sidebar.settings')}
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title={t('sidebar.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
