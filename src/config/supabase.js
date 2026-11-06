import { createAdminClient, createContextClient } from '@supabase/server/core';

/** Trusted backend client (bypasses RLS). Never hand this to user-controlled code paths. */
export const supabaseAdmin = createAdminClient();

/** Fresh publishable client per call: auth calls attach sessions to the client, so never share one. */
export const createAnonClient = () => createContextClient();

/** Client bound to the caller's JWT: every query is enforced by RLS as that user. */
export const createUserClient = accessToken => createContextClient({ auth: { token: accessToken } });
