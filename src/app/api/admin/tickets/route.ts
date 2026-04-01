import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { verifyAdmin } from '@/lib/auth/admin-guard'

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  const supabase = createServiceClient()
  const status = req.nextUrl.searchParams.get('status')

  let query = supabase.from('admin_tickets').select('*').order('created_at', { ascending: false })
  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, title, description, priority } = body

  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const admin = createServiceClient()
  const { error } = await admin.from('admin_tickets').insert({
    user_email: user.email,
    type: type || 'bug',
    title,
    description: description || '',
    priority: priority || 'normal',
    status: 'open',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  const body = await req.json()
  const { id, status } = body
  if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('admin_tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
