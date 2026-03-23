import { z } from 'zod'

export const registerSchema = z.object({
  businessName: z
    .string()
    .min(2, 'שם העסק חייב להכיל לפחות 2 תווים')
    .max(100, 'שם העסק לא יכול להכיל יותר מ-100 תווים'),
  ownerName: z
    .string()
    .min(2, 'שם בעל העסק חייב להכיל לפחות 2 תווים')
    .max(100, 'שם בעל העסק לא יכול להכיל יותר מ-100 תווים'),
  email: z
    .string()
    .email('כתובת אימייל לא תקינה'),
  password: z
    .string()
    .min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים')
    .regex(/[A-Z]/, 'הסיסמה חייבת להכיל לפחות אות גדולה אחת')
    .regex(/[0-9]/, 'הסיסמה חייבת להכיל לפחות ספרה אחת'),
  phone: z
    .string()
    .regex(/^05\d{8}$/, 'מספר טלפון לא תקין (05XXXXXXXX)')
    .optional(),
  businessType: z
    .string()
    .min(1, 'יש לבחור סוג עסק'),
})

export const appointmentSchema = z.object({
  contactId: z
    .string()
    .uuid('מזהה איש קשר לא תקין'),
  serviceType: z
    .string()
    .min(1, 'יש לבחור סוג שירות'),
  startTime: z
    .string()
    .min(1, 'יש לבחור תאריך ושעה'),
  endTime: z
    .string()
    .min(1, 'יש לציין זמן סיום'),
  durationMinutes: z
    .number()
    .min(15, 'משך הפגישה חייב להיות לפחות 15 דקות')
    .max(480, 'משך הפגישה לא יכול לעלות על 8 שעות'),
  notes: z
    .string()
    .max(500, 'ההערות לא יכולות להכיל יותר מ-500 תווים')
    .optional(),
})

export const expenseSchema = z.object({
  amount: z
    .number()
    .positive('הסכום חייב להיות חיובי')
    .max(1_000_000, 'הסכום לא יכול לעלות על 1,000,000'),
  category: z
    .string()
    .min(1, 'יש לבחור קטגוריה'),
  description: z
    .string()
    .min(1, 'יש להזין תיאור')
    .max(300, 'התיאור לא יכול להכיל יותר מ-300 תווים'),
  date: z
    .string()
    .min(1, 'יש לבחור תאריך'),
  receiptUrl: z
    .string()
    .url('קישור לקבלה לא תקין')
    .optional()
    .or(z.literal('')),
  isRecurring: z
    .boolean()
    .optional(),
  recurringInterval: z
    .enum(['weekly', 'monthly', 'yearly'] as const, {
      message: 'יש לבחור תדירות חזרה תקינה',
    })
    .optional(),
})

export const contactSchema = z.object({
  name: z
    .string()
    .min(2, 'שם איש הקשר חייב להכיל לפחות 2 תווים')
    .max(100, 'שם איש הקשר לא יכול להכיל יותר מ-100 תווים'),
  phone: z
    .string()
    .regex(/^05\d{8}$/, 'מספר טלפון לא תקין (05XXXXXXXX)'),
  tags: z
    .array(z.string())
    .optional(),
  notes: z
    .string()
    .max(1000, 'ההערות לא יכולות להכיל יותר מ-1000 תווים')
    .optional(),
  birthday: z
    .string()
    .optional()
    .or(z.literal('')),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type AppointmentInput = z.infer<typeof appointmentSchema>
export type ExpenseInput = z.infer<typeof expenseSchema>
export type ContactInput = z.infer<typeof contactSchema>
