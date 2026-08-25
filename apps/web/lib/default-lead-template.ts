import type { CheckinQuestion } from '@coaching/types'

// A standalone coach with no lead intake template of their own gets these
// sensible defaults — used both at registration time (see
// app/auth/register/register-form.tsx) and as a lazy fallback for accounts
// that predate that auto-creation (see app/start/[coachId]/page.tsx).
export function defaultLeadTemplateQuestions(): CheckinQuestion[] {
  return [
    { id: crypto.randomUUID(), text: 'Fornavn', type: 'text', required: true },
    { id: crypto.randomUUID(), text: 'Etternavn', type: 'text', required: true },
    { id: crypto.randomUUID(), text: 'Mobilnummer', type: 'text', required: true },
    { id: crypto.randomUUID(), text: 'E-post', type: 'text', required: true },
    { id: crypto.randomUUID(), text: 'Mål', type: 'text' },
    { id: crypto.randomUUID(), text: 'Hvordan fant du oss?', type: 'text' },
  ]
}
