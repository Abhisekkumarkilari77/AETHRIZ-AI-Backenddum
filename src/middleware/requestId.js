import { randomUUID } from 'node:crypto';

export function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.set('x-request-id', req.id);
  next();
}
