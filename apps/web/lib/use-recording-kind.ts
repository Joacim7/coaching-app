'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Looks up whether a pasted feedback link points at one of the coach's own
// audio-only recordings. Anything else (video recordings, external links,
// no match) is treated as video.
export function useRecordingKind(url: string): 'video' | 'audio' {
  const [kind, setKind] = useState<'video' | 'audio'>('video')

  useEffect(() => {
    const link = url.trim()
    if (!link) return
    let cancelled = false
    createClient()
      .from('recordings')
      .select('kind')
      .eq('share_url', link)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setKind(data?.kind === 'audio' ? 'audio' : 'video')
      })
    return () => { cancelled = true }
  }, [url])

  return kind
}
