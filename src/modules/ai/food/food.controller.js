import { supabaseAdmin } from '../../../config/supabase.js';
import { runFoodScan } from './food.service.js';
import { AppError } from '../../../utils/errors.js';

const ANON_USER_ID = null;

export async function scanFood(req, res) {
  try {
    const result = await runFoodScan(req.body);

    const { data: record } = await supabaseAdmin
      .from('food_scans')
      .insert({ user_id: ANON_USER_ID, image_path: 'inline', status: 'completed', result, language_code: req.body.language_code ?? 'en' })
      .select('id').single();

    res.status(200).json({ scanId: record?.id, result });
  } catch (err) {
    throw new AppError(502, 'AI_ERROR', err.message || 'Food scan failed.');
  }
}

export async function listFoodScans(req, res) {
  const { data, error } = await supabaseAdmin
    .from('food_scans')
    .select('id, status, language_code, created_at')
    .eq('user_id', ANON_USER_ID)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  res.json(data);
}

export async function getFoodScan(req, res) {
  const { data, error } = await supabaseAdmin
    .from('food_scans')
    .select('id, status, result, language_code, created_at')
    .eq('id', req.params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'NOT_FOUND', 'Scan not found');
  res.json(data);
}
