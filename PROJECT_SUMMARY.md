# WhatsApp AI Agent Platform - Comprehensive Project Summary

> **Generated**: 2026-03-24
> **Stack**: Next.js 16 + React 19 + Supabase + WAHA + OpenRouter AI
> **Language**: TypeScript (RTL Hebrew UI)
> **Status**: Post-MVP, deployed to production (144.91.108.83:3001)

---

## Table of Contents

1. [Overall Architecture](#overall-architecture)
2. [Tech Stack](#tech-stack)
3. [Database Schema](#database-schema)
4. [Complete File Reference (src/)](#complete-file-reference)
5. [User Flow](#user-flow)
6. [AI Pipeline](#ai-pipeline)
7. [API Routes Reference](#api-routes-reference)
8. [Deployment Setup](#deployment-setup)

---

## Overall Architecture

```
                          +------------------+
                          |   Next.js App    |
                          | (SSR + Client)   |
                          +--------+---------+
                                   |
            +----------------------+----------------------+
            |                      |                      |
    +-------v-------+    +--------v--------+    +--------v--------+
    |  Supabase     |    |  OpenRouter AI  |    |  WAHA Server    |
    |  (DB + Auth   |    |  (Gemini 2.5    |    |  (WhatsApp      |
    |   + Realtime  |    |   Flash via     |    |   Web API)      |
    |   + Storage)  |    |   OpenAI-compat)|    |                 |
    +---------------+    +-----------------+    +--------+--------+
                                                         |
                                                  +------v------+
                                                  |  WhatsApp   |
                                                  |  (End Users)|
                                                  +-------------+
```

**Architecture Pattern**: Multi-tenant SaaS with per-business data isolation via Supabase RLS (Row Level Security). Each business gets its own WhatsApp session via WAHA, AI persona, and settings.

**Request Flow**:
- **Dashboard pages**: Next.js Server Components fetch data via Supabase server client (cookie-based auth)
- **Client interactions**: React Client Components use Supabase browser client + realtime subscriptions
- **WhatsApp messages**: WAHA webhook -> `/api/webhooks/waha` -> AI agent -> WAHA send -> DB persist
- **AI queries**: Server-side calls to OpenRouter API (OpenAI-compatible endpoint)

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16.1.6 (App Router) | SSR, API routes, middleware |
| **UI** | React 19, Tailwind CSS 4 | Component rendering, styling |
| **Database** | Supabase (PostgreSQL) | Data, auth, realtime, storage |
| **AI** | OpenRouter API (Gemini 2.5 Flash) | Chat AI, BI analysis, style learning |
| **WhatsApp** | WAHA (self-hosted) | WhatsApp Web API bridge |
| **Validation** | Zod 4 | Schema validation |
| **Forms** | React Hook Form 7 | Form state management |
| **Icons** | Lucide React | UI icons |
| **Font** | Noto Sans Hebrew | Hebrew typography |
| **Deploy** | PM2 on VPS (Debian) | Process management |
| **Alerts** | Telegram Bot API | Health check alerts |

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-side, bypasses RLS) |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI |
| `AI_MODEL` | AI model identifier (default: `google/gemini-2.5-flash-preview`) |
| `WAHA_API_URL` | WAHA server base URL |
| `WAHA_API_KEY` | WAHA API authentication key |
| `WAHA_WEBHOOK_SECRET` | Optional webhook auth secret |
| `CRON_SECRET` | Health check cron authorization |
| `TELEGRAM_BOT_TOKEN` | Telegram alerts bot token |
| `TELEGRAM_CHAT_ID` | Telegram alerts chat ID |

---

## Database Schema

### 23 Tables (all UUID primary keys, RLS enabled)

#### Core Business Tables

**`businesses`** (4 rows) - Top-level tenant entity
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | Business display name |
| owner_user_id | uuid | FK -> auth.users |
| business_type | text | e.g., "barbershop", "cosmetics" |
| plan | text | `trial` (default), `basic`, `pro` |
| status | text | `active`, `onboarding` |
| created_at | timestamptz | |

**`business_users`** (4 rows) - User-to-business mapping (multi-user support)
| Column | Type | Notes |
|--------|------|-------|
| business_id | uuid | FK -> businesses |
| user_id | uuid | FK -> auth.users |
| role | text | `owner`, `agent` |

**`business_settings`** (4 rows) - Per-business configuration
| Column | Type | Notes |
|--------|------|-------|
| business_id | uuid | FK -> businesses (unique) |
| working_hours | jsonb | `{0: {active, start, end, breaks[]}, ...}` keyed by day-of-week |
| services | jsonb | `[{name, duration, price}, ...]` |
| cancellation_policy | jsonb | Policy text/rules |
| ai_config | jsonb | General AI config (includes theme) |
| ai_advanced | jsonb | Advanced AI training config (goal, sales_style, upsells, guardrails, FAQ, knowledge) |

**`business_templates`** (4 rows) - Pre-built templates per business type
| Column | Type | Notes |
|--------|------|-------|
| business_type | text | Template key (e.g., "barbershop") |
| template_data | jsonb | Default services, hours, policies |

#### WhatsApp / Messaging Tables

**`phone_numbers`** (4 rows) - WAHA session tracking
| Column | Type | Notes |
|--------|------|-------|
| business_id | uuid | FK -> businesses |
| phone_number | text | Unique, the WhatsApp number |
| session_id | text | WAHA session name |
| status | text | `connected`, `disconnected`, `pending_qr` |
| provider | text | `waha` (default) |
| ownership | text | `platform`, `client` |
| last_health_check | timestamptz | |

**`contacts`** (11 rows) - CRM contacts
| Column | Type | Notes |
|--------|------|-------|
| business_id | uuid | FK -> businesses |
| wa_id | text | WhatsApp identifier (phone or LID) |
| phone | text | Display phone number |
| name | text | Contact name |
| status | text | `new`, `active`/`returning`, `vip`, `dormant` |
| tags | jsonb | Array of tags |
| notes | text | Free-text notes |
| birthday | date | |
| total_visits | integer | Auto-incremented |
| total_revenue | numeric | Auto-accumulated |

**`conversations`** (9 rows) - Chat threads
| Column | Type | Notes |
|--------|------|-------|
| business_id | uuid | FK -> businesses |
| contact_id | uuid | FK -> contacts |
| status | text | `active`, `closed`, `waiting` |
| is_bot_active | boolean | Whether AI responds automatically |
| assigned_to | uuid | FK -> auth.users (manual agent) |
| booking_state | jsonb | State machine state for booking flow |
| last_message_at | timestamptz | |

**`messages`** (426 rows) - Individual messages
| Column | Type | Notes |
|--------|------|-------|
| conversation_id | uuid | FK -> conversations |
| direction | text | `inbound`, `outbound` |
| sender_type | text | `customer`, `ai`, `human`, `agent` |
| type | text | `text`, `image`, etc. |
| content | text | Message body |
| status | text | `sent`, `delivered`, `read` |
| provider_message_id | text | WAHA message ID (for ack tracking) |

#### Appointments & Scheduling

**`appointments`** (22 rows) - Booked appointments
| Column | Type | Notes |
|--------|------|-------|
| business_id | uuid | FK -> businesses |
| contact_id | uuid | FK -> contacts |
| service_type | text | Service name |
| start_time | timestamp (no tz) | Israel local time |
| end_time | timestamp (no tz) | Israel local time |
| duration_minutes | integer | |
| status | text | `confirmed`, `completed`, `cancelled`, `no_show`, `pending` |
| price | numeric | |
| contact_name | text | Denormalized for display |
| reminder_sent | boolean | |
| confirmed_by_client | boolean | |

**`waitlist`** (0 rows) - Waitlist for cancelled slots
| Column | Type | Notes |
|--------|------|-------|
| contact_id | uuid | FK -> contacts |
| preferred_date | date | |
| service_type | text | |
| status | text | `waiting`, `offered` |

#### AI Tables

**`ai_personas`** (4 rows) - Per-business AI personality
| Column | Type | Notes |
|--------|------|-------|
| business_id | uuid | FK -> businesses (unique) |
| system_prompt | text | Custom system prompt |
| tone | text | `friendly`, `professional`, `casual`, `humorous` |
| emoji_usage | text | `none`, `light`, `heavy` |
| style_examples | jsonb | Example messages array |
| boundaries | jsonb | Active hours, sensitive topics |
| learned_phrases | jsonb | AI-extracted phrases from owner's chats |
| conversation_style | text | AI-generated style description |
| custom_instructions | text | Additional instructions |

**`ai_conversation_logs`** (200 rows) - AI response audit trail
| Column | Type | Notes |
|--------|------|-------|
| conversation_id | uuid | FK -> conversations |
| detected_intent | text | `book`, `cancel`, `greeting`, etc. |
| ai_response | text | The AI's response text |
| confidence | numeric | 0.0-1.0 |
| escalated | boolean | Whether escalated to human |

**`ai_chat_history`** (5 rows) - BI chat Q&A history
| Column | Type | Notes |
|--------|------|-------|
| business_id | uuid | FK -> businesses |
| question | text | User's BI question |
| answer | text | AI's answer |
| query_generated | text | Query plan JSON |

#### Financial Tables

**`expenses`** (0 rows) - One-time expenses
| Column | Type | Notes |
|--------|------|-------|
| category | text | Expense category |
| amount | numeric | |
| receipt_url | text | Supabase Storage URL |
| expense_date | date | |
| is_recurring | boolean | |

**`recurring_expenses`** (0 rows) - Monthly/weekly recurring expenses
| Column | Type | Notes |
|--------|------|-------|
| frequency | text | `monthly`, `weekly`, `yearly` |
| is_active | boolean | |

#### KPI & Analytics

**`kpi_goals`** (0 rows) - Business KPI targets
**`kpi_snapshots`** (0 rows) - Periodic KPI snapshots with metrics JSONB

#### Billing & Payments

**`billing_accounts`** (4 rows) - Subscription billing
**`platform_payments`** (0 rows) - Payment records (Tranzila integration placeholder)

#### System Tables

**`onboarding_progress`** (4 rows) - Multi-step onboarding tracking
**`notifications`** (56 rows) - In-app notification system (typed: new_appointment, cancelled_appointment, etc.)
**`webhook_logs`** (0 rows) - Raw webhook payload logging
**`audit_log`** (0 rows) - User action audit trail

---

## Complete File Reference

### Root Configuration

| File | Purpose |
|------|---------|
| `package.json` | Dependencies: Next.js 16, React 19, Supabase SSR, Zod 4, React Hook Form, Lucide, Tailwind 4 |
| `next.config.ts` | Next.js configuration (currently empty/default) |
| `tsconfig.json` | TypeScript config with `@/` path alias |
| `postcss.config.mjs` | PostCSS with Tailwind |
| `eslint.config.mjs` | ESLint with Next.js config |
| `deploy.sh` | Production deployment script (tar + scp + pm2) |
| `public/manifest.json` | PWA manifest for mobile installability |

---

### `src/middleware.ts`
**Purpose**: Next.js edge middleware that intercepts all non-static requests.
**Key logic**: Calls `updateSession()` to (1) refresh Supabase auth cookies, (2) redirect unauthenticated users to `/login`, (3) redirect users without completed onboarding to `/onboarding`.
**Imports from**: `@/lib/supabase/middleware`
**Used by**: Every page request

---

### `src/types/database.ts`
**Purpose**: Re-exports TypeScript interfaces for database row types.
**Exports**: `Contact`, `Conversation`, `PhoneNumber`, `ConversationWithContact`, `Message`
**Imports from**: `@/lib/data/messages`

---

### `src/lib/env.ts`
**Purpose**: Validates required environment variables on startup, logs warnings for missing ones.
**Exports**: None (side-effect only)
**Used by**: `src/app/layout.tsx` (imported for side effect)

---

### `src/lib/utils/cn.ts`
**Purpose**: Tailwind CSS class merging utility combining `clsx` and `tailwind-merge`.
**Exports**: `cn()`
**Used by**: Most UI components

---

### `src/lib/validations.ts`
**Purpose**: Zod validation schemas for forms throughout the app. All error messages in Hebrew.
**Exports**: `registerSchema`, `appointmentSchema`, `expenseSchema`, `contactSchema`, `RegisterInput`, `AppointmentInput`, `ExpenseInput`, `ContactInput`
**Used by**: Registration, appointment creation, expense forms, contact forms

---

### Supabase Clients (`src/lib/supabase/`)

#### `src/lib/supabase/client.ts`
**Purpose**: Creates a browser-side Supabase client using the anon key. Used in Client Components.
**Exports**: `createClient()`
**Used by**: All `use-*.ts` hooks, client-side pages

#### `src/lib/supabase/server.ts`
**Purpose**: Creates a server-side Supabase client using cookies for auth. Used in Server Components and API routes.
**Exports**: `createClient()`
**Used by**: All `src/lib/data/*.ts` queries, API routes, server actions

#### `src/lib/supabase/service.ts`
**Purpose**: Creates a Supabase admin client using the service role key. Bypasses RLS for system operations.
**Exports**: `createServiceClient()`
**Used by**: Webhooks, registration, AI agent actions, cron jobs

#### `src/lib/supabase/middleware.ts`
**Purpose**: Middleware session handler. Refreshes auth tokens, enforces login redirect, enforces onboarding redirect.
**Exports**: `updateSession()`
**Used by**: `src/middleware.ts`
**Key logic**: Public paths (`/login`, `/register`, `/api/webhooks`, `/api/cron`) skip auth. Logged-in users without completed onboarding are redirected to `/onboarding`.

---

### AI Module (`src/lib/ai/`)

#### `src/lib/ai/ai-client.ts`
**Purpose**: Low-level AI client that calls OpenRouter API (OpenAI-compatible). Supports text and vision models.
**Exports**: `generateResponse()`, `generateVisionResponse()`, `ConversationEntry`, `GenerateOptions`
**Used by**: `agent-prompt.ts`, `bi-chat.ts`, `style-analyzer.ts`, API routes
**Key details**: Default model is `google/gemini-2.5-flash-preview`. Sends HTTP-Referer and X-Title headers for OpenRouter tracking.

#### `src/lib/ai/agent-prompt.ts`
**Purpose**: The core AI agent that handles WhatsApp conversations. Builds a comprehensive Hebrew system prompt from business config, processes messages, parses structured JSON responses, and executes actions (book/cancel/reschedule appointments, update contacts, escalate).
**Exports**: `processAIAgent()`, `buildSystemPrompt()`, `AgentInput`, `AgentResponse`, `AdvancedAIConfig`
**Used by**: WAHA webhook handler, manual AI agent API
**Key features**:
- Dynamic system prompt built from business settings, services, working hours, AI persona, advanced config (goals, sales style, upsells, guardrails, FAQ)
- Time slot validation and rounding to service duration intervals
- Conflict detection with swap offers to existing customers
- Contact name learning and auto-update
- Date/time awareness with Israel timezone
- Customer status-aware responses (new/returning/VIP)
- Structured JSON response format with action dispatch

#### `src/lib/ai/bi-chat.ts`
**Purpose**: Business Intelligence chat system. Users ask natural language questions about their business data; the AI determines which tables to query, fetches data, and generates Hebrew answers.
**Exports**: `processBusinessQuery()`, `BIChatResult`
**Used by**: `/api/ai/chat` route
**Pipeline**: Question -> AI query plan (which tables?) -> Supabase data fetch (scoped to business_id, limited to 50 rows) -> AI answer generation -> Save to `ai_chat_history`

#### `src/lib/ai/booking-state.ts`
**Purpose**: State machine for the appointment booking flow. Tracks conversation state through steps: idle -> collecting_service -> collecting_name -> collecting_date -> collecting_time -> collecting_notes -> confirming.
**Exports**: `processState()`, `checkAvailability()`, `loadBookingState()`, `saveBookingState()`, `BookingState`, `ExtractedData`
**Used by**: `agent-prompt.ts` (currently the agent handles booking inline, this is a structured alternative)
**Key features**: Service fuzzy matching, time slot generation, date/time validation, Hebrew day names

#### `src/lib/ai/intent-detector.ts`
**Purpose**: Re-export wrapper for backward compatibility.
**Exports**: `processAIAgent`, `AgentInput`, `AgentResponse` (re-exported from `agent-prompt.ts`)

#### `src/lib/ai/style-analyzer.ts`
**Purpose**: Analyzes WhatsApp screenshots using AI vision to extract a business owner's communication style (message length, emoji usage, formality, phrases).
**Exports**: `analyzeStyleFromScreenshots()`, `StyleAnalysis`, `ScreenshotInput`
**Used by**: Onboarding AI style step

---

### WAHA WhatsApp Module (`src/lib/waha/`)

#### `src/lib/waha/types.ts`
**Purpose**: TypeScript interfaces for WAHA API payloads.
**Exports**: `WahaSession`, `WahaMessage`, `WebhookPayload`, `WahaQR`, `WahaSendResult`

#### `src/lib/waha/waha-client.ts`
**Purpose**: Low-level HTTP client for the WAHA API. Handles session management, QR code retrieval, text/image sending.
**Exports**: `WahaClient` class, `waha` singleton instance
**Methods**: `createSession()`, `getSession()`, `getSessions()`, `getQR()`, `sendText()`, `sendImage()`

#### `src/lib/waha/provider.ts`
**Purpose**: Provider abstraction layer over WAHA. Implements `WhatsAppProvider` interface so the backend can be swapped (e.g., to Meta Cloud API) without changing calling code.
**Exports**: `WahaProvider` class, `whatsapp` singleton, `WhatsAppProvider` interface
**Methods**: `sendMessage()`, `sendImage()`, `getSessionStatus()`, `createSession()`, `getQR()`

---

### Auth Module (`src/lib/auth/`)

#### `src/lib/auth/register.ts`
**Purpose**: Server Action for full business registration. Creates: auth user -> business -> business_users link -> business_settings (from template) -> ai_personas -> billing_accounts -> onboarding_progress.
**Exports**: `registerBusiness()`, `RegisterBusinessData`

#### `src/lib/auth/onboarding-actions.ts`
**Purpose**: Server Actions for the manual (step-by-step) onboarding flow. Updates onboarding progress, saves settings, saves AI persona, completes onboarding.
**Exports**: `updateOnboardingStep()`, `saveBusinessSettings()`, `saveAiPersona()`, `completeOnboarding()`

#### `src/lib/auth/save-onboarding.ts`
**Purpose**: Server Action for the AI chat-based onboarding flow. Saves all onboarding data in a single transaction when the AI chat gathers all info.
**Exports**: `saveAiOnboardingData()`, `OnboardingData`
**Key logic**: Transforms working hours from array format to Record format, generates AI system prompt, marks onboarding as completed.

---

### Data Access Layer (`src/lib/data/`)

#### `src/lib/data/messages.ts`
**Purpose**: Server-side queries for conversations and messages. Fetches conversation list with contact info and last message, and messages for a single conversation.
**Exports**: `getConversations()`, `getConversationMessages()`, `ConversationWithContact`, `Message`, `ConversationFilters`
**Used by**: Inbox page (SSR), inbox components

#### `src/lib/data/contacts.ts`
**Purpose**: Server-side queries for contacts. Supports search, filtering, sorting, pagination, and detailed contact view with appointments/conversations.
**Exports**: `getContacts()`, `getContactById()`, `getDormantContacts()`, `Contact`, `ContactsResult`, `ContactDetail`

#### `src/lib/data/contacts-mutations.ts`
**Purpose**: Contact creation and status auto-computation (new -> returning -> VIP -> dormant based on visit count and recency).
**Exports**: `createContact()`, `updateContactStatus()`, `CreateContactData`

#### `src/lib/data/appointments.ts`
**Purpose**: Appointment queries. Fetches by date, week, month. Calculates available time slots by checking working hours, breaks, and existing appointments.
**Exports**: `getAppointmentsByDate()`, `getAvailableSlots()`, `getWeekAppointments()`, `getMonthAppointments()`, `AppointmentWithContact`, `parseTime()`, `formatTime()`

#### `src/lib/data/appointments-mutations.ts`
**Purpose**: Appointment CRUD with side effects: reminder scheduling (TODO: BullMQ), contact stats update via RPC, waitlist notification on cancellation, rescheduling.
**Exports**: `createAppointment()`, `cancelAppointment()`, `rescheduleAppointment()`, `CreateAppointmentData`

#### `src/lib/data/dashboard.ts`
**Purpose**: Aggregates dashboard KPIs: today's appointments, monthly revenue, new contacts this week, cancellation rate.
**Exports**: `getDashboardData()`, `DashboardData`

#### `src/lib/data/expenses.ts`
**Purpose**: Financial data queries and mutations. Computes monthly summary (revenue from completed appointments minus expenses minus recurring). Supports receipt upload to Supabase Storage.
**Exports**: `getMonthlyFinancials()`, `addExpense()`, `addRecurringExpense()`, `Expense`, `RecurringExpense`, `MonthlyFinancials`

#### `src/lib/data/onboarding.ts`
**Purpose**: Step-by-step onboarding flow handler. Advances through 9 steps, applying step-specific data to the appropriate tables (business type, name, services, working hours, AI persona).
**Exports**: `updateOnboardingStep()`

#### `src/lib/data/settings-mutations.ts`
**Purpose**: Settings update mutations for working hours, services, and AI persona.
**Exports**: `updateWorkingHours()`, `updateServices()`, `updateAIPersona()`, `WorkingHours`, `ServiceItem`, `AIPersonaUpdate`

---

### React Hooks (`src/hooks/`)

#### `src/hooks/use-auth.ts`
**Purpose**: Client-side auth hook. Resolves current user, their business_id, and business name. Listens for auth state changes.
**Exports**: `useAuth()` -> `{ user, businessId, businessName, loading }`

#### `src/hooks/use-realtime.ts`
**Purpose**: Supabase Realtime subscription hooks. Provides live-updating arrays for messages, appointments, and conversations via Postgres changes.
**Exports**: `useRealtimeMessages(conversationId)`, `useRealtimeAppointments(businessId)`, `useRealtimeConversations(businessId, initialData)`

#### `src/hooks/use-theme.ts`
**Purpose**: Theme customization hook. Loads theme from localStorage (instant) then syncs with Supabase. Applies CSS custom properties to DOM. Supports cookie-based SSR.
**Exports**: `useTheme(businessId)` -> `{ theme, setTheme, loading }`

#### `src/hooks/use-toast.ts`
**Purpose**: Toast notification system. Manages toast stack with auto-dismiss timers.
**Exports**: `useToast()` -> `{ toast, toasts, removeToast }`

---

### App Layout & Pages (`src/app/`)

#### `src/app/layout.tsx`
**Purpose**: Root layout. Sets up Hebrew RTL direction, Noto Sans Hebrew font, theme CSS variables from cookies (SSR flash prevention), PWA metadata.
**Imports**: `ThemeProvider`, `@/lib/env` (side effect)

#### `src/app/globals.css`
**Purpose**: Tailwind CSS imports and custom design system (glass morphism, iOS-style shadows, animations, color variables).

#### `src/app/(auth)/layout.tsx`
**Purpose**: Auth pages layout. Centered card with glass morphism background.

#### `src/app/(auth)/login/page.tsx`
**Purpose**: Login form. Uses Supabase `signInWithPassword`. Redirects to `/` on success.
**Client Component**: Yes

#### `src/app/(auth)/register/page.tsx`
**Purpose**: Registration form with business type selection. Calls `registerBusiness()` server action. Redirects to `/onboarding`.
**Client Component**: Yes
**Business types**: Barbershop, Cosmetics, Nails, Personal Trainer, Health, Professional Services, Education, Tradesmen, Other

#### `src/app/(dashboard)/layout.tsx`
**Purpose**: Dashboard layout shell. Includes desktop `Sidebar`, mobile `BottomNav`, `MobileHeader`, `ToastProvider`, Suspense loading skeleton.

#### `src/app/(dashboard)/page.tsx`
**Purpose**: Main dashboard (SSR). Shows greeting, WhatsApp connection status, 4 KPI stat cards (today's appointments, monthly revenue, new contacts, cancellation rate), upcoming appointments list.
**Server Component**: Yes

#### `src/app/(dashboard)/inbox/page.tsx`
**Purpose**: WhatsApp inbox (SSR + client). Loads conversations server-side, delegates to `InboxShell` for split-view UI (conversation list + chat view).
**Server Component**: Yes (data fetch), delegates to client

#### `src/app/(dashboard)/calendar/page.tsx`
**Purpose**: Appointment calendar. Delegates to `CalendarView` component.

#### `src/app/(dashboard)/contacts/page.tsx`
**Purpose**: Contact management. Delegates to `ContactsList` component.

#### `src/app/(dashboard)/contacts/[id]/page.tsx`
**Purpose**: Single contact detail page with appointment history and conversation history.

#### `src/app/(dashboard)/ai-chat/page.tsx`
**Purpose**: BI chat interface. Users ask natural language questions about their business data, get AI-generated Hebrew answers with data.
**Client Component**: Yes

#### `src/app/(dashboard)/expenses/page.tsx`
**Purpose**: Financial tracking page. Shows monthly revenue, expenses, recurring costs, net profit.

#### `src/app/(dashboard)/kpis/page.tsx`
**Purpose**: KPI dashboard with AI-generated insights. Shows key metrics and lets AI analyze trends.

#### `src/app/(dashboard)/reports/page.tsx`
**Purpose**: Reports page (likely placeholder or basic analytics view).

#### `src/app/(dashboard)/settings/page.tsx`
**Purpose**: Business settings page. Sections: WhatsApp connection (QR scanner), working hours editor, services editor, AI persona config, theme picker.
**Client Component**: Yes

#### `src/app/(dashboard)/train-ai/page.tsx`
**Purpose**: Advanced AI training wizard. Configure: business goal, sales style slider, upsell rules, guardrails, FAQ, custom knowledge, style learning from chat samples.

#### `src/app/onboarding/layout.tsx`
**Purpose**: Onboarding layout wrapper.

#### `src/app/onboarding/page.tsx`
**Purpose**: Multi-mode onboarding page. Users choose between AI chat-guided onboarding (conversational) or manual step-by-step (services, hours, AI style, WhatsApp QR).
**Client Component**: Yes

#### `src/app/admin/layout.tsx` + `src/app/admin/page.tsx`
**Purpose**: Super-admin panel layout and dashboard. Shows platform-wide stats across all businesses.

#### `src/app/admin/businesses/page.tsx` + `businesses-client.tsx`
**Purpose**: Admin view of all businesses with detail modal.

#### `src/app/admin/phones/page.tsx` + `phones-client.tsx`
**Purpose**: Admin management of all WhatsApp phone numbers across businesses.

#### `src/app/admin/sims/page.tsx` + `sims-client.tsx`
**Purpose**: SIM card inventory management.

#### `src/app/admin/health/page.tsx` + `health-client.tsx`
**Purpose**: System health dashboard showing WAHA session statuses.

#### `src/app/admin/logs/page.tsx` + `logs-client.tsx`
**Purpose**: AI conversation log viewer for debugging.

#### `src/app/admin/billing/page.tsx`
**Purpose**: Billing management across all businesses.

---

### UI Components (`src/components/`)

#### Admin Components (`src/components/admin/`)
- **`admin-sidebar.tsx`**: Admin panel navigation sidebar
- **`admin-stat-card.tsx`**: Stat card component for admin dashboard
- **`business-detail-modal.tsx`**: Modal showing business details with settings/personas
- **`qr-scanner.tsx`**: WhatsApp QR code connection component. Initiates WAHA session, polls for QR, displays QR image, detects successful connection

#### Calendar Components (`src/components/calendar/`)
- **`calendar-view.tsx`**: Full calendar with day/week/month views. Fetches appointments via API, supports drag-to-create
- **`appointment-block.tsx`**: Single appointment block in the calendar grid
- **`appointment-detail.tsx`**: Appointment detail panel/modal with reschedule/cancel actions
- **`new-appointment-sheet.tsx`**: Bottom sheet for creating new appointments

#### Contact Components (`src/components/contacts/`)
- **`contacts-list.tsx`**: Searchable, filterable, paginated contact list with status badges
- **`contact-card.tsx`**: Contact card in the list view
- **`contact-detail.tsx`**: Full contact profile with stats, tags, appointments, conversations
- **`contact-form.tsx`**: Contact creation/edit form

#### Dashboard Components (`src/components/dashboard/`)
- **`stat-card.tsx`**: KPI stat card with icon, label, and value
- **`ai-chat-bubble.tsx`**: Chat bubble component for BI chat messages (user/AI), typing indicator, action buttons
- **`expense-form.tsx`**: Expense entry form with category selection and receipt upload

#### Inbox Components (`src/components/inbox/`)
- **`inbox-shell.tsx`**: Main inbox container managing split-view state (list vs. chat on mobile)
- **`conversation-list.tsx`**: Conversation list with last message preview, unread indicators, status
- **`chat-view.tsx`**: Chat message view with realtime updates, auto-scroll, message rendering
- **`chat-bubble.tsx`**: Individual message bubble (inbound/outbound styling, timestamps, read receipts)
- **`message-input.tsx`**: Message composition input with send button
- **`bot-toggle.tsx`**: Toggle switch to enable/disable AI bot for a conversation

#### Onboarding Components (`src/components/onboarding/`)
- **`onboarding-context.tsx`**: React Context for onboarding step state management
- **`ai-onboarding-chat.tsx`**: Conversational AI onboarding chat. Guides user through business setup via natural conversation, extracts structured data, saves on completion
- **`step-services.tsx`**: Manual step for configuring services (name, duration, price)
- **`step-hours.tsx`**: Manual step for configuring working hours per day
- **`step-ai-style.tsx`**: Manual step for configuring AI personality (tone, emoji, style examples)

#### Settings Components (`src/components/settings/`)
- **`theme-picker.tsx`**: Color theme selector with presets (WhatsApp green, ocean blue, sunset orange, etc.) and custom color picker

#### Shared UI Components (`src/components/ui/`)
- **`sidebar.tsx`**: Desktop navigation sidebar with business name, nav links, logout
- **`bottom-nav.tsx`**: Mobile bottom navigation bar (Home, Calendar, Inbox, Contacts, Settings)
- **`mobile-header.tsx`**: Mobile top header with business name, notification bell, user menu
- **`notifications-bell.tsx`**: Notification bell with unread count badge and dropdown
- **`avatar-initials.tsx`**: Avatar component showing initials from name
- **`status-badge.tsx`**: Colored status badge (success/warning/danger/info variants)
- **`error-boundary.tsx`**: React error boundary with retry
- **`theme-provider.tsx`**: Client-side theme initialization component
- **`toast.tsx`**: Toast notification container and context provider

---

## User Flow

### Registration -> Onboarding -> Dashboard -> WhatsApp Bot

```
1. REGISTRATION (/register)
   User fills: name, email, phone, password, business name, business type
   -> Server Action creates: auth user, business, business_users,
      business_settings (from template), ai_persona, billing_account,
      onboarding_progress
   -> Redirect to /onboarding

2. ONBOARDING (/onboarding)
   User chooses mode:

   A) AI Chat Mode (recommended):
      - Conversational AI asks about business type, name, services,
        hours, tone, cancellation policy
      - AI suggests defaults based on business type
      - User confirms, data is extracted as structured JSON
      - saveAiOnboardingData() saves everything at once

   B) Manual Mode:
      - Step-by-step wizard: Services -> Working Hours -> AI Style ->
        WhatsApp QR
      - Each step saves via server actions

   Both modes end by:
   - Setting onboarding_progress.is_completed = true
   - Redirect to / (dashboard)

3. DASHBOARD (/)
   - Middleware checks onboarding completion, allows access
   - SSR fetches: today's appointments, monthly revenue, new contacts,
     cancellation rate, WhatsApp status
   - Shows KPI cards and upcoming appointments

4. WHATSAPP CONNECTION (/settings)
   - User clicks "Connect WhatsApp"
   - Frontend calls POST /api/waha/connect -> creates WAHA session
   - Frontend polls GET /api/waha/qr -> shows QR code
   - User scans QR with WhatsApp mobile
   - WAHA sends session.status webhook -> phone_numbers updated to
     "connected"
   - Frontend detects connection, shows success

5. BOT OPERATION (automatic)
   - Customer sends WhatsApp message to business number
   - WAHA receives message -> sends webhook to /api/webhooks/waha
   - Webhook handler:
     a) Finds business by WAHA session
     b) Finds or creates contact (supports @c.us and @lid formats)
     c) Finds or creates conversation
     d) Saves inbound message to DB
     e) If bot is active: runs AI agent -> sends response via WAHA
     f) Saves outbound AI message and conversation log
   - Dashboard updates in realtime via Supabase Realtime

6. INBOX (/inbox)
   - Business owner sees all conversations
   - Can read AI responses, send manual messages
   - Can toggle bot on/off per conversation
   - Realtime updates when new messages arrive
```

---

## AI Pipeline

### Message Processing Flow

```
Customer WhatsApp Message
         |
         v
+-------------------+
| WAHA Webhook      |  POST /api/webhooks/waha
| (route.ts)        |
+--------+----------+
         |
         v
+-------------------+
| Find/Create       |  phone_numbers -> contacts -> conversations
| Business Context  |  -> messages (save inbound)
+--------+----------+
         |
         v (if is_bot_active)
+-------------------+
| processAIAgent()  |  src/lib/ai/agent-prompt.ts
+--------+----------+
         |
    +----+----+
    |         |
    v         v
+-------+ +----------+
| Build | | Load     |
| System| | History  |  Last 15 messages from conversation
| Prompt| | + Config |  Business settings, AI persona, advanced config
+---+---+ +----+-----+
    |          |
    v          v
+-------------------+
| OpenRouter API    |  Gemini 2.5 Flash
| (ai-client.ts)   |  System prompt + conversation history + user message
+--------+----------+
         |
         v
+-------------------+
| Parse JSON        |  { text, intent, confidence, action, escalated }
| Response          |
+--------+----------+
         |
    +----+----+
    |         |
    v         v
+-------+ +----------+
| Send  | | Execute  |  book_appointment -> check conflicts, insert DB
| Reply | | Actions  |  cancel_appointment -> soft-delete
| via   | |          |  reschedule_appointment -> cancel + rebook
| WAHA  | |          |  update_contact -> update name/phone/notes
+-------+ |          |  escalate -> set flag
          +----------+
         |
         v
+-------------------+
| Save to DB        |  messages (outbound), ai_conversation_logs,
|                   |  notifications (for owner)
+-------------------+
```

### System Prompt Construction

The AI system prompt (`buildSystemPrompt()`) is assembled from:
1. **Base personality**: Israeli casual Hebrew, business-specific slang
2. **Critical rules**: Never reveal AI identity, short messages, escalation rules
3. **Business info**: Name, type, services with prices, working hours
4. **Time slot rules**: Valid booking times based on service duration
5. **Cancellation policy**: From business settings
6. **Communication style**: Tone, emoji usage, style examples
7. **Custom instructions**: From AI persona
8. **Advanced config**: Goal (bookings/revenue/support/leads), sales style, upsell rules, guardrails, FAQ, knowledge base
9. **Learned style**: Phrases and conversation style extracted from owner's chats
10. **Contact context**: Current customer name, status, phone, visit count
11. **Status-specific instructions**: Different behavior for new/returning/VIP customers
12. **Response format**: Structured JSON with action dispatch
13. **Date/time context**: Current Israel date, time, and next week's dates

### BI Chat Pipeline

```
User Question (Hebrew)
         |
         v
+-------------------+
| generateQueryPlan |  AI decides which tables to query
+--------+----------+
         |
         v
+-------------------+
| fetchRelevantData |  Supabase queries (business_id scoped, 50 row limit)
+--------+----------+  Tables: contacts, appointments, messages, conversations,
         |             expenses, ai_conversation_logs, kpi_snapshots
         v
+-------------------+
| generateAnswer    |  AI analyzes data, responds in Hebrew with numbers
+--------+----------+
         |
         v
+-------------------+
| Save to           |  ai_chat_history table
| ai_chat_history   |
+-------------------+
```

---

## API Routes Reference

### AI Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `POST /api/ai/agent` | POST | Manual AI agent trigger for testing | User auth |
| `POST /api/ai/chat` | POST | BI chat - ask business data questions | User auth |
| `POST /api/ai/chat/action` | POST | Execute BI chat actions (create/cancel appointments, campaigns) | User auth |
| `POST /api/ai/insights` | POST | Generate AI insights from KPI data | User auth |
| `POST /api/ai/learn-style` | POST | Analyze chat samples to learn owner's communication style | User auth |
| `POST /api/ai/onboarding-chat` | POST | Conversational onboarding AI chat | User auth |

### Data Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `GET /api/appointments` | GET | List appointments by date range or contact | User auth |
| `POST /api/appointments` | POST | Create appointment | User auth |
| `PATCH /api/appointments` | PATCH | Update/reschedule appointment (sends WhatsApp notification) | User auth |
| `DELETE /api/appointments` | DELETE | Cancel appointment (sends WhatsApp notification) | User auth |
| `GET /api/contacts` | GET | List contacts with search/filter/pagination, or single by ID | User auth |
| `POST /api/contacts` | POST | Create new contact | User auth |
| `PATCH /api/contacts` | PATCH | Update contact fields | User auth |
| `POST /api/messages` | POST | Send manual message via WhatsApp (agent reply) | User auth |
| `GET /api/notifications` | GET | List notifications with unread count | User auth |
| `PATCH /api/notifications` | PATCH | Mark notifications as read | User auth |

### WhatsApp / WAHA Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `POST /api/waha/connect` | POST | Create/restart WAHA session for business | User auth |
| `GET /api/waha/qr` | GET | Get QR code for session (base64 PNG or data URL) | User auth |
| `POST /api/waha/send-test` | POST | Send test message to verify WhatsApp connection | User auth |
| `GET /api/whatsapp/status` | GET | Check WhatsApp connection status | User auth |
| `POST /api/webhooks/waha` | POST | WAHA webhook receiver (messages, ack, session status) | Webhook secret |

### Settings & Onboarding Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `GET /api/train-ai` | GET | Load advanced AI config | User auth |
| `POST /api/train-ai` | POST | Save advanced AI config | User auth |
| `POST /api/onboarding/ensure-business` | POST | Ensure user has business record (recovery) | User auth |

### System Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `GET /api/cron/health-check` | GET | Compare WAHA sessions with DB, update statuses, send Telegram alerts | CRON_SECRET bearer |

---

## Deployment Setup

### Infrastructure

- **Server**: VPS at `144.91.108.83` (Debian/Linux)
- **Process Manager**: PM2 (app name: `wa-app`, port: 3001)
- **Database**: Supabase cloud (PostgreSQL + Auth + Realtime + Storage)
- **WAHA**: Self-hosted on same or nearby server
- **AI**: OpenRouter cloud API

### Deployment Script (`deploy.sh`)

```
1. Pre-flight: Check SSH key, verify project root
2. TypeScript check: `npx tsc --noEmit`
3. Package: tar.gz excluding node_modules, .next, .git, .env.local
4. Upload: scp to server:/opt/wa-platform/
5. Remote deploy:
   a. Backup .env.local
   b. pm2 stop wa-app
   c. Remove old src/ and public/
   d. Extract new code
   e. Restore .env.local (verify SUPABASE_SERVICE_ROLE_KEY present)
   f. npm ci --omit=dev && npm run build
   g. pm2 start/restart wa-app
   h. Health check: curl http://localhost:3001/login
6. Cleanup local tar
```

### Key Safety Features
- `.env.local` is **never** included in the deploy archive
- `.env.local` is backed up before deploy and restored after
- Verification that `SUPABASE_SERVICE_ROLE_KEY` exists post-deploy
- Health check with HTTP status validation
- TypeScript compilation check before deploy

### PWA Support
- `public/manifest.json` with app icons (72px to 512px)
- Apple Web App meta tags
- Mobile-first responsive design
- Bottom navigation for mobile, sidebar for desktop
