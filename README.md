# AETHRIZ AI Backend

Node.js · Express 5 · ES Modules · Supabase (PostgreSQL) · Google Gemini AI · Zod

---

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/Abhisekkumarkilari77/AETHRIZ-AI-Backenddum.git
cd AETHRIZ-AI-Backenddum
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env
```
Fill in `.env`:
```
SUPABASE_URL=https://ecwzbolyzdqkxdvpnosi.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key
SUPABASE_JWKS_URL=https://ecwzbolyzdqkxdvpnosi.supabase.co/auth/v1/.well-known/jwks.json
IP_HASH_SALT=change-me-to-a-long-random-string
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.5-flash-lite
```
Get Gemini API key: https://aistudio.google.com/apikey

### 3. Setup Supabase Tables
Go to: https://supabase.com/dashboard/project/ecwzbolyzdqkxdvpnosi/sql/new

Paste and run this SQL:
```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table if not exists public.supported_languages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  native_name text not null,
  direction text not null default 'ltr',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.supported_languages (code, name, native_name) values
('en','English','English') on conflict do nothing;

create table if not exists public.health_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  status text not null default 'pending',
  input jsonb not null default '{}',
  result jsonb,
  language_code text not null default 'en',
  credits_charged int not null default 0,
  is_trial boolean not null default false,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.food_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  image_path text not null default 'inline',
  status text not null default 'pending',
  result jsonb,
  language_code text not null default 'en',
  credits_charged int not null default 0,
  is_trial boolean not null default false,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

### 4. Run Backend
```bash
npm run dev
```
Server starts at http://localhost:3001

### 5. Run Frontend
```bash
cd frontend
npx serve .
```
Open the URL shown (e.g. http://localhost:58824)

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/ai/health | Run health analysis |
| GET | /api/v1/ai/health | List health analyses |
| GET | /api/v1/ai/health/:id | Get health analysis by ID |
| POST | /api/v1/ai/food | Scan food/product image |
| GET | /api/v1/ai/food | List food scans |
| GET | /api/v1/ai/food/:id | Get food scan by ID |
| GET | /health/live | Liveness check |
| GET | /health/ready | Readiness check |

---

## Test API directly

### Health Analysis
```bash
curl -X POST http://localhost:3001/api/v1/ai/health \
  -H "Content-Type: application/json" \
  -d '{"age":22,"height_cm":170,"weight_kg":75,"sleep_hours":6,"activity_level":"light","water_intake_litres":1.5,"goals":["improve fitness"],"language_code":"en"}'
```

### Food Scan (PowerShell)
```powershell
$img = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\food.jpg"))
curl -X POST http://localhost:3001/api/v1/ai/food `
  -H "Content-Type: application/json" `
  -d "{`"image_base64`":`"$img`",`"mime_type`":`"image/jpeg`"}"
```

---

## Project Structure

```
src/
  config/         env.js · supabase.js
  middleware/     auth · validate · errorHandler · requestId
  modules/
    auth/         register · login · refresh · logout
    profile/      get · update · delete
    ai/
      health/     health analysis (Gemini)
      food/       food scanning (Gemini multimodal)
  services/       gemini.js (shared AI client)
  utils/          errors · logger · audit
frontend/
  index.html      UI
  app.js          API calls + result rendering
  style.css       Dark theme styles
supabase/
  migrations/     SQL schema files
```

---

## Git Commands

```bash
# Check status
git status

# Add all changes
git add .

# Commit
git commit -m "your message"

# Push
git push

# All in one
git add . && git commit -m "update" && git push
```
