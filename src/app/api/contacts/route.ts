import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'לא מאומת' }, { status: 401 })

    const { data: bu } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!bu) return NextResponse.json({ error: 'עסק לא נמצא' }, { status: 404 })

    const { searchParams } = new URL(request.url)

    // BUG-04 fix: Support ?id= parameter for single contact lookup
    const contactId = searchParams.get('id')
    if (contactId) {
      const { data: contact, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .eq('business_id', bu.business_id)
        .single()

      if (error || !contact) {
        return NextResponse.json({ error: 'איש קשר לא נמצא' }, { status: 404 })
      }

      // Get linked contacts (sub-clients under this contact)
      const { data: linkedContacts } = await supabase
        .from('contacts')
        .select('id, name, relationship, status, total_visits, total_revenue, created_at')
        .eq('business_id', bu.business_id)
        .eq('linked_to', contactId)
        .order('created_at', { ascending: false })

      // Get who this contact is linked TO (parent contact)
      let parentContact = null
      if ((contact as Record<string, unknown>).linked_to) {
        const { data: parent } = await supabase
          .from('contacts')
          .select('id, name, phone')
          .eq('id', (contact as Record<string, unknown>).linked_to as string)
          .single()
        parentContact = parent
      }

      return NextResponse.json({
        contact,
        linkedContacts: linkedContacts || [],
        parentContact,
      })
    }

    // List contacts with filters
    const q = searchParams.get('q') ?? ''
    const status = searchParams.get('status') ?? ''
    const sort = searchParams.get('sort') ?? 'name'
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
    const offset = (page - 1) * limit

    let query = supabase
      .from('contacts')
      .select('id, name, phone, wa_id, status, tags, notes, birthday, last_visit, total_visits, total_revenue, created_at', { count: 'exact' })
      .eq('business_id', bu.business_id)

    if (q) {
      const sanitized = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
      query = query.or(`name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`)
    }
    if (status && status !== 'all') query = query.eq('status', status)

    const sortColumn = sort === 'revenue' ? 'total_revenue' : sort === 'visits' ? 'total_visits' : sort === 'last_visit' ? 'last_visit' : 'name'
    query = query.order(sortColumn, { ascending: sort === 'name' })
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      contacts: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch {
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'לא מאומת' }, { status: 401 })

    const { data: bu } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!bu) return NextResponse.json({ error: 'עסק לא נמצא' }, { status: 404 })

    const body = await request.json()
    const { name, phone, tags, notes, birthday } = body

    if (!name || !phone) {
      return NextResponse.json({ error: 'שם וטלפון הם שדות חובה' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        business_id: bu.business_id,
        name,
        phone,
        wa_id: phone,
        tags: tags || [],
        notes: notes || null,
        birthday: birthday || null,
        status: 'new',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contact: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}

// BUG-05 fix: Add PATCH handler for editing contacts
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'לא מאומת' }, { status: 401 })

    const { data: bu } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!bu) return NextResponse.json({ error: 'עסק לא נמצא' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('id')
    if (!contactId) {
      return NextResponse.json({ error: 'חסר מזהה איש קשר' }, { status: 400 })
    }

    const body = await request.json()
    const { name, phone, tags, notes, birthday, status } = body

    // Build update payload with only provided fields
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) {
      updateData.phone = phone
      updateData.wa_id = phone
    }
    if (tags !== undefined) updateData.tags = tags
    if (notes !== undefined) updateData.notes = notes
    if (birthday !== undefined) updateData.birthday = birthday || null
    if (status !== undefined) updateData.status = status

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'לא סופקו שדות לעדכון' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', contactId)
      .eq('business_id', bu.business_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'איש קשר לא נמצא' }, { status: 404 })

    return NextResponse.json({ contact: data })
  } catch {
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
