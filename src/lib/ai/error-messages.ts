// Error messages and ActionError class

// ── Error Messages (Hebrew) ─────────────────────────────

export const ERROR_MESSAGES = {
  GENERIC_FALLBACK: 'שנייה, בודק ואחזור אליך 🙏',
  RATE_LIMIT: 'רגע, עומס קטן. שלח שוב בעוד דקה',
  WEBHOOK_FALLBACK: 'שנייה, בודק ואחזור אליך',
  TIME_SLOT_CONFLICT: 'השעה הזאת תפוסה. רוצה לנסות שעה אחרת?',
  UNKNOWN_SERVICE: 'לא הצלחתי להבין איזה שירות. מה מעניין אותך?',
  DB_INSERT_ERROR: 'שנייה, בודק שהכל מסודר... 🔍',
  BOT_AUTO_DISABLED: 'שנייה, מעביר לצוות',
} as const


export class ActionError extends Error {
  customerMessage: string
  constructor(technicalMessage: string, customerMessage: string) {
    super(technicalMessage)
    this.name = 'ActionError'
    this.customerMessage = customerMessage
  }
}