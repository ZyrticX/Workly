# Technology Stack

**Analysis Date:** 2026-03-16

## Languages

**Primary:**
- TypeScript ^5 - All application code (frontend, API routes, server actions, lib modules)

**Secondary:**
- CSS (Tailwind v4 + custom properties) - Styling via `src/app/globals.css`

## Runtime

**Environment:**
- Node.js (version not pinned; no `.nvmrc` detected)
- Next.js 16.1.6 App Router (server components, server actions, route handlers)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework (App Router, middleware, API routes, server actions)
- React 19.2.3 - UI rendering with server components + client components
- React DOM 19.2.3 - Browser DOM rendering

**Styling:**
- Tailwind CSS ^4 - Utility-first CSS framework (v4 with `@theme inline` syntax)
- PostCSS with `@tailwindcss/postcss` plugin - Build pipeline in `postcss.config.mjs`

**Validation:**
- Zod ^4.3.6 - Runtime schema validation for forms and API inputs
- React Hook Form ^7.71.2 + `@hookform/resolvers` ^5.2.2 - Form state management with Zod integration

**Testing:**
- Not detected - No test framework, test config, or test files present

**Build/Dev:**
- TypeScript ^5 - Type checking; config in `tsconfig.json` (target ES2017, strict mode, bundler resolution)
- ESLint ^9 - Linting with `eslint-config-next` 16.1.6 (core-web-vitals + typescript presets); config in `eslint.config.mjs`
- Next.js built-in dev server (`next dev`)

## Key Dependencies

**Critical:**
- `@supabase/ssr` ^0.9.0 - Server-side Supabase client for Next.js (cookie-based auth)
- `@supabase/supabase-js` ^2.99.2 - Supabase JavaScript client (DB queries, auth, realtime, storage)
- `next` 16.1.6 - Core framework; entire app architecture depends on App Router
- `react` 19.2.3 - React 19 with server components
- `zod` ^4.3.6 - Schema validation used across all forms and API input validation

**UI:**
- `lucide-react` ^0.577.0 - Icon library
- `class-variance-authority` ^0.7.1 - Component variant management (CVA pattern)
- `clsx` ^2.1.1 + `tailwind-merge` ^3.5.0 - Conditional className merging via `cn()` utility at `src/lib/utils/cn.ts`

## Configuration

**Environment:**
- `.env.local` file present (contents not read for security)
- Required env vars validated at startup by `src/lib/env.ts`:
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key
  - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only, bypasses RLS)
  - `OPENROUTER_API_KEY` - OpenRouter API key for AI
  - `WAHA_API_URL` - WAHA WhatsApp API server URL
  - `WAHA_API_KEY` - WAHA API authentication key
- Optional env vars (referenced in code but not in required list):
  - `NEXT_PUBLIC_APP_URL` - Public app URL for webhooks (fallback: `https://auto-crm.org`)
  - `AI_MODEL` - OpenRouter model ID (default: `google/gemini-2.5-flash-preview`)
  - `AI_VISION_MODEL` - OpenRouter vision model (default: `google/gemini-2.5-flash-preview`)
  - `CRON_SECRET` - Bearer token for cron health-check endpoint
  - `TELEGRAM_BOT_TOKEN` - Telegram bot token for health alerts
  - `TELEGRAM_CHAT_ID` - Telegram chat ID for health alerts

**TypeScript:**
- `tsconfig.json`: strict mode, ES2017 target, bundler module resolution
- Path alias: `@/*` maps to `./src/*`

**Build:**
- `next.config.ts` - Currently empty (default Next.js config)
- `postcss.config.mjs` - Tailwind CSS PostCSS plugin
- `eslint.config.mjs` - ESLint 9 flat config with Next.js core-web-vitals + TypeScript presets

## PWA Configuration

**Progressive Web App:**
- Web app manifest at `public/manifest.json`
- Name: "WhatsApp AI Agent", short: "AI Agent"
- Standalone display mode, portrait orientation
- RTL direction, Hebrew language (`lang: "he"`)
- Icons at multiple sizes (72x72 through 512x512)
- Apple Web App capable with meta tags in root layout
- Safe area padding support for notched devices
- Viewport locked: no user scaling, viewport-fit cover

## Font & Localization

**Primary Font:**
- Noto Sans Hebrew (loaded via `next/font/google`)
- Weights: 300, 400, 500, 600, 700
- CSS variable: `--font-noto-sans-hebrew`
- Hebrew + Latin subsets

**RTL Support:**
- Root `<html>` tag: `lang="he" dir="rtl"`
- CSS `direction: rtl` on body
- All UI text in Hebrew (validation messages, labels, error strings)

## Design System

**Color Tokens (CSS Custom Properties + Tailwind v4 theme):**
- Primary: `#25D366` (WhatsApp green), dark `#128C7E`, light `#DCF8E8`
- Surface: `#F7FAF8`, Background: `#FFFFFF`, Border: `#E8EFE9`
- Text: `#1B2E24`, Secondary: `#5A6E62`, Muted: `#8FA89A`
- Status colors: success, warning, danger, info (each with background variant)

**Radii:**
- Card: 16px, Button: 12px, Badge: 8px

**Visual Effects:**
- Glassmorphism classes: `.glass`, `.glass-strong`, `.glass-card`, `.glass-nav`, `.glass-sidebar`
- iOS-style shadows: `.shadow-ios`, `.shadow-ios-lg`
- Gradient mesh background: `.bg-mesh`
- Press effects: `.press-effect:active` (scale 0.97)
- iOS spring transitions: `.transition-ios` (cubic-bezier 0.25, 0.46, 0.45, 0.94)

## Platform Requirements

**Development:**
- Node.js (LTS recommended; no pinned version)
- npm (lockfile present)
- Supabase project with configured tables and RLS
- WAHA server instance for WhatsApp integration
- OpenRouter API key for AI features

**Production:**
- Designed for Vercel deployment (Next.js 16, App Router, server actions)
- Cron capability needed for health-check endpoint (`/api/cron/health-check`)
- WAHA server must be network-accessible for WhatsApp API calls
- Supabase Realtime must be enabled for live message/appointment/conversation updates

---

*Stack analysis: 2026-03-16*
