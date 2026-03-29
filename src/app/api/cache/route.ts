import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invalidatePattern } from '@/lib/cache/redis'

// POST /api/cache — invalidate cache for a business
// Called after settings/persona/business info changes
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: bu } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!bu) return NextResponse.json({ error: 'No business' }, { status: 404 })

  // Invalidate all cache for this business
  await invalidatePattern(`biz:${bu.business_id}:*`)

  return NextResponse.json({ ok: true, cleared: `biz:${bu.business_id}:*` })
}
