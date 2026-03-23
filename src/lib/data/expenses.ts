import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface Expense {
  id: string
  business_id: string
  category: string
  amount: number
  description: string | null
  receipt_url: string | null
  expense_date: string
  is_recurring: boolean
  created_at: string
}

export interface RecurringExpense {
  id: string
  business_id: string
  category: string
  amount: number
  description: string | null
  frequency: string
  is_active: boolean
  created_at: string
}

export interface MonthlyFinancials {
  revenue: number
  expenses: number
  recurringTotal: number
  net: number
  expensesList: Expense[]
  recurringList: RecurringExpense[]
}

export interface AddExpenseData {
  businessId: string
  category: string
  amount: number
  description?: string
  receiptFile?: File
  expenseDate?: string
  isRecurring?: boolean
}

export interface AddRecurringExpenseData {
  businessId: string
  category: string
  amount: number
  description?: string
  frequency?: 'monthly' | 'weekly' | 'yearly'
}

// ──────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────

/**
 * Compute monthly financial summary:
 *  - Revenue from completed appointments
 *  - One-time expenses for the month
 *  - Active recurring expenses
 *  - Net profit
 */
export async function getMonthlyFinancials(
  year: number,
  month: number
): Promise<MonthlyFinancials> {
  const supabase = await createClient()

  // Resolve business_id from authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: businessUser } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!businessUser) throw new Error('Business not found')

  const businessId = businessUser.business_id

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  // Handle December -> next year January
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  const [revenueResult, expensesResult, recurringResult] = await Promise.all([
    // Revenue from completed appointments in the month
    supabase
      .from('appointments')
      .select('price')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('start_time', startDate)
      .lt('start_time', endDate),

    // One-time expenses for the month
    supabase
      .from('expenses')
      .select('*')
      .eq('business_id', businessId)
      .gte('expense_date', startDate)
      .lt('expense_date', endDate)
      .order('expense_date', { ascending: false }),

    // All active recurring expenses (amortized monthly)
    supabase
      .from('recurring_expenses')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true),
  ])

  const totalRevenue =
    revenueResult.data?.reduce(
      (sum, a) => sum + (Number(a.price) || 0),
      0
    ) ?? 0

  const totalExpenses =
    expensesResult.data?.reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    ) ?? 0

  const totalRecurring =
    recurringResult.data?.reduce(
      (sum, r) => sum + (Number(r.amount) || 0),
      0
    ) ?? 0

  return {
    revenue: totalRevenue,
    expenses: totalExpenses,
    recurringTotal: totalRecurring,
    net: totalRevenue - totalExpenses - totalRecurring,
    expensesList: (expensesResult.data as Expense[]) ?? [],
    recurringList: (recurringResult.data as RecurringExpense[]) ?? [],
  }
}

// ──────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────

/**
 * Add a one-time expense. Optionally uploads a receipt image
 * to Supabase Storage and attaches the public URL.
 */
export async function addExpense(data: AddExpenseData): Promise<Expense> {
  const supabase = await createClient()

  let receiptUrl: string | null = null

  // Upload receipt if provided
  if (data.receiptFile) {
    const fileName = `${data.businessId}/${Date.now()}_${data.receiptFile.name}`

    const { data: upload, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, data.receiptFile)

    if (uploadError) {
      console.error(`[Receipt Upload] ${uploadError.message}`)
    }

    if (upload) {
      const {
        data: { publicUrl },
      } = supabase.storage.from('receipts').getPublicUrl(fileName)
      receiptUrl = publicUrl
    }
  }

  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      business_id: data.businessId,
      category: data.category,
      amount: data.amount,
      description: data.description ?? null,
      receipt_url: receiptUrl,
      expense_date:
        data.expenseDate ?? new Date().toISOString().split('T')[0],
      is_recurring: data.isRecurring ?? false,
    })
    .select()
    .single()

  if (error || !expense) {
    throw new Error(`Failed to add expense: ${error?.message}`)
  }

  return expense as Expense
}

/**
 * Create a new recurring expense entry.
 */
export async function addRecurringExpense(
  data: AddRecurringExpenseData
): Promise<RecurringExpense> {
  const supabase = await createClient()

  const { data: recurring, error } = await supabase
    .from('recurring_expenses')
    .insert({
      business_id: data.businessId,
      category: data.category,
      amount: data.amount,
      description: data.description ?? null,
      frequency: data.frequency ?? 'monthly',
      is_active: true,
    })
    .select()
    .single()

  if (error || !recurring) {
    throw new Error(`Failed to add recurring expense: ${error?.message}`)
  }

  return recurring as RecurringExpense
}
