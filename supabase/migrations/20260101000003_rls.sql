-- AETHRIZ AI | Migration 3: Row Level Security + least-privilege grants
-- Model: clients (anon/authenticated) get the minimum. All critical writes go through the
-- backend (service_role) or SECURITY DEFINER functions. Tables without policies are deny-all.

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'user_profiles','health_profiles','health_analyses','health_analysis_charts','food_scans',
    'product_scans','ai_trials','ai_trial_usage','ai_credit_wallets','ai_credit_transactions',
    'ai_usage_logs','ai_request_logs','supported_languages','user_language_preferences',
    'device_risk_signals','otp_verifications','admin_settings','audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    -- Explicit administrator read access on every table (writes stay backend-only).
    execute format('create policy admin_select on public.%I for select to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- Own-row READ-ONLY tables (clients can never write these) -----------------------------------
do $$
declare t text;
begin
  foreach t in array array['health_analyses','health_analysis_charts','food_scans','product_scans',
    'ai_trials','ai_trial_usage','ai_credit_wallets','ai_credit_transactions','ai_usage_logs'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy own_select on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;
-- hide soft-deleted history from owners
drop policy own_select on public.health_analyses;
create policy own_select on public.health_analyses for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);
drop policy own_select on public.food_scans;
create policy own_select on public.food_scans for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);
drop policy own_select on public.product_scans;
create policy own_select on public.product_scans for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

-- user_profiles: read own, update ONLY safe columns (role/phone/deleted_at are not grantable) ---
grant select on public.user_profiles to authenticated;
grant update (full_name, country_code, preferred_language, date_of_birth, avatar_path) on public.user_profiles to authenticated;
create policy own_select on public.user_profiles for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);
create policy own_update on public.user_profiles for update to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null)
  with check (user_id = (select auth.uid()));

-- health_profiles: full own CRUD (delete = soft delete via update of deleted_at) ----------------
grant select, insert on public.health_profiles to authenticated;
grant update (height_cm, weight_kg, gender, birth_year, activity_level, diet_preference,
              medical_conditions, allergies, goals, deleted_at) on public.health_profiles to authenticated;
create policy own_select on public.health_profiles for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);
create policy own_insert on public.health_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy own_update on public.health_profiles for update to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null)
  with check (user_id = (select auth.uid()));

-- supported_languages: public read of active languages ----------------------------------------
grant select on public.supported_languages to anon, authenticated;
create policy public_read_active on public.supported_languages for select to anon, authenticated
  using (is_active);

-- user_language_preferences: own CRUD ------------------------------------------------------------
grant select, insert, update, delete on public.user_language_preferences to authenticated;
create policy own_all on public.user_language_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ai_request_logs, device_risk_signals, otp_verifications, admin_settings, audit_logs:
-- no client policies and no grants => backend-only (admins may read through admin_select policy,
-- which additionally requires a SELECT grant, given below for the admin-visible tables).
grant select on public.audit_logs, public.ai_request_logs, public.admin_settings,
                public.device_risk_signals to authenticated;
-- (RLS still filters rows: non-admins match no policy and see nothing.)
