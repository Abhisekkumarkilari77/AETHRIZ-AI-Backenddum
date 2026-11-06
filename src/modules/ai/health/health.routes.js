import { Router } from 'express';
import { validate } from '../../../middleware/validate.js';
import { healthAnalysisBody } from './health.schemas.js';
import { analyseHealth, listHealthAnalyses, getHealthAnalysis } from './health.controller.js';

const router = Router();

router.post('/', validate({ body: healthAnalysisBody }), analyseHealth);
router.get('/', listHealthAnalyses);
router.get('/:id', getHealthAnalysis);

export default router;
