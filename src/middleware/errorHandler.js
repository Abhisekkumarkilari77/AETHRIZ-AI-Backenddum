import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { isProd } from '../config/env.js';

export const notFoundHandler = (req, _res, next) =>
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500, code = 'INTERNAL_ERROR', message = 'Something went wrong', details;

  if (err instanceof AppError) ({ status, code, message, details } = err);
  else if (err?.type === 'entity.parse.failed') [status, code, message] = [400, 'INVALID_JSON', 'Malformed JSON body'];
  else if (err?.type === 'entity.too.large') [status, code, message] = [413, 'PAYLOAD_TOO_LARGE', 'Request body too large'];

  if (status >= 500) logger.error('unhandled_error', { requestId: req.id, path: req.path, err: err?.message, stack: isProd ? undefined : err?.stack });

  res.status(status).json({ error: { code, message, ...(details && { details }), requestId: req.id } });
}
