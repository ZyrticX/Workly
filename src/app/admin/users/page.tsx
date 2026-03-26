import { createServiceClient } from '@/lib/supabase/service'
import { UsersClient } from './users-client'

export interface UserRow {
  id: string
  email: string
  created_at: string
  business_name: string | null
  role: string | null
  plan: string | null
}

async function getUsers(): Promise<UserRow[]> {
  const supabase = createServiceClient()

  // Fetch all auth users via admin API
  const { data: authResult, error: authError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  })

  if (authError || !authResult?.users) {
    console.error('Error fetching auth users:', authError)
    return []
  }

  const authUsers = authResult.users

  // Fetch business_users joined with businesses for all users
  const { data: businessUsers, error: buError } = await supabase
    .from('business_users')
    .select(`
      user_id,
      role,
      businesses (
        name,
        plan
      )
    `)

  if (buError) {
    console.error('Error fetching business_users:', buError)
  }

  // Build a lookup: user_id -> { business_name, role, plan }
  const userBusinessMap: Record<string, { business_name: string; role: string; plan: string }> = {}

  if (businessUsers) {
    for (const bu of businessUsers as any[]) {
      const biz = bu.businesses
      userBusinessMap[bu.user_id] = {
        business_name: biz?.name ?? null,
        role: bu.role ?? null,
        plan: biz?.plan ?? null,
      }
    }
  }

  return authUsers.map((u) => {
    const bizInfo = userBusinessMap[u.id]
    return {
      id: u.id,
      email: u.email ?? '',
      created_at: u.created_at,
      business_name: bizInfo?.business_name ?? null,
      role: bizInfo?.role ?? null,
      plan: bizInfo?.plan ?? null,
    }
  })
}

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">משתמשים</h2>
          <p className="text-sm text-text-muted mt-1">
            ניהול כל המשתמשים בפלטפורמה ({users.length} סה״כ)
          </p>
        </div>
      </div>

      <UsersClient users={users} />
    </div>
  )
}
