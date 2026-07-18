import { createClient } from '@/lib/supabase/server'
import { DocumentsView } from './documents-view'

export const metadata = { title: 'Dokumenter' }

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Coach's own documents ──────────────────────────────────────────────────
  const { data: rawDocs } = await supabase
    .from('coach_documents')
    .select('*, shares:coach_document_shares(client_id)')
    .eq('coach_id', user!.id)
    .order('created_at', { ascending: false })

  const myDocuments = (rawDocs ?? []).map(doc => ({
    id:              doc.id as string,
    name:            doc.name as string,
    description:     doc.description as string | null,
    file_path:       doc.file_path as string,
    file_size_bytes: doc.file_size_bytes as number | null,
    file_type:       doc.file_type as string | null,
    created_at:      doc.created_at as string,
    share_count:     Array.isArray(doc.shares) ? doc.shares.length : 0,
    shared_client_ids: Array.isArray(doc.shares)
      ? (doc.shares as { client_id: string }[]).map(s => s.client_id)
      : [],
  }))

  // ── Org documents ──────────────────────────────────────────────────────────
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(name)')
    .eq('user_id', user!.id)
    .maybeSingle()

  const orgName = membership?.organizations
    ? (Array.isArray(membership.organizations)
        ? membership.organizations[0]?.name
        : (membership.organizations as { name: string }).name)
    : null

  const orgDocuments: {
    id: string
    name: string
    file_path: string
    file_size_bytes: number | null
    file_type: string | null
    created_at: string
    shared_client_ids: string[]
  }[] = []

  if (membership?.org_id) {
    const { data: orgDocs } = await supabase
      .from('org_documents')
      .select('id, name, file_path, file_size_bytes, file_type, created_at')
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: false })

    if (orgDocs?.length) {
      const { data: orgShares } = await supabase
        .from('org_document_shares')
        .select('org_document_id, client_id')
        .eq('coach_id', user!.id)
        .in('org_document_id', orgDocs.map(d => d.id))

      const sharesByDoc: Record<string, string[]> = {}
      for (const s of orgShares ?? []) {
        sharesByDoc[s.org_document_id] ??= []
        sharesByDoc[s.org_document_id].push(s.client_id)
      }

      for (const doc of orgDocs) {
        orgDocuments.push({
          id:              doc.id,
          name:            doc.name,
          file_path:       doc.file_path,
          file_size_bytes: doc.file_size_bytes,
          file_type:       doc.file_type,
          created_at:      doc.created_at,
          shared_client_ids: sharesByDoc[doc.id] ?? [],
        })
      }
    }
  }

  // ── Clients for share modal ────────────────────────────────────────────────
  const { data: clientRels } = await supabase
    .from('coach_clients')
    .select('client_id, profile:profiles!client_id(id, full_name, avatar_url)')
    .eq('coach_id', user!.id)
    .neq('status', 'inactive')
    .order('created_at', { ascending: false })

  const clients = (clientRels ?? []).map(r => {
    const p = Array.isArray(r.profile) ? r.profile[0] : r.profile
    return {
      id:        r.client_id,
      full_name: (p as { full_name: string | null } | null)?.full_name ?? 'Ukjent klient',
    }
  })

  return (
    <DocumentsView
      coachId={user!.id}
      myDocuments={myDocuments}
      orgDocuments={orgDocuments}
      orgName={orgName ?? null}
      clients={clients}
    />
  )
}
