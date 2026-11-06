import { Router } from 'express';
import express from 'express';
import { validate } from '../../../middleware/validate.js';
import { foodScanBody } from './food.schemas.js';
import { scanFood } from './food.controller.js';

const router = Router();

router.post('/', express.json({ limit: '10mb' }), validate({ body: foodScanBody }), scanFood);

export default router;
