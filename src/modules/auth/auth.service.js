import { createAnonClient, supabaseAdmin } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

const fail = (e, fallback = 'Authentication failed') => {
  const code = e?.code || '';
  if (code === 'email_not_confirmed') return new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email first');
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || e?.status === 429)
    return new AppError(429, 'RATE_LIMITED', 'Too many attempts, try again later');
  if (code === 'weak_password') return new AppError(400, 'WEAK_PASSWORD', 'Password is too weak');
  if (code === 'same_password') return new AppError(400, 'SAME_PASSWORD', 'Choose a different password');
  if (e?.status >= 500 || !e?.status) return new AppError(502, 'AUTH_PROVIDER_ERROR', 'Authentication service unavailable');
  return new AppError(401, 'INVALID_CREDENTIALS', fallback);
};

const session = s => s && ({
  accessToken: s.access_token, refreshToken: s.refresh_token, expiresIn: s.expires_in, expiresAt: s.expires_at, tokenType: s.token_type,
});
const publicUser = u => u && ({ id: u.id, email: u.email, emailVerified: Boolean(u.email_confirmed_at) });

export async function register({ email, password, fullName }) {
  const { data, error } = await createAnonClient().auth.signUp({
    email, password,
    options: { data: fullName ? { full_name: fullName } : {}, emailRedirectTo: `${env.APP_URL}/auth/callback` },
  });
  if (error) throw fail(error, 'Registration failed');
  // Same response whether or not the email already existed (no account enumeration).
  return { user: publicUser(data.user), message: 'If the email is valid, a verification link has been sent.' };
}

export async function login({ email, password }) {
  const { data, error } = await createAnonClient().auth.signInWithPassword({ email, password });
  if (error) throw fail(error, 'Invalid email or password');
  return { user: publicUser(data.user), session: session(data.session) };
}

export async function refresh({ refreshToken }) {
  const { data, error } = await createAnonClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error) throw fail(error, 'Invalid refresh token');
  return { user: publicUser(data.user), session: session(data.session) };
}

export async function logout(accessToken) {
  const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, 'global');
  if (error) throw fail(error, 'Logout failed');
}

export async function forgotPassword({ email }) {
  await createAnonClient().auth.resetPasswordForEmail(email, { redirectTo: `${env.APP_URL}/auth/reset` }).catch(() => {});
  return { message: 'If the account exists, a reset link has been sent.' };
}

export async function resendVerification({ email }) {
  await createAnonClient().auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${env.APP_URL}/auth/callback` } }).catch(() => {});
  return { message: 'If the account exists and is unverified, a new link has been sent.' };
}

export async function updatePassword(userId, password) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (error) throw fail(error, 'Password update failed');
}
