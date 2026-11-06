import { jest } from '@jest/globals';

/** Chainable PostgREST-style query builder that resolves to `result`. */
export function chain(result = { data: null, error: null }) {
  const c = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'is', 'limit', 'order', 'single', 'maybeSingle'])
    c[m] = jest.fn(() => c);
  c.then = (res, rej) => Promise.resolve(result).then(res, rej);
  return c;
}

export const mocks = {
  admin: { auth: { getUser: jest.fn(), admin: { signOut: jest.fn(), updateUserById: jest.fn() } }, from: jest.fn() },
  anon: { auth: { signUp: jest.fn(), signInWithPassword: jest.fn(), refreshSession: jest.fn(), resetPasswordForEmail: jest.fn(), resend: jest.fn() } },
  user: { from: jest.fn() },
};

export const supabaseModule = () => ({
  supabaseAdmin: mocks.admin,
  createAnonClient: () => mocks.anon,
  createUserClient: jest.fn(() => mocks.user),
});

/** Makes a bearer token valid: auth.getUser OK + role lookup in user_profiles. */
export function loginAs({ id = 'u-1', role = 'user', verified = true, deleted = null } = {}) {
  mocks.admin.auth.getUser.mockResolvedValue({ data: { user: { id, email: 'a@x.com', email_confirmed_at: verified ? 'now' : null } }, error: null });
  mocks.admin.from.mockImplementation(table =>
    table === 'user_profiles' ? chain({ data: { role, deleted_at: deleted }, error: null }) : chain({ data: null, error: null }));
}
