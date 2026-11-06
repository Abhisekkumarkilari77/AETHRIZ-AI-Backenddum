import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const ADMIN = '33333333-3333-3333-3333-333333333333';
let db;

// Minimal stand-ins for Supabase-managed objects.
const STUBS = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

const as = async (role, uid, fn) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await fn(); } finally { await db.exec('reset role'); }
};
const q = (sql, p) => db.query(sql, p).then(r => r.rows);
const rejects = (p, re) => assert.rejects(p, re);

before(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
  await db.exec(`insert into auth.users (id,email,raw_user_meta_data) values
    ('${A}','a@x.com','{"full_name":"Alice"}'),('${B}','b@x.com','{}'),('${ADMIN}','root@x.com','{}')`);
  await db.exec(`update public.user_profiles set role='admin' where user_id='${ADMIN}'`);
});

test('all 18 tables exist with RLS enabled', async () => {
  const rows = await q(`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'`);
  assert.equal(rows.length, 18);
  assert.ok(rows.every(r => r.relrowsecurity), 'every table must have RLS');
});

test('24+ languages seeded; storage buckets are private', async () => {
  assert.ok((await q('select count(*)::int n from public.supported_languages'))[0].n >= 24);
  const b = await q('select id, public from storage.buckets order by id');
  assert.deepEqual(b.map(x => x.id), ['food-scan-images', 'health-reports', 'product-scan-images']);
  assert.ok(b.every(x => x.public === false));
});

test('new auth user auto-provisions profile, wallet and trial', async () => {
  assert.equal((await q(`select full_name from public.user_profiles where user_id='${A}'`))[0].full_name, 'Alice');
  assert.equal((await q(`select balance from public.ai_credit_wallets where user_id='${A}'`))[0].balance, 0);
  const t = (await q(`select status, charts_allowed from public.ai_trials where user_id='${A}'`))[0];
  assert.deepEqual(t, { status: 'eligible', charts_allowed: 3 });
});

test('email verification syncs to trial', async () => {
  await db.exec(`update auth.users set email_confirmed_at = now() where id='${A}'`);
  assert.equal((await q(`select email_verified from public.ai_trials where user_id='${A}'`))[0].email_verified, true);
});

test('credits: grant -> reserve -> settle, with idempotent replay', async () => {
  const g = (await q(`select public.credit_grant('${A}', 20, 'grant-key-0001') r`))[0].r;
  assert.equal(g.balance, 20);
  assert.equal((await q(`select public.credit_grant('${A}', 20, 'grant-key-0001') r`))[0].r.replayed, true);
  assert.equal((await q(`select balance from public.ai_credit_wallets where user_id='${A}'`))[0].balance, 20);

  const r = (await q(`select public.credit_reserve('${A}', 10, 'health_analysis', 'reserve-key-01') r`))[0].r;
  assert.equal(r.reserved, 10);
  assert.equal((await q(`select public.credit_reserve('${A}', 10, 'health_analysis', 'reserve-key-01') r`))[0].r.replayed, true);

  const s = (await q(`select public.credit_settle('${A}', '${r.reservation_id}', 'settle-key-001') r`))[0].r;
  assert.deepEqual([s.balance, s.reserved], [10, 0]);
  assert.equal((await q(`select public.credit_settle('${A}', '${r.reservation_id}', 'settle-key-002') r`))[0].r.replayed, true);
  await rejects(db.query(`select public.credit_refund('${A}', '${r.reservation_id}', 'refund-key-001')`), /RESERVATION_ALREADY_SETTLED/);
});

test('credits: refund releases hold; insufficient credits rejected; no overspend', async () => {
  const r = (await q(`select public.credit_reserve('${A}', 10, 'food_scan', 'reserve-key-02') r`))[0].r;
  await rejects(db.query(`select public.credit_reserve('${A}', 1, 'food_scan', 'reserve-key-03')`), /INSUFFICIENT_CREDITS/);
  const f = (await q(`select public.credit_refund('${A}', '${r.reservation_id}', 'refund-key-002') r`))[0].r;
  assert.deepEqual([f.balance, f.reserved], [10, 0]);
  await rejects(db.query(`select public.credit_reserve('${A}', 11, 'food_scan', 'reserve-key-04')`), /INSUFFICIENT_CREDITS/);
  await rejects(db.query(`select public.credit_grant('${A}', -5, 'grant-key-neg1')`), /INVALID_AMOUNT/);
});

test('trial: 3 total units, per-feature cap, idempotent, then exhausted', async () => {
  const c = k => q(`select public.trial_consume('${B}', 'health_analysis', 1, '${k}') r`).then(r => r[0].r);
  assert.equal((await c('trial-key-0001')).remaining, 2);
  assert.equal((await c('trial-key-0001')).replayed, true);
  assert.equal((await c('trial-key-0002')).remaining, 1);
  assert.equal((await c('trial-key-0003')).remaining, 0);
  const denied = await c('trial-key-0004');
  assert.deepEqual([denied.allowed, denied.reason], [false, 'exhausted']);
  assert.equal((await q(`select status from public.ai_trials where user_id='${B}'`))[0].status, 'exhausted');
  assert.equal((await q(`select charts_used from public.ai_trials where user_id='${B}'`))[0].charts_used, 3);
});

test('RLS: users read only their own rows; cannot write wallet/trial/role', async () => {
  await db.exec(`insert into public.health_profiles (user_id, height_cm) values ('${A}', 170), ('${B}', 180)`);
  await as('authenticated', A, async () => {
    assert.equal((await q('select * from public.health_profiles')).length, 1);
    assert.equal((await q('select * from public.ai_credit_wallets')).length, 1);
    assert.equal((await q('select * from public.user_profiles')).length, 1);
    await rejects(db.query(`update public.ai_credit_wallets set balance = 9999`), /permission denied/);
    await rejects(db.query(`update public.ai_trials set charts_used = 0`), /permission denied/);
    await rejects(db.query(`update public.user_profiles set role = 'admin'`), /permission denied/);
    await rejects(db.query(`insert into public.ai_credit_transactions (wallet_id,user_id,type,amount,balance_after,reserved_after,idempotency_key) values (gen_random_uuid(),'${A}','grant',5,5,0,'hack-key-0001')`), /permission denied/);
    await rejects(db.query(`select public.credit_grant('${A}', 100, 'hack-grant-001')`), /permission denied/);
    await rejects(db.query(`select public.trial_consume('${A}', 'food_scan', 1, 'hack-trial-001')`), /permission denied/);
    assert.equal((await db.query(`update public.user_profiles set full_name = 'Alicia' returning id`)).rows.length, 1);
    // cannot insert a health profile for someone else
    await rejects(db.query(`insert into public.health_profiles (user_id) values ('${B}')`), /row-level security|unique|violates/);
    assert.equal((await db.query(`update public.health_profiles set weight_kg = 70 where user_id = '${B}'`)).affectedRows, 0);
    // client-only tables are hidden
    await rejects(db.query('select * from public.otp_verifications'), /permission denied/);
    assert.equal((await q('select * from public.ai_request_logs')).length, 0);
    assert.equal((await q('select * from public.audit_logs')).length, 0);
  });
  await as('anon', null, async () => {
    assert.ok((await q('select * from public.supported_languages')).length >= 24);
    await rejects(db.query('select * from public.user_profiles'), /permission denied/);
  });
});

test('RLS: admin can read all; normal user cannot read admin_settings', async () => {
  await as('authenticated', ADMIN, async () => {
    assert.ok((await q('select * from public.ai_credit_wallets')).length >= 3);
    assert.ok((await q('select * from public.admin_settings')).length > 0);
  });
  await as('authenticated', A, async () => {
    assert.equal((await q('select * from public.admin_settings')).length, 0);
  });
});

test('soft-deleted rows are hidden from owners and purged by retention function', async () => {
  await db.exec(`update public.health_profiles set deleted_at = now() - interval '40 days' where user_id='${B}'`);
  await as('authenticated', B, async () => assert.equal((await q('select * from public.health_profiles')).length, 0));
  await db.exec(`insert into public.ai_request_logs (request_id,method,path,status_code,created_at) values ('r1','GET','/x',200, now() - interval '100 days')`);
  const res = (await q('select public.purge_expired_data() r'))[0].r;
  assert.equal(res.request_logs, 1);
  assert.equal(res.soft_deleted, 1);
});
