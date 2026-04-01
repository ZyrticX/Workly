# Database Migrations

Migrations are applied via Supabase MCP tools (`mcp__supabase__apply_migration`).
This directory tracks applied migrations for reference.

## Workflow

1. Write SQL migration
2. Apply via MCP: `apply_migration(name, query)`
3. Verify with `list_migrations` or `execute_sql`
4. Record in MIGRATIONS.md

## Applied Migrations

See `../MIGRATIONS.md` for the full list with timestamps.
