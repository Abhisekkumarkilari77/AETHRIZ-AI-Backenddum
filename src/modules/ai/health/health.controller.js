import { supabaseAdmin } from '../../../config/supabase.js';
import { runHealthAnalysis } from './health.service.js';
import { AppError } from '../../../utils/errors.js';

// Fixed anonymous UUID for unauthenticated requests
const ANON_USER_ID = null;

export async function analyseHealth(req, res) {
  try {
    const result = await runHealthAnalysis(req.body);

    // Save to Supabase (best-effort, don't fail if it errors)
    const { data: record } = await supabaseAdmin
      .from('health_analyses')
      .insert({ user_id: ANON_USER_ID, status: 'completed', input: req.body, result, language_code: req.body.language_code ?? 'en' })
      .select('id').single();

    res.status(200).json({ analysisId: record?.id, result });
  } catch (err) {
    throw new AppError(502, 'AI_ERROR', err.message || 'Health analysis failed.');
  }
}

export async function listHealthAnalyses(req, res) {
  const { data, error } = await supabaseAdmin
    .from('health_analyses')
    .select('id, status, language_code, created_at')
    .eq('user_id', ANON_USER_ID)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  res.json(data);
}

export async function getHealthAnalysis(req, res) {
  const { data, error } = await supabaseAdmin
    .from('health_analyses')
    .select('id, status, result, input, language_code, created_at')
    .eq('id', req.params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'NOT_FOUND', 'Analysis not found');
  res.json(data);
}
