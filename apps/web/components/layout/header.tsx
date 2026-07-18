'use client'

import InviteClientDialog from '@/app/(dashboard)/clients/invite-client-dialog'

export function Header({ coachId }: { coachId: string }) {
  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-end px-6 flex-shrink-0">
      <InviteClientDialog coachId={coachId} triggerVariant="success" />
    </header>
  )
}
