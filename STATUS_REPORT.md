# Workly — תמונת מצב מלאה
### 29 מרץ 2026

---

## 1. מבנה הפרויקט

```
wa-agent-platform/
├── src/
│   ├── app/                          ← Pages + API Routes (Next.js App Router)
│   │   ├── (auth)/                   ← Login, Register
│   │   ├── (dashboard)/              ← Dashboard, Inbox, Calendar, Contacts, Settings, etc.
│   │   ├── admin/                    ← Admin panel (businesses, users, phones, tickets, logs)
│   │   ├── admin-login/              ← Separate admin login
│   │   ├── onboarding/               ← Onboarding wizard (AI chat + manual)
│   │   ├── terms/                    ← Terms of Service + digital signature
│   │   ├── api/
│   │   │   ├── webhooks/waha/        ← WhatsApp webhook handler (main entry point)
│   │   │   ├── ai/                   ← AI chat, onboarding-chat, agent, insights
│   │   │   ├── admin/                ← Admin APIs (create-business, tickets, reset-password, phone-action)
│   │   │   ├── appointments/         ← CRUD appointments
│   │   │   ├── contacts/             ← CRUD contacts
│   │   │   ├── messages/             ← Manual message sending
│   │   │   ├── notifications/        ← Notification polling
│   │   │   ├── cron/                 ← Auto-complete, health-check
│   │   │   ├── tos/                  ← Terms of Service API
│   │   │   ├── train-ai/             ← AI training wizard API
│   │   │   ├── waha/                 ← QR, connect, send-test
│   │   │   └── whatsapp/             ← WhatsApp status
│   │   └── layout.tsx, middleware.ts
│   │
│   ├── components/                   ← React Components
│   │   ├── admin/                    ← Admin sidebar, stat cards, business detail, QR scanner
│   │   ├── calendar/                 ← Calendar views, appointment blocks, new appointment
│   │   ├── contacts/                 ← Contact list, cards, forms
│   │   ├── dashboard/                ← Stat cards, AI chat bubble, expense form
│   │   ├── inbox/                    ← Conversation list, chat view, bubbles, bot toggle
│   │   ├── onboarding/              ← AI onboarding chat, step components
│   │   ├── settings/                ← Theme picker
│   │   └── ui/                      ← Bottom nav, sidebar, mobile header, toast, error boundary, etc.
│   │
│   ├── hooks/                        ← Custom Hooks
│   │   ├── use-auth.ts              ← Auth context (user, businessId, businessName)
│   │   ├── use-realtime.ts          ← Supabase realtime subscriptions
│   │   ├── use-theme.ts            ← Theme/color management
│   │   └── use-toast.ts            ← Toast notifications
│   │
│   ├── lib/                          ← Business Logic
│   │   ├── ai/                      ← AI Engine (6 modules after refactor)
│   │   │   ├── agent-prompt.ts      ← RE-EXPORTS ONLY (backward compat)
│   │   │   ├── agent-processor.ts   ← Main orchestrator (607 lines)
│   │   │   ├── action-executor.ts   ← Booking/cancel/reschedule actions (452 lines)
│   │   │   ├── prompt-builder.ts    ← System prompt construction (297 lines)
│   │   │   ├── personality.ts       ← Business-type personalities (128 lines)
│   │   │   ├── types.ts             ← Interfaces (46 lines)
│   │   │   ├── error-messages.ts    ← Error constants (22 lines)
│   │   │   ├── booking-state.ts     ← State machine (550 lines)
│   │   │   ├── ai-client.ts        ← OpenRouter API client
│   │   │   └── bi-chat.ts          ← Business Intelligence chat
│   │   ├── auth/                    ← Registration, onboarding, admin guard
│   │   ├── data/                    ← Data layer (appointments, contacts, expenses, etc.)
│   │   ├── supabase/                ← Client, server, service, middleware
│   │   ├── waha/                    ← WAHA client + provider
│   │   └── utils/                   ← Hebrew calendar, error logger, cn()
│   │
│   └── types/                       ← TypeScript types
│
├── public/                           ← Static assets (logo, icons, manifest)
├── .env.local                        ← Environment variables (NOT in git)
├── package.json                      ← Dependencies
├── PROJECT_SUMMARY.md               ← Full project documentation
└── STATUS_REPORT.md                 ← This file
```

**סטטיסטיקות:**
- **143 קבצי TypeScript/TSX**
- **26,784 שורות קוד**
- **76 commits**

---

## 2. סטטוס הקוד

### ✅ עובד (Production)
| רכיב | סטטוס |
|-------|--------|
| WhatsApp Bot (WAHA webhook → AI → response) | ✅ פעיל |
| State Machine (booking flow: service→name→date→time→confirm) | ✅ פעיל |
| Dashboard (stats, appointments, notifications) | ✅ פעיל |
| Calendar (daily/weekly/monthly views + appointment management) | ✅ פעיל |
| Inbox (conversations + manual messaging) | ✅ פעיל |
| Contacts CRM (auto-create, name learning, gender detection) | ✅ פעיל |
| Settings (business info, hours, services, AI style, holidays, WhatsApp) | ✅ פעיל |
| Admin Panel (businesses, users, phones, tickets, logs) | ✅ פעיל |
| Onboarding (AI chat + manual wizard) | ✅ פעיל |
| Train AI Wizard (5-step advanced config) | ✅ פעיל |
| AI Chat (BI queries + appointment booking + contact management) | ✅ פעיל |
| Terms of Service (digital signature, mandatory acceptance) | ✅ פעיל |
| Error Logging (DB + WhatsApp alerts to admin) | ✅ פעיל |
| Auto-complete (past appointments → completed + revenue update) | ✅ פעיל |
| Typing indicator (natural delay before bot responds) | ✅ פעיל |
| WhatsApp name auto-import + Hebrew transliteration | ✅ פעיל |
| Phone-based contact dedup (prevents duplicates) | ✅ פעיל |
| Business personality engine (per business type) | ✅ פעיל |
| Hebrew holidays + business-specific closed days | ✅ פעיל |

### ⚠️ בפיתוח / דורש שיפור
| רכיב | סטטוס |
|-------|--------|
| Date extraction accuracy | ⚠️ שופר משמעותית, דורש ניטור |
| Availability check reliability | ⚠️ תוקן, דורש אימות בשטח |
| Manual message sending from inbox | ⚠️ LID format issues possible |
| Expense tracking | ⚠️ UI קיים, לא נבדק בשטח |
| KPIs page | ⚠️ UI קיים, נתונים תלויים ב-auto-complete |

### ❌ לא מומש / חסר
| רכיב | סטטוס |
|-------|--------|
| Redis caching | ❌ לא מותקן (כל הודעה = 5 DB queries) |
| Automated tests | ❌ אין tests |
| CI/CD pipeline | ❌ Manual deploy via git push |
| Payment integration (Tranzila) | ❌ Placeholder only |
| SMS reminders | ❌ לא מומש |
| Logo upload in settings | ❌ Field exists, upload not implemented |
| Reports page | ❌ Placeholder page |

---

## 3. תלויות

### NPM Dependencies
| Package | Purpose |
|---------|---------|
| next 16.1.6 | Framework (App Router, SSR, API routes) |
| react 19 | UI rendering |
| @supabase/ssr + @supabase/supabase-js | Database, Auth, Realtime, Storage |
| zod 4 | Schema validation |
| react-hook-form 7 | Form management |
| lucide-react | Icons |
| tailwind-merge + clsx | CSS utilities |

### External Services
| Service | Purpose | Status |
|---------|---------|--------|
| **Supabase** (mllcmnkogcmbbivekmxl) | PostgreSQL DB, Auth, Realtime | ✅ Active |
| **OpenRouter** (openai/gpt-4.1-mini) | AI model for bot responses | ✅ Active |
| **WAHA Plus** (Docker, port 3000) | WhatsApp Web API bridge | ✅ Active |
| **Redis** (Docker, port 6379) | Cache (installed, not used by app) | ⚠️ Idle |
| **Hetzner VPS** (144.91.108.83) | Server hosting | ✅ Active |
| **Nginx** | Reverse proxy + SSL | ✅ Active |
| **PM2** | Process manager | ✅ Active |
| **Let's Encrypt** | SSL certificates | ✅ Active |
| **GitHub** (ZyrticX/Workly) | Source control | ✅ Active |

### Domains
| Domain | Points to |
|--------|-----------|
| auto-crm.org | Next.js app (port 3001) |
| waha.auto-crm.org | WAHA dashboard (port 3000) |

---

## 4. Database Schema

### 25 Application Tables
| Table | Rows | Purpose |
|-------|------|---------|
| businesses | 6 | Top-level tenant |
| business_users | 6 | User-business mapping |
| business_settings | 6 | Services, hours, holidays, AI config |
| business_templates | 4 | Default templates per type |
| ai_personas | 6 | AI personality per business |
| contacts | 39 | CRM contacts |
| conversations | 24 | Chat threads |
| messages | 648 | Individual messages |
| appointments | 65 | Booked appointments |
| notifications | 93 | In-app notifications |
| ai_conversation_logs | 290 | AI response audit trail |
| ai_chat_history | 10 | BI chat Q&A history |
| phone_numbers | 4 | WAHA session tracking |
| onboarding_progress | 6 | Onboarding state |
| billing_accounts | 6 | Subscription info |
| error_logs | 0 | Error tracking |
| admin_tickets | 1 | Feedback/bug reports |
| admin_notifications | 0 | Admin-targeted alerts |
| tos_acceptances | 2 | Terms of Service signatures |
| waitlist | 0 | Appointment waitlist |
| expenses | 0 | One-time expenses |
| recurring_expenses | 0 | Recurring expenses |
| kpi_goals | 0 | KPI targets |
| kpi_snapshots | 0 | KPI periodic snapshots |
| webhook_logs | 0 | Raw webhook payloads |

### Key Indexes (13)
- phone_numbers(session_id), appointments(business_id, start_time), contacts(business_id), contacts(wa_id), conversations(business_id, contact_id), messages(conversation_id, created_at), + more

### RPC Functions
- `book_appointment_atomic` — Advisory lock + conflict check + insert (prevents double booking)
- `increment_contact_visits` — Atomic visit counter update

---

## 5. WAHA Sessions
| Session | Business | Status |
|---------|----------|--------|
| biz_46d05e44 | שמואל (רו"ח) | ✅ WORKING |
| biz_577a87d9 | אלעד מילס (מספרה) | ✅ WORKING |
| biz_3eb8a555 | מספרה טסט | ❌ FAILED |

---

## 6. Server Health
- **App:** online, 68MB RAM, 6,402 restarts
- **WAHA:** Up 12 days (Docker)
- **Redis:** Up 12 days (Docker, idle)
- **Disk:** 6% used (8.6GB / 145GB)
- **RAM:** 1.4GB / 7.8GB

---

## 7. בעיות פתוחות

### קריטי
| # | בעיה | סטטוס |
|---|------|-------|
| 1 | AI extraction לפעמים מחזיר תאריכים שגויים | שופר, דורש ניטור |
| 2 | 6,402 restarts (PM2) — מצביע על crashes חוזרים | דורש חקירה |

### חשוב
| # | בעיה |
|---|------|
| 3 | אין Redis cache — כל הודעה = 5+ DB queries |
| 4 | אין automated tests |
| 5 | Settings page = 1,137 שורות (mega-component) |
| 6 | 15 שימושים ב-`any` types |
| 7 | אין circuit breaker ל-OpenRouter (אם AI down, כל הבוטים down) |
| 8 | Reports page — placeholder בלבד |
| 9 | Logo upload — שדה קיים, upload לא מומש |
| 10 | biz_3eb8a555 WAHA session FAILED — צריך reconnect |

### נמוך
| # | בעיה |
|---|------|
| 11 | Webhook secret אופציונלי (WAHA_WEBHOOK_SECRET) |
| 12 | Admin notifications table empty — צריך לחבר ל-UI |
| 13 | Expense/KPI pages לא נבדקו עם נתונים אמיתיים |

---

## 8. מה הושלם (Timeline)

| תאריך | Milestone |
|--------|-----------|
| 16-18.3 | MVP: בניית כל הקוד, DB, WAHA, Deploy |
| 19-22.3 | באגים: Timezone, double booking, working hours, wa_id |
| 23-24.3 | UX: Responsive, toggles, dashboard enhancements |
| 25.3 | Admin panel: businesses, users, phones, tickets |
| 25-26.3 | Function calling: state machine, availability check, atomic booking |
| 26.3 | Business personality engine, gender detection, linked contacts |
| 27.3 | Code audit, indexes, module split (1,543→6 files) |
| 28.3 | Hebrew calendar, holidays settings |
| 29.3 | Date extraction fix, service auto-select, error logging, TOS, typing indicator, name transliteration |

---

## 9. צעד הבא המומלץ

### שבוע 1 (דחוף)
1. **חקור 6,402 PM2 restarts** — `pm2 logs --err` לזהות crashes
2. **הוסף Redis cache** — business settings + 1-hour TTL
3. **נטר date extraction** — log כל extraction ובדוק דיוק

### שבוע 2
4. **כתוב tests** — booking flow E2E, webhook handling
5. **פרק settings page** — 1,137 שורות → sub-components
6. **הסר `any` types** — 15 מקומות

### שבוע 3
7. **Circuit breaker** ל-OpenRouter — graceful degradation
8. **Reports page** — מימוש אמיתי
9. **CI/CD** — GitHub Actions → auto deploy

---

## 10. Admin Access

| Role | URL | Credentials |
|------|-----|-------------|
| Admin | https://auto-crm.org/admin-login | workly@admin.com / workly1233 |
| Admin | https://auto-crm.org/admin-login | evgeniyphotos1@gmail.com / Orel1721 |
| WAHA | https://waha.auto-crm.org/dashboard | admin / AutoCRM2026 |
| Server | ssh root@144.91.108.83 | SSH key at /tmp/server_key |
| GitHub | https://github.com/ZyrticX/Workly | — |
