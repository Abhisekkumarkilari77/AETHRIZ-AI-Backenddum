import { AppError } from '../utils/errors.js';

/** validate({ body, query, params }) -> parsed values on req.valid.{body,query,params} */
export const validate = schemas => (req, _res, next) => {
  req.valid = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const r = schemas[part].safeParse(req[part] ?? {});
    if (!r.success) {
      const details = r.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }));
      return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid request', details));
    }
    req.valid[part] = r.data;
  }
  next();
};
