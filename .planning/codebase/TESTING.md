# Testing Patterns

**Analysis Date:** 2026-03-16

## Test Framework

**Runner:**
- Not configured. No test framework (Jest, Vitest, Playwright, Cypress) is installed or configured.
- No test runner config files detected (`jest.config.*`, `vitest.config.*`, `playwright.config.*`, `cypress.config.*`).
- No test-related scripts in `package.json`.
- No test-related devDependencies in `package.json`.

**Assertion Library:**
- None installed.

**Run Commands:**
```bash
# No test commands available
# npm run lint              # Only linting exists (ESLint)
```

## Test File Organization

**Location:**
- No test files exist anywhere in `src/`.
- No `__tests__/` directories.
- No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` files in the project source.

**Current state:** Zero test coverage. The codebase has no automated tests of any kind.

## Recommended Test Setup

Based on the stack (Next.js 16, React 19, TypeScript), the following setup would be appropriate:

**Unit/Integration Tests:**
- Framework: Vitest (fast, native TypeScript/ESM support, compatible with Next.js)
- Config file: `vitest.config.ts` at project root
- React component testing: `@testing-library/react` with `@testing-library/jest-dom`

**Recommended `package.json` scripts:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Recommended devDependencies:**
```json
{
  "vitest": "^3.x",
  "@testing-library/react": "^16.x",
  "@testing-library/jest-dom": "^6.x",
  "@testing-library/user-event": "^14.x",
  "@vitejs/plugin-react": "^4.x",
  "jsdom": "^25.x"
}
```

## Test File Naming Convention (Recommended)

Based on the file naming conventions in the codebase (kebab-case), use:

**Pattern:** Co-located test files with `.test.ts` / `.test.tsx` suffix

```
src/
  lib/
    data/
      contacts.ts
      contacts.test.ts           # Unit tests for query functions
      contacts-mutations.ts
      contacts-mutations.test.ts # Unit tests for mutation functions
    ai/
      ai-client.ts
      ai-client.test.ts
    waha/
      waha-client.ts
      waha-client.test.ts
  components/
    ui/
      status-badge.tsx
      status-badge.test.tsx
    contacts/
      contact-form.tsx
      contact-form.test.tsx
  hooks/
    use-auth.ts
    use-auth.test.ts
  app/
    api/
      contacts/
        route.ts
        route.test.ts
```

## What to Test (Priority Order)

### P0 -- Critical Business Logic

**AI Agent Processing (`src/lib/ai/agent-prompt.ts`):**
- `buildSystemPrompt()` -- pure function, easy to unit test
- `processAIAgent()` -- mock Supabase and AI client, test flow
- JSON parsing fallback when AI returns invalid JSON
- Action execution: `book_appointment`, `cancel_appointment`, `escalate`
- Time slot conflict detection

**Webhook Handler (`src/app/api/webhooks/waha/route.ts`):**
- Message event: contact creation, conversation creation, message saving
- Session status event: status mapping (WORKING -> connected)
- Message ack event: status updates
- Auth verification (API key check)
- Edge cases: outgoing messages skipped, group messages skipped, empty messages skipped

**Data Mutations:**
- `createAppointment()` in `src/lib/data/appointments-mutations.ts`
- `cancelAppointment()` with waitlist logic
- `createContact()` in `src/lib/data/contacts-mutations.ts`
- `updateContactStatus()` status computation logic

### P1 -- Data Layer Queries

**Appointment Slot Calculation (`src/lib/data/appointments.ts`):**
- `getAvailableSlots()` -- complex logic with break intervals, overlap detection
- `parseTime()` and `formatTime()` -- pure helper functions, trivial to test

**Contact Queries (`src/lib/data/contacts.ts`):**
- `getContacts()` with search, filter, sort, pagination
- `getDormantContacts()` with date threshold calculation

### P2 -- API Routes

**All API routes follow the same pattern and should test:**
- Auth guard (401 if no user)
- Business resolution (404 if no business)
- Input validation (400 for missing fields)
- Success response shape
- Error handling (500 catch-all)

**Files to cover:**
- `src/app/api/contacts/route.ts` (GET, POST)
- `src/app/api/appointments/route.ts` (GET, POST)
- `src/app/api/messages/route.ts` (POST)
- `src/app/api/ai/chat/route.ts` (POST)
- `src/app/api/ai/agent/route.ts` (POST)
- `src/app/api/cron/health-check/route.ts` (GET)

### P3 -- UI Components

**Components with logic worth testing:**
- `src/components/contacts/contact-form.tsx` -- form validation, submission
- `src/components/inbox/inbox-shell.tsx` -- mobile/desktop layout switching
- `src/components/ui/error-boundary.tsx` -- error catching behavior
- `src/components/ui/toast.tsx` -- toast context, auto-dismiss

**Pure display components (low priority):**
- `src/components/ui/status-badge.tsx`
- `src/components/ui/avatar-initials.tsx` -- `getInitials()` and `getVariant()` are pure testable functions
- `src/components/dashboard/stat-card.tsx`

## Mocking Strategy (Recommended)

**Supabase Client Mocking:**
The Supabase client is created via factory functions in three files. Mock the module:

```typescript
// Example: mocking server-side Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    }),
  }),
}))
```

**Service Client (`src/lib/supabase/service.ts`):**
```typescript
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      // ... chainable mocks
    }),
  }),
}))
```

**AI Client (`src/lib/ai/ai-client.ts`):**
```typescript
vi.mock('@/lib/ai/ai-client', () => ({
  generateResponse: vi.fn().mockResolvedValue('{"text":"response","intent":"greeting","confidence":0.9,"action":null,"escalated":false}'),
  generateVisionResponse: vi.fn().mockResolvedValue('{"message_length":"short","emoji_usage":"light"}'),
}))
```

**WAHA Client (`src/lib/waha/waha-client.ts`):**
```typescript
vi.mock('@/lib/waha/waha-client', () => ({
  waha: {
    sendText: vi.fn().mockResolvedValue({ id: 'msg-1', status: 'sent' }),
    sendImage: vi.fn().mockResolvedValue({ id: 'msg-2', status: 'sent' }),
    getSession: vi.fn().mockResolvedValue({ name: 'test', status: 'WORKING' }),
    getSessions: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockResolvedValue({ name: 'new-session' }),
    getQR: vi.fn().mockResolvedValue({ value: 'qr-data', mimetype: 'image/png' }),
  },
}))
```

**WhatsApp Provider (`src/lib/waha/provider.ts`):**
```typescript
vi.mock('@/lib/waha/provider', () => ({
  whatsapp: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendImage: vi.fn().mockResolvedValue(undefined),
    getSessionStatus: vi.fn().mockResolvedValue('WORKING'),
    createSession: vi.fn().mockResolvedValue('new-session'),
    getQR: vi.fn().mockResolvedValue('qr-data'),
  },
}))
```

**What to Mock:**
- All Supabase client calls (network boundary)
- All AI API calls (OpenRouter -- external service)
- All WAHA API calls (external service)
- `fetch()` global for API route integration tests
- `next/headers` (`cookies()`) for server client tests
- Environment variables via `vi.stubEnv()`

**What NOT to Mock:**
- Pure functions: `parseTime()`, `formatTime()`, `getInitials()`, `getVariant()`, `lighten()`, `cn()`
- Zod schemas and validation logic
- `buildSystemPrompt()` (pure function that formats strings)
- Data transformation logic (e.g., mapping Supabase rows to typed objects)

## Fixtures and Factories (Recommended)

**Test Data Location:** `src/__tests__/fixtures/` or co-located `__fixtures__/` directories

**Example fixture pattern:**
```typescript
// src/__tests__/fixtures/contacts.ts
export const mockContact = {
  id: 'contact-1',
  business_id: 'biz-1',
  wa_id: '0501234567',
  phone: '0501234567',
  name: 'ישראל ישראלי',
  status: 'new',
  tags: ['VIP'],
  notes: null,
  birthday: null,
  last_visit: null,
  total_visits: 0,
  total_revenue: 0,
  created_at: '2026-01-01T00:00:00Z',
}

export const mockBusiness = {
  id: 'biz-1',
  name: 'מספרה של שרה',
  owner_user_id: 'user-1',
  business_type: 'salon',
  plan: 'trial',
  status: 'active',
}

export const mockBusinessUser = {
  business_id: 'biz-1',
  user_id: 'user-1',
  role: 'owner',
}
```

## Coverage

**Requirements:** None enforced (no test infrastructure exists).

**Recommended targets when testing is added:**
- Overall: 60% as initial target
- Critical paths (AI agent, webhooks, mutations): 80%+
- Pure utility functions: 100%

## Test Types

**Unit Tests:**
- Target: pure functions, data transformations, Zod schemas
- Files: `src/lib/ai/agent-prompt.ts` (buildSystemPrompt), `src/lib/data/appointments.ts` (parseTime, formatTime, slot calculation), `src/lib/validations.ts`

**Integration Tests:**
- Target: API route handlers, data layer functions with mocked Supabase
- Verify request/response shapes, auth guards, error handling

**E2E Tests:**
- Not configured. No Playwright or Cypress.
- Recommended: Playwright for critical user flows (login, contact creation, appointment booking)

## Pure Functions to Test Immediately

These require zero mocking and provide high value:

| Function | File | Complexity |
|----------|------|------------|
| `parseTime(time: string)` | `src/lib/data/appointments.ts` | Low |
| `formatTime(minutes: number)` | `src/lib/data/appointments.ts` | Low |
| `getInitials(name: string)` | `src/components/ui/avatar-initials.tsx` | Low |
| `getVariant(name: string)` | `src/components/ui/avatar-initials.tsx` | Low |
| `lighten(hex: string, ratio: number)` | `src/hooks/use-theme.ts` | Low |
| `cn(...inputs: ClassValue[])` | `src/lib/utils/cn.ts` | Trivial |
| `buildSystemPrompt(business, settings, persona)` | `src/lib/ai/agent-prompt.ts` | Medium |
| `formatWorkingHours(hours)` | `src/lib/ai/agent-prompt.ts` | Low |
| Zod schema validation | `src/lib/validations.ts` | Low |
| `getGreeting()` | `src/app/(dashboard)/page.tsx` | Trivial |
| `formatCurrency(amount: number)` | `src/app/(dashboard)/page.tsx` | Trivial |

## Vitest Config (Recommended Starter)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/components/**', 'src/hooks/**', 'src/app/api/**'],
      exclude: ['src/types/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
```

```typescript
// src/__tests__/setup.ts
import '@testing-library/jest-dom/vitest'
```

---

*Testing analysis: 2026-03-16*
