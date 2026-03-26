// Error messages and ActionError class

// ── Error Messages (Hebrew) ─────────────────────────────

export const ERROR_MESSAGES = {
  GENERIC_FALLBACK: 'סליחה, לא הצלחתי לענות כרגע. נסה שוב בעוד רגע 🙏',
  RATE_LIMIT: 'יש עומס כרגע, נסה שוב בעוד דקה',
  WEBHOOK_FALLBACK: 'סליחה, משהו השתבש. ננסה שוב בהודעה הבאה.',
  TIME_SLOT_CONFLICT: 'השעה הזאת תפוסה. רוצה לנסות שעה אחרת?',
  UNKNOWN_SERVICE: 'לא מצאתי את השירות הזה. רוצה לבחור מהרשימה?',
  DB_INSERT_ERROR: 'הייתה תקלה בשמירת התור. ננסה שוב...',
  BOT_AUTO_DISABLED: 'הבוט נתקל בבעיות חוזרות. כיבינו אותו זמנית — תבדוק בהגדרות.',
} as const


export class ActionError extends Error {
  customerMessage: string
  constructor(technicalMessage: string, customerMessage: string) {
    super(technicalMessage)
    this.name = 'ActionError'
    this.customerMessage = customerMessage
  }
}