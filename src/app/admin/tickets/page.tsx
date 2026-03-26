import { createServiceClient } from '@/lib/supabase/service'
import { TicketsClient } from './tickets-client'

export default async function TicketsPage() {
  const supabase = createServiceClient()
  const { data: tickets } = await supabase
    .from('admin_tickets')
    .select('*')
    .order('created_at', { ascending: false })

  return <TicketsClient tickets={tickets || []} />
}
