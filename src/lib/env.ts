// Validate required environment variables on startup
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENROUTER_API_KEY',
  'WAHA_API_URL',
  'WAHA_API_KEY',
]

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[ENV] Missing required: ${key}`)
  }
}
