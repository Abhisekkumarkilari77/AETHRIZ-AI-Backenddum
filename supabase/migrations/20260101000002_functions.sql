-- AETHRIZ AI | Migration 2: atomic business functions (callable ONLY by service_role)

-- Auto-provision profile, wallet, trial when a Supabase Auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (user_id, full_name)
    values (new.id, left(nullif(new.raw_user_meta_data->>'full_name',''), 120));
  insert into public.ai_credit_wallets (user_id) values (new.id);
  insert into public.ai_trials (user_id, email_verified)
    values (new.id, new.email_confirmed_at is not null);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep trial email verification in sync with Supabase Auth.
create or replace function public.handle_user_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.ai_trials set email_verified = true where user_id = new.id;
  return new;
end $$;

create trigger on_auth_user_verified after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_verified();

-- is_admin(): used by RLS policies --------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = (select auth.uid()) and role in ('admin','super_admin') and deleted_at is null);
$$;

-- credit_grant ----------------------------------------------------------------
create or replace function public.credit_grant(p_user_id uuid, p_amount int, p_idempotency_key text, p_reason text default 'grant')
returns jsonb language plpgsql security definer set search_path = public as $$
declare w public.ai_credit_wallets; tx public.ai_credit_transactions;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into w from public.ai_credit_wallets where user_id = p_user_id for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  select * into tx from public.ai_credit_transactions where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('transaction_id', tx.id, 'balance', tx.balance_after, 'reserved', tx.reserved_after, 'replayed', true);
  end if;
  update public.ai_credit_wallets set balance = balance + p_amount, lifetime_granted = lifetime_granted + p_amount
    where id = w.id returning * into w;
  insert into public.ai_credit_transactions (wallet_id, user_id, type, amount, balance_after, reserved_after, idempotency_key, metadata)
    values (w.id, p_user_id, 'grant', p_amount, w.balance, w.reserved, p_idempotency_key, jsonb_build_object('reason', p_reason))
    returning * into tx;
  return jsonb_build_object('transaction_id', tx.id, 'balance', w.balance, 'reserved', w.reserved, 'replayed', false);
end $$;

-- credit_reserve: hold credits before calling Gemini ----------------------------
create or replace function public.credit_reserve(p_user_id uuid, p_amount int, p_feature text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare w public.ai_credit_wallets; tx public.ai_credit_transactions;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into w from public.ai_credit_wallets where user_id = p_user_id for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  select * into tx from public.ai_credit_transactions where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('reservation_id', tx.id, 'balance', tx.balance_after, 'reserved', tx.reserved_after, 'replayed', true);
  end if;
  if w.balance - w.reserved < p_amount then raise exception 'INSUFFICIENT_CREDITS'; end if;
  update public.ai_credit_wallets set reserved = reserved + p_amount where id = w.id returning * into w;
  insert into public.ai_credit_transactions (wallet_id, user_id, type, amount, state, feature, balance_after, reserved_after, idempotency_key)
    values (w.id, p_user_id, 'reserve', p_amount, 'pending', p_feature, w.balance, w.reserved, p_idempotency_key)
    returning * into tx;
  return jsonb_build_object('reservation_id', tx.id, 'balance', w.balance, 'reserved', w.reserved, 'replayed', false);
end $$;

-- credit_settle: AI call succeeded -> spend reserved credits ----------------------
create or replace function public.credit_settle(p_user_id uuid, p_reservation_id uuid, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare w public.ai_credit_wallets; r public.ai_credit_transactions; tx public.ai_credit_transactions;
begin
  select * into w from public.ai_credit_wallets where user_id = p_user_id for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  select * into r from public.ai_credit_transactions
    where id = p_reservation_id and user_id = p_user_id and type = 'reserve' for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if r.state = 'settled' then
    return jsonb_build_object('balance', w.balance, 'reserved', w.reserved, 'replayed', true);
  elsif r.state = 'refunded' then raise exception 'RESERVATION_ALREADY_REFUNDED';
  end if;
  update public.ai_credit_wallets
    set balance = balance - r.amount, reserved = reserved - r.amount, lifetime_spent = lifetime_spent + r.amount
    where id = w.id returning * into w;
  update public.ai_credit_transactions set state = 'settled' where id = r.id;
  insert into public.ai_credit_transactions (wallet_id, user_id, type, amount, feature, reference_id, balance_after, reserved_after, idempotency_key)
    values (w.id, p_user_id, 'settle', r.amount, r.feature, r.id, w.balance, w.reserved, p_idempotency_key)
    returning * into tx;
  return jsonb_build_object('transaction_id', tx.id, 'balance', w.balance, 'reserved', w.reserved, 'replayed', false);
end $$;

-- credit_refund: AI call failed -> release the hold ----------------------------------
create or replace function public.credit_refund(p_user_id uuid, p_reservation_id uuid, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare w public.ai_credit_wallets; r public.ai_credit_transactions; tx public.ai_credit_transactions;
begin
  select * into w from public.ai_credit_wallets where user_id = p_user_id for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  select * into r from public.ai_credit_transactions
    where id = p_reservation_id and user_id = p_user_id and type = 'reserve' for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if r.state = 'refunded' then
    return jsonb_build_object('balance', w.balance, 'reserved', w.reserved, 'replayed', true);
  elsif r.state = 'settled' then raise exception 'RESERVATION_ALREADY_SETTLED';
  end if;
  update public.ai_credit_wallets set reserved = reserved - r.amount where id = w.id returning * into w;
  update public.ai_credit_transactions set state = 'refunded' where id = r.id;
  insert into public.ai_credit_transactions (wallet_id, user_id, type, amount, feature, reference_id, balance_after, reserved_after, idempotency_key)
    values (w.id, p_user_id, 'refund', r.amount, r.feature, r.id, w.balance, w.reserved, p_idempotency_key)
    returning * into tx;
  return jsonb_build_object('transaction_id', tx.id, 'balance', w.balance, 'reserved', w.reserved, 'replayed', false);
end $$;

-- trial_consume: atomic, server-side, idempotent -----------------------------------------
create or replace function public.trial_consume(p_user_id uuid, p_feature text, p_units int, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.ai_trials; feature_used int; feature_cap int;
begin
  if p_units is null or p_units <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into t from public.ai_trials where user_id = p_user_id for update;
  if not found then raise exception 'TRIAL_NOT_FOUND'; end if;
  if exists (select 1 from public.ai_trial_usage where user_id = p_user_id and idempotency_key = p_idempotency_key) then
    return jsonb_build_object('allowed', true, 'replayed', true, 'charts_used', t.charts_used, 'remaining', t.charts_allowed - t.charts_used);
  end if;
  if t.status = 'blocked' then
    return jsonb_build_object('allowed', false, 'reason', 'blocked', 'remaining', 0);
  end if;
  select coalesce(sum(units), 0) into feature_used from public.ai_trial_usage where trial_id = t.id and feature = p_feature;
  feature_cap := coalesce((t.feature_limits ->> p_feature)::int, 0);
  if t.charts_used + p_units > t.charts_allowed then
    update public.ai_trials set status = 'exhausted', exhausted_at = coalesce(exhausted_at, now()) where id = t.id;
    return jsonb_build_object('allowed', false, 'reason', 'exhausted', 'remaining', 0);
  end if;
  if feature_used + p_units > feature_cap then
    return jsonb_build_object('allowed', false, 'reason', 'feature_limit', 'remaining', t.charts_allowed - t.charts_used);
  end if;
  insert into public.ai_trial_usage (trial_id, user_id, feature, units, idempotency_key)
    values (t.id, p_user_id, p_feature, p_units, p_idempotency_key);
  update public.ai_trials set charts_used = charts_used + p_units,
      status = case when charts_used + p_units >= charts_allowed then 'exhausted' else 'active' end,
      activated_at = coalesce(activated_at, now()),
      exhausted_at = case when charts_used + p_units >= charts_allowed then now() else exhausted_at end
    where id = t.id returning * into t;
  return jsonb_build_object('allowed', true, 'replayed', false, 'charts_used', t.charts_used, 'remaining', t.charts_allowed - t.charts_used);
end $$;

-- Data retention (schedule with pg_cron or a backend cron job) -----------------------------
create or replace function public.purge_expired_data(p_request_log_days int default 90, p_usage_log_days int default 365, p_soft_deleted_days int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a int; b int; c int; d int := 0; n int;
begin
  delete from public.ai_request_logs where created_at < now() - make_interval(days => p_request_log_days); get diagnostics a = row_count;
  delete from public.ai_usage_logs   where created_at < now() - make_interval(days => p_usage_log_days);   get diagnostics b = row_count;
  delete from public.otp_verifications where expires_at < now() - interval '7 days';                         get diagnostics c = row_count;
  delete from public.health_analyses where deleted_at < now() - make_interval(days => p_soft_deleted_days); get diagnostics n = row_count; d := d + n;
  delete from public.food_scans      where deleted_at < now() - make_interval(days => p_soft_deleted_days); get diagnostics n = row_count; d := d + n;
  delete from public.product_scans   where deleted_at < now() - make_interval(days => p_soft_deleted_days); get diagnostics n = row_count; d := d + n;
  delete from public.health_profiles where deleted_at < now() - make_interval(days => p_soft_deleted_days); get diagnostics n = row_count; d := d + n;
  return jsonb_build_object('request_logs', a, 'usage_logs', b, 'otps', c, 'soft_deleted', d);
end $$;

-- Lock down: critical functions run only from the trusted backend (service_role) ------------
do $$
declare f text;
begin
  foreach f in array array[
    'credit_grant(uuid,int,text,text)','credit_reserve(uuid,int,text,text)',
    'credit_settle(uuid,uuid,text)','credit_refund(uuid,uuid,text)',
    'trial_consume(uuid,text,int,text)','purge_expired_data(int,int,int)',
    'handle_new_user()','handle_user_verified()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
