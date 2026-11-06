import { jest } from '@jest/globals';
import { mocks, supabaseModule, chain, loginAs } from '../helpers/mockSupabase.js';

jest.unstable_mockModule('../../src/config/supabase.js', supabaseModule);
const { default: request } = await import('supertest');
const { createApp } = await import('../../src/app.js');
const { authenticate, requireRole, requireVerifiedEmail } = await import('../../src/middleware/auth.js');
const app = createApp();

const profileRow = { id: 'p1', user_id: 'u-1', full_name: 'Alice', phone: null, role: 'user', country_code: 'IN', preferred_language: 'te', date_of_birth: null, avatar_path: null, created_at: 't', updated_at: 't' };
const sess = { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, expires_at: 1, token_type: 'bearer' };
const authUser = { id: 'u-1', email: 'a@x.com', email_confirmed_at: 'now' };

beforeEach(() => {
  jest.clearAllMocks();
  mocks.admin.from.mockImplementation(() => chain({ data: null, error: null }));
});

describe('platform', () => {
  test('liveness + request id header', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeTruthy();
  });
  test('readiness reports database state', async () => {
    mocks.admin.from.mockReturnValue(chain({ error: null }));
    expect((await request(app).get('/health/ready')).status).toBe(200);
    mocks.admin.from.mockReturnValue(chain({ error: { code: 'x' } }));
    expect((await request(app).get('/health/ready')).status).toBe(503);
  });
  test('security headers set; x-powered-by hidden', async () => {
    const res = await request(app).get('/health/live');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeTruthy();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
  test('CORS allows only configured origins', async () => {
    const ok = await request(app).get('/health/live').set('Origin', 'http://allowed.test');
    const bad = await request(app).get('/health/live').set('Origin', 'http://evil.test');
    expect(ok.headers['access-control-allow-origin']).toBe('http://allowed.test');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
  test('unknown route -> 404 envelope; malformed JSON -> 400; huge body -> 413', async () => {
    const nf = await request(app).get('/nope');
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe('NOT_FOUND');
    const bad = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect([bad.status, bad.body.error.code]).toEqual([400, 'INVALID_JSON']);
    const big = await request(app).post('/api/v1/auth/login').send({ email: 'a@x.com', password: 'x'.repeat(200_000) });
    expect(big.status).toBe(413);
  });
  test('OpenAPI docs are served', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.body.openapi).toBe('3.0.3');
    expect((await request(app).get('/docs/')).status).toBe(200);
  });
});

describe('auth', () => {
  test('register validates input', async () => {
    for (const body of [{ email: 'bad', password: 'abcdefg1' }, { email: 'a@x.com', password: 'short1' }, { email: 'a@x.com', password: 'onlyletters' }, { email: 'a@x.com', password: 'abcdefg1', role: 'admin' }]) {
      const res = await request(app).post('/api/v1/auth/register').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(mocks.anon.auth.signUp).not.toHaveBeenCalled();
  });
  test('register normalizes email and passes full name', async () => {
    mocks.anon.auth.signUp.mockResolvedValue({ data: { user: authUser }, error: null });
    const res = await request(app).post('/api/v1/auth/register').send({ email: '  A@X.com ', password: 'abcdefg1', fullName: 'Alice' });
    expect(res.status).toBe(201);
    expect(mocks.anon.auth.signUp.mock.calls[0][0]).toMatchObject({ email: 'a@x.com', options: { data: { full_name: 'Alice' } } });
  });
  test('login success returns session', async () => {
    mocks.anon.auth.signInWithPassword.mockResolvedValue({ data: { user: authUser, session: sess }, error: null });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'a@x.com', password: 'abcdefg1' });
    expect(res.status).toBe(200);
    expect(res.body.session).toMatchObject({ accessToken: 'AT', refreshToken: 'RT' });
  });
  test('login wrong password -> generic 401; unverified -> 403; provider down -> 502', async () => {
    mocks.anon.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { status: 400, code: 'invalid_credentials' } });
    const a = await request(app).post('/api/v1/auth/login').send({ email: 'a@x.com', password: 'x' });
    expect([a.status, a.body.error.message]).toEqual([401, 'Invalid email or password']);
    mocks.anon.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { status: 400, code: 'email_not_confirmed' } });
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'a@x.com', password: 'x' })).body.error.code).toBe('EMAIL_NOT_VERIFIED');
    mocks.anon.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { status: 500 } });
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'a@x.com', password: 'x' })).status).toBe(502);
  });
  test('refresh; forgot password never reveals account existence', async () => {
    mocks.anon.auth.refreshSession.mockResolvedValue({ data: { user: authUser, session: sess }, error: null });
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: 'x'.repeat(20) })).status).toBe(200);
    mocks.anon.auth.resetPasswordForEmail.mockRejectedValue(new Error('boom'));
    const res = await request(app).post('/api/v1/auth/password/forgot').send({ email: 'nobody@x.com' });
    expect(res.status).toBe(200);
  });
  test('logout + password update require auth, then work', async () => {
    expect((await request(app).post('/api/v1/auth/logout')).status).toBe(401);
    loginAs();
    mocks.admin.auth.admin.signOut.mockResolvedValue({ error: null });
    mocks.admin.auth.admin.updateUserById.mockResolvedValue({ error: null });
    expect((await request(app).post('/api/v1/auth/logout').set('Authorization', 'Bearer T')).status).toBe(204);
    expect((await request(app).post('/api/v1/auth/password/update').set('Authorization', 'Bearer T').send({ password: 'newpass123' })).status).toBe(204);
    expect(mocks.admin.auth.admin.updateUserById).toHaveBeenCalledWith('u-1', { password: 'newpass123' });
  });
});

describe('auth middleware', () => {
  test('rejects missing, malformed and invalid tokens', async () => {
    expect((await request(app).get('/api/v1/profile/me')).status).toBe(401);
    expect((await request(app).get('/api/v1/profile/me').set('Authorization', 'Basic abc')).status).toBe(401);
    mocks.admin.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    expect((await request(app).get('/api/v1/profile/me').set('Authorization', 'Bearer bad')).status).toBe(401);
  });
  test('disabled (soft-deleted) account is rejected', async () => {
    loginAs({ deleted: '2026-01-01' });
    const res = await request(app).get('/api/v1/profile/me').set('Authorization', 'Bearer T');
    expect([res.status, res.body.error.code]).toEqual([403, 'ACCOUNT_DISABLED']);
  });
  test('requireRole / requireVerifiedEmail guards', async () => {
    const run = async (mw, user) => { const req = { user }; let err; try { await mw(req, {}, () => {}); } catch (e) { err = e; } return err; };
    expect(await run(requireRole('admin'), { role: 'user' })).toMatchObject({ status: 403 });
    expect(await run(requireRole('admin', 'super_admin'), { role: 'admin' })).toBeUndefined();
    expect(await run(requireVerifiedEmail, { emailVerified: false })).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    expect(typeof authenticate).toBe('function');
  });
});

describe('profile', () => {
  test('get me (RLS client)', async () => {
    loginAs();
    mocks.user.from.mockReturnValue(chain({ data: profileRow, error: null }));
    const res = await request(app).get('/api/v1/profile/me').set('Authorization', 'Bearer T');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ fullName: 'Alice', preferredLanguage: 'te', role: 'user' });
  });
  test('patch maps fields and rejects privileged/unknown fields', async () => {
    loginAs();
    const q = chain({ data: { ...profileRow, full_name: 'Bob' }, error: null });
    mocks.user.from.mockReturnValue(q);
    const ok = await request(app).patch('/api/v1/profile/me').set('Authorization', 'Bearer T').send({ fullName: 'Bob' });
    expect(ok.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith({ full_name: 'Bob' });
    for (const body of [{ role: 'admin' }, {}, { countryCode: 'india' }, { dateOfBirth: 'yesterday' }]) {
      const res = await request(app).patch('/api/v1/profile/me').set('Authorization', 'Bearer T').send(body);
      expect(res.status).toBe(400);
    }
  });
  test('unsupported language -> 400', async () => {
    loginAs();
    mocks.user.from.mockReturnValue(chain({ data: null, error: { code: '23503' } }));
    const res = await request(app).patch('/api/v1/profile/me').set('Authorization', 'Bearer T').send({ preferredLanguage: 'xx' });
    expect(res.body.error.code).toBe('UNSUPPORTED_LANGUAGE');
  });
  test('delete me soft-deletes and revokes sessions; DB errors never leak', async () => {
    loginAs();
    mocks.admin.auth.admin.signOut.mockResolvedValue({ error: null });
    expect((await request(app).delete('/api/v1/profile/me').set('Authorization', 'Bearer T')).status).toBe(204);
    mocks.user.from.mockReturnValue(chain({ data: null, error: { code: 'XX000', message: 'secret internal detail' } }));
    const res = await request(app).get('/api/v1/profile/me').set('Authorization', 'Bearer T');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
  });
});
