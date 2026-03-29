import { createServiceClient } from '@/lib/supabase/service'
import { PhonesClient } from './phones-client'

async function getPhones() {
  const supabase = createServiceClient()

  const { data: phones, error } = await supabase
    .from('phone_numbers')
    .select(`
      id,
      phone_number,
      display_name,
      session_id,
      server_node,
      status,
      ownership,
      last_health_check,
      business_id,
      created_at,
      businesses (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching phones:', error)
    return { phones: [], counts: { total: 0, connected: 0, disconnected: 0, free: 0 } }
  }

  const phoneList = (phones ?? []).map((p) => ({
    id: p.id,
    phone_number: p.phone_number,
    display_name: p.display_name,
    session_id: p.session_id,
    server_node: p.server_node,
    status: p.status,
    ownership: p.ownership,
    last_health_check: p.last_health_check,
    business_id: p.business_id,
    created_at: p.created_at,
    business_name: (p.businesses as unknown as { id: string; name: string } | null)?.name ?? null,
  }))

  const counts = {
    total: phoneList.length,
    connected: phoneList.filter((p) => p.status === 'connected').length,
    disconnected: phoneList.filter((p) => p.status === 'disconnected').length,
    free: phoneList.filter((p) => !p.business_id).length,
  }

  return { phones: phoneList, counts }
}

export default async function PhonesPage() {
  const { phones, counts } = await getPhones()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">מספרי טלפון</h2>
        <p className="text-sm text-text-muted mt-1">
          ניהול כל מספרי הטלפון בפלטפורמה
        </p>
      </div>

      <PhonesClient phones={phones} counts={counts} />
    </div>
  )
}
