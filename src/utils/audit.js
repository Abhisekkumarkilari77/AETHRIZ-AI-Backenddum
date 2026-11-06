import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from './logger.js';

export const hashIp = ip => (ip ? createHash('sha256').update(`${env.IP_HASH_SALT}:${ip}`).digest('hex') : null);

/** Fire-and-forget audit entry: an audit failure must never break the user's request. */
export function audit(req, action, { actorId, entityType, entityId, metadata = {} } = {}) {
  Promise.resolve(
    supabaseAdmin.from('audit_logs').insert({
      actor_id: actorId ?? req.user?.id ?? null,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      metadata,
      ip_hash: hashIp(req.ip),
    }),
  )
    .then(res => res?.error && logger.error('audit_failed', { action, code: res.error.code }))
    .catch(e => logger.error('audit_failed', { action, err: e?.message }));
}
