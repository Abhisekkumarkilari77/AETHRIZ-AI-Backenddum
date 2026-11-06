import { runFoodScan } from './food.service.js';
import { AppError } from '../../../utils/errors.js';

export async function scanFood(req, res) {
  try {
    const result = await runFoodScan(req.body);
    res.status(200).json({ result });
  } catch (err) {
    throw new AppError(502, 'AI_ERROR', err.message || 'Food scan failed. Please try again.');
  }
}

export async function getFoodScan(req, res) {
  res.json({ message: 'History requires authentication.' });
}

export async function listFoodScans(req, res) {
  res.json([]);
}
