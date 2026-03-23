'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type PostgresChange<T extends { [key: string]: any }> = RealtimePostgresChangesPayload<T>

// Module-level singleton — avoids creating a new client on every render
const supabase = createClient()

/**
 * Subscribe to realtime messages for a specific conversation.
 * Returns messages array that updates in real-time.
 */
export function useRealtimeMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setMessages(data)
    }
    setLoading(false)
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Subscribe to realtime changes
  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: PostgresChange<any>) => {
          setMessages((prev) => [...prev, payload.new as any])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: PostgresChange<any>) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === (payload.new as any).id ? (payload.new as any) : msg
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { messages, loading, refetch: fetchMessages }
}

/**
 * Subscribe to realtime appointments for a business.
 * Returns appointments array that updates in real-time.
 */
export function useRealtimeAppointments(businessId: string | null) {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch initial appointments
  const fetchAppointments = useCallback(async () => {
    if (!businessId) {
      setAppointments([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('appointments')
      .select('*, contacts(name, phone)')
      .eq('business_id', businessId)
      .gte('start_time', new Date().toISOString().split('T')[0])
      .order('start_time', { ascending: true })

    if (!error && data) {
      setAppointments(data)
    }
    setLoading(false)
  }, [businessId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // Subscribe to realtime changes
  useEffect(() => {
    if (!businessId) return

    const channel = supabase
      .channel(`appointments:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${businessId}`,
        },
        (payload: PostgresChange<any>) => {
          setAppointments((prev) =>
            [...prev, payload.new as any].sort((a, b) =>
              (a.start_time || '').localeCompare(b.start_time || '')
            )
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${businessId}`,
        },
        (payload: PostgresChange<any>) => {
          setAppointments((prev) =>
            prev.map((apt) =>
              apt.id === (payload.new as any).id ? (payload.new as any) : apt
            )
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${businessId}`,
        },
        (payload: PostgresChange<any>) => {
          setAppointments((prev) =>
            prev.filter((apt) => apt.id !== (payload.old as any).id)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [businessId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { appointments, loading, refetch: fetchAppointments }
}

/**
 * Subscribe to realtime conversations list for a business.
 * Returns conversations array that updates in real-time.
 *
 * Accepts optional `initialData` from SSR so the list is never blank
 * while the client-side auth + fetch is in-flight.
 */
export function useRealtimeConversations(
  businessId: string | null,
  initialData: any[] = []
) {
  const [conversations, setConversations] = useState<any[]>(initialData)
  const [loading, setLoading] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)

  const fetchConversations = useCallback(async () => {
    if (!businessId) {
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('conversations')
      .select('*, contacts(name, phone, status), messages(content, created_at, direction, sender_type)')
      .eq('business_id', businessId)
      .order('last_message_at', { ascending: false })
      .order('created_at', { referencedTable: 'messages', ascending: false })
      .limit(1, { referencedTable: 'messages' })

    if (!error && data) {
      // Map messages array to lastMessage (matches server-side getConversations shape)
      const mapped = data.map((conv: any) => {
        const msgs = conv.messages as any[] | null
        const lastMessage = msgs && msgs.length > 0 ? msgs[0] : null
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { messages: _msgs, ...rest } = conv
        return { ...rest, lastMessage }
      })
      setConversations(mapped)
    }
    setHasFetched(true)
    setLoading(false)
  }, [businessId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Only fetch when businessId is resolved; until then, show initialData
    if (businessId) {
      fetchConversations()
    }
  }, [businessId, fetchConversations])

  useEffect(() => {
    if (!businessId) return

    const channel = supabase
      .channel(`conversations:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          // Refetch to get joined contact data
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [businessId, fetchConversations]) // eslint-disable-line react-hooks/exhaustive-deps

  return { conversations, loading, refetch: fetchConversations }
}
