# Technology Stack

**Analysis Date:** 2026-03-16

## Languages

**Primary:**
- TypeScript ^5 - All application code (frontend, API routes, server actions, data layer)

**Secondary:**
- CSS - Tailwind v4 utility classes via `src/app/globals.css`
- JSON - Configuration manifests (`package.json`, `tsconfig.json`, `public/manifest.json`)

## Runtime

**Environment:**
- Node.js (version not pinned; no `.nvmrc` present)
- Next.js 16.1.6 App Router (React Server Components + Edge-compatible routes)

**Package Manager:**
- npm (inferred from `package-lock.json`)
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack framework (App Router, API routes, middleware, server actions)
- React 19.2.3 - UI rendering
- React DOM 19.2.3 - Browser DOM binding

**Styling:**
- Tailwind CSS ^4 - Utility-first CSS with v4 `@theme inline` configuration in `src/app/globals.css`
- PostCSS with `@tailwindcss/postcss` plugin - configured in `postcss.config.mjs`

**Form Handling:**
- React Hook Form ^7.71.2 - Form state management
- @hookform/resolvers ^5.2.2 - Connects Zod schemas to React Hook Form
- Zod ^4.3.6 - Schema validation (all validation schemas in `src/lib/validations.ts`)

**Build/Dev:**
- ESLint ^9 - Linting with flat config (`eslint.config.mjs`)
- eslint-config-next 16.1.6 - Next.js-specific ESLint rules (core-web-vitals + typescript)
- TypeScript ^5 - Type checking with strict mode enabled

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` ^2.99.2 - Supabase client for database, auth, storage, and realtime
- `@supabase/ssr` ^0.9.0 - Server-side Supabase client with cookie-based session management
- `next` 16.1.6 - Application framework (App Router)
- `react` 19.2.3 - UI library
- `zod` ^4.3.6 - Runtime validation for all form inputs and API payloads

**UI Utilities:**
- `class-variance-authority` ^0.7.1 - Component variant management (CVA)
- `clsx` ^2.1.1 - Conditional class merging
- `tailwind-merge` ^3.5.0 - Tailwind class deduplication (combined with clsx in `src/lib/utils/cn.ts`)
- `lucide-react` ^0.577.0 - Icon library

## Configuration

**TypeScript:**
- `tsconfig.json` - Strict mode, ES2017 target, bundler module resolution
- Path alias: `@/*` maps to `./src/*`
- JSX: react-jsx (automatic runtime)
- Incremental compilation enabled

**ESLint:**
- `eslint.config.mjs` - Flat config format
- Extends: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`

**PostCSS:**
- `postcss.config.mjs` - Single plugin: `@tailwindcss/postcss`

**Next.js:**
- `next.config.ts` - Currently empty (no custom configuration)

**Environment:**
- `.env.local` file present (not read for security)
- Required env vars (identified from code references):
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
  - `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (server-only)
  - `OPENROUTER_API_KEY` - OpenRouter API key for AI
  - `AI_MODEL` - AI model identifier (default: `google/gemini-2.5-flash-preview`)
  - `AI_VISION_MODEL` - Vision AI model (default: `google/gemini-2.5-flash-preview`)
  - `WAHA_API_URL` - WAHA WhatsApp API server URL
  - `WAHA_API_KEY` - WAHA API authentication key
  - `NEXT_PUBLIC_APP_URL` - Public application URL (used for webhook URLs)
  - `CRON_SECRET` - Bearer token for cron endpoint protection
  - `TELEGRAM_BOT_TOKEN` - Telegram bot token for health alerts (optional)
  - `TELEGRAM_CHAT_ID` - Telegram chat ID for health alerts (optional)

## PWA Configuration

**Web App Manifest:**
- `public/manifest.json` - Full PWA manifest
- Display: standalone
- Orientation: portrait
- Direction: RTL (Hebrew-first)
- Language: Hebrew (he)
- Icons: 72x72 through 512x512 in `public/icons/`

**Mobile Optimization:**
- Viewport meta: `width=device-width, initialScale=1, maximumScale=1, userScalable=false`
- Apple Web App capable with status bar styling
- Telephone detection disabled

## Font Configuration

- Google Font: Noto Sans Hebrew
- Subsets: hebrew, latin
- Weights: 300, 400, 500, 600, 700
- CSS variable: `--font-noto-sans-hebrew`
- Display strategy: swap

## Design System

**CSS Custom Properties (defined in `src/app/globals.css`):**
- Primary palette: WhatsApp green (#25D366, #128C7E, #DCF8E8)
- Surface/Background: #F7FAF8 / #FFFFFF
- Text hierarchy: #1B2E24 / #5A6E62 / #8FA89A
- Status colors: success, warning, danger, info (with background variants)
- Border radii: card (16px), button (12px), badge (8px)

**Tailwind v4 Theme:**
- All design tokens exposed via `@theme inline` block in globals.css
- Custom color names match CSS variable names (e.g., `bg-primary`, `text-text-secondary`)

## Platform Requirements

**Development:**
- Node.js (modern LTS recommended, version not pinned)
- npm for package management
- Access to Supabase project (URL + keys)
- WAHA server instance for WhatsApp connectivity
- OpenRouter API key for AI features

**Production:**
- Vercel (implied by Next.js App Router + Vercel Cron references in code comments)
- Self-hosted WAHA server for WhatsApp API
- Supabase hosted instance (database + auth + storage + realtime)
- OpenRouter API access

---

*Stack analysis: 2026-03-16*
