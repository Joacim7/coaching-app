// Heuristic used by /admin to decide which coaches are safe to hard-delete
// from the panel — deliberately conservative: only accounts with no email at
// all, or an email that clearly marks them as a test/dev account. Shared
// between the page (to decide whether to render the delete button) and the
// delete API route (to re-validate server-side — never trust the client).
export function isDeletableTestCoach(email: string | null | undefined): boolean {
  if (!email) return true
  const lower = email.toLowerCase()
  return lower.includes('test') || lower.endsWith('@example.com')
}
