import { createUserClient, supabaseAdmin } from '../../config/supabase.js';
import { AppError, notFound } from '../../utils/errors.js';

const COLS = 'id, user_id, full_name, phone, role, country_code, preferred_language, date_of_birth, avatar_path, created_at, updated_at';
const toApi = r => ({
  id: r.id, userId: r.user_id, fullName: r.full_name, phone: r.phone, role: r.role, countryCode: r.country_code,
  preferredLanguage: r.preferred_language, dateOfBirth: r.date_of_birth, avatarPath: r.avatar_path,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// Reads/writes use the caller's JWT, so Postgres RLS + column grants are the enforcement layer.
export async function getMe(token) {
  const { data, error } = await createUserClient(token).from('user_profiles').select(COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound('Profile not found');
  return toApi(data);
}

export async function updateMe(token, userId, input) {
  const patch = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.countryCode !== undefined) patch.country_code = input.countryCode;
  if (input.preferredLanguage !== undefined) patch.preferred_language = input.preferredLanguage;
  if (input.dateOfBirth !== undefined) patch.date_of_birth = input.dateOfBirth;

  const { data, error } = await createUserClient(token).from('user_profiles')
    .update(patch).eq('user_id', userId).select(COLS).maybeSingle();
  if (error?.code === '23503') throw new AppError(400, 'UNSUPPORTED_LANGUAGE', 'Language is not supported');
  if (error) throw error;
  if (!data) throw notFound('Profile not found');
  return toApi(data);
}

/** Soft delete (trusted path): disables the account everywhere and revokes sessions. */
export async function deleteMe(userId, token) {
  const { error } = await supabaseAdmin.from('user_profiles').update({ deleted_at: new Date().toISOString() }).eq('user_id', userId);
  if (error) throw error;
  await supabaseAdmin.auth.admin.signOut(token, 'global');
}
