import { createServiceClient } from '@/lib/supabase/service'
import { BusinessesClient } from './businesses-client'

async function getBusinesses() {
  const supabase = createServiceClient()

  const { data: businesses, error } = await supabase
    .from('businesses')
    .select(`
      id,
      name,
      business_type,
      plan,
      status,
      created_at,
      phone_numbers (
        id,
        phone_number,
        status,
        session_id
      ),
      business_users (
        user_id,
        role,
        profiles:user_id (
          email
        )
      ),
      billing_accounts (
        plan,
        monthly_price,
        status,
        next_billing_date
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching businesses:', error)
    return []
  }

  return (businesses ?? []).map((biz) => {
    // Extract owner email from business_users join
    const ownerUser = (biz.business_users as any[])?.find(
      (bu: any) => bu.role === 'owner'
    )
    const ownerEmail =
      ownerUser?.profiles?.email ?? ownerUser?.profiles?.[0]?.email ?? null

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
