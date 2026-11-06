import { Router } from 'express';
import { supabaseAdmin } from '../../config/supabase.js';

const r = Router();
r.get('/live', (_req, res) => res.json({ status: 'ok' }));
r.get('/ready', async (_req, res) => {
  const { error } = await supabaseAdmin.from('supported_languages').select('id', { head: true, count: 'exact' }).limit(1);
  res.status(error ? 503 : 200).json({ status: error ? 'unavailable' : 'ok', checks: { database: error ? 'down' : 'up' } });
});
export default r;
