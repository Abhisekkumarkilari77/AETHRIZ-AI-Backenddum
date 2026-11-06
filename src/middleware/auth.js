import { supabaseAdmin } from '../config/supabase.js';
import { forbidden, unauthorized } from '../utils/errors.js';

/**
 * Verifies the Supabase JWT on every protected request (server-side, via Supabase Auth, so
 * revoked/expired sessions are rejected) and loads the role from user_profiles.
 * Sets req.user = { id, email, emailVerified, role, token }.
 */
export async function authenticate(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw unauthorized();

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) throw unauthorized('Invalid or expired token');

  const { data: profile, error: pErr } = await supabaseAdmin
    .from('user_profiles')
    .select('role, deleted_at')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!profile || profile.deleted_at) throw forbidden('Account is disabled', 'ACCOUNT_DISABLED');

  req.user = {
    id: data.user.id,
    email: data.user.email,
    emailVerified: Boolean(data.user.email_confirmed_at),
    role: profile.role,
    token,
  };
  next();
}

export const requireVerifiedEmail = (req, _res, next) => {
  if (!req.user?.emailVerified) throw forbidden('Email verification required', 'EMAIL_NOT_VERIFIED');
  next();
};

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user?.role)) throw forbidden('Insufficient permissions');
  next();
};
