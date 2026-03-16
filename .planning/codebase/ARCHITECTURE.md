# Architecture

**Analysis Date:** 2026-03-16

## Pattern Overview

**Overall:** Next.js App Router Monolith with Multi-Tenant SaaS Architecture

**Key Characteristics:**
- Server-first rendering: pages are React Server Components that fetch data directly via `@/lib/data/*` modules
- Client interactivity is pushed to leaf components marked `'use client'`
- Multi-tenant isolation enforced by Supabase RLS (Row Level Security) scoped to `business_id`
- API routes serve two purposes: (1) JSON endpoints for client-side mutations, (2) webhook receivers for external services (WAHA)
- The AI agent pipeline (WhatsApp bot) runs entirely server-side, triggered by incoming webhooks
- Hebrew-first (RTL) application targeting Israeli small business owners

## Layers

**Presentation Layer (Pages + Components):**
- Purpose: Render UI, handle user interactions, manage client-side state
- Location: `src/app/` (pages/layouts), `src/components/` (reusable components)
- Contains: React Server Components (pages), Client Components (interactive UI), layouts with route grouping
- Depends on: Data layer (`@/lib/data/*`), hooks (`@/hooks/*`), UI utilities (`@/lib/utils/cn`)
- Used by: End users via browser

**API Layer (Route Handlers):**
- Purpose: Expose REST endpoints for client mutations and external webhook ingestion
- Location: `src/app/api/`
- Contains: Next.js Route Handlers (`route.ts` files) for messages, appointments, contacts, AI chat, WAHA webhooks, cron jobs
- Depends on: Data layer, AI layer, WhatsApp provider, Supabase clients
- Used by: Client components (via `fetch`), external services (WAHA webhooks), cron schedulers

**Data Layer (Queries + Mutations):**
- Purpose: Encapsulate all Supabase database operations with typed interfaces
- Location: `src/lib/data/`
- Contains: Query functions (read) and mutation functions (write), split into separate files per domain
- Depends on: Supabase server client (`@/lib/supabase/server`) or service client (`@/lib/supabase/service`)
- Used by: Pages (server-side data fetching), API routes (mutations)

**AI Layer:**
- Purpose: Process incoming WhatsApp messages with AI, provide BI chat analytics, analyze communication style
- Location: `src/lib/ai/`
- Contains: Agent prompt builder, OpenRouter/Gemini client, BI query engine, style analyzer
- Depends on: Supabase service client, OpenRouter API (external)
- Used by: Webhook handler (`src/app/api/webhooks/waha/route.ts`), AI API routes, onboarding flow

**WhatsApp Integration Layer:**
- Purpose: Abstract WhatsApp messaging behind a provider interface; currently implements WAHA
- Location: `src/lib/waha/`
- Contains: `WhatsAppProvider` interface, `WahaProvider` implementation, `WahaClient` HTTP client, type definitions
- Depends on: WAHA external API server
- Used by: Webhook handler, message sending API, health check cron

**Auth Layer:**
- Purpose: Handle user authentication, registration, session management, and business provisioning
- Location: `src/lib/auth/`, `src/lib/supabase/`, `src/middleware.ts`
- Contains: Registration flow (server action), onboarding actions (server actions), middleware for session refresh and route protection
- Depends on: Supabase Auth, Supabase service client (for privileged DB operations during registration)
- Used by: Auth pages, onboarding pages, middleware

**Hooks Layer:**
- Purpose: Provide client-side reactive state for auth, realtime subscriptions, and theming
- Location: `src/hooks/`
- Contains: `useAuth`, `useRealtimeMessages`, `useRealtimeAppointments`, `useRealtimeConversations`, `useTheme`
- Depends on: Supabase browser client (`@/lib/supabase/client`)
- Used by: Client components

## Data Flow

**Inbound WhatsApp Message (AI Agent Pipeline):**

1. WAHA server receives a WhatsApp message and POSTs webhook to `src/app/api/webhooks/waha/route.ts`
2. Webhook handler uses service client (no auth context) to find business by `session_id` in `phone_numbers`
3. Handler finds or creates a `contact` record, finds or creates an active `conversation`
4. Handler saves the inbound `message` to the database
5. If `conversation.is_bot_active`, calls `processAIAgent()` from `src/lib/ai/agent-prompt.ts`
6. `processAIAgent()` loads business context in parallel (business, settings, persona, message history)
7. Builds a Hebrew system prompt with business info, services, working hours, AI persona style
8. Sends prompt + conversation history + new message to OpenRouter API via `src/lib/ai/gemini.ts`
9. Parses JSON response (intent, action, text, confidence)
10. If an action is present (e.g., `book_appointment`, `cancel_appointment`, `escalate`), executes it against the database
11. Sends AI response text back to customer via `whatsapp.sendMessage()` (WAHA provider)
12. Saves outbound AI message and AI conversation log to database

**Manual Agent Message (Human Override):**

1. Business owner types message in inbox UI, client component calls `POST /api/messages`
2. API route authenticates user, verifies conversation ownership via RLS
3. Sends message via WAHA provider, saves to database, updates conversation timestamp
4. Supabase realtime broadcasts INSERT to subscribed clients via `useRealtimeMessages` hook

**BI Chat (Business Intelligence):**

1. User asks a question in the AI Chat page, client calls `POST /api/ai/chat`
2. `processBusinessQuery()` in `src/lib/ai/bi-chat.ts` generates a query plan via AI (determines which tables to query)
3. Fetches relevant data from Supabase (contacts, appointments, messages, expenses, etc.) scoped to `business_id`
4. Sends fetched data + question to AI for natural language answer generation
5. Saves query to `ai_chat_history`, returns answer + raw data to client

**User Registration:**

1. User fills registration form, client calls server action `registerBusiness()` in `src/lib/auth/register.ts`
2. Creates Supabase auth user with `signUp()`
3. Uses service client (bypasses RLS) to create: business, business_users link, business_settings (from template or defaults), AI persona, billing account, onboarding progress
4. Redirects to onboarding wizard

**State Management:**
- Server state: Fetched in Server Components via `@/lib/data/*` functions, passed as props
- Client state: Managed via React `useState` in client components; no global state library
- Realtime state: Supabase Realtime subscriptions in `@/hooks/use-realtime.ts` keep inbox and calendar in sync
- Theme state: CSS custom properties (`--color-primary`, `--color-primary-dark`, `--color-primary-light`) set on `document.documentElement` by `ThemeProvider` and `useTheme`

## Key Abstractions

**WhatsAppProvider Interface:**
- Purpose: Decouple messaging logic from WAHA-specific implementation; designed for future Cloud API migration
- Examples: `src/lib/waha/provider.ts` (interface + WahaProvider), `src/lib/waha/waha-client.ts` (HTTP client)
- Pattern: Strategy pattern via interface + singleton export (`export const whatsapp: WhatsAppProvider = new WahaProvider()`)

**Data Layer Split (Queries vs Mutations):**
- Purpose: Separate read-only data fetching from write operations for clarity and different auth contexts
- Examples: `src/lib/data/contacts.ts` (queries) vs `src/lib/data/contacts-mutations.ts` (mutations), `src/lib/data/appointments.ts` vs `src/lib/data/appointments-mutations.ts`
- Pattern: Module-per-domain with query/mutation split

**Supabase Client Tiers:**
- Purpose: Provide correct auth context for each execution environment
- Examples:
  - `src/lib/supabase/client.ts` — Browser client (client components, hooks)
  - `src/lib/supabase/server.ts` — Server client with cookie-based auth (pages, API routes, server actions)
  - `src/lib/supabase/service.ts` — Service role client bypassing RLS (webhooks, registration, cron)
  - `src/lib/supabase/middleware.ts` — Middleware-specific client for session refresh
- Pattern: Factory functions scoped to execution context

**AI Agent System:**
- Purpose: Process customer messages, detect intent, execute actions, generate contextual responses
- Examples: `src/lib/ai/agent-prompt.ts` (main pipeline), `src/lib/ai/gemini.ts` (LLM client), `src/lib/ai/bi-chat.ts` (BI analytics)
- Pattern: Pipeline pattern: load context -> build prompt -> call LLM -> parse response -> execute actions -> return

## Entry Points

**Next.js Middleware:**
- Location: `src/middleware.ts`
- Triggers: Every non-static request (configured via matcher)
- Responsibilities: Refresh Supabase auth session cookies, redirect unauthenticated users to `/login` (except `/login`, `/register`, `/api/webhooks`)

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: All pages
- Responsibilities: Hebrew RTL setup (`lang="he" dir="rtl"`), Noto Sans Hebrew font, `ThemeProvider` (loads business theme colors), PWA meta tags

**Dashboard Layout:**
- Location: `src/app/(dashboard)/layout.tsx`
- Triggers: All dashboard pages (home, inbox, calendar, contacts, etc.)
- Responsibilities: Sidebar (desktop), BottomNav (mobile), main content area

**WAHA Webhook:**
- Location: `src/app/api/webhooks/waha/route.ts`
- Triggers: External POST from WAHA server (message, message.ack, session.status events)
- Responsibilities: Ingest WhatsApp events, manage contacts/conversations, trigger AI agent, update message status

**Health Check Cron:**
- Location: `src/app/api/cron/health-check/route.ts`
- Triggers: External cron scheduler (protected by `CRON_SECRET`)
- Responsibilities: Compare WAHA sessions with DB records, update connection statuses, send Telegram alerts for disconnections

## Error Handling

**Strategy:** Fail-safe with logging; never crash the webhook pipeline

**Patterns:**
- Webhook handler wraps entire flow in try/catch; returns `{ ok: true }` for all recognized events, `500` only for truly unhandled errors
- AI agent errors are caught independently — message is still saved even if AI fails: `catch (aiError) { console.error('[webhook] AI agent error:', aiError) }`
- Data layer functions throw `Error` with descriptive messages (`throw new Error(\`Failed to fetch contacts: ${error.message}\`)`)
- API routes return structured JSON errors with appropriate HTTP status codes (400, 401, 404, 500, 503)
- Server actions in `src/lib/auth/register.ts` return discriminated union: `{ userId, businessId }` or `{ error: string }`
- AI JSON parsing has fallback: if LLM returns invalid JSON, defaults to `{ text: rawResponse, intent: 'other', confidence: 0.5 }`

## Cross-Cutting Concerns

**Logging:**
- `console.error` with `[tag]` prefix (e.g., `[webhook]`, `[api/messages]`, `[health-check]`)
- No structured logging framework; relies on platform (Vercel) log aggregation

**Validation:**
- Zod schemas in `src/lib/validations.ts` for registration, appointments, expenses, contacts
- Hebrew error messages in validation schemas
- API routes perform inline validation (check required fields, type checks) rather than using Zod

**Authentication:**
- Supabase Auth with email/password
- Middleware-level session refresh on every request
- Every API route and server-side data function calls `supabase.auth.getUser()` then resolves `business_id` via `business_users` table
- Webhook routes use service client (no auth) since they are called by WAHA server
- Admin routes have auth check but no role-based access control yet (TODO in `src/app/admin/layout.tsx`)

**Multi-Tenancy:**
- All data is scoped by `business_id`
- Supabase RLS enforces isolation at the database level
- Service client bypasses RLS only where needed (webhooks, registration, cron)

**Internationalization:**
- Hebrew-first: all UI strings, validation messages, and AI prompts are in Hebrew
- RTL layout via `dir="rtl"` on `<html>` and RTL-aware Tailwind utilities (`me-`, `ms-`, border-e)
- Noto Sans Hebrew font loaded via `next/font/google`

---

*Architecture analysis: 2026-03-16*
