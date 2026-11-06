import * as svc from './profile.service.js';
import { audit } from '../../utils/audit.js';

export const getMe = async (req, res) => res.json(await svc.getMe(req.user.token));

export const updateMe = async (req, res) => {
  const out = await svc.updateMe(req.user.token, req.user.id, req.valid.body);
  audit(req, 'profile.updated', { entityType: 'user_profile', entityId: out.id, metadata: { fields: Object.keys(req.valid.body) } });
  res.json(out);
};

export const deleteMe = async (req, res) => {
  await svc.deleteMe(req.user.id, req.user.token);
  audit(req, 'profile.deleted', { entityType: 'user_profile', entityId: req.user.id });
  res.status(204).end();
};
