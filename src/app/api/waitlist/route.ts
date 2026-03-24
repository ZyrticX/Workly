import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: bu } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()
  if (!bu) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const { data: entries, error } = await supabase
    .from('waitlist')
    .select('*, contacts(name, phone, wa_id)')
    .eq('business_id', bu.business_id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(entries)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: bu } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()
  if (!bu) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const { error } = await supabase
    .from('waitlist')
    .delete()
    .eq('id', id)
    .eq('business_id', bu.business_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
