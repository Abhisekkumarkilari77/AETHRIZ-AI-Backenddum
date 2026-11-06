import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as c from './profile.controller.js';
import { updateProfileBody } from './profile.schemas.js';

const r = Router();
r.use(authenticate);
r.get('/me', c.getMe);
r.patch('/me', validate({ body: updateProfileBody }), c.updateMe);
r.delete('/me', c.deleteMe);
export default r;
