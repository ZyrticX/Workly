# Coding Conventions

**Analysis Date:** 2026-03-16

## Language & Framework

**Primary:** TypeScript (strict mode) with Next.js 16 App Router, React 19, Tailwind CSS v4.
**Direction:** Hebrew RTL application (`lang="he" dir="rtl"` on `<html>`).

## Naming Patterns

**Files:**
- Route pages: `page.tsx` (Next.js convention)
- Route layouts: `layout.tsx`
- API routes: `route.ts` inside `src/app/api/[resource]/`
- Components: `kebab-case.tsx` (e.g., `stat-card.tsx`, `inbox-shell.tsx`, `avatar-initials.tsx`)
- Hooks: `use-kebab-case.ts` (e.g., `use-auth.ts`, `use-realtime.ts`, `use-toast.ts`)
- Data layer (queries): `kebab-case.ts` (e.g., `contacts.ts`, `appointments.ts`, `messages.ts`)
- Data layer (mutations): `kebab-case-mutations.ts` (e.g., `contacts-mutations.ts`, `appointments-mutations.ts`)
- Library modules: `kebab-case.ts` (e.g., `ai-client.ts`, `agent-prompt.ts`, `waha-client.ts`)
- Type-only files: `kebab-case.ts` in `src/types/` (e.g., `database.ts`)

**Functions:**
- Use `camelCase` for all functions: `getContacts()`, `createAppointment()`, `processAIAgent()`
- React components: `PascalCase` named exports: `StatCard`, `InboxShell`, `AvatarInitials`
- Custom hooks: `camelCase` with `use` prefix: `useAuth()`, `useRealtimeMessages()`, `useToast()`
- Server actions: `camelCase` verb-first: `registerBusiness()`, `updateOnboardingStep()`
- Helper functions: `camelCase` descriptive: `getGreeting()`, `formatCurrency()`, `parseTime()`

**Variables:**
- Local variables: `camelCase` (e.g., `businessId`, `todayAppointments`, `monthRevenue`)
- Constants (module-level): `SCREAMING_SNAKE_CASE` for config-like values: `OPENROUTER_URL`, `TOTAL_STEPS`, `SCHEMA_CONTEXT`, `PUBLIC_PATHS`
- Boolean state: `is` or `has` prefix for DB columns (`is_bot_active`, `is_completed`); plain names in React state (`loading`, `submitting`)

**Types/Interfaces:**
- `PascalCase` for all types and interfaces: `Contact`, `AppointmentWithContact`, `ConversationFilters`
- Data input types: `PascalCase` with descriptive suffix: `CreateContactData`, `CreateAppointmentData`, `RegisterBusinessData`
- Zod inferred types: `PascalCase` with `Input` suffix: `RegisterInput`, `AppointmentInput`, `ContactInput`
- Function return types: `PascalCase` descriptive: `AgentResponse`, `BIChatResult`, `StyleAnalysis`
- Union type aliases: `PascalCase`: `ToastType`, `BadgeVariant`, `ContactStatus`

## Code Style

**Formatting:**
- No Prettier config file detected. Formatting relies on ESLint and editor defaults.
- Indentation: 2 spaces
- Semicolons: omitted (no semicolons at end of statements)
- Quotes: single quotes for imports and strings
- Trailing commas: used in multiline arrays, objects, and function parameters
- Line length: no enforced max; lines tend to stay under ~120 characters
- Template literals: used for string interpolation, backtick strings for Supabase `.select()` multiline queries

**Linting:**
- ESLint 9 with flat config at `eslint.config.mjs`
- Extends: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Run via: `npm run lint` (which runs `eslint`)
- Some `eslint-disable-line react-hooks/exhaustive-deps` comments in hooks where Supabase client singleton is intentionally excluded from deps

**TypeScript:**
- `strict: true` in `tsconfig.json`
- Non-null assertions (`!`) used for env vars: `process.env.NEXT_PUBLIC_SUPABASE_URL!`
- `as` type assertions used when casting Supabase query results: `data as Contact[]`, `data as Appointment`
- `any` used sparingly but present in: Supabase realtime payloads, dashboard data mapping, some `Record<string, any>` for JSON columns

## Import Organization

**Order (observed consistently):**
1. Framework/library imports (`next/server`, `react`, `next/navigation`, `next/link`)
2. External packages (`@supabase/ssr`, `@hookform/resolvers`, `react-hook-form`, `lucide-react`, `zod`)
3. Internal `@/` aliased imports (`@/lib/...`, `@/components/...`, `@/hooks/...`, `@/types/...`)

**Path Aliases:**
- `@/*` maps to `./src/*` (defined in `tsconfig.json`)
- Always use `@/` for internal imports; never relative paths between directories

**Import Style:**
- Named imports: `import { createClient } from '@/lib/supabase/server'`
- Type-only imports: `import type { User } from '@supabase/supabase-js'`, `import type { NextConfig } from 'next'`
- Default imports only for: Next.js page components (`export default function`) and config files

## Section Separators

Use ASCII line-art separators to divide file sections:

```typescript
// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────
```

In page files, use shorter separators:
```typescript
/* ─── Data fetching ─── */
/* ─── Greeting ─── */
/* ─── Page ─── */
```

## Error Handling

**Data Layer (lib/data/*):**
- Throw `new Error()` with descriptive messages prefixed by operation: `throw new Error('Failed to fetch contacts: ...')`
- Always check `if (error)` after Supabase queries and throw
- Pattern:
```typescript
const { data, error } = await supabase.from('table').select('*')
if (error) {
  throw new Error(`Failed to fetch X: ${error.message}`)
}
return (data as Type[]) ?? []
```

**API Routes (app/api/*):**
- Wrap entire handler in `try/catch`
- Return `NextResponse.json({ error: '...' }, { status: N })` for all error cases
- Auth check: return 401 if no user
- Business check: return 404 if no business found
- Validation: return 400 for missing/invalid fields
- Catch-all: return 500 with `'Internal server error'` or Hebrew `'שגיאת שרת'`
- Log unhandled errors with prefix: `console.error('[api/messages] Unhandled error:', err)`
- Pattern:
```typescript
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ... business logic ...

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[api/endpoint] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Webhook Routes:**
- Non-critical failures (like saving AI logs) are caught silently to avoid failing the webhook
- Pattern: `try { ... } catch (err) { console.error(...) }` around secondary operations

**Client Components:**
- `ErrorBoundary` class component in `src/components/ui/error-boundary.tsx` for React error boundaries
- Form submissions: set `serverError` state, display in Hebrew
- Catch blocks use bare `catch` (no error variable) or `catch (err)` with console.error

**Middleware:**
- Errors during onboarding check are swallowed with `catch {}` to avoid blocking users

## Logging

**Framework:** `console.log`, `console.error`, `console.warn` (no external logging library)

**Patterns:**
- Prefix logs with bracketed context tag: `[ENV]`, `[webhook]`, `[api/messages]`, `[Reminder]`, `[Waitlist]`, `[health-check]`, `[Contact Stats]`, `[Onboarding Step N]`
- `console.error` for failures that need attention
- `console.warn` for non-critical issues (orphaned sessions, unknown action types, missing env vars)
- `console.log` for informational messages (scheduled reminders, slot offers)

## Comments

**When to Comment:**
- JSDoc `/** */` on exported functions explaining purpose, parameters, and behavior
- Inline numbered steps (`// 1.`, `// 2.`, etc.) for multi-step operations like `registerBusiness()`, `processAIAgent()`, `cancelAppointment()`
- Hebrew comments in UI for business-domain context
- `TODO:` comments for planned integrations (BullMQ queue, WAHA Cloud API migration)

**JSDoc Style:**
```typescript
/**
 * Get a paginated, filterable, searchable list of contacts.
 * Search matches name or phone (case-insensitive).
 * Returns both the contact array and total count for pagination.
 */
export async function getContacts(options?: GetContactsOptions): Promise<ContactsResult> {
```

## Component Design

**Server Components (default):**
- Pages and layouts are server components by default
- Fetch data directly with `async function` and `await createClient()` from server Supabase
- No `'use client'` directive

**Client Components:**
- Marked with `'use client'` directive at top of file
- Used for: interactive forms, realtime subscriptions, state management, event handlers
- Name pattern: `kebab-case.tsx`

**Component Props:**
- Define interface inline or above component:
```typescript
interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  className?: string
}
```
- Accept optional `className` prop for composability, merge with `cn()` utility

**Component Structure:**
1. `'use client'` directive (if needed)
2. Imports
3. Interface definitions
4. Helper constants/functions
5. Named export function component

## CSS & Styling

**Approach:** Tailwind CSS v4 with CSS custom properties (design tokens)

**Design Tokens (defined in `src/app/globals.css`):**
- Colors: `--color-primary`, `--color-primary-dark`, `--color-primary-light`, `--color-text`, `--color-text-secondary`, `--color-text-muted`
- Status colors: `--color-success`, `--color-warning`, `--color-danger`, `--color-info` (with `-bg` variants)
- Radii: `--radius-card` (16px), `--radius-button` (12px), `--radius-badge` (8px)
- Font: `--font-sans` (Noto Sans Hebrew)

**Custom Utility Classes (defined in `src/app/globals.css`):**
- `glass`, `glass-strong`, `glass-dark`, `glass-card`, `glass-nav`, `glass-sidebar` -- iOS glassmorphism effects
- `shadow-ios`, `shadow-ios-lg` -- iOS-style box shadows
- `bg-mesh` -- gradient mesh background
- `transition-ios` -- cubic-bezier transition
- `press-effect` -- iOS-style active press scale
- `animate-slide-in-top` -- toast slide-in animation

**Color Reference in Components:**
- Use CSS variables via Tailwind: `text-[var(--color-primary)]`, `bg-[var(--color-primary)]`
- Use Tailwind theme tokens directly: `text-text`, `text-text-secondary`, `text-text-muted`, `text-success`, `text-danger`
- Hardcoded hex values appear in some places: `text-[#1B2E24]`, `text-[#5A6E62]`, `text-[#8FA89A]` (these match the CSS var values)

**`cn()` Utility:**
- Located at `src/lib/utils/cn.ts`
- Combines `clsx` and `tailwind-merge` for conditional/merged class names
- Use for all components that accept `className` props

## Supabase Client Pattern

**Three client types, each with a specific use case:**

1. **Browser client** (`src/lib/supabase/client.ts`): `createClient()` -- for `'use client'` components. Module-level singleton pattern used in hooks.
2. **Server client** (`src/lib/supabase/server.ts`): `createClient()` (async) -- for server components, API routes, server actions. Uses `cookies()`.
3. **Service client** (`src/lib/supabase/service.ts`): `createServiceClient()` -- bypasses RLS. Used in webhooks, cron jobs, registration.

**Business ID Resolution Pattern (repeated in most data functions and API routes):**
```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) throw new Error('Not authenticated')

const { data: businessUser } = await supabase
  .from('business_users')
  .select('business_id')
  .eq('user_id', user.id)
  .single()
if (!businessUser) throw new Error('Business not found')

const businessId = businessUser.business_id
```

## Validation Pattern

- Zod schemas defined in `src/lib/validations.ts`
- Schemas export both the schema and inferred type: `export const contactSchema = z.object({...})` + `export type ContactInput = z.infer<typeof contactSchema>`
- Validation messages are in Hebrew
- Client-side: `react-hook-form` with `@hookform/resolvers/zod`
- Server-side (API routes): manual validation (`if (!name || !phone)`) -- Zod schemas not used in API routes

## Module Design

**Exports:**
- Named exports exclusively (no default exports except Next.js pages/layouts)
- Data modules export both types and functions from the same file
- Re-export pattern used in `src/types/database.ts` for convenience: `export type { ConversationWithContact } from '@/lib/data/messages'`
- Singleton exports: `export const whatsapp: WhatsAppProvider = new WahaProvider()`, `export const waha = new WahaClient()`

**Barrel Files:**
- Not used. Import directly from specific files.

**Provider/Interface Pattern:**
- `src/lib/waha/provider.ts` defines a `WhatsAppProvider` interface with a `WahaProvider` class implementation
- Singleton export: `export const whatsapp: WhatsAppProvider = new WahaProvider()`
- Comment indicates future `CloudApiProvider` will implement the same interface

## Data Layer Split

**Queries vs Mutations:**
- Read operations: `src/lib/data/{resource}.ts` (e.g., `contacts.ts`, `appointments.ts`, `messages.ts`)
- Write operations: `src/lib/data/{resource}-mutations.ts` (e.g., `contacts-mutations.ts`, `appointments-mutations.ts`)
- Some files contain both if the resource is smaller (e.g., `expenses.ts`)

**Parallel Fetching:**
- Use `Promise.all()` for independent queries:
```typescript
const [businessRes, settingsRes, personaRes] = await Promise.all([
  supabase.from('businesses').select('*').eq('id', id).single(),
  supabase.from('business_settings').select('*').eq('business_id', id).single(),
  supabase.from('ai_personas').select('*').eq('business_id', id).single(),
])
```

## RTL & Internationalization

- The entire app is Hebrew, RTL by default
- `dir="rtl"` set on `<html>` element and some container elements
- `dir="ltr"` explicitly set on email/password/phone inputs
- Use logical CSS properties (`border-e`, `inset-x`, `me-1`) for RTL compatibility where Tailwind supports them
- All user-facing strings (labels, errors, placeholders) are in Hebrew
- API error messages mixed: some English (`'Unauthorized'`, `'Internal server error'`), some Hebrew (`'לא מאומת'`, `'שגיאת שרת'`)

---

*Convention analysis: 2026-03-16*
