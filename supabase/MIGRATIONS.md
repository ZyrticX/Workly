# Applied Migrations

| Version | Name | Description |
|---------|------|-------------|
| 20260316141109 | create_core_business_tables | Core business, contacts, notifications tables |
| 20260316141111 | create_whatsapp_phone_numbers | WhatsApp phone numbers table |
| 20260316141114 | create_messaging_tables | Conversations and messages tables |
| 20260316141116 | create_appointments_tables | Appointments and waitlist tables |
| 20260316141119 | create_ai_tables | AI personas and training data tables |
| 20260316141123 | create_expenses_kpi_tables | Expenses and KPI tables |
| 20260316141126 | create_onboarding_billing_log_tables | Onboarding, billing, error logs tables |
| 20260316141139 | create_indexes | Initial indexes |
| 20260316141142 | enable_rls_all_tables | Enable RLS on all tables |
| 20260316141151 | create_rls_policies | RLS policies for authenticated access |
| 20260316141154 | create_functions_and_realtime | RPC functions + realtime subscriptions |
| 20260316141212 | seed_business_templates | Business template seed data |
| 20260316185209 | add_missing_columns | Add missing columns (gender, linked_to, etc.) |
| 20260324132437 | add_error_count_to_conversations | Error count column on conversations |
| 20260401124134 | enable_rls_on_exposed_tables | Phase 1: RLS on 6 exposed tables + tos policy |
| 20260401124135 | fix_rpc_search_path | Phase 1: Set search_path on RPC functions |
| 20260401131041 | fix_book_appointment_atomic_remove_stats | Phase 2: Remove stats update from booking RPC |
| 20260401131151 | add_missing_indexes_drop_duplicates | Phase 2: Add/drop indexes for performance |
| 20260401133533 | add_gist_exclusion_constraint | Phase 3: btree_gist + overlap prevention |
