# Testing Patterns

**Analysis Date:** 2026-03-16

## Test Framework

**Runner:**
- **None installed.** No test framework (Jest, Vitest, Playwright, etc.) is configured.
- No test runner config files exist (`jest.config.*`, `vitest.config.*`, `cypress.config.*`, `playwright.config.*`).
- No test-related dependencies in `package.json`.
- No test scripts in `package.json` (only `dev`, `build`, `start`, `lint`).

**Assertion Library:**
- None

**Run Commands:**
```bash
npm run lint               # Only available quality check (ESLint)
npm run build              # Type checking via TypeScript (strict mode)
```

## Test File Organization

**Location:**
- No test files exist anywhere in `src/`.
- No `__tests__/` directories, no `*.test.ts`, no `*.spec.ts` files.

**Naming:**
- No convention established yet.

## Test Coverage

**Requirements:** None enforced. No coverage tooling configured.

**Current coverage:** 0% -- no tests exist.

## Recommended Test Setup

Based on the codebase patterns (Next.js 16, React 19, TypeScript, Supabase), the recommended test stack would be:

**Unit/Integration:**
- Vitest (fast, native ESM/TypeScript, works well with Next.js)
- `@testing-library/react` for component testing
- `@testing-library/jest-dom` for DOM assertions

**E2E:**
- Playwright (official Next.js recommendation)

**Suggested `package.json` additions:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^3.x",
    "@vitejs/plugin-react": "^4.x",
    "@testing-library/react": "^16.x",
    "@testing-library/jest-dom": "^6.x",
    "jsdom": "^26.x"
  }
}
```

## What Should Be Tested (Priority Order)

### High Priority -- Pure Logic (no mocking needed)

These modules contain pure business logic that is trivial to unit test:

**Time utilities** in `src/lib/data/appointments.ts`:
```typescript
// parseTime("14:30") should return 870
// formatTime(870) should return "14:30"
export function parseTime(time: string): number
export function formatTime(minutes: number): string
```

**Zod validation schemas** in `src/lib/validations.ts`:
```typescript
// Test valid/invalid inputs for each schema
registerSchema.parse({ ... })    // should succeed
registerSchema.parse({ phone: '123' })  // should throw
```

**Contact status logic** in `src/lib/data/contacts-mutations.ts`:
```typescript
// updateContactStatus determines status from visit count + recency
// 10+ visits => 'vip', 2+ => 'returning', etc.
```

**AI response parsing** in `src/lib/ai/agent-prompt.ts`:
```typescript
// JSON parsing with markdown fence stripping
// Fallback when AI returns invalid JSON
const cleaned = rawResponse.replace(/```json\n?|```/g, '').trim()
```

**Dashboard helpers** in `src/lib/data/dashboard.ts`:
```typescript
// getStartOfWeek(), getStartOfMonth() -- date utilities
```

**cn() utility** in `src/lib/utils/cn.ts`:
```typescript
// cn('foo', false && 'bar', 'baz') => 'foo baz'
```

### Medium Priority -- Data Layer (requires Supabase mocking)

**Data query functions** in `src/lib/data/`:
- `src/lib/data/contacts.ts` -- `getContacts()`, `getContactById()`, `getDormantContacts()`
- `src/lib/data/messages.ts` -- `getConversations()`, `getConversationMessages()`
- `src/lib/data/appointments.ts` -- `getAppointmentsByDate()`, `getAvailableSlots()`
- `src/lib/data/dashboard.ts` -- `getDashboardData()`
- `src/lib/data/expenses.ts` -- `getMonthlyFinancials()`, `addExpense()`

**Mocking pattern for Supabase:**
```typescript
import { vi } from 'vitest'

// Mock the server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
  }),
}))
```

### Medium Priority -- API Routes (requires request/response mocking)

**API route handlers** in `src/app/api/`:
- `src/app/api/contacts/route.ts` -- GET (search, filter, paginate), POST (create)
- `src/app/api/appointments/route.ts` -- GET (date range), POST (create)
- `src/app/api/messages/route.ts` -- POST (send message)
- `src/app/api/ai/agent/route.ts` -- POST (trigger AI agent)
- `src/app/api/ai/chat/route.ts` -- POST (BI query)
- `src/app/api/webhooks/waha/route.ts` -- POST (incoming WhatsApp messages)

**Testing pattern for route handlers:**
```typescript
import { POST } from '@/app/api/contacts/route'
import { NextRequest } from 'next/server'

it('returns 401 when not authenticated', async () => {
  const req = new NextRequest('http://localhost/api/contacts', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test', phone: '0501234567' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(401)
})
```

### Lower Priority -- Components (requires DOM testing)

**Complex client components:**
- `src/components/inbox/inbox-shell.tsx` -- split-view layout, mobile/desktop toggle
- `src/components/inbox/chat-view.tsx` -- realtime messages, bot toggle, send
- `src/components/contacts/contacts-list.tsx` -- search, filter, paginate, CRUD
- `src/components/calendar/calendar-view.tsx` -- date navigation, appointment display

### Lower Priority -- Integration/E2E

**Critical user flows:**
- Registration flow: register -> onboarding -> dashboard
- Login flow: login -> redirect to dashboard
- WhatsApp webhook: incoming message -> AI response -> outgoing message
- Appointment booking: select date -> check availability -> create appointment

## Mocking

**Framework:** Not yet configured. Vitest built-in `vi.mock()` recommended.

**What to Mock:**
- `@/lib/supabase/server` -- mock `createClient()` to return chainable query builder
- `@/lib/supabase/client` -- mock for component tests
- `@/lib/supabase/service` -- mock `createServiceClient()` for webhook/cron tests
- `@/lib/waha/waha-client` -- mock `waha` singleton for WhatsApp API calls
- `@/lib/waha/provider` -- mock `whatsapp` singleton
- `@/lib/ai/gemini` -- mock `generateResponse()` and `generateVisionResponse()`
- `fetch` -- mock for OpenRouter API calls, Telegram alerts, WAHA API

**What NOT to Mock:**
- Zod schemas (test real validation behavior)
- Pure utility functions (`cn()`, `parseTime()`, `formatTime()`, `lighten()`)
- Type definitions and interfaces
- Component rendering logic (use Testing Library instead)

## Fixtures and Factories

**Test Data:**
No fixtures or factories exist yet. Create them in a `src/__tests__/fixtures/` directory.

```typescript
// Suggested: src/__tests__/fixtures/contacts.ts
export const mockContact = {
  id: 'contact-1',
  business_id: 'biz-1',
  wa_id: '0501234567',
  phone: '0501234567',
  name: 'Test Contact',
  status: 'new',
  tags: [],
  notes: null,
  birthday: null,
  last_visit: null,
  total_visits: 0,
  total_revenue: 0,
  created_at: '2026-01-01T00:00:00Z',
}

// Suggested: src/__tests__/fixtures/conversations.ts
export const mockConversation = {
  id: 'conv-1',
  business_id: 'biz-1',
  contact_id: 'contact-1',
  status: 'active',
  assigned_to: null,
  is_bot_active: true,
  last_message_at: '2026-01-01T12:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  contacts: { name: 'Test Contact', phone: '0501234567', status: 'new' },
  lastMessage: null,
}
```

**Location:**
- `src/__tests__/fixtures/` for shared test data
- Co-locate test files next to source: `src/lib/data/contacts.test.ts`
- Or use `__tests__/` directories: `src/lib/data/__tests__/contacts.test.ts`

## Test Types

**Unit Tests:**
- Target: pure functions, utilities, validation schemas, data transformations
- No external dependencies or side effects
- Fast execution, no mocking needed

**Integration Tests:**
- Target: data layer functions with mocked Supabase, API route handlers
- Mock external services (Supabase, WAHA, OpenRouter)
- Test request/response shape and error handling

**E2E Tests:**
- Framework: Not configured. Playwright recommended.
- Target: full user flows (registration, login, inbox, calendar)
- Would require Supabase local instance or test project

## Current Quality Checks

The only automated quality checks available:

```bash
npm run lint               # ESLint with Next.js + TypeScript rules
npm run build              # TypeScript compilation (strict: true)
```

**TypeScript strict mode** (`tsconfig.json`) catches:
- Missing null checks
- Implicit `any` usage
- Unused variables (via ESLint)

**No CI/CD pipeline detected** -- no `.github/workflows/`, no `vercel.json` with build checks.

---

*Testing analysis: 2026-03-16*
