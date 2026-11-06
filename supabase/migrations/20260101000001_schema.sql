-- AETHRIZ AI | Migration 1: normalized schema (18 tables)
-- UUID PKs, FKs, checks, unique constraints, indexes, soft deletion, timestamps.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- 13. supported_languages -----------------------------------------------------
create table public.supported_languages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$'),
  name text not null,
  native_name text not null,
  direction text not null default 'ltr' check (direction in ('ltr','rtl')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.supported_languages (code, name, native_name, direction) values
 ('en','English','English','ltr'),('hi','Hindi','हिन्दी','ltr'),('te','Telugu','తెలుగు','ltr'),
 ('ta','Tamil','தமிழ்','ltr'),('kn','Kannada','ಕನ್ನಡ','ltr'),('ml','Malayalam','മലയാളം','ltr'),
 ('mr','Marathi','मराठी','ltr'),('bn','Bengali','বাংলা','ltr'),('gu','Gujarati','ગુજરાતી','ltr'),
 ('pa','Punjabi','ਪੰਜਾਬੀ','ltr'),('ur','Urdu','اردو','rtl'),('ar','Arabic','العربية','rtl'),
 ('es','Spanish','Español','ltr'),('fr','French','Français','ltr'),('de','German','Deutsch','ltr'),
 ('pt','Portuguese','Português','ltr'),('it','Italian','Italiano','ltr'),('ru','Russian','Русский','ltr'),
 ('zh','Chinese','中文','ltr'),('ja','Japanese','日本語','ltr'),('ko','Korean','한국어','ltr'),
 ('id','Indonesian','Bahasa Indonesia','ltr'),('tr','Turkish','Türkçe','ltr'),('vi','Vietnamese','Tiếng Việt','ltr'),
 ('th','Thai','ไทย','ltr'),('sw','Swahili','Kiswahili','ltr');

-- 1. user_profiles ------------------------------------------------------------
create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  role text not null default 'user' check (role in ('user','admin','super_admin')),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  preferred_language text not null default 'en' references public.supported_languages(code),
  date_of_birth date check (date_of_birth > date '1900-01-01'),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index user_profiles_phone_active_uq on public.user_profiles(phone)
  where phone is not null and deleted_at is null;   -- duplicate-account guard
create trigger trg_user_profiles_updated before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- 2. health_profiles ----------------------------------------------------------
create table public.health_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  height_cm numeric(5,2) check (height_cm between 50 and 272),
  weight_kg numeric(5,2) check (weight_kg between 2 and 700),
  gender text check (gender in ('female','male','other','prefer_not_to_say')),
  birth_year smallint check (birth_year between 1900 and 2100),
  activity_level text check (activity_level in ('sedentary','light','moderate','active','very_active')),
  diet_preference text check (char_length(diet_preference) <= 60),
  medical_conditions text[] not null default '{}',
  allergies text[] not null default '{}',
  goals text[] not null default '{}',
  sensitive_notes_encrypted text,          -- application-level encrypted (AES-GCM)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index health_profiles_user_active_uq on public.health_profiles(user_id) where deleted_at is null;
create trigger trg_health_profiles_updated before update on public.health_profiles
  for each row execute function public.set_updated_at();

-- 3. health_analyses ----------------------------------------------------------
create table public.health_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  health_profile_id uuid references public.health_profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  input jsonb not null default '{}',
  result jsonb,
  language_code text not null default 'en' references public.supported_languages(code),
  credits_charged int not null default 0 check (credits_charged >= 0),
  is_trial boolean not null default false,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index health_analyses_user_idx on public.health_analyses(user_id, created_at desc) where deleted_at is null;
create trigger trg_health_analyses_updated before update on public.health_analyses
  for each row execute function public.set_updated_at();

-- 4. health_analysis_charts ---------------------------------------------------
create table public.health_analysis_charts (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.health_analyses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chart_type text not null check (chart_type in ('bar','line','pie','radar','gauge')),
  title text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index health_analysis_charts_analysis_idx on public.health_analysis_charts(analysis_id);
create index health_analysis_charts_user_idx on public.health_analysis_charts(user_id);

-- 5. food_scans / 6. product_scans -------------------------------------------
create table public.food_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  result jsonb,
  language_code text not null default 'en' references public.supported_languages(code),
  credits_charged int not null default 0 check (credits_charged >= 0),
  is_trial boolean not null default false,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index food_scans_user_idx on public.food_scans(user_id, created_at desc) where deleted_at is null;
create trigger trg_food_scans_updated before update on public.food_scans
  for each row execute function public.set_updated_at();

create table public.product_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text,
  barcode text check (barcode ~ '^[0-9]{8,14}$'),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  result jsonb,
  language_code text not null default 'en' references public.supported_languages(code),
  credits_charged int not null default 0 check (credits_charged >= 0),
  is_trial boolean not null default false,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (image_path is not null or barcode is not null)
);
create index product_scans_user_idx on public.product_scans(user_id, created_at desc) where deleted_at is null;
create trigger trg_product_scans_updated before update on public.product_scans
  for each row execute function public.set_updated_at();

-- 7. ai_trials / 8. ai_trial_usage -------------------------------------------
create table public.ai_trials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'eligible' check (status in ('eligible','active','exhausted','blocked')),
  charts_allowed int not null default 3 check (charts_allowed >= 0),
  charts_used int not null default 0 check (charts_used >= 0),
  feature_limits jsonb not null default
    '{"health_analysis":3,"food_scan":3,"product_scan":3,"translation":3}',
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  blocked_reason text,
  activated_at timestamptz,
  exhausted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (charts_used <= charts_allowed)
);
create trigger trg_ai_trials_updated before update on public.ai_trials
  for each row execute function public.set_updated_at();

create table public.ai_trial_usage (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.ai_trials(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('health_analysis','food_scan','product_scan','translation')),
  units int not null default 1 check (units > 0),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index ai_trial_usage_trial_idx on public.ai_trial_usage(trial_id, feature);

-- 9. ai_credit_wallets / 10. ai_credit_transactions ---------------------------
create table public.ai_credit_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  reserved int not null default 0 check (reserved >= 0),
  lifetime_granted int not null default 0 check (lifetime_granted >= 0),
  lifetime_spent int not null default 0 check (lifetime_spent >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserved <= balance)              -- available = balance - reserved, never negative
);
create trigger trg_ai_credit_wallets_updated before update on public.ai_credit_wallets
  for each row execute function public.set_updated_at();

create table public.ai_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.ai_credit_wallets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('grant','reserve','settle','refund','adjust')),
  amount int not null check (amount > 0),
  state text check (state in ('pending','settled','refunded')),   -- reserve rows only
  feature text check (feature in ('health_analysis','food_scan','product_scan','translation')),
  reference_id uuid,                        -- reservation id for settle/refund
  balance_after int not null,
  reserved_after int not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index ai_credit_tx_user_idx on public.ai_credit_transactions(user_id, created_at desc);

-- 11. ai_usage_logs / 12. ai_request_logs -------------------------------------
create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  feature text not null,
  model text,
  input_tokens int check (input_tokens >= 0),
  output_tokens int check (output_tokens >= 0),
  latency_ms int check (latency_ms >= 0),
  status text not null check (status in ('success','error','blocked')),
  credits int not null default 0 check (credits >= 0),
  created_at timestamptz not null default now()
);
create index ai_usage_logs_user_idx on public.ai_usage_logs(user_id, created_at desc);
create index ai_usage_logs_created_idx on public.ai_usage_logs(created_at);

create table public.ai_request_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  request_id text not null,
  method text not null,
  path text not null,
  status_code int not null,
  duration_ms int,
  ip_hash text,
  error_code text,
  created_at timestamptz not null default now()
);
create index ai_request_logs_created_idx on public.ai_request_logs(created_at);
create index ai_request_logs_user_idx on public.ai_request_logs(user_id, created_at desc);

-- 14. user_language_preferences ----------------------------------------------
create table public.user_language_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null references public.supported_languages(code),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, language_code)
);
create unique index user_language_primary_uq on public.user_language_preferences(user_id) where is_primary;

-- 15. device_risk_signals -----------------------------------------------------
create table public.device_risk_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  device_hash text,
  ip_hash text,
  signal_type text not null check (signal_type in ('duplicate_device','duplicate_ip','velocity','disposable_email','vpn','manual')),
  risk_score int not null default 0 check (risk_score between 0 and 100),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index device_risk_user_idx on public.device_risk_signals(user_id);
create index device_risk_device_idx on public.device_risk_signals(device_hash) where device_hash is not null;
create index device_risk_ip_idx on public.device_risk_signals(ip_hash) where ip_hash is not null;

-- 16. otp_verifications (codes stored hashed only) ----------------------------
create table public.otp_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email','phone')),
  target_hash text not null,
  code_hash text not null,
  attempts int not null default 0 check (attempts >= 0),
  max_attempts int not null default 5 check (max_attempts > 0),
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index otp_user_idx on public.otp_verifications(user_id, channel, created_at desc);
create index otp_expires_idx on public.otp_verifications(expires_at);

-- 17. admin_settings ----------------------------------------------------------
create table public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_admin_settings_updated before update on public.admin_settings
  for each row execute function public.set_updated_at();

insert into public.admin_settings (key, value, description) values
 ('credits.cost.health_analysis','10','Credits per health analysis'),
 ('credits.cost.food_scan','5','Credits per food scan'),
 ('credits.cost.product_scan','5','Credits per product scan'),
 ('credits.cost.translation','1','Credits per translation'),
 ('trial.charts_allowed','3','Total charts in the free trial'),
 ('spend.daily_limit_credits','100000','Daily application credit spending threshold'),
 ('retention.request_logs_days','90','Days to keep ai_request_logs'),
 ('retention.usage_logs_days','365','Days to keep ai_usage_logs'),
 ('retention.soft_deleted_days','30','Days before soft-deleted rows are purged');

-- 18. audit_logs --------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}',
  ip_hash text,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs(action, created_at desc);
