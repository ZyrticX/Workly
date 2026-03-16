# Architecture

**Analysis Date:** 2026-03-16

## Pattern Overview

**Overall:** Next.js App Router full-stack monolith with multi-tenant SaaS design

**Key Characteristics:**
- Server-first rendering with Next.js App Router (React Server Components by default)
- Multi-tenant data isolation via Supabase Row-Level Security (RLS) scoped to `business_id`
- Three distinct user contexts: public auth, dashboard (business owner), admin panel (platform operator)
- AI agent pipeline that processes inbound WhatsApp messages via webhooks, runs through OpenRouter LLM, and sends responses back via WAHA
- Hebrew-first RTL interface targeting Israeli small businesses (hair salons, clinics, coaches)
- Mobile-first PWA design with responsive desktop support

## Layers

**Presentation Layer (Pages + Components):**
- Purpose: Render UI using React Server Components (pages) and Client Components (interactive widgets)
- Location: `src/app/` (pages/routes), `src/components/` (reusable UI)
- Contains: Route handlers, layouts, page components, client-side interactive components
- Depends on: Data layer (`src/lib/data/`), hooks (`src/hooks/`), Supabase server client
- Used by: End users (business owners via dashboard, platform admins via admin panel)

**API Layer (Route Handlers):**
- Purpose: Expose REST endpoints for client-side mutations, webhook ingestion, and cron jobs
- Location: `src/app/api/`
- Contains: Next.js Route Handlers (POST/GET functions in `route.ts` files)
- Depends on: Supabase clients, AI module, WAHA provider
- Used by: Client components (via fetch), WAHA webhook callbacks, external cron services

**Data Layer (Queries + Mutations):**
- Purpose: Encapsulate all Supabase database operations with typed interfaces
- Location: `src/lib/data/`
- Contains: Query functions (read) and mutation functions (write), each with TypeScript types
- Depends on: Supabase server client (`src/lib/supabase/server.ts`)
- Used by: Server Components (pages), API route handlers

**AI Layer:**
- Purpose: Process WhatsApp conversations with AI, handle BI queries, analyze communication style
- Location: `src/lib/ai/`
- Contains: AI client wrapper, agent prompt builder, BI chat engine, style analyzer
- Depends on: OpenRouter API (via fetch), Supabase service client for context loading
- Used by: Webhook handler (`src/app/api/webhooks/waha/route.ts`), AI API routes

**WhatsApp Integration Layer:**
- Purpose: Abstract WhatsApp messaging via WAHA (WhatsApp HTTP API) with a provider interface
- Location: `src/lib/waha/`
- Contains: WAHA HTTP client, provider interface + implementation, type definitions
- Depends on: WAHA API server (external), environment variables
- Used by: Webhook handler, messages API, admin phone management

**Auth + Middleware Layer:**
- Purpose: Handle authentication, session management, and route protection
- Location: `src/middleware.ts`, `src/lib/supabase/middleware.ts`, `src/lib/auth/`
- Contains: Next.js middleware for session refresh + auth redirects, server actions for registration/onboarding
- Depends on: Supabase Auth (@supabase/ssr)
- Used by: Every request (middleware runs on all non-static routes)

**Hooks Layer (Client-side State):**
- Purpose: Provide client-side state management and Supabase Realtime subscriptions
- Location: `src/hooks/`
- Contains: `useAuth`, `useRealtimeMessages`, `useRealtimeAppointments`, `useRealtimeConversations`, `useTheme`, `useToast`
- Depends on: Supabase browser client (`src/lib/supabase/client.ts`)
- Used by: Client Components

## Data Flow

**Inbound WhatsApp Message (Primary Flow):**

1. Customer sends WhatsApp message to business phone number
2. WAHA server receives message, fires webhook POST to `/api/webhooks/waha` (`src/app/api/webhooks/waha/route.ts`)
3. Webhook handler verifies `X-Api-Key` header against `WAHA_API_KEY`
4. Handler looks up business by matching `session_id` in `phone_numbers` table
5. Handler finds or creates `contact` record (by `wa_id`)
6. Handler finds or creates active `conversation` record
7. Handler saves inbound `message` to database
8. If `conversation.is_bot_active` is true, handler calls `processAIAgent()` (`src/lib/ai/agent-prompt.ts`)
9. `processAIAgent()` loads business context (business, settings, persona, message history) in parallel from Supabase
10. Builds Hebrew system prompt with business details, services, hours, cancellation policy, communication style
11. Sends conversation to OpenRouter API (default model: `google/gemini-2.5-flash-preview`)
12. Parses structured JSON response containing `text`, `intent`, `confidence`, `action`, `escalated`
13. If response contains an action (e.g., `book_appointment`, `cancel_appointment`, `escalate`), executes it against Supabase
14. Sends AI response text back to customer via `whatsapp.sendMessage()` (WAHA provider)
15. Saves outbound message and AI conversation log to database
16. Supabase Realtime broadcasts the new messages to any connected dashboard client via `useRealtimeMessages`

**Manual Agent Message (Dashboard to WhatsApp):**

1. Business owner types message in inbox chat view (client component)
2. Client POSTs to `/api/messages` (`src/app/api/messages/route.ts`)
3. Handler authenticates user, verifies conversation ownership via RLS
4. Looks up connected WAHA session for the business
5. Sends message via `whatsapp.sendMessage()`
6. Saves outbound message (sender_type: `agent`) to database
7. Updates `conversation.last_message_at`

**BI Chat Query:**

1. Business owner asks a question in the AI chat interface
2. Client POSTs to `/api/ai/chat` (`src/app/api/ai/chat/route.ts`)
3. Handler calls `processBusinessQuery()` (`src/lib/ai/bi-chat.ts`)
4. `generateQueryPlan()` asks the LLM which Supabase tables are relevant to the question
5. `fetchRelevantData()` queries those tables (scoped to `business_id`, limited to 50 rows each)
6. `generateAnswer()` sends the data + question to the LLM for Hebrew natural-language answer
7. Result saved to `ai_chat_history` table

**Server Component Data Loading (Dashboard Pages):**

1. User navigates to a dashboard page (e.g., `/inbox`, `/calendar`, `/contacts`)
2. Next.js renders the Server Component, which calls data functions from `src/lib/data/`
3. Data functions create a Supabase server client (cookie-based auth), query database
4. Supabase RLS enforces `business_id` scoping automatically
5. Server Component renders HTML with the data
6. Client Components hydrate with initial data, then subscribe to Supabase Realtime for live updates

**State Management:**
- No client-side state library (no Redux, Zustand, etc.)
- Server state via React Server Components (data fetched at render time)
- Client-side realtime state via custom hooks (`src/hooks/use-realtime.ts`) using Supabase Realtime subscriptions
- Auth state via `useAuth` hook (`src/hooks/use-auth.ts`) with Supabase `onAuthStateChange`
- Theme state via `useTheme` hook (`src/hooks/use-theme.ts`) with CSS custom properties
- Toast notifications via `useToast` hook (`src/hooks/use-toast.ts`)
- Form state via React Hook Form + Zod validation (`src/lib/validations.ts`)

## Key Abstractions

**WhatsAppProvider Interface:**
- Purpose: Abstract WhatsApp messaging to allow swapping WAHA for Cloud API later
- Definition: `src/lib/waha/provider.ts` (interface `WhatsAppProvider`)
- Implementation: `WahaProvider` class in the same file
- Singleton: `export const whatsapp: WhatsAppProvider = new WahaProvider()`
- Methods: `sendMessage()`, `sendImage()`, `getSessionStatus()`, `createSession()`, `getQR()`

**Supabase Client Hierarchy:**
- Purpose: Three client types for different execution contexts
- Browser client: `src/lib/supabase/client.ts` - for client components, uses anon key
- Server client: `src/lib/supabase/server.ts` - for Server Components/Route Handlers, cookie-based auth, respects RLS
- Service client: `src/lib/supabase/service.ts` - for webhooks/cron/admin ops, uses service role key, bypasses RLS

**Data Module Pattern:**
- Purpose: Separate read queries from write mutations with clear naming
- Query files: `src/lib/data/contacts.ts`, `src/lib/data/messages.ts`, `src/lib/data/appointments.ts`, `src/lib/data/dashboard.ts`, `src/lib/data/expenses.ts`
- Mutation files: `src/lib/data/contacts-mutations.ts`, `src/lib/data/appointments-mutations.ts`, `src/lib/data/settings-mutations.ts`
- Pattern: Each file exports typed async functions that create their own Supabase client internally

**AI Agent Pipeline:**
- Purpose: Process customer messages through context-aware AI with structured JSON responses
- Entry point: `processAIAgent()` in `src/lib/ai/agent-prompt.ts`
- Re-exported from `src/lib/ai/intent-detector.ts` for backward compatibility
- Pipeline: Load context -> Build prompt -> Call LLM -> Parse JSON -> Execute actions -> Return response
- Actions: `book_appointment`, `cancel_appointment`, `escalate` (with conflict detection for bookings)

**Server Actions:**
- Purpose: Server-side mutations callable from client components
- Location: `src/lib/auth/register.ts`, `src/lib/auth/save-onboarding.ts`, `src/lib/auth/onboarding-actions.ts`
- Pattern: Functions marked with `'use server'` directive, called from client forms

## Entry Points

**Next.js Middleware (`src/middleware.ts`):**
- Location: `src/middleware.ts`
- Triggers: Every non-static request (configured via matcher)
- Responsibilities: Refresh Supabase auth session, redirect unauthenticated users to `/login`, redirect users without completed onboarding to `/onboarding`

**Root Layout (`src/app/layout.tsx`):**
- Location: `src/app/layout.tsx`
- Triggers: Every page render
- Responsibilities: Set HTML lang="he" dir="rtl", load Noto Sans Hebrew font, apply ThemeProvider, validate env vars on startup

**WAHA Webhook (`src/app/api/webhooks/waha/route.ts`):**
- Location: `src/app/api/webhooks/waha/route.ts`
- Triggers: POST from WAHA server on message/ack/session events
- Responsibilities: Process inbound messages, trigger AI agent, update message statuses, track session connectivity

**Health Check Cron (`src/app/api/cron/health-check/route.ts`):**
- Location: `src/app/api/cron/health-check/route.ts`
- Triggers: External cron service (protected by `CRON_SECRET` bearer token)
- Responsibilities: Compare WAHA sessions with DB records, update statuses, send Telegram alerts for disconnected numbers

**Environment Validation (`src/lib/env.ts`):**
- Location: `src/lib/env.ts`
- Triggers: App startup (imported in root layout)
- Responsibilities: Warn on missing required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `WAHA_API_URL`, `WAHA_API_KEY`

## Error Handling

**Strategy:** Defensive error handling with graceful degradation. Non-critical failures are logged but do not crash the request.

**Patterns:**
- API routes wrap all logic in try/catch, return JSON error responses with appropriate HTTP status codes
- Webhook handler continues processing even if AI agent fails (the inbound message is already saved)
- Middleware silently catches onboarding check failures to avoid blocking authenticated users
- Data layer functions throw typed Error objects with descriptive messages
- Server Components catch data-fetching errors and render fallback UI (e.g., empty states)
- AI response parsing has a fallback: if JSON parse fails, the raw text is used as the response
- Console logging uses `[prefix]` tags for easy filtering: `[webhook]`, `[agent]`, `[api/ai/chat]`, `[health-check]`

## Cross-Cutting Concerns

**Authentication:**
- Supabase Auth with cookie-based sessions via `@supabase/ssr`
- Middleware refreshes session on every request
- API routes authenticate by calling `supabase.auth.getUser()` and checking `business_users` table for `business_id`
- Admin access controlled by hardcoded email allowlist in `src/app/admin/layout.tsx`
- Webhook and cron endpoints use API key / bearer token auth (no user session)

**Multi-tenancy:**
- Every data table includes `business_id` column
- Supabase RLS policies enforce data isolation (server client respects RLS)
- Service client bypasses RLS for system operations (webhooks, cron, registration)
- User-to-business mapping via `business_users` junction table (supports multiple users per business)

**Validation:**
- Zod schemas in `src/lib/validations.ts` for form inputs (register, appointment, expense, contact)
- React Hook Form integration via `@hookform/resolvers`
- Hebrew error messages in all validation schemas

**Logging:**
- `console.log` / `console.error` / `console.warn` with bracket-prefixed tags
- No structured logging library
- AI conversation logs persisted to `ai_conversation_logs` table

**Realtime:**
- Supabase Realtime subscriptions via `postgres_changes` events
- Used for messages, appointments, and conversations
- Client-side hooks handle INSERT, UPDATE, and DELETE events
- Conversations refetch full data on any change (to get joined contact info)

**Internationalization:**
- Hebrew-only application (hardcoded `lang="he" dir="rtl"`)
- All user-facing strings in Hebrew
- Hebrew date/time/currency formatting via `Intl` APIs
- Noto Sans Hebrew web font loaded via `next/font`

---

*Architecture analysis: 2026-03-16*
