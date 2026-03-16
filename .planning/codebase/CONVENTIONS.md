# Coding Conventions

**Analysis Date:** 2026-03-16

## Language & Locale

**Primary language:** TypeScript (strict mode enabled in `tsconfig.json`)
**UI locale:** Hebrew (RTL). The entire app is RTL-first (`<html lang="he" dir="rtl">`).
- All user-facing strings are in Hebrew
- Error messages from Zod schemas and API responses are in Hebrew
- Use `start`/`end` instead of `left`/`right` for RTL compatibility (e.g., `ps-10`, `pe-3`, `border-e`)
- Set `dir="ltr"` on inputs for email, phone, password fields

## Naming Patterns

**Files:**
- Components: `kebab-case.tsx` (e.g., `chat-view.tsx`, `stat-card.tsx`, `inbox-shell.tsx`)
- Hooks: `use-kebab-case.ts` (e.g., `use-auth.ts`, `use-realtime.ts`, `use-theme.ts`)
- Data modules: `kebab-case.ts` (e.g., `contacts-mutations.ts`, `appointments.ts`)
- API routes: `route.ts` inside directory matching the endpoint path
- Type files: `kebab-case.ts` (e.g., `database.ts`, `types.ts`)

**Functions:**
- React components: `PascalCase` (e.g., `StatCard`, `InboxShell`, `ChatView`)
- Server-side data functions: `camelCase` verbs (e.g., `getContacts`, `createAppointment`, `getDashboardData`)
- Mutation functions: `camelCase` verb prefixed (e.g., `createContact`, `updateContactStatus`, `cancelAppointment`)
- Hooks: `useCamelCase` (e.g., `useAuth`, `useRealtimeMessages`, `useTheme`)
- Helper functions: `camelCase` (e.g., `formatTime`, `parseTime`, `getGreeting`, `lighten`)

**Variables:**
- `camelCase` for local variables and state
- `UPPER_SNAKE_CASE` for constants (e.g., `TOTAL_STEPS`, `OPENROUTER_URL`, `BUSINESS_TYPES`, `SCHEMA_CONTEXT`)
- Database columns use `snake_case` (e.g., `business_id`, `last_message_at`, `is_bot_active`)
- TypeScript interface fields for DB rows mirror `snake_case` from Supabase
- TypeScript interface fields for app logic use `camelCase` (e.g., `businessId`, `contactName`, `serviceType`)

**Types:**
- Interfaces: `PascalCase` (e.g., `Contact`, `ConversationWithContact`, `AgentInput`, `DashboardData`)
- Type aliases: `PascalCase` (e.g., `RegisterResult`, `ContactStatus`, `StatusFilter`)
- Input/data types: suffixed with `Data` or `Input` (e.g., `CreateContactData`, `RegisterInput`, `AppointmentInput`)
- Props interfaces: suffixed with `Props` (e.g., `ChatViewProps`, `InboxShellProps`, `StatCardProps`)

## Code Style

**Formatting:**
- No Prettier config detected -- rely on ESLint + editor defaults
- Single quotes for strings
- No semicolons (consistent across all source files)
- 2-space indentation
- Trailing commas in multiline arrays/objects

**Linting:**
- ESLint 9 with flat config (`eslint.config.mjs`)
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- `react-hooks/exhaustive-deps` warnings are suppressed with `// eslint-disable-line react-hooks/exhaustive-deps` in hook files (consistent pattern for Supabase client in deps)

## Import Organization

**Order:**
1. React/Next.js framework imports (`react`, `next/navigation`, `next/server`, `next/link`)
2. External library imports (`@supabase/ssr`, `lucide-react`, `zod`)
3. Internal absolute imports using `@/` alias (`@/lib/...`, `@/components/...`, `@/hooks/...`)
4. Relative imports (`./contact-card`, `./gemini`)
5. Type-only imports use `import type` syntax (e.g., `import type { User } from '@supabase/supabase-js'`)

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Always use `@/` for cross-directory imports; use relative paths only within the same directory

## Error Handling

**Server-side data functions (`src/lib/data/*.ts`):**
- Throw `new Error()` with descriptive message on Supabase query failure
- Pattern: check `error` from Supabase response, throw with `error.message`
```typescript
if (error) {
  throw new Error(`Failed to fetch contacts: ${error.message}`)
}
```

**API route handlers (`src/app/api/**/route.ts`):**
- Wrap entire handler in `try/catch`
- Return `NextResponse.json({ error: '...' }, { status: N })` for known errors
- Return `NextResponse.json({ error: 'Internal server error' }, { status: 500 })` in catch blocks
- Log errors with `console.error('[context] description:', err)`
- Auth pattern: check user first, then business_users lookup, then proceed
```typescript
try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // ... business logic
} catch (err) {
  console.error('[api/endpoint] Error:', err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```

**Client-side components:**
- Use `useState` for error state, display Hebrew error messages
- Use `try/catch` around async operations with `finally` for loading state
- Silently catch non-critical failures (e.g., theme load, analytics)

**AI response parsing:**
- Always wrap `JSON.parse()` in try/catch with fallback objects
- Strip markdown code fences before parsing: `text.replace(/```json\n?|```/g, '').trim()`

## Logging

**Framework:** `console` (no external logging library)

**Patterns:**
- Use bracketed prefix tags: `[webhook]`, `[Reminder]`, `[api/ai/chat]`, `[health-check]`, `[AI]`, `[Contact Stats]`
- `console.error` for failures and errors
- `console.log` for informational events (e.g., reminder scheduling)
- `console.warn` for non-critical warnings (e.g., unknown action type, Telegram not configured)
- Non-critical side-effect failures log but do not throw (e.g., contact stats update, receipt upload)

## Comments

**When to Comment:**
- Section dividers use ASCII box-drawing style: `// ── Section Name ──────────────────────────────`
- JSDoc `/** */` comments on all exported async functions explaining purpose and behavior
- Inline comments for non-obvious business logic (e.g., "Skip group messages", "month is 1-based")
- `TODO` comments for planned features with context (e.g., `// TODO: Replace with BullMQ queue when configured`)

**Section Dividers:**
- Data modules consistently use these section markers:
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

**JSDoc:**
- Applied to exported server functions in `src/lib/data/*.ts` and `src/lib/ai/*.ts`
- Describes what the function does, parameters it expects, and notable behavior
- Not applied to React components (component name + props interface is sufficient)

## Function Design

**Size:** Functions are moderate length (20-60 lines typical). Complex functions use numbered steps.

**Parameters:**
- Data functions accept options objects for complex queries: `GetContactsOptions`
- Mutations accept typed data objects: `CreateContactData`, `CreateAppointmentData`
- Simple functions accept positional args: `getAppointmentsByDate(date: string)`

**Return Values:**
- Server data functions return typed Promise: `Promise<Contact[]>`, `Promise<DashboardData>`
- Mutations return the created/updated entity: `Promise<Appointment>`, `Promise<Contact>`
- Actions return `{ success: true }` or `{ error: string }` (discriminated union)

**Async patterns:**
- Use `Promise.all()` for independent parallel queries
- Always `await createClient()` for server Supabase client (Next.js async cookies)
- Browser Supabase client is created synchronously: `createClient()` (no await)

## Module Design

**Exports:**
- Named exports only (no default exports except for page components and layouts)
- Page components: `export default function PageName()`
- Layout components: `export default function LayoutName()`
- All other components and functions: named exports

**Barrel Files:**
- Not used. Import directly from the source module.
- One exception: `src/lib/ai/intent-detector.ts` re-exports from `agent-prompt.ts` for backward compatibility.

## Component Patterns

**Server Components (default in App Router):**
- Pages fetch data directly with async server functions
- Pass data as props to client components
- Pattern: `src/app/(dashboard)/inbox/page.tsx` fetches conversations, passes to `InboxShell`

**Client Components:**
- Marked with `'use client'` directive at top of file
- Use hooks for state, effects, and realtime subscriptions
- All components in `src/components/` that need interactivity are client components

**Props Interface Pattern:**
```typescript
interface ComponentNameProps {
  requiredProp: string
  optionalProp?: boolean
  /** JSDoc for complex props */
  callback?: () => void
  className?: string  // Always last, always optional
}
```

## Styling Conventions

**Framework:** Tailwind CSS v4 with CSS custom properties

**Approach:**
- Utility-first with Tailwind classes directly in JSX
- CSS custom properties for design tokens (defined in `src/app/globals.css`)
- `cn()` utility from `src/lib/utils/cn.ts` (clsx + tailwind-merge) for conditional classes
- Custom CSS classes for reusable effects: `glass-card`, `shadow-ios`, `transition-ios`, `press-effect`, `bg-mesh`
- Use CSS variables for theming: `var(--color-primary)`, `var(--color-text)`, etc.

**Responsive:**
- Mobile-first approach
- Breakpoints: `md:` for tablet, `lg:` for desktop
- Some components use `hidden md:block` / `block md:hidden` for mobile/desktop variants

**Color references:**
- Use Tailwind theme colors: `text-text`, `text-text-muted`, `bg-surface`, `border-border`
- Some components use raw hex codes: `text-[#1B2E24]`, `bg-[#F7FAF8]`, `border-[#E8EFE9]`
- Use CSS variables for primary brand color: `bg-[var(--color-primary)]`, `text-[var(--color-primary)]`

## Supabase Client Pattern

**Four distinct clients for different contexts:**

| Context | Client | File | Auth |
|---------|--------|------|------|
| Browser (client components) | `createClient()` | `src/lib/supabase/client.ts` | User session (cookie) |
| Server (RSC, server actions) | `await createClient()` | `src/lib/supabase/server.ts` | User session (cookie) |
| Middleware | `createServerClient()` | `src/lib/supabase/middleware.ts` | Request cookies |
| Service (webhooks, cron) | `createServiceClient()` | `src/lib/supabase/service.ts` | Service role key (no RLS) |

**Usage rule:** Always use the server client for data functions. Use service client only in webhook handlers and cron jobs where there is no user auth context.

## Validation Pattern

**Schema validation** with Zod (`src/lib/validations.ts`):
- Define schema with Hebrew error messages
- Export inferred type: `export type RegisterInput = z.infer<typeof registerSchema>`
- Used with `react-hook-form` via `@hookform/resolvers`
- Client-side validation in register page duplicates some Zod checks manually (phone regex, password rules)

---

*Convention analysis: 2026-03-16*
