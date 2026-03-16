# Codebase Structure

**Analysis Date:** 2026-03-16

## Directory Layout

```
wa-agent-platform/
├── public/                     # Static assets (icons, manifest, SVGs)
│   ├── icons/                  # PWA icons
│   └── manifest.json           # PWA manifest
├── src/
│   ├── app/                    # Next.js App Router (pages, layouts, API routes)
│   │   ├── (auth)/             # Route group: login + register pages
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── layout.tsx      # Centered card layout for auth
│   │   ├── (dashboard)/        # Route group: main business dashboard
│   │   │   ├── page.tsx        # Home dashboard (stats + upcoming appointments)
│   │   │   ├── inbox/page.tsx  # WhatsApp conversations
│   │   │   ├── calendar/page.tsx
│   │   │   ├── contacts/       # Contact list + [id] detail
│   │   │   ├── ai-chat/page.tsx
│   │   │   ├── expenses/page.tsx
│   │   │   ├── kpis/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   ├── billing/        # (placeholder)
│   │   │   ├── campaigns/      # (placeholder)
│   │   │   └── layout.tsx      # Sidebar + BottomNav shell
│   │   ├── (onboarding)/       # Route group: multi-step onboarding wizard
│   │   │   ├── onboarding/page.tsx
│   │   │   └── layout.tsx      # Progress bar layout
│   │   ├── admin/              # Admin panel (NOT grouped, separate layout)
│   │   │   ├── page.tsx        # Admin dashboard
│   │   │   ├── businesses/     # Business management
│   │   │   ├── phones/         # Phone/session management
│   │   │   ├── sims/           # SIM card management
│   │   │   ├── health/         # System health monitoring
│   │   │   ├── billing/        # Billing management
│   │   │   └── layout.tsx      # Admin sidebar layout (auth-protected)
│   │   ├── api/                # API Route Handlers
│   │   │   ├── ai/
│   │   │   │   ├── agent/route.ts  # Manual AI agent trigger
│   │   │   │   └── chat/route.ts   # BI chat endpoint
│   │   │   ├── appointments/route.ts # CRUD appointments
│   │   │   ├── contacts/route.ts     # CRUD contacts
│   │   │   ├── messages/route.ts     # Send manual messages
│   │   │   ├── waha/
│   │   │   │   ├── connect/route.ts  # Create WAHA session
│   │   │   │   └── qr/route.ts       # Get QR code for scanning
│   │   │   ├── webhooks/
│   │   │   │   └── waha/route.ts     # WAHA webhook receiver (core)
│   │   │   └── cron/
│   │   │       └── health-check/route.ts # Health check cron
│   │   ├── layout.tsx          # Root layout (RTL, font, theme)
│   │   └── globals.css         # Global Tailwind + custom CSS
│   ├── components/             # Reusable React components
│   │   ├── admin/              # Admin panel components
│   │   ├── calendar/           # Calendar page components
│   │   ├── contacts/           # Contact page components
│   │   ├── dashboard/          # Dashboard page components
│   │   ├── inbox/              # Inbox/chat components
│   │   ├── onboarding/         # Onboarding wizard components
│   │   ├── settings/           # Settings page components
│   │   └── ui/                 # Shared UI primitives
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Core business logic + utilities
│   │   ├── ai/                 # AI agent, BI chat, style analyzer
│   │   ├── auth/               # Registration + onboarding server actions
│   │   ├── data/               # Database queries + mutations (per domain)
│   │   ├── queue/              # (empty - placeholder for BullMQ)
│   │   ├── supabase/           # Supabase client factories (browser/server/service/middleware)
│   │   ├── utils/              # Utility functions (cn)
│   │   ├── waha/               # WhatsApp provider + WAHA client
│   │   └── validations.ts      # Zod schemas for form validation
│   └── types/                  # Shared TypeScript type definitions
│       └── database.ts         # Database row type re-exports
├── .env.local                  # Environment variables (secrets - DO NOT READ)
├── .gitignore
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── README.md
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router structure. Each subdirectory is a route segment.
- Contains: `page.tsx` (route component), `layout.tsx` (shared layout), `route.ts` (API handler)
- Key files: `src/app/layout.tsx` (root), `src/app/(dashboard)/layout.tsx` (dashboard shell)
- Route groups `(auth)`, `(dashboard)`, `(onboarding)` share layouts without affecting URL paths

**`src/app/api/`:**
- Purpose: Server-side REST API endpoints
- Contains: Route handlers for CRUD operations, AI endpoints, webhook receivers, cron jobs
- Key files: `src/app/api/webhooks/waha/route.ts` (core webhook), `src/app/api/messages/route.ts`

**`src/components/`:**
- Purpose: Reusable React components organized by feature area
- Contains: Client and server components, grouped by the page/feature they belong to
- Key pattern: Feature-scoped directories (e.g., `inbox/`, `calendar/`) + shared `ui/` primitives

**`src/lib/`:**
- Purpose: Core business logic, external integrations, and utilities
- Contains: Database access, AI processing, auth flows, WhatsApp integration, validation
- Key pattern: Each subdirectory represents an integration or domain concern

**`src/lib/data/`:**
- Purpose: All Supabase database operations. The data access layer.
- Contains: Query files (read-only functions) and mutation files (write operations), split per domain
- Key files:
  - `src/lib/data/messages.ts` — Conversation + message queries
  - `src/lib/data/contacts.ts` — Contact queries (search, detail, dormant detection)
  - `src/lib/data/contacts-mutations.ts` — Contact creation, status computation
  - `src/lib/data/appointments.ts` — Appointment queries + availability slot calculator
  - `src/lib/data/appointments-mutations.ts` — Create, cancel, reschedule with side effects
  - `src/lib/data/dashboard.ts` — Aggregated dashboard stats
  - `src/lib/data/expenses.ts` — Financial queries + mutations + receipt upload
  - `src/lib/data/onboarding.ts` — Multi-step onboarding progression
  - `src/lib/data/settings-mutations.ts` — Working hours, services, AI persona updates

**`src/lib/ai/`:**
- Purpose: AI agent processing pipeline and BI analytics
- Contains: LLM client, prompt builder, action executor, BI chat engine, style analyzer
- Key files:
  - `src/lib/ai/gemini.ts` — OpenRouter API client (text + vision)
  - `src/lib/ai/agent-prompt.ts` — Main AI agent: builds prompt, calls LLM, parses response, executes actions
  - `src/lib/ai/bi-chat.ts` — Business intelligence: query planning, data fetching, answer generation
  - `src/lib/ai/style-analyzer.ts` — Analyze WhatsApp screenshots for communication style
  - `src/lib/ai/intent-detector.ts` — Re-export module (backward compat)

**`src/lib/waha/`:**
- Purpose: WhatsApp messaging abstraction with WAHA implementation
- Contains: Provider interface, WAHA HTTP client, type definitions
- Key files:
  - `src/lib/waha/provider.ts` — `WhatsAppProvider` interface + `WahaProvider` implementation + singleton
  - `src/lib/waha/waha-client.ts` — Low-level HTTP client for WAHA REST API + singleton
  - `src/lib/waha/types.ts` — TypeScript types for WAHA API payloads

**`src/lib/supabase/`:**
- Purpose: Supabase client factory functions for each execution context
- Contains: Four client creators, one per context
- Key files:
  - `src/lib/supabase/client.ts` — Browser client (`createBrowserClient`)
  - `src/lib/supabase/server.ts` — Server client with cookie auth (`createServerClient` + `cookies()`)
  - `src/lib/supabase/service.ts` — Service role client (bypasses RLS)
  - `src/lib/supabase/middleware.ts` — Middleware client for session refresh + route protection

**`src/lib/auth/`:**
- Purpose: Server actions for authentication and business provisioning
- Contains: Registration flow, onboarding step actions
- Key files:
  - `src/lib/auth/register.ts` — `registerBusiness()` server action (creates user + business + all related records)
  - `src/lib/auth/onboarding-actions.ts` — `updateOnboardingStep()`, `saveBusinessSettings()`, `saveAiPersona()`, `completeOnboarding()` server actions

**`src/hooks/`:**
- Purpose: Client-side React hooks for state management and Supabase realtime
- Contains: Auth hook, realtime subscription hooks, theme hook
- Key files:
  - `src/hooks/use-auth.ts` — Returns `{ user, businessId, loading }`
  - `src/hooks/use-realtime.ts` — `useRealtimeMessages()`, `useRealtimeAppointments()`, `useRealtimeConversations()` — Supabase Realtime subscriptions
  - `src/hooks/use-theme.ts` — Load and apply business theme from `business_settings.ai_config.theme`

**`src/types/`:**
- Purpose: Shared TypeScript type definitions
- Contains: Database row types, re-exports from data layer
- Key files: `src/types/database.ts`

**`src/components/ui/`:**
- Purpose: Shared UI primitive components used across multiple features
- Contains: Layout primitives, theming, common widgets
- Key files:
  - `src/components/ui/sidebar.tsx` — Desktop sidebar navigation (hidden on mobile)
  - `src/components/ui/bottom-nav.tsx` — Mobile bottom tab navigation (hidden on desktop)
  - `src/components/ui/theme-provider.tsx` — Loads business theme colors on mount
  - `src/components/ui/avatar-initials.tsx` — Initials avatar component
  - `src/components/ui/status-badge.tsx` — Colored status badge (success/warning/danger)

## Key File Locations

**Entry Points:**
- `src/middleware.ts`: Auth session refresh + route protection
- `src/app/layout.tsx`: Root layout (RTL, font, theme, PWA meta)
- `src/app/(dashboard)/layout.tsx`: Dashboard shell (sidebar + bottom nav)

**Configuration:**
- `package.json`: Dependencies and scripts
- `tsconfig.json`: TypeScript config with `@/*` path alias pointing to `./src/*`
- `next.config.ts`: Next.js config (currently empty)
- `eslint.config.mjs`: ESLint configuration
- `postcss.config.mjs`: PostCSS with Tailwind CSS v4

**Core Logic:**
- `src/app/api/webhooks/waha/route.ts`: Central webhook handler (the "brain" of the system)
- `src/lib/ai/agent-prompt.ts`: AI agent pipeline (prompt building, LLM call, action execution)
- `src/lib/ai/gemini.ts`: OpenRouter API client for all AI calls
- `src/lib/auth/register.ts`: Full registration + business provisioning flow

**Testing:**
- No test files detected. No test framework configured.

## Naming Conventions

**Files:**
- `kebab-case.ts` / `kebab-case.tsx` for all source files: `agent-prompt.ts`, `chat-view.tsx`, `inbox-shell.tsx`
- `route.ts` for API route handlers (Next.js convention)
- `page.tsx` for page components (Next.js convention)
- `layout.tsx` for layout components (Next.js convention)
- Data layer split: `{domain}.ts` for queries, `{domain}-mutations.ts` for mutations

**Directories:**
- `kebab-case` for all directories: `ai-chat`, `health-check`
- Route groups use parentheses: `(auth)`, `(dashboard)`, `(onboarding)`
- Dynamic segments use brackets: `[id]`
- Feature-scoped component directories match page names: `inbox/`, `calendar/`, `contacts/`

**Exports:**
- Named exports everywhere (no default exports except page/layout components required by Next.js)
- Singleton pattern for clients: `export const waha = new WahaClient()`, `export const whatsapp: WhatsAppProvider = new WahaProvider()`
- React components use PascalCase: `InboxShell`, `StatCard`, `BottomNav`
- Functions use camelCase: `getConversations`, `processAIAgent`, `updateContactStatus`
- Types/interfaces use PascalCase: `AgentInput`, `ConversationWithContact`, `WhatsAppProvider`

## Where to Add New Code

**New Dashboard Feature (e.g., a new page like "Analytics"):**
- Page: `src/app/(dashboard)/analytics/page.tsx`
- Components: `src/components/analytics/` (create directory)
- Data queries: `src/lib/data/analytics.ts`
- Data mutations: `src/lib/data/analytics-mutations.ts`
- API route (if client needs): `src/app/api/analytics/route.ts`

**New API Endpoint:**
- Create: `src/app/api/{resource}/route.ts`
- Follow auth pattern: call `createClient()`, then `supabase.auth.getUser()`, then resolve `business_id` via `business_users`
- For unauthenticated endpoints (webhooks): use `createServiceClient()` from `src/lib/supabase/service.ts`

**New Shared UI Component:**
- Place in: `src/components/ui/{component-name}.tsx`
- Use `cn()` utility from `src/lib/utils/cn.ts` for class merging
- Mark as `'use client'` if it uses hooks/event handlers

**New Feature-Specific Component:**
- Place in: `src/components/{feature-name}/{component-name}.tsx`
- Group with other components for the same page/feature

**New Database Query or Mutation:**
- Queries (read): `src/lib/data/{domain}.ts`
- Mutations (write): `src/lib/data/{domain}-mutations.ts`
- Use `createClient()` from `src/lib/supabase/server.ts` for user-scoped operations
- Use `createServiceClient()` from `src/lib/supabase/service.ts` for admin/webhook operations
- Define TypeScript interfaces at the top of the file

**New Custom Hook:**
- Place in: `src/hooks/use-{name}.ts`
- Mark with `'use client'` directive
- Use browser Supabase client from `src/lib/supabase/client.ts`

**New Validation Schema:**
- Add to: `src/lib/validations.ts`
- Use Zod; write error messages in Hebrew

**New AI Feature:**
- Add to: `src/lib/ai/{feature-name}.ts`
- Use `generateResponse()` or `generateVisionResponse()` from `src/lib/ai/gemini.ts`
- Use `createServiceClient()` for database access (AI runs in service context)

**New Server Action:**
- Place in: `src/lib/auth/` (if auth-related) or `src/lib/data/` (if data-related)
- Mark with `'use server'` directive
- Return typed result or throw Error

## Special Directories

**`.next/`:**
- Purpose: Next.js build output and dev server cache
- Generated: Yes
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: Installed npm dependencies
- Generated: Yes
- Committed: No (in `.gitignore`)

**`.planning/`:**
- Purpose: Planning and documentation files for development tooling
- Generated: No (manually maintained)
- Committed: Yes

**`public/`:**
- Purpose: Static assets served at root URL
- Generated: No
- Committed: Yes
- Key files: `manifest.json` (PWA), `icons/` (PWA icons)

**`src/lib/queue/`:**
- Purpose: Placeholder for future BullMQ job queue (appointment reminders)
- Generated: No
- Committed: Yes (currently empty)
- Note: Referenced in TODO comments in `src/lib/data/appointments-mutations.ts`

---

*Structure analysis: 2026-03-16*
