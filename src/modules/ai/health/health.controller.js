import { runHealthAnalysis } from './health.service.js';
import { AppError } from '../../../utils/errors.js';

export async function analyseHealth(req, res) {
  try {
    const result = await runHealthAnalysis(req.body);
    res.status(200).json({ result });
  } catch (err) {
    throw new AppError(502, 'AI_ERROR', err.message || 'Health analysis failed. Please try again.');
  }
}
