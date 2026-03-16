# Codebase Concerns

**Analysis Date:** 2026-03-16

## Critical Bugs

**BUG-01: Settings page calls non-existent API endpoint `/api/whatsapp/status`**
- Symptoms: WhatsApp status refresh silently fails; status always shows "not connected"
- Files: `src/app/(dashboard)/settings/page.tsx` line 759
- Trigger: User opens Settings page or clicks "Refresh Status"
- The code calls `fetch('/api/whatsapp/status?businessId=${businessId}')` but no such route exists. The actual routes are `/api/waha/connect` (POST) and `/api/waha/qr` (GET). There is no GET status endpoint at all.
- Fix approach: Create `src/app/api/whatsapp/status/route.ts` that queries `phone_numbers` table for the business, or change the settings page to call the existing `/api/waha/qr` endpoint with the session name.

**BUG-02: KPIs page calls non-existent API endpoint `/api/ai/insights`**
- Symptoms: AI insights section on KPIs page silently fails; insights never load
- Files: `src/app/(dashboard)/kpis/page.tsx` line 450
- Trigger: User opens KPIs page, `loadInsights` fires
- The code calls `fetch('/api/ai/insights', ...)` but no such route exists under `src/app/api/ai/`. Only `agent`, `chat`, and `onboarding-chat` exist.
- Fix approach: Create `src/app/api/ai/insights/route.ts` that takes business KPIs and generates AI insights via the existing `generateResponse` function.

**BUG-03: AI Chat page calls non-existent API endpoint `/api/ai/chat/action`**
- Symptoms: Action buttons in AI chat responses silently fail when clicked
- Files: `src/app/(dashboard)/ai-chat/page.tsx` line 174
- Trigger: User clicks an action button rendered in an AI chat response
- The code calls `fetch('/api/ai/chat/action', ...)` but no such route exists. Only `/api/ai/chat` exists.
- Fix approach: Create `src/app/api/ai/chat/action/route.ts` or remove the action button functionality.

**BUG-04: Contact detail page calls API with wrong query parameter**
- Symptoms: Contact detail page fails to load contact data; shows "Contact not found"
- Files: `src/components/contacts/contact-detail.tsx` line 96
- Trigger: User navigates to `/contacts/[id]`
- The component calls `fetch('/api/contacts?id=${contactId}')` expecting the API to return `{ contact }`, but the `GET /api/contacts` handler in `src/app/api/contacts/route.ts` does not handle an `id` query parameter at all. It only supports `q`, `status`, `sort`, `page`, `limit` parameters and returns `{ contacts, total, page, limit, totalPages }`.
- Similarly, line 108 calls `fetch('/api/appointments?contactId=${contactId}')` but `GET /api/appointments` does not handle `contactId` parameter either, only `startDate` and `endDate`.
- Fix approach: Add `id` support to the contacts API route and `contactId` support to the appointments API route. Or create separate routes like `/api/contacts/[id]/route.ts`.

**BUG-05: Contact form edit mode calls PATCH on contacts API, but PATCH is not implemented**
- Symptoms: Editing a contact fails with 405 Method Not Allowed
- Files: `src/components/contacts/contact-form.tsx` line 62-63
- Trigger: User clicks "Edit" on a contact detail page, then submits the form
- The code sends `method: 'PATCH'` to `/api/contacts?id=...` but `src/app/api/contacts/route.ts` only exports `GET` and `POST` handlers. There is no `PATCH` or `PUT` handler.
- Fix approach: Add a `PATCH` export to `src/app/api/contacts/route.ts`.

**BUG-06: Calendar `Appointment` type mismatch -- `contact_name` field does not exist in API response**
- Symptoms: Calendar shows "undefined" or empty string for contact names
- Files: `src/components/calendar/calendar-view.tsx` line 13, `src/components/calendar/appointment-block.tsx` line 57/76
- Trigger: Calendar renders appointment blocks
- The `Appointment` interface in `calendar-view.tsx` defines `contact_name: string`, but the API response from `GET /api/appointments` returns appointments joined with `contacts(name, phone)` -- so the contact name is at `appointment.contacts.name`, not `appointment.contact_name`. The `AppointmentBlock` component references `appointment.contact_name` which will be undefined.
- Fix approach: Either transform the API response to flatten `contacts.name` into `contact_name`, or update the type and component to use `contacts?.name`.

**BUG-07: `getConversations` fetches ALL messages for each conversation**
- Symptoms: Slow inbox loading, high Supabase bandwidth usage
- Files: `src/lib/data/messages.ts` lines 66-71
- Trigger: Every time the inbox page loads
- The query joins `messages ( content, created_at, direction, sender_type )` without any limit, fetching ALL messages for every conversation. Then line 90-100 sorts them client-side to pick only the last one. For conversations with hundreds of messages, this is extremely wasteful.
- Fix approach: Use a Supabase RPC or a subquery approach to fetch only the latest message per conversation. Alternatively, use `.order('created_at', { referencedTable: 'messages', ascending: false }).limit(1, { referencedTable: 'messages' })` if supported.

**BUG-08: `onboarding_progress.is_completed` never set to `true` via `onboarding-actions.ts`**
- Symptoms: Users who complete manual onboarding get redirected back to `/onboarding` on every page visit
- Files: `src/lib/auth/onboarding-actions.ts` line 29
- Trigger: User completes step 9 via manual onboarding wizard
- The `updateOnboardingStep` function sets `completed_at` when `step >= 9` but never sets `is_completed: true`. The middleware at `src/lib/supabase/middleware.ts` line 67 checks `onboarding.is_completed`, which will remain `false/null`. The `completeOnboarding` function at line 80 updates `businesses.status` to `'active'` and calls `updateOnboardingStep(businessId, 9, ...)` but that call ALSO does not set `is_completed`.
- The AI onboarding path in `src/lib/auth/save-onboarding.ts` ALSO does not set `is_completed: true` in its upsert at line 97.
- Fix approach: Add `is_completed: true` to the onboarding progress update in both `onboarding-actions.ts` line 29 and `save-onboarding.ts` line 100.

**BUG-09: Onboarding test message calls non-existent `/api/waha/send-test` endpoint**
- Symptoms: "Send test message" button on onboarding step 7 fails silently
- Files: `src/app/onboarding/page.tsx` line 180
- Trigger: User enters phone number and clicks "Send test message" during manual onboarding
- No route exists at `src/app/api/waha/send-test/`. Only `connect` and `qr` exist.
- Fix approach: Create the route, or use the existing message sending infrastructure via `/api/messages`.

**BUG-10: `save-onboarding.ts` saves `working_hours` as an array but `appointments.ts` expects a Record keyed by day number**
- Symptoms: Available time slots calculation fails for AI-onboarded businesses; booking via AI agent may silently skip slot validation
- Files: `src/lib/auth/save-onboarding.ts` line 56, `src/lib/data/appointments.ts` lines 171-172
- Trigger: Business completes onboarding via AI chat, then a customer tries to book an appointment
- The AI onboarding saves `workingHours` as an array of objects with `{day, dayHe, active, start, end}`, but `getAvailableSlots` in `appointments.ts` expects `working_hours` to be a `Record<string, WorkingDay>` keyed by day-of-week number (e.g., `{"0": {active: true, start: "09:00", end: "19:00"}}`). Accessing `workingHours[String(dayOfWeek)]` on an array will return `undefined`.
- Fix approach: Transform the array format into the Record format before saving in `save-onboarding.ts`, or handle both formats in `getAvailableSlots`.

**BUG-11: `save-onboarding.ts` writes `custom_instructions` to `ai_personas` but `agent-prompt.ts` reads `system_prompt`**
- Symptoms: AI agent for businesses onboarded via AI chat uses no custom system prompt; the persona prompt is empty
- Files: `src/lib/auth/save-onboarding.ts` line 88 vs `src/lib/ai/agent-prompt.ts` line 65
- The save function writes `custom_instructions` to the `ai_personas` table, but `buildSystemPrompt` in `agent-prompt.ts` reads `pers.system_prompt` and `pers.style_examples`. The `custom_instructions` field is never read by the AI agent.
- Fix approach: Either save to `system_prompt` column instead of `custom_instructions`, or update `buildSystemPrompt` to also use `custom_instructions`.

## Tech Debt

**Duplicate `Contact` type definitions across multiple files**
- Issue: The `Contact` interface is defined independently in at least 3 files with subtle differences
- Files: `src/types/database.ts` line 11, `src/lib/data/contacts.ts` line 7, `src/lib/data/contacts-mutations.ts` line 17
- Impact: Changes to the database schema require updates in multiple places; easy to miss one
- Fix approach: Define `Contact` once in `src/types/database.ts` and import everywhere else

**Duplicate `AppointmentWithContact` type definitions**
- Issue: Defined separately in `src/lib/data/appointments.ts` line 7 and `src/lib/data/dashboard.ts` line 7 with different shapes (dashboard version has `phone: string` in contacts, appointments version has `phone: string, status: string`)
- Files: `src/lib/data/appointments.ts`, `src/lib/data/dashboard.ts`
- Impact: Type inconsistencies when passing data between modules
- Fix approach: Consolidate into a single shared type

**Repeated business_id resolution pattern**
- Issue: Almost every API route and data function repeats the same 8-line pattern to resolve `business_id` from the authenticated user via `business_users` table
- Files: Every file in `src/app/api/`, `src/lib/data/`, `src/app/(dashboard)/page.tsx`
- Impact: Massive code duplication; if the pattern changes, dozens of files need updating
- Fix approach: Create a shared utility like `getBusinessId(supabase)` that encapsulates the auth check and business resolution

**No Zod validation on API route inputs**
- Issue: The Zod schemas in `src/lib/validations.ts` exist but are only used client-side in forms. API routes parse `req.json()` and trust the raw data without validation.
- Files: `src/app/api/contacts/route.ts`, `src/app/api/appointments/route.ts`, `src/app/api/messages/route.ts`
- Impact: Malformed requests bypass validation; potential for invalid data in database
- Fix approach: Apply Zod schemas in API route handlers before database operations

**Module-level Supabase client singletons in client components**
- Issue: Several components create Supabase clients at module scope (`const supabase = createClient()` outside component). While intentional for performance, this means the client is created once during module evaluation, potentially before auth state is ready.
- Files: `src/hooks/use-auth.ts` line 7, `src/hooks/use-realtime.ts` line 10, `src/components/inbox/chat-view.tsx` line 13, `src/components/ui/theme-provider.tsx` line 6, `src/components/settings/theme-picker.tsx` line 107
- Impact: Could cause stale auth state issues in edge cases
- Fix approach: Acceptable pattern for browser client, but document the convention

**TODO: Reminder system not implemented**
- Issue: Appointment reminders are logged to console but never actually sent
- Files: `src/lib/data/appointments-mutations.ts` lines 73-83, 219-233
- Impact: Customers never receive reminder messages before appointments; higher no-show rates
- Fix approach: Implement BullMQ or use Supabase Edge Functions with `pg_cron` for scheduled reminders

**TODO: Waitlist notification not implemented**
- Issue: When appointments are cancelled, waitlisted contacts are marked as "offered" in the DB but never actually notified
- Files: `src/lib/data/appointments-mutations.ts` lines 148-173
- Impact: Waitlist feature is non-functional; freed slots are never communicated to waiting customers
- Fix approach: Implement WhatsApp message sending for waitlist notifications

## Security Considerations

**Admin access controlled by hardcoded email list**
- Risk: Adding/removing admin users requires a code deploy
- Files: `src/app/admin/layout.tsx` lines 5-9
- Current mitigation: Server-side check prevents unauthorized access
- Recommendations: Move admin email list to database or environment variable; add role-based access control

**Webhook authentication uses shared API key**
- Risk: If WAHA_API_KEY is leaked, anyone can send fake webhook events and inject messages/create contacts
- Files: `src/app/api/webhooks/waha/route.ts` lines 11-16
- Current mitigation: Key comparison in request header
- Recommendations: Add request signature verification; implement IP allowlisting for webhook sources; add rate limiting

**Service role key used in webhook handler and multiple server actions**
- Risk: Service role bypasses all RLS policies; a bug in any function using it could expose cross-tenant data
- Files: `src/lib/supabase/service.ts`, `src/app/api/webhooks/waha/route.ts`, `src/lib/ai/agent-prompt.ts`, `src/lib/ai/bi-chat.ts`, `src/lib/auth/register.ts`, `src/lib/auth/onboarding-actions.ts`, `src/lib/auth/save-onboarding.ts`
- Current mitigation: Used only in server-side code; always scoped by business_id in queries
- Recommendations: Minimize service client usage; add explicit business_id assertions before writes

**No CSRF protection on API routes**
- Risk: API routes accept POST without CSRF tokens; vulnerable to cross-site request forgery
- Files: All `src/app/api/*/route.ts` files
- Current mitigation: Supabase auth cookies provide some protection
- Recommendations: Next.js 16 may handle this via SameSite cookies; verify cookie settings

**BI Chat sends raw business data to AI model**
- Risk: Business data (contacts, appointments, expenses) is sent to external AI provider (OpenRouter/Gemini)
- Files: `src/lib/ai/bi-chat.ts` lines 174-188
- Current mitigation: Content is stripped (message content excluded); limited to 50 rows per table
- Recommendations: Add data anonymization; consider on-premise AI option for sensitive businesses; document data processing in privacy policy

**No rate limiting on AI endpoints**
- Risk: Abuse of `/api/ai/chat`, `/api/ai/agent`, `/api/ai/onboarding-chat` could run up OpenRouter bills
- Files: `src/app/api/ai/chat/route.ts`, `src/app/api/ai/agent/route.ts`, `src/app/api/ai/onboarding-chat/route.ts`
- Current mitigation: Auth required (user must be logged in)
- Recommendations: Add per-user rate limiting; add monthly token usage tracking per business

## Performance Bottlenecks

**Inbox loads ALL messages for ALL conversations**
- Problem: As described in BUG-07, the conversations query joins all messages without a limit
- Files: `src/lib/data/messages.ts` lines 66-71
- Cause: Supabase join fetches complete related records
- Improvement path: Use a database view or RPC that returns only the latest message per conversation

**Middleware makes 2-3 database queries on EVERY page navigation**
- Problem: On every request, middleware calls `getUser()`, then `business_users`, then `onboarding_progress`
- Files: `src/lib/supabase/middleware.ts` lines 35, 47-51, 60-63
- Cause: No caching of auth/business state
- Improvement path: Cache the onboarding completion status in a cookie or JWT claim after first check; skip onboarding check if a "completed" flag is set

**ThemeProvider makes 3 sequential Supabase queries on every page load**
- Problem: `getUser()` -> `business_users` -> `business_settings` runs on every page load to apply theme colors
- Files: `src/components/ui/theme-provider.tsx` lines 29-52
- Cause: Theme loaded client-side on mount
- Improvement path: Store theme in a cookie or localStorage after first load; only re-query when settings change

**Dashboard page makes 6 parallel database queries**
- Problem: Each dashboard load triggers 6 separate Supabase queries (business name, today appointments, monthly revenue, new contacts, cancelled count, total count)
- Files: `src/app/(dashboard)/page.tsx` lines 26-57
- Cause: No aggregation/caching layer
- Improvement path: Create a Supabase RPC that returns all dashboard metrics in a single call; add ISR or client-side caching

**KPIs page makes 6 parallel database queries**
- Problem: Similar to dashboard; 6 queries for revenue, expenses, cancellations, new clients, total appointments, and goals
- Files: `src/app/(dashboard)/kpis/page.tsx` lines 316-367
- Cause: No aggregation layer
- Improvement path: Same as dashboard; consider precomputed KPI snapshots

## Fragile Areas

**Onboarding system with two divergent paths**
- Files: `src/app/onboarding/page.tsx`, `src/components/onboarding/ai-onboarding-chat.tsx`, `src/lib/auth/save-onboarding.ts`, `src/lib/auth/onboarding-actions.ts`, `src/lib/data/onboarding.ts`
- Why fragile: Three different files handle onboarding completion (`save-onboarding.ts` for AI path, `onboarding-actions.ts` for manual path, `onboarding.ts` for step-by-step updates). Each saves data in slightly different formats (array vs Record for working hours, `custom_instructions` vs `system_prompt` for AI persona). The `is_completed` flag is not consistently set.
- Safe modification: Test both AI and manual onboarding flows end-to-end after any change. Verify the middleware redirect works correctly after completion.
- Test coverage: None

**AI Agent response parsing**
- Files: `src/lib/ai/agent-prompt.ts` lines 293-306
- Why fragile: The AI is instructed to return JSON, but if the model returns invalid JSON (which happens regularly with LLMs), the fallback at line 299 treats the entire raw text as the response. This means booking/cancellation actions embedded in the JSON will silently not execute, while raw AI text gets sent to the customer.
- Safe modification: Add better JSON extraction (try regex for JSON blocks within text); add logging when JSON parsing fails
- Test coverage: None

**Working hours format consumed by multiple modules**
- Files: `src/lib/data/appointments.ts`, `src/lib/auth/register.ts`, `src/lib/auth/save-onboarding.ts`, `src/lib/auth/onboarding-actions.ts`, `src/app/(dashboard)/settings/page.tsx`
- Why fragile: Working hours are stored as JSON in `business_settings.working_hours` but different code paths write different formats (Record vs Array). Any module reading working hours must handle both formats.
- Safe modification: Standardize on one format; add a migration to normalize existing data
- Test coverage: None

**Realtime subscriptions without cleanup verification**
- Files: `src/hooks/use-realtime.ts`
- Why fragile: Multiple realtime channels subscribe to Postgres changes. If channels are not properly cleaned up (e.g., due to rapid navigation), stale subscriptions accumulate. The hook does call `supabase.removeChannel(channel)` in cleanup, but race conditions are possible if `conversationId` or `businessId` changes rapidly.
- Safe modification: Add subscription counting/logging in development mode
- Test coverage: None

## Missing Critical Features

**No message sending from contacts page**
- Problem: Contact detail page has a "Send message" button that does nothing (no onClick handler)
- Files: `src/components/contacts/contact-detail.tsx` line 222
- Blocks: Business owners cannot initiate conversations with contacts from the CRM

**No logout on mobile**
- Problem: The logout button only exists in the desktop sidebar (`src/components/ui/sidebar.tsx` lines 113-126). The mobile bottom nav (`src/components/ui/bottom-nav.tsx`) has no logout option.
- Files: `src/components/ui/bottom-nav.tsx`
- Blocks: Mobile users cannot log out

**Reports page is a placeholder**
- Problem: The reports page shows "Reports will be available after first month" with no actual implementation
- Files: `src/app/(dashboard)/reports/page.tsx`
- Blocks: No business reporting functionality

**Conversations tab on contact detail is a placeholder**
- Problem: Shows "Conversation history will appear here" with no actual data
- Files: `src/components/contacts/contact-detail.tsx` lines 305-308
- Blocks: Cannot see conversation history for a specific contact

## Test Coverage Gaps

**Zero test files in the entire codebase**
- What's not tested: Everything. There are no test files, no test configuration, no test runner configured.
- Files: No `*.test.*` or `*.spec.*` files exist. No `jest.config.*` or `vitest.config.*` files exist.
- Risk: Any code change could introduce regressions with no automated detection. The numerous bugs documented above would have been caught by basic integration tests.
- Priority: High -- at minimum, add tests for: API route handlers, onboarding data saving, AI response parsing, working hours format handling, and appointment slot calculation.

## Dependencies at Risk

**Zod v4 (beta/early release)**
- Risk: `zod@^4.3.6` in `package.json` -- Zod v4 is a major version with breaking changes from v3. Some ecosystem packages (like older `@hookform/resolvers`) may not fully support it.
- Impact: Form validation could break with resolver incompatibilities
- Migration plan: Monitor Zod v4 stability; ensure `@hookform/resolvers@^5.2.2` is fully compatible

**Next.js 16 (bleeding edge)**
- Risk: `next@16.1.6` is very recent; community packages and documentation may lag behind
- Impact: Potential for undiscovered bugs in the framework itself
- Migration plan: Keep monitoring Next.js release notes; pin to known stable versions if issues arise

## Scaling Limits

**Single WAHA session per business**
- Current capacity: Each business can only have 1 connected WhatsApp number
- Limit: Businesses with multiple phone numbers or high message volume cannot scale
- Scaling path: Support multiple phone_numbers per business; implement session load balancing

**50-row limit on BI chat data fetching**
- Current capacity: AI analysis is limited to 50 rows per table per query
- Limit: Businesses with large datasets get incomplete analytics
- Scaling path: Implement aggregation RPCs in Supabase; pre-compute common metrics

---

*Concerns audit: 2026-03-16*
