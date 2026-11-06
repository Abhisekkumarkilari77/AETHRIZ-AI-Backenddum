import * as svc from './auth.service.js';
import { audit } from '../../utils/audit.js';

export const register = async (req, res) => res.status(201).json(await svc.register(req.valid.body));

export const login = async (req, res) => {
  const out = await svc.login(req.valid.body);
  audit(req, 'auth.login', { actorId: out.user.id });
  res.json(out);
};

export const refresh = async (req, res) => res.json(await svc.refresh(req.valid.body));

export const logout = async (req, res) => {
  await svc.logout(req.user.token);
  audit(req, 'auth.logout');
  res.status(204).end();
};

export const forgotPassword = async (req, res) => res.json(await svc.forgotPassword(req.valid.body));
export const resendVerification = async (req, res) => res.json(await svc.resendVerification(req.valid.body));

export const updatePassword = async (req, res) => {
  await svc.updatePassword(req.user.id, req.valid.body.password);
  audit(req, 'auth.password_changed');
  res.status(204).end();
};
