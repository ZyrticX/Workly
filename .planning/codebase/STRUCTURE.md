# Codebase Structure

**Analysis Date:** 2026-03-16

## Directory Layout

```
wa-agent-platform/
├── .planning/              # GSD planning documents
│   └── codebase/           # Codebase analysis docs
├── public/                 # Static assets served at /
│   └── icons/              # PWA icons
├── src/
│   ├── app/                # Next.js App Router (pages, layouts, API routes)
│   │   ├── (auth)/         # Auth route group (login, register)
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/    # Main business owner dashboard
│   │   │   ├── ai-chat/
│   │   │   ├── billing/
│   │   │   ├── calendar/
│   │   │   ├── campaigns/
│   │   │   ├── contacts/
│   │   │   │   └── [id]/   # Dynamic contact detail
│   │   │   ├── expenses/
│   │   │   ├── inbox/
│   │   │   ├── kpis/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── admin/          # Platform admin panel
│   │   │   ├── billing/
│   │   │   ├── businesses/
│   │   │   ├── health/
│   │   │   ├── logs/
│   │   │   ├── phones/
│   │   │   └── sims/
│   │   ├── api/            # API route handlers
│   │   │   ├── ai/
│   │   │   │   ├── agent/
│   │   │   │   ├── chat/
│   │   │   │   └── onboarding-chat/
│   │   │   ├── appointments/
│   │   │   ├── contacts/
│   │   │   ├── cron/
│   │   │   │   ├── health-check/
│   │   │   │   └── reminders/
│   │   │   ├── messages/
│   │   │   ├── waha/
│   │   │   │   ├── connect/
│   │   │   │   └── qr/
│   │   │   └── webhooks/
│   │   │       └── waha/
│   │   ├── onboarding/     # Business onboarding wizard
│   │   ├── layout.tsx      # Root layout (HTML, font, ThemeProvider)
│   │   ├── globals.css     # Global CSS (Tailwind, CSS variables)
│   │   └── favicon.ico
│   ├── components/         # Reusable React components
│   │   ├── admin/          # Admin panel components
│   │   ├── calendar/       # Calendar/appointment components
│   │   ├── contacts/       # Contact management components
│   │   ├── dashboard/      # Dashboard widgets
│   │   ├── inbox/          # Inbox/chat components
│   │   ├── onboarding/     # Onboarding wizard components
│   │   ├── settings/       # Settings page components
│   │   └── ui/             # Shared UI primitives
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Core business logic and utilities
│   │   ├── ai/             # AI integration (OpenRouter, prompts)
│   │   ├── auth/           # Auth server actions (register, onboarding)
│   │   ├── data/           # Data access layer (queries + mutations)
│   │   ├── queue/          # Job queue (placeholder)
│   │   ├── supabase/       # Supabase client factories
│   │   ├── utils/          # Utility functions
│   │   └── waha/           # WhatsApp (WAHA) integration
│   ├── types/              # Shared TypeScript types
│   └── middleware.ts       # Next.js edge middleware
├── .env.local              # Environment variables (secrets)
├── .gitignore
├── eslint.config.mjs       # ESLint configuration
├── next.config.ts          # Next.js configuration
├── package.json
├── package-lock.json
├── postcss.config.mjs      # PostCSS + Tailwind
├── tsconfig.json           # TypeScript configuration
└── README.md
```

## Directory Purposes

**`src/app/`**
- Purpose: Next.js App Router directory containing all pages, layouts, and API routes
- Contains: Route segments using file-based routing conventions (`page.tsx`, `layout.tsx`, `route.ts`)
- Key files:
  - `src/app/layout.tsx`: Root layout with HTML lang/dir, font loading, ThemeProvider
  - `src/app/globals.css`: Tailwind CSS imports and custom CSS variables
  - `src/app/(dashboard)/layout.tsx`: Dashboard shell with Sidebar + BottomNav
  - `src/app/(auth)/layout.tsx`: Centered card layout for auth pages
  - `src/app/admin/layout.tsx`: Admin layout with email-allowlist guard
  - `src/app/onboarding/layout.tsx`: Onboarding wizard with progress bar

**`src/app/(auth)/`**
- Purpose: Authentication pages (login, register) in a route group with shared centered layout
- Contains: `login/page.tsx`, `register/page.tsx`

**`src/app/(dashboard)/`**
- Purpose: Main business owner dashboard pages, protected by auth middleware
- Contains: All feature pages (inbox, calendar, contacts, expenses, settings, etc.)
- Key files:
  - `src/app/(dashboard)/page.tsx`: Dashboard home with KPI stats and upcoming appointments
  - `src/app/(dashboard)/inbox/page.tsx`: Inbox with server-loaded conversations passed to client shell
  - `src/app/(dashboard)/contacts/page.tsx`: Contact list page
  - `src/app/(dashboard)/contacts/[id]/page.tsx`: Dynamic contact detail page
  - `src/app/(dashboard)/calendar/page.tsx`: Appointment calendar view

**`src/app/admin/`**
- Purpose: Platform admin panel for managing businesses, phones, health monitoring
- Contains: Admin dashboard, businesses list, phone management, health status, logs, SIM management
- Key pattern: Server Components for pages, `*-client.tsx` companion files for interactive client portions
  - Example: `src/app/admin/businesses/page.tsx` (server) + `src/app/admin/businesses/businesses-client.tsx` (client)

**`src/app/api/`**
- Purpose: REST API endpoints as Next.js Route Handlers
- Contains: All `route.ts` files organized by domain
- Key files:
  - `src/app/api/webhooks/waha/route.ts`: Main webhook handler for inbound WhatsApp messages
  - `src/app/api/messages/route.ts`: Manual message sending endpoint
  - `src/app/api/ai/agent/route.ts`: Manual AI agent trigger
  - `src/app/api/ai/chat/route.ts`: BI chat endpoint
  - `src/app/api/ai/onboarding-chat/route.ts`: AI-driven onboarding conversation
  - `src/app/api/contacts/route.ts`: Contact CRUD
  - `src/app/api/appointments/route.ts`: Appointment CRUD
  - `src/app/api/waha/connect/route.ts`: WAHA session creation
  - `src/app/api/waha/qr/route.ts`: QR code retrieval for WhatsApp pairing
  - `src/app/api/cron/health-check/route.ts`: Health check cron endpoint

**`src/components/`**
- Purpose: Reusable React components organized by feature domain
- Contains: Feature-specific components and shared UI primitives
- Key files:
  - `src/components/ui/sidebar.tsx`: Desktop navigation sidebar
  - `src/components/ui/bottom-nav.tsx`: Mobile bottom navigation bar
  - `src/components/ui/theme-provider.tsx`: CSS variable-based theme system
  - `src/components/ui/toast.tsx`: Toast notification component + provider
  - `src/components/ui/error-boundary.tsx`: React error boundary
  - `src/components/ui/avatar-initials.tsx`: Avatar with name initials
  - `src/components/ui/status-badge.tsx`: Colored status badge
  - `src/components/inbox/inbox-shell.tsx`: Inbox split-view layout manager
  - `src/components/inbox/conversation-list.tsx`: Conversation sidebar list
  - `src/components/inbox/chat-view.tsx`: Message thread view
  - `src/components/inbox/message-input.tsx`: Message compose input
  - `src/components/inbox/bot-toggle.tsx`: AI bot on/off toggle
  - `src/components/inbox/chat-bubble.tsx`: Message bubble component
  - `src/components/calendar/calendar-view.tsx`: Calendar/schedule view
  - `src/components/calendar/appointment-block.tsx`: Single appointment block
  - `src/components/calendar/new-appointment-sheet.tsx`: New appointment form sheet
  - `src/components/contacts/contacts-list.tsx`: Searchable contacts list
  - `src/components/contacts/contact-card.tsx`: Contact summary card
  - `src/components/contacts/contact-detail.tsx`: Full contact detail view
  - `src/components/contacts/contact-form.tsx`: Contact creation/edit form
  - `src/components/onboarding/onboarding-context.tsx`: Onboarding wizard state context
  - `src/components/onboarding/ai-onboarding-chat.tsx`: AI-driven onboarding chat interface

**`src/hooks/`**
- Purpose: Custom React hooks for client-side state and subscriptions
- Contains: Auth, realtime, theme, and toast hooks
- Key files:
  - `src/hooks/use-auth.ts`: Current user + business_id from Supabase auth
  - `src/hooks/use-realtime.ts`: Supabase Realtime subscriptions for messages, appointments, conversations
  - `src/hooks/use-theme.ts`: Theme loading/application via CSS custom properties
  - `src/hooks/use-toast.ts`: Toast notification state management

**`src/lib/`**
- Purpose: Core business logic, external integrations, and utilities (not React-specific)
- Contains: All non-UI code organized by domain

**`src/lib/ai/`**
- Purpose: AI integration layer
- Key files:
  - `src/lib/ai/ai-client.ts`: OpenRouter HTTP client (text + vision), model configuration
  - `src/lib/ai/agent-prompt.ts`: Full AI agent pipeline (context loading, prompt building, action execution)
  - `src/lib/ai/intent-detector.ts`: Re-export of `processAIAgent` for backward compat
  - `src/lib/ai/bi-chat.ts`: BI/analytics chat engine (query planning, data fetching, answer generation)
  - `src/lib/ai/style-analyzer.ts`: WhatsApp screenshot analysis for communication style extraction

**`src/lib/auth/`**
- Purpose: Server actions for authentication and onboarding flows
- Key files:
  - `src/lib/auth/register.ts`: Full registration flow (create user, business, settings, persona, billing, onboarding)
  - `src/lib/auth/save-onboarding.ts`: Save AI-chat-driven onboarding data in bulk
  - `src/lib/auth/onboarding-actions.ts`: Step-by-step onboarding mutations

**`src/lib/data/`**
- Purpose: Data access layer with typed Supabase queries and mutations
- Key files:
  - `src/lib/data/messages.ts`: Conversation queries (list with contacts, messages by conversation)
  - `src/lib/data/contacts.ts`: Contact queries (list, detail, dormant)
  - `src/lib/data/contacts-mutations.ts`: Contact creation, status auto-computation
  - `src/lib/data/appointments.ts`: Appointment queries (by date, week, month, available slots)
  - `src/lib/data/appointments-mutations.ts`: Appointment create, cancel (with waitlist), reschedule
  - `src/lib/data/dashboard.ts`: Dashboard KPI aggregation queries
  - `src/lib/data/expenses.ts`: Expense queries + mutations (one-time, recurring, receipt upload)
  - `src/lib/data/onboarding.ts`: Onboarding progress step updates with side-effect application
  - `src/lib/data/settings-mutations.ts`: Business settings mutations (hours, services, AI persona)

**`src/lib/supabase/`**
- Purpose: Supabase client factories for different execution contexts
- Key files:
  - `src/lib/supabase/client.ts`: Browser client (for Client Components), uses `createBrowserClient`
  - `src/lib/supabase/server.ts`: Server client (for Server Components/Route Handlers), uses `createServerClient` with cookies
  - `src/lib/supabase/service.ts`: Service role client (bypasses RLS), uses `createClient` with service key
  - `src/lib/supabase/middleware.ts`: Middleware session management with auth/onboarding redirect logic

**`src/lib/waha/`**
- Purpose: WhatsApp integration via WAHA (WhatsApp HTTP API)
- Key files:
  - `src/lib/waha/waha-client.ts`: Low-level WAHA HTTP client class (sessions, QR, messaging)
  - `src/lib/waha/provider.ts`: `WhatsAppProvider` interface + `WahaProvider` implementation (abstraction for future Cloud API swap)
  - `src/lib/waha/types.ts`: TypeScript types for WAHA API payloads

**`src/lib/utils/`**
- Purpose: Shared utility functions
- Key files:
  - `src/lib/utils/cn.ts`: Tailwind class name merger (`clsx` + `tailwind-merge`)

**`src/types/`**
- Purpose: Shared TypeScript type definitions
- Key files:
  - `src/types/database.ts`: Core database row types (Contact, Conversation, PhoneNumber) + re-exports from data modules

## Key File Locations

**Entry Points:**
- `src/middleware.ts`: Edge middleware (auth session, redirects)
- `src/app/layout.tsx`: Root layout (HTML shell, font, theme)
- `src/app/api/webhooks/waha/route.ts`: Primary webhook entry (WhatsApp messages)
- `src/lib/env.ts`: Environment variable validation (imported at startup)

**Configuration:**
- `package.json`: Dependencies and scripts
- `tsconfig.json`: TypeScript config (path alias `@/*` -> `./src/*`)
- `next.config.ts`: Next.js config (currently empty/default)
- `eslint.config.mjs`: ESLint config
- `postcss.config.mjs`: PostCSS + Tailwind CSS config
- `.env.local`: Environment variables (exists, not committed)

**Core Business Logic:**
- `src/lib/ai/agent-prompt.ts`: AI agent pipeline (the "brain" of the system)
- `src/lib/ai/bi-chat.ts`: BI analytics chat engine
- `src/lib/ai/ai-client.ts`: OpenRouter API wrapper
- `src/lib/waha/provider.ts`: WhatsApp provider abstraction
- `src/lib/auth/register.ts`: Business registration flow (creates 6+ DB records)
- `src/lib/data/appointments-mutations.ts`: Appointment lifecycle (create, cancel with waitlist, reschedule)

**Validation:**
- `src/lib/validations.ts`: All Zod schemas (register, appointment, expense, contact)

**Testing:**
- No test files detected in the codebase

## Naming Conventions

**Files:**
- `kebab-case.tsx` for all React components: `inbox-shell.tsx`, `calendar-view.tsx`
- `kebab-case.ts` for all non-component TypeScript files: `ai-client.ts`, `use-auth.ts`
- `page.tsx` for Next.js page components
- `layout.tsx` for Next.js layout components
- `route.ts` for Next.js API route handlers
- `*-client.tsx` suffix for admin client companion components: `businesses-client.tsx`, `health-client.tsx`
- `*-mutations.ts` suffix for data mutation files: `appointments-mutations.ts`, `contacts-mutations.ts`

**Directories:**
- `kebab-case` for all directories: `ai-chat`, `health-check`
- `(group-name)` for Next.js route groups: `(auth)`, `(dashboard)`
- `[param]` for Next.js dynamic routes: `[id]`
- Feature-domain grouping in `src/components/`: `inbox/`, `calendar/`, `contacts/`, `admin/`

**Functions/Variables:**
- `camelCase` for functions and variables: `processAIAgent`, `buildSystemPrompt`, `getConversations`
- `PascalCase` for React components: `InboxShell`, `CalendarView`, `ChatBubble`
- `PascalCase` for TypeScript interfaces/types: `AgentInput`, `ConversationWithContact`, `DashboardData`
- `UPPER_SNAKE_CASE` for constants: `OPENROUTER_URL`, `ALLOWED_ADMIN_EMAILS`, `TOTAL_STEPS`
- Prefix hooks with `use`: `useAuth`, `useRealtimeMessages`, `useTheme`

**Database Columns:**
- `snake_case` for all Supabase columns: `business_id`, `last_message_at`, `is_bot_active`
- TypeScript interfaces mirror DB column names exactly (no camelCase transformation)

## Import Organization

**Order observed in codebase:**
1. React/Next.js framework imports (`'next/server'`, `'next/navigation'`, `'react'`)
2. Third-party library imports (`'@supabase/ssr'`, `'zod'`, `'lucide-react'`)
3. Internal absolute imports using `@/` alias (`'@/lib/supabase/server'`, `'@/components/ui/sidebar'`)
4. Relative imports (rare, used only within the same module)

**Path Alias:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)

## Where to Add New Code

**New Dashboard Feature Page:**
- Create `src/app/(dashboard)/{feature-name}/page.tsx`
- Add data queries in `src/lib/data/{feature-name}.ts`
- Add mutations in `src/lib/data/{feature-name}-mutations.ts`
- Add components in `src/components/{feature-name}/`
- Add Zod validation schema in `src/lib/validations.ts`
- Update `src/components/ui/sidebar.tsx` and `src/components/ui/bottom-nav.tsx` for navigation

**New API Endpoint:**
- Create `src/app/api/{domain}/{action}/route.ts`
- Follow the auth pattern: create server client, get user, resolve business_id via `business_users`
- Return `NextResponse.json()` with appropriate status codes

**New Admin Page:**
- Create `src/app/admin/{section}/page.tsx` (Server Component)
- Create `src/app/admin/{section}/{section}-client.tsx` (Client Component for interactivity)
- Admin layout auto-applies from `src/app/admin/layout.tsx` (email allowlist enforced)

**New Shared UI Component:**
- Create `src/components/ui/{component-name}.tsx`
- Mark as `'use client'` if it needs interactivity
- Import `cn` from `@/lib/utils/cn` for conditional Tailwind classes

**New Custom Hook:**
- Create `src/hooks/use-{name}.ts`
- Mark as `'use client'`
- Use Supabase browser client from `@/lib/supabase/client` for client-side data

**New AI Capability:**
- Add to `src/lib/ai/` as a new file
- Use `generateResponse()` or `generateVisionResponse()` from `src/lib/ai/ai-client.ts`
- Create API route in `src/app/api/ai/{capability}/route.ts`

**New WhatsApp Feature:**
- Add methods to `WhatsAppProvider` interface in `src/lib/waha/provider.ts`
- Implement in `WahaProvider` class
- Add low-level WAHA calls in `src/lib/waha/waha-client.ts`

**New Database Table Integration:**
- Add types to `src/types/database.ts` (or in the data module file)
- Create query file in `src/lib/data/{table}.ts`
- Create mutation file in `src/lib/data/{table}-mutations.ts` if needed
- Note: Supabase schema changes happen in Supabase dashboard (no local migration files)

## Special Directories

**`.next/`**
- Purpose: Next.js build output and development cache
- Generated: Yes (by `next dev` / `next build`)
- Committed: No (in `.gitignore`)

**`node_modules/`**
- Purpose: NPM package dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in `.gitignore`)

**`.planning/`**
- Purpose: GSD planning and analysis documents
- Generated: By GSD mapping commands
- Committed: Yes

**`public/`**
- Purpose: Static files served at root URL path
- Contains: PWA icons (`public/icons/`), potentially `manifest.json`
- Generated: No (manually created)
- Committed: Yes

**`src/lib/queue/`**
- Purpose: Placeholder for future job queue (BullMQ) integration
- Contains: Empty or minimal placeholder
- Note: Appointment reminders currently have TODO comments referencing this

---

*Structure analysis: 2026-03-16*
