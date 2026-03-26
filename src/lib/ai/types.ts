// ── Types ───────────────────────────────────────────────

export interface AgentInput {
  businessId: string
  conversationId: string
  contactId: string
  message: string
  contactName: string
  contactStatus?: string
  contactPhone?: string
  contactVisits?: number
}

export interface AgentResponse {
  text: string
  intent: string
  confidence: number
  escalated: boolean
}

export interface ParsedAIResponse {
  text: string
  intent: string
  confidence: number
  action: { type: string; params: Record<string, unknown> } | null
  escalated: boolean
}

// ── Advanced AI Config Type ─────────────────────────────

export interface AdvancedAIConfig {
  goal?: 'bookings' | 'revenue' | 'support' | 'leads'
  sales_style?: number
  upsells?: Array<{ trigger: string; suggest: string }>
  guardrails?: {
    require_phone?: boolean
    no_prices_without_details?: boolean
    escalate_complaints?: boolean
    send_summary?: boolean
    suggest_alternatives?: boolean
    custom_rules?: string
  }
  signature_style?: string
  faq?: Array<{ q: string; a: string }>
  knowledge?: string
}
