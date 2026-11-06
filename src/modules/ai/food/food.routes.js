import { Router } from 'express';
import express from 'express';
import { validate } from '../../../middleware/validate.js';
import { foodScanBody } from './food.schemas.js';
import { scanFood, listFoodScans, getFoodScan } from './food.controller.js';

const router = Router();

router.post('/', express.json({ limit: '10mb' }), validate({ body: foodScanBody }), scanFood);
router.get('/', listFoodScans);
router.get('/:id', getFoodScan);

export default router;
