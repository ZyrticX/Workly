# External Integrations

**Analysis Date:** 2026-03-16

## APIs & External Services

### WhatsApp via WAHA (WhatsApp HTTP API)

**Purpose:** Send and receive WhatsApp messages for automated customer communication.

- SDK/Client: Custom `WahaClient` class in `src/lib/waha/waha-client.ts`
- Provider abstraction: `WhatsAppProvider` interface in `src/lib/waha/provider.ts`
- Current implementation: `WahaProvider` class (implements `WhatsAppProvider`)
- Auth: API key via `WAHA_API_KEY` env var, passed as `X-Api-Key` header
- Base URL: `WAHA_API_URL` env var
- Singleton instance: `waha` exported from `src/lib/waha/waha-client.ts`
- Provider singleton: `whatsapp` exported from `src/lib/waha/provider.ts`

**Capabilities:**
- Session management (create, get, list sessions): `WahaClient.createSession()`, `WahaClient.getSession()`, `WahaClient.getSessions()`
- QR code retrieval for phone linking: `WahaClient.getQR()`
- Send text messages: `WahaClient.sendText()`
- Send image messages: `WahaClient.sendImage()`

**WAHA API Endpoints Used:**
- `POST /api/sessions` - Create session with webhook config
- `GET /api/sessions/{name}` - Get session status
- `GET /api/sessions` - List all sessions
- `GET /api/{session}/auth/qr` - Get QR code for authentication
- `POST /api/sendText` - Send text message
- `POST /api/sendImage` - Send image message

**Types:** Defined in `src/lib/waha/types.ts`:
- `WahaSession` (name, status, config)
- `WahaMessage` (id, from, to, body, fromMe, type, session)
- `WebhookPayload` (event, session, payload)
- `WahaQR` (value, mimetype)
- `WahaSendResult` (id, status)

**Architecture Note:** The `WhatsAppProvider` interface in `src/lib/waha/provider.ts` is designed for future provider swapping (comment: "Future: CloudApiProvider implements WhatsAppProvider"), enabling migration from WAHA to WhatsApp Cloud API.

### OpenRouter AI API

**Purpose:** AI-powered customer conversation agent and business intelligence chat.

- Endpoint: `https://openrouter.ai/api/v1/chat/completions` (OpenAI-compatible)
- Client: Custom functions in `src/lib/ai/gemini.ts` (file named "gemini" for historical reasons; uses OpenRouter)
- Auth: Bearer token via `OPENROUTER_API_KEY` env var
- Default model: `google/gemini-2.5-flash-preview` (configurable via `AI_MODEL` env var)
- Vision model: `google/gemini-2.5-flash-preview` (configurable via `AI_VISION_MODEL` env var)

**Functions:**
- `generateResponse()` in `src/lib/ai/gemini.ts` - Text chat completion with system prompt and conversation history
- `generateVisionResponse()` in `src/lib/ai/gemini.ts` - Multimodal completion with base64 images

**Request Headers:**
- `Authorization: Bearer {OPENROUTER_API_KEY}`
- `HTTP-Referer: {NEXT_PUBLIC_APP_URL}` (fallback: `https://auto-crm.org`)
- `X-Title: WhatsApp AI Agent Platform`

**AI Features:**

1. **WhatsApp Agent** (`src/lib/ai/agent-prompt.ts`):
   - Entry point: `processAIAgent(input: AgentInput): Promise<AgentResponse>`
   - Loads business context (business, settings, persona, conversation history) from Supabase
   - Builds Hebrew system prompt with business details, services, hours, persona style
   - Sends to OpenRouter, parses structured JSON response
   - Executes actions (book_appointment, cancel_appointment, escalate)
   - Returns intent classification with confidence score

2. **BI Chat** (`src/lib/ai/bi-chat.ts`):
   - Entry point: `processBusinessQuery(businessId, question): Promise<BIChatResult>`
   - Two-step AI pipeline: (1) generate query plan identifying relevant tables, (2) fetch data and generate Hebrew answer
   - Saves chat history to `ai_chat_history` table
   - Schema-aware: knows 7 database tables and their columns

3. **Style Analyzer** (`src/lib/ai/style-analyzer.ts`):
   - Entry point: `analyzeStyleFromScreenshots(images): Promise<StyleAnalysis>`
   - Uses vision model to analyze WhatsApp screenshot images
   - Extracts communication style attributes (formality, emoji usage, phrasing patterns)
   - Used during onboarding to configure AI persona

### Telegram Bot API

**Purpose:** Health check alerts for disconnected WhatsApp sessions.

- Used in: `src/app/api/cron/health-check/route.ts`
- Endpoint: `https://api.telegram.org/bot{token}/sendMessage`
- Auth: `TELEGRAM_BOT_TOKEN` env var
- Chat target: `TELEGRAM_CHAT_ID` env var
- Parse mode: HTML
- **Optional integration** - gracefully skips if env vars not configured

**Alert Types:**
- WAHA server unreachable
- Phone number disconnected
- Phone number reconnected (recovery notice)

## Data Storage

### Supabase (PostgreSQL)

**Role:** Primary database, authentication, file storage, and realtime subscriptions.

**Connection:**
- URL: `NEXT_PUBLIC_SUPABASE_URL` env var
- Anon key: `NEXT_PUBLIC_SUPABASE_ANON_KEY` env var (client + server with RLS)
- Service key: `SUPABASE_SERVICE_ROLE_KEY` env var (admin operations, bypasses RLS)

**Client Initialization (4 patterns):**

1. **Browser client** - `src/lib/supabase/client.ts`
   - `createBrowserClient()` from `@supabase/ssr`
   - Used in React hooks and client components
   - Singleton pattern in `src/hooks/use-auth.ts`

2. **Server client (with cookies)** - `src/lib/supabase/server.ts`
   - `createServerClient()` from `@supabase/ssr`
   - Uses Next.js `cookies()` for session management
   - Used in server components, server actions, and API routes that need user context

3. **Service client (admin)** - `src/lib/supabase/service.ts`
   - `createClient()` from `@supabase/supabase-js` with service role key
   - Bypasses Row-Level Security (RLS)
   - Used in webhook handlers, registration flow, cron jobs, and AI agent

4. **Middleware client** - `src/lib/supabase/middleware.ts`
   - `createServerClient()` from `@supabase/ssr`
   - Manages auth session refresh on every request
   - Called from `src/middleware.ts`

**Database Tables (identified from code usage):**

| Table | Purpose | Key Files |
|-------|---------|-----------|
| `businesses` | Business accounts | `src/lib/auth/register.ts`, `src/lib/ai/agent-prompt.ts` |
| `business_users` | User-to-business mapping (roles: owner) | `src/lib/auth/register.ts`, `src/hooks/use-auth.ts` |
| `business_settings` | Working hours, services, cancellation policy, AI config | `src/lib/data/settings-mutations.ts`, `src/lib/ai/agent-prompt.ts` |
| `business_templates` | Business type templates for onboarding | `src/lib/auth/register.ts` |
| `ai_personas` | AI agent personality (tone, emoji, prompt, examples) | `src/lib/ai/agent-prompt.ts`, `src/lib/data/settings-mutations.ts` |
| `contacts` | Customer records (phone, status, tags, visit stats) | `src/lib/data/contacts.ts`, `src/lib/data/contacts-mutations.ts` |
| `conversations` | Chat threads (status, bot toggle, assignment) | `src/lib/data/messages.ts`, `src/app/api/webhooks/waha/route.ts` |
| `messages` | Individual messages (direction, sender type, content) | `src/lib/data/messages.ts`, `src/app/api/webhooks/waha/route.ts` |
| `appointments` | Scheduled appointments (service, time, price, status) | `src/lib/data/appointments.ts`, `src/lib/data/appointments-mutations.ts` |
| `expenses` | One-time business expenses | `src/lib/data/expenses.ts` |
| `recurring_expenses` | Recurring expense entries | `src/lib/data/expenses.ts` |
| `phone_numbers` | WhatsApp phone sessions (WAHA session mapping) | `src/app/api/webhooks/waha/route.ts`, `src/app/api/waha/connect/route.ts` |
| `ai_conversation_logs` | AI response logs (intent, confidence, escalation) | `src/app/api/webhooks/waha/route.ts`, `src/lib/ai/bi-chat.ts` |
| `ai_chat_history` | BI chat Q&A history | `src/lib/ai/bi-chat.ts` |
| `kpi_snapshots` | Periodic business metrics snapshots | `src/lib/ai/bi-chat.ts` |
| `onboarding_progress` | Multi-step onboarding wizard state | `src/lib/data/onboarding.ts`, `src/lib/auth/register.ts` |
| `billing_accounts` | Billing and plan information | `src/lib/auth/register.ts` |
| `waitlist` | Appointment waitlist for cancelled slot offers | `src/lib/data/appointments-mutations.ts` |

**Supabase RPC Functions:**
- `increment_contact_visits(p_contact_id, p_revenue)` - Atomic contact stats update, called from `src/lib/data/appointments-mutations.ts`

**File Storage:**
- Bucket: `receipts` - Expense receipt image uploads
- Used in: `src/lib/data/expenses.ts` (`addExpense()`)
- Files stored at path: `{businessId}/{timestamp}_{filename}`
- Public URLs generated via `supabase.storage.from('receipts').getPublicUrl()`

**Realtime Subscriptions:**
- Implemented in `src/hooks/use-realtime.ts`
- `useRealtimeMessages(conversationId)` - Subscribes to `postgres_changes` on `messages` table (INSERT + UPDATE)
- `useRealtimeAppointments(businessId)` - Subscribes to `postgres_changes` on `appointments` table (INSERT + UPDATE + DELETE)
- `useRealtimeConversations(businessId)` - Subscribes to `postgres_changes` on `conversations` table (all events, refetches with joins)

## Authentication & Identity

**Auth Provider:** Supabase Auth

- Implementation: Email/password signup and login
- Registration flow: `src/lib/auth/register.ts` (`registerBusiness()` server action)
- Session management: Cookie-based via `@supabase/ssr`
- Middleware: `src/middleware.ts` -> `src/lib/supabase/middleware.ts`
  - Refreshes auth session on every request
  - Redirects unauthenticated users to `/login`
  - Exempts: `/login`, `/register`, `/api/webhooks/*`
- Client auth hook: `src/hooks/use-auth.ts` (`useAuth()`)
  - Provides `user`, `businessId`, `loading` state
  - Subscribes to `onAuthStateChange` for session changes

**Authorization Pattern:**
- Row-Level Security (RLS) on Supabase tables scopes data to the user's business
- API routes manually verify auth via `supabase.auth.getUser()` and resolve business via `business_users` table
- Webhook routes use service client (no auth context) - explicitly exempted from middleware redirect
- Cron routes protected by `CRON_SECRET` bearer token

**User Metadata:**
- `full_name` and `phone` stored in Supabase Auth user metadata during signup

## Monitoring & Observability

**Error Tracking:** None detected (no Sentry, Datadog, etc.)

**Logs:**
- `console.log` / `console.error` / `console.warn` throughout
- Prefixed log patterns: `[webhook]`, `[health-check]`, `[AI]`, `[AI Vision]`, `[Reminder]`, `[Waitlist]`, `[Contact Stats]`, `[Receipt Upload]`, `[api/ai/agent]`, `[api/ai/chat]`, `[api/messages]`, `[api/waha/connect]`, `[api/waha/qr]`

**Health Monitoring:**
- Cron health check endpoint: `GET /api/cron/health-check` (`src/app/api/cron/health-check/route.ts`)
- Compares WAHA session states against database records
- Detects orphaned WAHA sessions
- Sends Telegram alerts on status changes
- Protected by `CRON_SECRET` bearer token

## CI/CD & Deployment

**Hosting:** Vercel (implied by Next.js App Router, Vercel Cron references in comments)

**CI Pipeline:** Not detected (no `.github/workflows/`, no `vercel.json` found)

**Build Commands:**
```bash
npm run dev    # Development server
npm run build  # Production build
npm run start  # Start production server
npm run lint   # ESLint
```

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (server-only, secret)
- `OPENROUTER_API_KEY` - OpenRouter API key (server-only, secret)
- `WAHA_API_URL` - WAHA server base URL (server-only)
- `WAHA_API_KEY` - WAHA API key (server-only, secret)
- `NEXT_PUBLIC_APP_URL` - Public URL of the app (used for webhook callback URLs)

**Optional env vars:**
- `AI_MODEL` - Override AI model (default: `google/gemini-2.5-flash-preview`)
- `AI_VISION_MODEL` - Override vision model (default: `google/gemini-2.5-flash-preview`)
- `CRON_SECRET` - Bearer token for cron endpoint protection
- `TELEGRAM_BOT_TOKEN` - Telegram bot for health alerts
- `TELEGRAM_CHAT_ID` - Telegram chat for health alerts

**Secrets location:**
- `.env.local` file (present, gitignored)
- All server-only secrets accessed via `process.env` at runtime

## Webhooks & Callbacks

**Incoming Webhooks:**

1. **WAHA Message Webhook** - `POST /api/webhooks/waha` (`src/app/api/webhooks/waha/route.ts`)
   - Receives WhatsApp message events from WAHA server
   - Events handled:
     - `message` - Incoming customer message -> auto-creates contact/conversation, saves message, triggers AI agent
     - `session.status` - Session state changes -> updates `phone_numbers` status
     - `message.ack` - Delivery/read receipts -> updates message status (sent/delivered/read)
   - Uses service client (no auth) - exempted from middleware auth redirect
   - Webhook URL configured during session creation: `{NEXT_PUBLIC_APP_URL}/api/webhooks/waha`

**Outgoing Webhooks:** None

**Cron Endpoints:**

1. **Health Check** - `GET /api/cron/health-check` (`src/app/api/cron/health-check/route.ts`)
   - Polls WAHA for session statuses
   - Updates DB records
   - Sends Telegram alerts for disconnections/reconnections
   - Protected by `CRON_SECRET` bearer token

2. **Reminders** - `src/app/api/cron/reminders/` (directory exists but empty; not yet implemented)

## Internal API Routes

| Method | Path | Purpose | File |
|--------|------|---------|------|
| POST | `/api/ai/agent` | Manual AI agent trigger | `src/app/api/ai/agent/route.ts` |
| POST | `/api/ai/chat` | BI chat query | `src/app/api/ai/chat/route.ts` |
| GET | `/api/appointments` | List appointments by date range | `src/app/api/appointments/route.ts` |
| POST | `/api/appointments` | Create appointment | `src/app/api/appointments/route.ts` |
| GET | `/api/contacts` | Search/list contacts with pagination | `src/app/api/contacts/route.ts` |
| POST | `/api/contacts` | Create contact | `src/app/api/contacts/route.ts` |
| POST | `/api/messages` | Send manual WhatsApp message | `src/app/api/messages/route.ts` |
| POST | `/api/waha/connect` | Create WAHA session for business | `src/app/api/waha/connect/route.ts` |
| GET | `/api/waha/qr` | Get QR code for session auth | `src/app/api/waha/qr/route.ts` |
| POST | `/api/webhooks/waha` | WAHA webhook receiver | `src/app/api/webhooks/waha/route.ts` |
| GET | `/api/cron/health-check` | WAHA session health check | `src/app/api/cron/health-check/route.ts` |

## Planned/Stubbed Integrations

**BullMQ Job Queue:**
- Referenced in TODO comments in `src/lib/data/appointments-mutations.ts`
- Directory exists: `src/lib/queue/` (empty)
- Intended for: Appointment reminder scheduling (1 hour before start)
- Currently: Reminders are logged but not actually sent

**WhatsApp Cloud API:**
- Comment in `src/lib/waha/provider.ts`: "Future: CloudApiProvider implements WhatsAppProvider"
- The `WhatsAppProvider` interface is designed for provider swapping

**Waitlist Notifications:**
- Logic exists in `src/lib/data/appointments-mutations.ts` (`cancelAppointment()`)
- Waitlist query works, but WhatsApp notification is commented out (TODO)

---

*Integration audit: 2026-03-16*
