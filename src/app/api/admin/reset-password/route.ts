import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Verify admin auth
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { userId, newPassword } = body

  if (!userId || !newPassword) {
    return NextResponse.json({ error: 'userId and newPassword are required' }, { status: 400 })
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'סיסמה חייבת להכיל לפחות 6 תווים' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (error) {
      console.error('[admin] reset-password error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'הסיסמה אופסה בהצלחה' })
  } catch (err) {
    console.error('[admin] reset-password error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'שגיאה באיפוס הסיסמה' },
      { status: 500 }
    )
  }
}
