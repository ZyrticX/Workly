'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotificationSound } from '@/hooks/use-notification-sound'

const supabase = createClient()

/**
 * Returns the total unread message count across all conversations for a business.
 * Subscribes to realtime updates so the count stays current.
 * Plays a notification sound when the count increases.
 */
export function useInboxUnreadCount(businessId: string | null): number {
  const [count, setCount] = useState(0)
  const prevCountRef = useRef(0)
  const playSound = useNotificationSound()

  const fetchCount = useCallback(async () => {
    if (!businessId) {
      setCount(0)
      return
    }

    const { data } = await supabase
      .from('conversations')
      .select('unread_count')
      .eq('business_id', businessId)
      .gt('unread_count', 0)

    if (data) {
      const total = data.reduce((sum, c) => sum + (c.unread_count || 0), 0)
      setCount(total)
    }
  }, [businessId])

  // Play sound when unread count increases
  useEffect(() => {
    if (count > prevCountRef.current && prevCountRef.current >= 0) {
      playSound()
    }
    prevCountRef.current = count
  }, [count, playSound])

  useEffect(() => {
    fetchCount()
  }, [fetchCount])

  // Subscribe to conversation changes (unread_count updates trigger refetch)
  useEffect(() => {
    if (!businessId) return

    const channel = supabase
      .channel(`inbox-unread:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          fetchCount()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [businessId, fetchCount])

  return count
}
