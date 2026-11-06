import { Router } from 'express';
import { validate } from '../../../middleware/validate.js';
import { healthAnalysisBody } from './health.schemas.js';
import { analyseHealth } from './health.controller.js';

const router = Router();

router.post('/', validate({ body: healthAnalysisBody }), analyseHealth);

export default router;
