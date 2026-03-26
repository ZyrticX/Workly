import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_ADMIN_EMAILS = [
  'smartmindsai31@gmail.com',
  'evgeniy.orel@open-israel.co.il',
  'evgeniyphotos1@gmail.com',
  'eladmilles2005@gmail.com',
  'workly@admin.com',
]

/**
 * Verify that the current user is an admin.
 * Returns the user if admin, or a 403 NextResponse if not.
 */
export async function verifyAdmin(): Promise<
  { user: { id: string; email: string }; error?: never } |
  { user?: never; error: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user || !user.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  if (!ALLOWED_ADMIN_EMAILS.includes(user.email)) {
    return { error: NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 }) }
  }

  return { user: { id: user.id, email: user.email } }
}
