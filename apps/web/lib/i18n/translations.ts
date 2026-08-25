// Minimal i18n dictionary — covers the dashboard chrome (sidebar) and the
// Settings page, where the language switcher itself lives. Other pages
// remain Norwegian-only for now; extend this file and wrap new strings in
// t('...') the same way to bring them in later.

export type Locale = 'nb' | 'en'

const nb = {
  // Sidebar
  'sidebar.record':                          'Record',
  'sidebar.myRecordings':                    'Mine opptak',
  'sidebar.section.clients':                 'JOBB MED KLIENTER',
  'sidebar.section.planning':                'PLANLEGGING',
  'sidebar.section.admin':                   'ADMINISTRASJON',
  'sidebar.home':                            'Hjem',
  'sidebar.clients':                         'Klienter',
  'sidebar.messages':                        'Meldinger',
  'sidebar.forms':                           'Skjemaer',
  'sidebar.forms.templates':                 'Maler',
  'sidebar.forms.weeklyOverview':            'Ukentlig oversikt',
  'sidebar.forms.onboardingSubmissions':     'Onboarding-innsendinger',
  'sidebar.leads':                           'Leads',
  'sidebar.analytics':                       'Analyser',
  'sidebar.training':                        'Trening',
  'sidebar.training.plans':                  'Treningsplaner',
  'sidebar.training.exerciseLibrary':        'Øvelsesbibliotek',
  'sidebar.nutrition':                       'Kosthold',
  'sidebar.nutrition.recipes':               'Oppskrifter',
  'sidebar.nutrition.ingredients':           'Ingredienser',
  'sidebar.nutrition.mealPlans':             'Matplaner',
  'sidebar.finance':                         'Økonomi',
  'sidebar.documents':                       'Dokumenter',
  'sidebar.organization':                    'Organisasjon',
  'sidebar.settings':                        'Innstillinger',
  'sidebar.logout':                          'Logg ut',

  // Settings page
  'settings.title':                          'Innstillinger',
  'settings.subtitle':                       'Administrer konto, preferanser og varsler',

  'settings.profile.title':                  'Profilinnstillinger',
  'settings.profile.nameNotSet':             'Navn ikke satt',
  'settings.profile.changePhoto':            'Endre bilde',
  'settings.profile.fullName':               'Fullt navn',
  'settings.profile.fullNamePlaceholder':    'Ola Nordmann',
  'settings.profile.email':                  'E-post',
  'settings.profile.emailHint':              'E-post endres via Supabase Auth',
  'settings.profile.phone':                  'Telefon',
  'settings.profile.phonePlaceholder':       '+47 123 45 678',
  'settings.profile.save':                   'Lagre profil',
  'settings.saving':                         'Lagrer...',
  'settings.saved':                          'Lagret!',

  'settings.subscription.title':             'Abonnement',
  'settings.subscription.active':            'Aktiv',
  'settings.subscription.none':              'Ingen aktivt abonnement',
  'settings.subscription.nextRenewal':       'Neste fornyelse',
  'settings.subscription.notAvailable':      'Ikke tilgjengelig',
  'settings.subscription.upgrade':           'Oppgrader plan',

  'settings.invoices.title':                 'Fakturaer',
  'settings.invoices.none':                  'Ingen fakturaer ennå',
  'settings.invoices.download':              'Last ned',
  'settings.invoices.sentTo':                'Fakturaer sendes til',

  'settings.notifications.title':            'Varslingsadministrasjon',
  'settings.notifications.subtitle':         'Velg hvilke hendelser du vil varsles om',
  'settings.notifications.newCheckin':       'Ny check-in innsendt',
  'settings.notifications.newCheckinSub':    'Varsle meg når en klient sender inn check-in',
  'settings.notifications.weeklyReport':     'Ukentlig klientrapport',
  'settings.notifications.weeklyReportSub':  'Oppsummering av alle klienters uke',
  'settings.notifications.newLead':          'Ny lead',
  'settings.notifications.newLeadSub':       'Varsle meg om nye leads fra oppstartslenken',

  'settings.units.title':                    'Enheter og mål',
  'settings.units.subtitle':                 'Gjelder for alle klienter i dashboardet',
  'settings.units.weight':                   'Vektenhet',
  'settings.units.weightSub':                'Brukes i check-ins og progresjon',
  'settings.units.distance':                 'Avstandsenhet',
  'settings.units.distanceSub':              'Brukes i treningsplaner og skritt',
  'settings.units.save':                     'Lagre preferanser',

  'settings.language.title':                 'Språk',
  'settings.language.label':                 'Velg språk',

  'settings.legal.title':                    'Juridisk',
  'settings.legal.privacy':                  'Personvernerklæring',
  'settings.legal.privacySub':               'Hvordan vi behandler dine data',
  'settings.legal.terms':                    'Vilkår for bruk',
  'settings.legal.termsSub':                 'Avtalevilkår for Nova Performance',
  'settings.legal.dpa':                      'Databehandleravtale (DPA)',
  'settings.legal.dpaSub':                   'GDPR-avtale for behandling av klientdata',
} as const

const en: Record<keyof typeof nb, string> = {
  'sidebar.record':                          'Record',
  'sidebar.myRecordings':                    'My recordings',
  'sidebar.section.clients':                 'WORKING WITH CLIENTS',
  'sidebar.section.planning':                'PLANNING',
  'sidebar.section.admin':                   'ADMINISTRATION',
  'sidebar.home':                            'Home',
  'sidebar.clients':                         'Clients',
  'sidebar.messages':                        'Messages',
  'sidebar.forms':                           'Forms',
  'sidebar.forms.templates':                 'Templates',
  'sidebar.forms.weeklyOverview':            'Weekly overview',
  'sidebar.forms.onboardingSubmissions':     'Onboarding submissions',
  'sidebar.leads':                           'Leads',
  'sidebar.analytics':                       'Analytics',
  'sidebar.training':                        'Training',
  'sidebar.training.plans':                  'Training plans',
  'sidebar.training.exerciseLibrary':        'Exercise library',
  'sidebar.nutrition':                       'Nutrition',
  'sidebar.nutrition.recipes':               'Recipes',
  'sidebar.nutrition.ingredients':           'Ingredients',
  'sidebar.nutrition.mealPlans':             'Meal plans',
  'sidebar.finance':                         'Finance',
  'sidebar.documents':                       'Documents',
  'sidebar.organization':                    'Organization',
  'sidebar.settings':                        'Settings',
  'sidebar.logout':                          'Log out',

  'settings.title':                          'Settings',
  'settings.subtitle':                       'Manage account, preferences and notifications',

  'settings.profile.title':                  'Profile settings',
  'settings.profile.nameNotSet':             'Name not set',
  'settings.profile.changePhoto':            'Change photo',
  'settings.profile.fullName':               'Full name',
  'settings.profile.fullNamePlaceholder':    'Jane Doe',
  'settings.profile.email':                  'Email',
  'settings.profile.emailHint':              'Email is changed via Supabase Auth',
  'settings.profile.phone':                  'Phone',
  'settings.profile.phonePlaceholder':       '+47 123 45 678',
  'settings.profile.save':                   'Save profile',
  'settings.saving':                         'Saving...',
  'settings.saved':                          'Saved!',

  'settings.subscription.title':             'Subscription',
  'settings.subscription.active':            'Active',
  'settings.subscription.none':              'No active subscription',
  'settings.subscription.nextRenewal':       'Next renewal',
  'settings.subscription.notAvailable':      'Not available',
  'settings.subscription.upgrade':           'Upgrade plan',

  'settings.invoices.title':                 'Invoices',
  'settings.invoices.none':                  'No invoices yet',
  'settings.invoices.download':              'Download',
  'settings.invoices.sentTo':                'Invoices are sent to',

  'settings.notifications.title':            'Notification management',
  'settings.notifications.subtitle':         'Choose which events you want to be notified about',
  'settings.notifications.newCheckin':       'New check-in submitted',
  'settings.notifications.newCheckinSub':    'Notify me when a client submits a check-in',
  'settings.notifications.weeklyReport':     'Weekly client report',
  'settings.notifications.weeklyReportSub':  "Summary of all clients' week",
  'settings.notifications.newLead':          'New lead',
  'settings.notifications.newLeadSub':       'Notify me about new leads from the intake link',

  'settings.units.title':                    'Units and measurements',
  'settings.units.subtitle':                 'Applies to all clients in the dashboard',
  'settings.units.weight':                   'Weight unit',
  'settings.units.weightSub':                'Used in check-ins and progress tracking',
  'settings.units.distance':                 'Distance unit',
  'settings.units.distanceSub':              'Used in training plans and steps',
  'settings.units.save':                     'Save preferences',

  'settings.language.title':                 'Language',
  'settings.language.label':                 'Choose language',

  'settings.legal.title':                    'Legal',
  'settings.legal.privacy':                  'Privacy policy',
  'settings.legal.privacySub':               'How we handle your data',
  'settings.legal.terms':                    'Terms of use',
  'settings.legal.termsSub':                 'Terms of agreement for Nova Performance',
  'settings.legal.dpa':                      'Data Processing Agreement (DPA)',
  'settings.legal.dpaSub':                   'GDPR agreement for handling client data',
}

export const translations: Record<Locale, Record<keyof typeof nb, string>> = { nb, en }
export type TranslationKey = keyof typeof nb

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === 'en' ? 'en' : 'nb'
}
