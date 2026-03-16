# External Integrations

**Analysis Date:** 2026-03-16

## APIs & External Services

### AI / LLM — OpenRouter

**Purpose:** All AI features (WhatsApp agent, BI chat, onboarding assistant, style analysis)

**SDK/Client:** Raw `fetch()` to OpenRouter REST API (OpenAI-compatible format)

**Auth:** `OPENROUTER_API_KEY` env var, sent as `Authorization: Bearer <key>`

**Implementation:** `src/lib/ai/ai-client.ts`

**Endpoints used:**
- `POST https://openrouter.ai/api/v1/chat/completions` - Text generation
- Same endpoint with `image_url` content blocks for vision

**Models configured:**
- Text: `AI_MODEL` env var, default `google/gemini-2.5-flash-preview`
- Vision: `AI_VISION_MODEL` env var, default `google/gemini-2.5-flash-preview`

**Request headers:**
- `Authorization: Bearer <OPENROUTER_API_KEY>`
- `HTTP-Referer: <NEXT_PUBLIC_APP_URL>` (fallback: `https://auto-crm.org`)
- `X-Title: WhatsApp AI Agent Platform`

**AI features built on this integration:**
- **WhatsApp AI Agent** (`src/lib/ai/agent-prompt.ts`): Processes incoming WhatsApp messages, detects intents (book/cancel/reschedule/price/faq/lead/human/sensitive/greeting/other), generates Hebrew responses, returns structured JSON with action commands
- **BI Chat** (`src/lib/ai/bi-chat.ts`): Business intelligence Q&A; generates query plans, fetches data from Supabase, synthesizes Hebrew answers
- **Onboarding Chat** (`src/app/api/ai/onboarding-chat/route.ts`): Conversational onboarding wizard that collects business configuration via AI dialogue
- **Style Analyzer** (`src/lib/ai/style-analyzer.ts`): Analyzes WhatsApp screenshot images to extract communication style patterns using vision model

**API routes:**
- `POST /api/ai/chat` - BI chat endpoint (`src/app/api/ai/chat/route.ts`)
- `POST /api/ai/agent` - Manual AI agent trigger (`src/app/api/ai/agent/route.ts`)
- `POST /api/ai/onboarding-chat` - Onboarding AI chat (`src/app/api/ai/onboarding-chat/route.ts`)

---

### WhatsApp — WAHA (WhatsApp HTTP API)

**Purpose:** Send and receive WhatsApp messages, manage WhatsApp sessions, QR code authentication

**SDK/Client:** Custom `WahaClient` class in `src/lib/waha/waha-client.ts` using raw `fetch()`

**Auth:** `WAHA_API_KEY` env var, sent as `X-Api-Key` header

**Provider abstraction:** `src/lib/waha/provider.ts` defines `WhatsAppProvider` interface with `WahaProvider` implementation. Designed for future swap to WhatsApp Cloud API (`// Future: CloudApiProvider implements WhatsAppProvider`).

**Singleton instance:** `src/lib/waha/provider.ts` exports `whatsapp` singleton

**WAHA endpoints consumed:**
- `POST /api/sessions` - Create new WhatsApp session
- `GET /api/sessions/<name>` - Get session status
- `GET /api/sessions` - List all sessions
- `GET /api/<session>/auth/qr` - Get QR code for authentication
- `POST /api/sendText` - Send text message
- `POST /api/sendImage` - Send image message
- `POST /api/sessions/<name>/stop` - Stop session
- `POST /api/sessions/<name>/start` - Start session

**Types:** `src/lib/waha/types.ts` defines `WahaSession`, `WahaMessage`, `WebhookPayload`, `WahaQR`, `WahaSendResult`

**API routes:**
- `POST /api/waha/connect` - Create/restart WAHA session for a business (`src/app/api/waha/connect/route.ts`)
- `GET /api/waha/qr?session=<name>` - Get QR code for session auth (`src/app/api/waha/qr/route.ts`)

**Environment variables:**
- `WAHA_API_URL` - Base URL of the WAHA server
- `WAHA_API_KEY` - API key for authentication

---

### Telegram Bot API

**Purpose:** Health check alerts for disconnected WhatsApp sessions

**SDK/Client:** Raw `fetch()` to Telegram Bot API

**Implementation:** `src/app/api/cron/health-check/route.ts` (inline `sendTelegramAlert` function)

**Endpoint used:**
- `POST https://api.telegram.org/bot<token>/sendMessage`

**Environment variables:**
- `TELEGRAM_BOT_TOKEN` - Telegram bot token (optional; alerts skipped if not set)
- `TELEGRAM_CHAT_ID` - Target chat ID for alerts

**Alert types:**
- Disconnected phone numbers
- WAHA server connection failures
- Phone number recovery notices

---

## Data Storage

### Database — Supabase (PostgreSQL)

**Provider:** Supabase (hosted PostgreSQL with PostgREST, Auth, Realtime, Storage)

**Connection env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous key (respects RLS)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS; server-only)

**Client implementations (4 variants):**

| Client | File | Context | Auth |
|--------|------|---------|------|
| Browser | `src/lib/supabase/client.ts` | Client components | `createBrowserClient()` from `@supabase/ssr` |
| Server | `src/lib/supabase/server.ts` | Server components, API routes, server actions | `createServerClient()` from `@supabase/ssr` with cookie handling |
| Service | `src/lib/supabase/service.ts` | Webhooks, cron jobs, admin operations | `createClient()` from `@supabase/supabase-js` with service role key (bypasses RLS) |
| Middleware | `src/lib/supabase/middleware.ts` | Next.js middleware for auth session refresh | `createServerClient()` with request/response cookie propagation |

**Database tables (inferred from queries):**

| Table | Purpose | Key Files |
|-------|---------|-----------|
| `businesses` | Business profiles (name, type, plan, status, owner) | `src/lib/auth/register.ts`, `src/lib/auth/save-onboarding.ts` |
| `business_users` | User-business membership (user_id, business_id, role) | `src/lib/supabase/middleware.ts`, `src/hooks/use-auth.ts` |
| `business_settings` | Services, working hours, cancellation policy, AI config (JSONB columns) | `src/lib/data/settings-mutations.ts`, `src/lib/data/appointments.ts` |
| `business_templates` | Pre-configured templates by business type | `src/lib/auth/register.ts` |
| `ai_personas` | AI tone, emoji usage, style examples, system prompt, boundaries | `src/lib/ai/agent-prompt.ts`, `src/lib/auth/onboarding-actions.ts` |
| `onboarding_progress` | Wizard step tracking (current_step, steps_data, is_completed) | `src/lib/data/onboarding.ts`, `src/lib/auth/save-onboarding.ts` |
| `contacts` | CRM contacts (wa_id, phone, name, status, tags, visits, revenue) | `src/lib/data/contacts.ts`, `src/lib/data/contacts-mutations.ts` |
| `conversations` | Chat threads (contact_id, status, is_bot_active, assigned_to) | `src/lib/data/messages.ts`, `src/hooks/use-realtime.ts` |
| `messages` | Individual messages (direction, sender_type, content, status, provider_message_id) | `src/lib/data/messages.ts`, `src/app/api/webhooks/waha/route.ts` |
| `appointments` | Scheduled appointments (service_type, start/end time, status, price) | `src/lib/data/appointments.ts`, `src/lib/data/appointments-mutations.ts` |
| `expenses` | One-time business expenses | `src/lib/data/expenses.ts` |
| `recurring_expenses` | Recurring expense definitions (frequency, is_active) | `src/lib/data/expenses.ts` |
| `phone_numbers` | WhatsApp phone registrations (session_id, status, provider, server_node) | `src/app/api/webhooks/waha/route.ts`, `src/app/api/cron/health-check/route.ts` |
| `ai_conversation_logs` | AI response logging (intent, confidence, escalated) | `src/app/api/webhooks/waha/route.ts`, `src/lib/ai/bi-chat.ts` |
| `ai_chat_history` | BI chat Q&A history (question, answer, query_generated) | `src/lib/ai/bi-chat.ts` |
| `kpi_snapshots` | Business KPI snapshots (period, metrics JSONB) | `src/lib/ai/bi-chat.ts` |
| `billing_accounts` | Billing/subscription info (plan, monthly_price, status) | `src/lib/auth/register.ts` |
| `platform_payments` | Platform payment records (amount, status) | `src/app/admin/page.tsx` |
| `waitlist` | Appointment waitlist (preferred_date, status: waiting/offered) | `src/lib/data/appointments-mutations.ts` |

**Supabase RPC functions:**
- `increment_contact_visits(p_contact_id, p_revenue)` - Atomic contact stats update on appointment creation (`src/lib/data/appointments-mutations.ts`)

**Realtime subscriptions:**
- Messages by `conversation_id` (INSERT + UPDATE) - `src/hooks/use-realtime.ts`
- Appointments by `business_id` (INSERT + UPDATE + DELETE) - `src/hooks/use-realtime.ts`
- Conversations by `business_id` (* all events, triggers refetch) - `src/hooks/use-realtime.ts`

### File Storage — Supabase Storage

**Purpose:** Receipt image uploads for expenses

**Bucket:** `receipts`

**Implementation:** `src/lib/data/expenses.ts` (`addExpense` function)

**Pattern:** Upload file to `receipts/<businessId>/<timestamp>_<filename>`, retrieve public URL via `getPublicUrl()`

### Caching

Not detected - No caching layer (Redis, Memcached, etc.)

---

## Authentication & Identity

**Auth Provider:** Supabase Auth

**Implementation:** Cookie-based SSR auth via `@supabase/ssr`

**Auth flows:**
- **Registration:** Email/password signup via `supabase.auth.signUp()` in `src/lib/auth/register.ts` (server action)
- **Login:** Standard Supabase email/password (handled by login page at `src/app/(auth)/login/page.tsx`)
- **Session refresh:** Next.js middleware at `src/middleware.ts` refreshes auth cookies on every request via `src/lib/supabase/middleware.ts`

**Authorization model:**
- **Business isolation:** All data queries scoped by `business_id` via Supabase RLS + application-level filtering through `business_users` table join
- **Admin access:** Hardcoded email allowlist in `src/app/admin/layout.tsx` (`ALLOWED_ADMIN_EMAILS` array)
- **Onboarding gate:** Middleware redirects users without completed onboarding to `/onboarding` (checked via `onboarding_progress.is_completed`)
- **Webhook auth:** WAHA webhook verifies `X-Api-Key` header matches `WAHA_API_KEY` env var
- **Cron auth:** Health-check endpoint verifies `Authorization: Bearer <CRON_SECRET>`

**User metadata stored at signup:**
- `full_name` (from registration form)
- `phone` (from registration form)

**Client-side auth hook:** `src/hooks/use-auth.ts` - Provides `user`, `businessId`, `loading` state; subscribes to `onAuthStateChange`

---

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog, etc.)

**Logs:**
- `console.log`, `console.error`, `console.warn` throughout codebase
- Log prefix convention: `[module]` (e.g., `[webhook]`, `[health-check]`, `[agent]`, `[Reminder]`, `[ENV]`)

**Health Monitoring:**
- Cron endpoint at `GET /api/cron/health-check` (`src/app/api/cron/health-check/route.ts`)
- Compares WAHA sessions against `phone_numbers` table
- Detects: disconnected phones, orphaned WAHA sessions, WAHA server failures
- Alerts via Telegram Bot API (optional)

---

## CI/CD & Deployment

**Hosting:**
- Designed for Vercel (Next.js 16 App Router, server actions, middleware)
- No `vercel.json` or deployment config detected

**CI Pipeline:**
- Not detected (no `.github/workflows`, no CI config files)

---

## Environment Configuration

**Required env vars:**
| Variable | Purpose | Client/Server |
|----------|---------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Both |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key | Both |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Server only |
| `OPENROUTER_API_KEY` | OpenRouter AI API key | Server only |
| `WAHA_API_URL` | WAHA server base URL | Server only |
| `WAHA_API_KEY` | WAHA API authentication key | Server only |

**Optional env vars:**
| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_APP_URL` | Public URL for webhooks | `https://auto-crm.org` |
| `AI_MODEL` | OpenRouter model for text | `google/gemini-2.5-flash-preview` |
| `AI_VISION_MODEL` | OpenRouter model for vision | `google/gemini-2.5-flash-preview` |
| `CRON_SECRET` | Bearer token for cron endpoint | None (endpoint returns 500 if missing) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot for alerts | None (alerts skipped) |
| `TELEGRAM_CHAT_ID` | Telegram chat for alerts | None (alerts skipped) |

**Secrets location:**
- `.env.local` file (present, not committed)

---

## Webhooks & Callbacks

### Incoming Webhooks

**WAHA WhatsApp Webhook:**
- Endpoint: `POST /api/webhooks/waha` (`src/app/api/webhooks/waha/route.ts`)
- Auth: `X-Api-Key` header must match `WAHA_API_KEY`
- Events handled:
  - `message` - Incoming WhatsApp message processing:
    1. Lookup business by WAHA session
    2. Find/create contact
    3. Find/create conversation
    4. Save message to DB
    5. Run AI agent if bot is active
    6. Send AI response via WAHA
    7. Log AI interaction
  - `session.status` - Updates `phone_numbers.status` (connected/disconnected)
  - `message.ack` - Updates message delivery status (sent/delivered/read)
- Skips: outgoing messages (`fromMe`), group messages (hyphen in ID), empty messages

**Health-Check Cron:**
- Endpoint: `GET /api/cron/health-check` (`src/app/api/cron/health-check/route.ts`)
- Auth: `Authorization: Bearer <CRON_SECRET>`
- Meant to be called by Vercel Cron or external cron service

### Outgoing Webhooks

**WAHA Session Webhooks:**
- Configured when creating WAHA sessions in `src/lib/waha/provider.ts` and `src/app/api/waha/connect/route.ts`
- Webhook URL: `<NEXT_PUBLIC_APP_URL>/api/webhooks/waha`
- Subscribed events: `message`, `message.ack`, `session.status`

---

## Integration Architecture Summary

```
                    +------------------+
                    |   Mobile PWA     |
                    |  (Next.js SSR)   |
                    +--------+---------+
                             |
                    +--------+---------+
                    |  Supabase Auth   |
                    |  (Cookie-based)  |
                    +--------+---------+
                             |
              +--------------+-------------+
              |                            |
     +--------+--------+        +---------+--------+
     | Next.js API      |        | Supabase         |
     | Route Handlers   |        | (PostgreSQL +    |
     |                  |        |  Realtime +      |
     | /api/webhooks/   |        |  Storage)        |
     | /api/ai/         |        +------------------+
     | /api/waha/       |
     | /api/cron/       |
     | /api/messages/   |
     | /api/contacts/   |
     | /api/appointments|
     +-------+--+-------+
             |  |
    +--------+  +----------+
    |                      |
+---+--------+    +--------+-------+
| OpenRouter |    |  WAHA Server   |
| (AI/LLM)  |    |  (WhatsApp)    |
+------------+    +--------+-------+
                           |
                  +--------+-------+
                  | WhatsApp Users |
                  | (Customers)    |
                  +----------------+

                  +----------------+
                  | Telegram Bot   |
                  | (Health Alerts)|
                  +----------------+
```

---

*Integration audit: 2026-03-16*
