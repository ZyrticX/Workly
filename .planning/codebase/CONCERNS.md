# Codebase Concerns

**Analysis Date:** 2026-03-16

## Tech Debt

**No Reminder/Queue System Implemented:**
- Issue: Appointment reminders are logged to console only. BullMQ or any job queue is not installed or configured. The `src/lib/queue/` directory exists but is empty.
- Files: `src/lib/data/appointments-mutations.ts` (lines 74, 162, 223)
- Impact: Customers receive no reminder messages before appointments. Waitlist notifications after cancellation are also not sent.
- Fix approach: Install BullMQ + Redis (or use Vercel Cron + DB-based queue). Implement a reminder worker that checks upcoming appointments and sends WhatsApp messages via the WAHA provider. Replace all three TODO blocks in `appointments-mutations.ts`.

**Admin Panel Has No Authorization:**
- Issue: The admin layout at `src/app/admin/layout.tsx` only checks if a user is logged in (`supabase.auth.getUser()`), not if they have an admin role. Any authenticated user can access `/admin/*` routes.
- Files: `src/app/admin/layout.tsx` (line 25)
- Impact: Critical security issue. Any registered business user can view all businesses, phone numbers, billing data, and health checks across the entire platform.
- Fix approach: Add a `role` column to a `profiles` or `business_users` table (or use Supabase custom claims). Check `role === 'admin'` in the admin layout before rendering. Redirect non-admins.

**Webhook Endpoint Has No Authentication:**
- Issue: `POST /api/webhooks/waha` accepts any request without verifying the caller is the actual WAHA server. No secret, HMAC, or IP whitelist.
- Files: `src/app/api/webhooks/waha/route.ts` (line 9)
- Impact: Anyone who discovers the webhook URL can inject fake messages, trigger AI responses, or update phone statuses. This is an abuse vector.
- Fix approach: Add a webhook secret header check (e.g., `X-Webhook-Secret` configured in WAHA). Reject requests that don't include the correct secret.

**Registration Has No Rollback:**
- Issue: `registerBusiness()` creates an auth user, then a business, business_user, settings, persona, billing, and onboarding records in sequence. If any step after auth user creation fails, the auth user is left orphaned with no associated business.
- Files: `src/lib/auth/register.ts` (lines 71-161)
- Impact: Orphaned auth users who cannot re-register with the same email but have no business data. Manual cleanup required.
- Fix approach: Wrap steps 2-7 in a transaction (use Supabase `rpc` with a PL/pgSQL function), or add cleanup logic that deletes the auth user on failure.

**Cron Health Check Has Conditional Auth:**
- Issue: The CRON_SECRET check only runs if the env var is set (`if (cronSecret && ...)`). If CRON_SECRET is not configured, the endpoint is completely open.
- Files: `src/app/api/cron/health-check/route.ts` (line 19)
- Impact: In development or misconfigured production, anyone can trigger health checks and see internal session/phone data.
- Fix approach: Change to fail-closed: if `CRON_SECRET` is not set, return 500 "CRON_SECRET not configured" instead of allowing unauthenticated access.

**BI Chat Sends Full Data to AI:**
- Issue: `processBusinessQuery()` in `bi-chat.ts` fetches up to 200-500 rows per table and sends the entire JSON payload to the AI model via `generateAnswer()`. Large businesses could send massive payloads.
- Files: `src/lib/ai/bi-chat.ts` (lines 62-163, 167-188)
- Impact: High token costs, potential API timeouts, and possible token limit errors. A business with 500 appointments sends the full JSON of all 500 rows to OpenRouter.
- Fix approach: Add aggregation queries (SUM, COUNT, AVG) at the database level rather than sending raw rows. Only send raw data when needed for detail-level questions.

**Pervasive `any` Types in Realtime Hooks:**
- Issue: All three realtime hooks (`useRealtimeMessages`, `useRealtimeAppointments`, `useRealtimeConversations`) use `any[]` for state and `any` for payloads.
- Files: `src/hooks/use-realtime.ts` (lines 14, 57-58, 69-72, 92, 136-138, 152-155, 168-170, 189)
- Impact: No type safety for data flowing through realtime subscriptions. Bugs from schema changes will not be caught at compile time.
- Fix approach: Define typed interfaces for messages, appointments, and conversations. Use generics with `RealtimePostgresChangesPayload<T>`.

**Widespread `eslint-disable` Comments:**
- Issue: 18 instances of `eslint-disable-line react-hooks/exhaustive-deps` across the codebase, suppressing dependency warnings in `useEffect` and `useCallback`.
- Files: `src/hooks/use-realtime.ts`, `src/app/(dashboard)/settings/page.tsx`, `src/app/(dashboard)/kpis/page.tsx`, `src/app/(dashboard)/expenses/page.tsx`, `src/app/(dashboard)/ai-chat/page.tsx`, `src/components/settings/theme-picker.tsx`, `src/components/contacts/contacts-list.tsx`, `src/components/inbox/chat-view.tsx`, `src/components/admin/qr-scanner.tsx`, `src/components/onboarding/step-hours.tsx`
- Impact: Possible stale closures and missed re-renders. The `supabase` client reference created per-render in hooks (e.g., `const supabase = createClient()` outside the callback) is intentionally excluded but creates a new reference each render.
- Fix approach: Stabilize the `supabase` client reference (memoize it or move it outside the component). Then remove the eslint-disable comments and fix any remaining dependency issues.

**`select('*')` Overuse:**
- Issue: ~20 queries use `.select('*')` instead of selecting only needed columns.
- Files: `src/hooks/use-realtime.ts` (line 29), `src/app/api/webhooks/waha/route.ts` (lines 56, 88), `src/app/api/waha/connect/route.ts` (line 27), `src/lib/ai/agent-prompt.ts` (lines 229, 234, 239), `src/lib/data/expenses.ts` (lines 92, 100), `src/app/(dashboard)/settings/page.tsx` (lines 685, 690), and others
- Impact: Over-fetching data from Supabase. Minor performance concern now; will worsen as tables grow and add columns.
- Fix approach: Replace `select('*')` with explicit column lists in each query.

**Monolithic Settings Page:**
- Issue: `src/app/(dashboard)/settings/page.tsx` is 874 lines containing 7 sub-components (CollapsibleSection, SaveButton, WorkingHoursSection, ServicesSection, AIStyleSection, CancellationSection, WhatsAppSection) plus the main page component all in a single file.
- Files: `src/app/(dashboard)/settings/page.tsx`
- Impact: Hard to maintain and test. Changes to one section risk breaking another. High cognitive load.
- Fix approach: Extract each section into a separate component file under `src/components/settings/`. The page file should only compose them.

## Known Bugs

**Missing Error Toast in Message Input:**
- Symptoms: When sending a message fails (network error or server 500), the user sees no feedback. The error is silently caught.
- Files: `src/components/inbox/message-input.tsx` (line 42-43)
- Trigger: Send a message when the WAHA session is disconnected or the API is down.
- Workaround: None. The user must check the conversation manually to see if the message appeared.

**AI Agent Books Without Checking Availability:**
- Symptoms: The AI agent's `book_appointment` action in `executeAction()` inserts directly without checking for overlapping appointments or business hours.
- Files: `src/lib/ai/agent-prompt.ts` (lines 140-170)
- Trigger: A customer asks to book at a time that is already taken or outside business hours.
- Workaround: The `getAvailableSlots()` function in `src/lib/data/appointments.ts` correctly checks availability, but `executeAction()` does not call it. The AI prompt instructs the model not to book unavailable times, but this is prompt-level only, not enforced in code.

**`getMonthlyFinancials` Missing `business_id` Filter:**
- Symptoms: The function does not explicitly filter by `business_id`. It relies entirely on Supabase RLS via the user's session token.
- Files: `src/lib/data/expenses.ts` (lines 68-130)
- Trigger: If RLS policies are misconfigured or if the function is ever called with a service client (which bypasses RLS), it would return data from ALL businesses.
- Workaround: Currently safe if RLS is correctly configured. However, this is fragile and inconsistent with other queries that explicitly filter.

**`getAppointmentsByDate` and `getWeekAppointments` Missing `business_id` Filter:**
- Symptoms: Same issue as above. These appointment queries rely entirely on RLS.
- Files: `src/lib/data/appointments.ts` (lines 70-92, 203-229, 234-261)
- Trigger: RLS misconfiguration would expose other businesses' appointment data.
- Workaround: Same as above. RLS must be correctly configured.

## Security Considerations

**No Rate Limiting on Any API Route:**
- Risk: All API endpoints (`/api/messages`, `/api/ai/chat`, `/api/ai/agent`, `/api/contacts`, `/api/appointments`, `/api/webhooks/waha`) have zero rate limiting. The webhook endpoint is particularly vulnerable as it triggers AI calls (OpenRouter API costs).
- Files: All files under `src/app/api/`
- Current mitigation: None.
- Recommendations: Add rate limiting middleware. For the webhook, limit by session/IP. For authenticated routes, limit per-user. Use Vercel's built-in rate limiting or a library like `@upstash/ratelimit`.

**Service Client (Admin Key) Used in Multiple Contexts:**
- Risk: `createServiceClient()` uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses all RLS. It is used in 12+ files including AI agent processing, BI chat, admin pages, webhook handler, and the connect route.
- Files: `src/lib/supabase/service.ts`, and all files listed under the `createServiceClient` grep results above
- Current mitigation: Webhook and AI agent legitimately need service client as they operate without user context. Admin pages use it for cross-business queries.
- Recommendations: Audit each usage. The BI chat (`src/lib/ai/bi-chat.ts`) uses service client for `fetchRelevantData` but receives `businessId` from the authenticated API route -- this is safe but error-prone. Consider creating a scoped service client that always adds a `business_id` filter.

**Contact Search Potentially Vulnerable to SQL-like Injection:**
- Risk: The contact search builds a Supabase filter string using user input directly: `.or(\`name.ilike.%${q}%,phone.ilike.%${q}%\`)`. While Supabase PostgREST parameterizes values, special characters in `q` (like `%`, `_`, or parentheses) could manipulate the filter syntax.
- Files: `src/app/api/contacts/route.ts` (line 30), `src/lib/data/contacts.ts` (line 77)
- Current mitigation: Supabase PostgREST handles parameterization, but the `.or()` filter string format is fragile.
- Recommendations: Sanitize the search term by escaping `%` and `_` characters. Consider using `.ilike()` with explicit column filters instead of `.or()` string interpolation.

**Middleware Allows Unauthenticated Access to API Routes:**
- Risk: The middleware in `src/lib/supabase/middleware.ts` exempts `/api/webhooks` from auth checks (line 36), but it does not protect other API routes at the middleware level -- those rely on per-route auth checks.
- Files: `src/middleware.ts`, `src/lib/supabase/middleware.ts`
- Current mitigation: Each API route handler individually checks authentication. But if a developer adds a new route and forgets the auth check, it will be open.
- Recommendations: Add middleware-level protection for all `/api/*` routes except explicitly exempted paths (`/api/webhooks/*`, `/api/cron/*`). Keep per-route checks as defense-in-depth.

**OpenRouter API Key Used with Non-Null Assertion:**
- Risk: `const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY!` in `src/lib/ai/gemini.ts` (line 7). If the env var is missing, the app will send requests with `undefined` as the Bearer token, potentially leaking error details.
- Files: `src/lib/ai/gemini.ts` (line 7)
- Current mitigation: None.
- Recommendations: Add a startup check or throw a descriptive error if the key is missing.

## Performance Bottlenecks

**AI Agent Loads Full Business Context Per Message:**
- Problem: Every incoming WhatsApp message triggers `processAIAgent()` which runs 4 parallel Supabase queries (business, settings, persona, last 20 messages) plus an OpenRouter API call.
- Files: `src/lib/ai/agent-prompt.ts` (lines 225-248), `src/app/api/webhooks/waha/route.ts` (lines 141-182)
- Cause: Business settings, persona, and business info rarely change but are re-fetched for every single message.
- Improvement path: Cache business context (settings, persona, business info) in memory or Redis with a TTL of 5-10 minutes. Only the message history needs to be fetched per-request.

**BI Chat Makes 3 AI API Calls Per Question:**
- Problem: `processBusinessQuery()` calls AI twice (once for query plan, once for answer generation) plus fetches data. Each AI call has latency of 1-5 seconds.
- Files: `src/lib/ai/bi-chat.ts` (lines 192-215)
- Cause: Two-step approach: plan -> fetch -> answer. The planning step could be eliminated for common queries.
- Improvement path: For known question patterns, skip the planning step and go directly to data fetch + answer. Cache common query plans.

**Health Check Updates Each Phone Sequentially:**
- Problem: The health check loop (`for (const phone of phones)`) issues a DB update for every phone number sequentially, even if nothing changed.
- Files: `src/app/api/cron/health-check/route.ts` (lines 63-120)
- Cause: Sequential loop with individual `update()` calls.
- Improvement path: Batch updates using a single query or `upsert`. Skip the timestamp update if status hasn't changed to reduce DB writes.

**KPIs Page Makes 6 Parallel Queries + AI Insights:**
- Problem: The KPIs page fires 6 Supabase queries on load, then immediately triggers an AI insights API call.
- Files: `src/app/(dashboard)/kpis/page.tsx` (lines 316-367, 445-468)
- Cause: All KPI metrics are computed client-side from raw data.
- Improvement path: Create a server-side KPI computation function or a Supabase RPC that returns pre-computed metrics. Cache results with a short TTL.

## Fragile Areas

**AI Response JSON Parsing:**
- Files: `src/lib/ai/agent-prompt.ts` (lines 276-288), `src/lib/ai/bi-chat.ts` (lines 56-57), `src/lib/ai/style-analyzer.ts` (lines 66-74)
- Why fragile: The AI is instructed to return JSON, but LLMs sometimes wrap responses in markdown fences, add explanatory text, or return malformed JSON. The `replace(/```json\n?|```/g, '')` cleanup is a band-aid.
- Safe modification: Always wrap JSON parsing in try/catch with meaningful fallbacks. Consider using structured output (JSON mode) if the model supports it via OpenRouter.
- Test coverage: None.

**Webhook Message Processing Pipeline:**
- Files: `src/app/api/webhooks/waha/route.ts`
- Why fragile: The webhook handler performs 6+ sequential operations (find business, find/create contact, find/create conversation, save message, update timestamp, run AI, send response, save AI message, save AI log). A failure in any step leaves partial data.
- Safe modification: Changes to the message schema, contact creation logic, or AI response format require careful testing of the full pipeline. The AI error is caught and logged, but contact/conversation creation failures return 500 and stop processing.
- Test coverage: None.

**Registration Multi-Step Flow:**
- Files: `src/lib/auth/register.ts`
- Why fragile: 7 sequential DB inserts. Steps 3-7 do not check error results (`await admin.from(...).insert(...)` without checking the returned error). If the `business_templates` table doesn't have a matching row, the template lookup silently falls back to defaults -- this is handled, but other steps silently fail.
- Safe modification: Must check error return from every insert. Add the rollback mechanism described in Tech Debt above.
- Test coverage: None.

## Scaling Limits

**Supabase Realtime Channels Per Business:**
- Current capacity: Each dashboard user opens 1-3 realtime channels (messages, appointments, conversations).
- Limit: Supabase free/pro plans have channel limits. With 100+ concurrent business users, this could hit limits.
- Scaling path: Consolidate channels (use one channel per business instead of per-conversation). Consider Supabase's broadcast for high-frequency events.

**WAHA Single-Instance Architecture:**
- Current capacity: One WAHA server handles all WhatsApp sessions.
- Limit: WAHA instances have session limits. Each business connects one phone number, so the platform scales linearly with WAHA capacity.
- Scaling path: Deploy multiple WAHA instances behind a load balancer. Route sessions to specific instances based on session ID.

**OpenRouter API Costs Scale With Messages:**
- Current capacity: Every inbound WhatsApp message triggers an AI call.
- Limit: High-volume businesses could generate hundreds of messages per day, each costing AI tokens.
- Scaling path: Add message batching, response caching for identical questions, and configurable AI-off hours.

## Dependencies at Risk

**File Named `gemini.ts` But Uses OpenRouter:**
- Risk: Misleading module name. `src/lib/ai/gemini.ts` uses OpenRouter API (OpenAI-compatible) with configurable models. The file name suggests it is a Gemini-specific client, causing confusion.
- Impact: Developers may create a separate OpenRouter client thinking `gemini.ts` is Gemini-only, leading to duplicate code.
- Migration plan: Rename to `openrouter.ts` or `ai-client.ts`. Update all imports.

**Next.js 16.x (Bleeding Edge):**
- Risk: Next.js 16.1.6 and React 19.2.3 are very recent versions. Community libraries may not yet be fully compatible.
- Impact: Potential breaking changes in minor releases. Limited community support for troubleshooting.
- Migration plan: Monitor Next.js release notes. Pin exact versions in `package.json` rather than using `^`.

## Missing Critical Features

**No Toast/Notification System:**
- Problem: Multiple error handlers have `// TODO: show toast error` comments, and many catch blocks only log to `console.error`.
- Blocks: Users cannot see when operations fail (message sending, settings save, API errors). Silent failures degrade trust.

**No Appointment Reminders:**
- Problem: The reminder scheduling code is entirely placeholder (`console.log` only). No actual notifications are sent.
- Blocks: Key feature for a business management platform. Increases no-show rates.

**No Waitlist Notifications:**
- Problem: When appointments are cancelled, the waitlist check code runs but the actual WhatsApp notification to waitlisted contacts is commented out.
- Files: `src/lib/data/appointments-mutations.ts` (lines 155-172)
- Blocks: Waitlist feature is non-functional from the customer's perspective.

## Test Coverage Gaps

**Zero Test Files:**
- What's not tested: The entire codebase. No test files exist anywhere (`*.test.*`, `*.spec.*`, `__tests__/`). No test framework is installed in `package.json` (no jest, vitest, or testing-library).
- Files: All files under `src/`
- Risk: Every code change is deployed without automated verification. Refactoring is dangerous. Regression bugs are invisible until reported by users.
- Priority: High. At minimum, add tests for:
  1. `src/lib/ai/agent-prompt.ts` -- AI response parsing and action execution
  2. `src/app/api/webhooks/waha/route.ts` -- webhook message processing pipeline
  3. `src/lib/auth/register.ts` -- registration flow
  4. `src/lib/data/appointments.ts` -- availability slot calculation
  5. `src/lib/data/appointments-mutations.ts` -- appointment CRUD operations

---

*Concerns audit: 2026-03-16*
