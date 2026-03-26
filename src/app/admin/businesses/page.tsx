import { createServiceClient } from '@/lib/supabase/service'
import { BusinessesClient } from './businesses-client'

async function getBusinesses() {
  const supabase = createServiceClient()

  // Fetch businesses with related data (no profiles table - get email separately)
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select(`
      id,
      name,
      business_type,
      plan,
      status,
      created_at,
      is_draft,
      ai_setup_summary,
      phone_numbers (
        id,
        phone_number,
        status,
        session_id
      ),
      business_users (
        user_id,
        role
      ),
      billing_accounts (
        plan,
        monthly_price,
        status,
        next_billing_date
      )
    `)
    .order('created_at', { ascending: false })

  // Fetch owner emails from auth.users via business_users
  const ownerEmails: Record<string, string> = {}
  if (businesses) {
    const ownerUserIds = businesses
      .flatMap((b: any) => (b.business_users as any[] || []))
      .filter((bu: any) => bu.role === 'owner')
      .map((bu: any) => bu.user_id)

    if (ownerUserIds.length > 0) {
      const { data: users } = await supabase
        .from('auth.users' as any)
        .select('id, email')
        .in('id', ownerUserIds)

      // Fallback: query business_users with owner_user_id from businesses table
      if (!users) {
        for (const biz of businesses) {
          const ownerId = (biz as any).owner_user_id
          if (ownerId) {
            ownerEmails[biz.id] = ownerId
          }
        }
      } else {
        for (const u of users as any[]) {
          ownerEmails[u.id] = u.email
        }
      }
    }
  }

  if (error) {
    console.error('Error fetching businesses:', error)
    return []
  }

  return (businesses ?? []).map((biz) => {
    // Extract owner email from business_users join
    const ownerUser = (biz.business_users as any[])?.find(
      (bu: any) => bu.role === 'owner'
    )
    const ownerEmail = ownerUser ? ownerEmails[ownerUser.user_id] ?? null : null

    // Extract primary phone
    const primaryPhone = (biz.phone_numbers as any[])?.[0] ?? null

    // Extract billing
    const billing = Array.isArray(biz.billing_accounts)
      ? biz.billing_accounts[0] ?? null
      : biz.billing_accounts ?? null

    return {
      id: biz.id,
      name: biz.name,
      business_type: biz.business_type,
      plan: biz.plan,
      status: biz.status,
      created_at: biz.created_at,
      owner_email: ownerEmail,
      phone_number: primaryPhone?.phone_number ?? null,
      phone_status: primaryPhone?.status ?? null,
      phones: (biz.phone_numbers as any[]) ?? [],
      billing: billing,
      is_draft: (biz as any).is_draft ?? false,
      ai_setup_summary: (biz as any).ai_setup_summary ?? null,
    }
  })
}

export default async function BusinessesPage() {
  const businesses = await getBusinesses()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">עסקים</h2>
          <p className="text-sm text-text-muted mt-1">
            ניהול כל העסקים בפלטפורמה ({businesses.length} סה״כ)
          </p>
        </div>
      </div>

      <BusinessesClient businesses={businesses} />
    </div>
  )
}
