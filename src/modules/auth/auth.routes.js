import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import * as c from './auth.controller.js';
import * as s from './auth.schemas.js';

const r = Router();
r.post('/register', validate({ body: s.registerBody }), c.register);
r.post('/login', validate({ body: s.loginBody }), c.login);
r.post('/refresh', validate({ body: s.refreshBody }), c.refresh);
r.post('/password/forgot', validate({ body: s.emailBody }), c.forgotPassword);
r.post('/verification/resend', validate({ body: s.emailBody }), c.resendVerification);
r.post('/logout', authenticate, c.logout);
r.post('/password/update', authenticate, validate({ body: s.passwordUpdateBody }), c.updatePassword);
export default r;
