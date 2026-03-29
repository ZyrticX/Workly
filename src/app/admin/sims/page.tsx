import { createServiceClient } from '@/lib/supabase/service'
import { SimsClient } from './sims-client'

async function getSimData() {
  const supabase = createServiceClient()

  const [simsRes, businessesRes] = await Promise.all([
    // Platform-owned SIMs
    supabase
      .from('phone_numbers')
      .select(`
        id,
        phone_number,
        display_name,
        session_id,
        server_node,
        status,
        business_id,
        last_health_check,
        created_at,
        businesses (
          id,
          name
        )
      `)
      .eq('ownership', 'platform')
      .order('created_at', { ascending: false }),

    // Businesses for allocation dropdown
    supabase
      .from('businesses')
      .select('id, name')
      .eq('status', 'active')
      .order('name'),
  ])

  const sims = (simsRes.data ?? []).map((s) => {
    let simStatus: 'free' | 'allocated' | 'problem'
    if (!s.business_id) {
      simStatus = 'free'
    } else if (s.status === 'disconnected') {
      simStatus = 'problem'
    } else {
      simStatus = 'allocated'
    }

    return {
      id: s.id,
      phone_number: s.phone_number,
      display_name: s.display_name,
      session_id: s.session_id,
      server_node: s.server_node,
      status: s.status,
      sim_status: simStatus,
      business_id: s.business_id,
      business_name: (s.businesses as unknown as { id: string; name: string } | null)?.name ?? null,
      last_health_check: s.last_health_check,
      created_at: s.created_at,
    }
  })

  return {
    sims,
    businesses: businessesRes.data ?? [],
  }
}

export default async function SimsPage() {
  const { sims, businesses } = await getSimData()

  const freeCount = sims.filter((s) => s.sim_status === 'free').length
  const allocatedCount = sims.filter((s) => s.sim_status === 'allocated').length
  const problemCount = sims.filter((s) => s.sim_status === 'problem').length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">מלאי סימים</h2>
        <p className="text-sm text-text-muted mt-1">
          ניהול סימים בבעלות הפלטפורמה ({sims.length} סה״כ)
        </p>
      </div>

      <SimsClient
        sims={sims}
        businesses={businesses}
        counts={{ free: freeCount, allocated: allocatedCount, problem: problemCount }}
      />
    </div>
  )
}
