import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { openapi } from './docs/openapi.js';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import profileRoutes from './modules/profile/profile.routes.js';
import aiHealthRoutes from './modules/ai/health/health.routes.js';
import aiFoodRoutes from './modules/ai/food/food.routes.js';

const limiter = (windowMs, limit, code) => rateLimit({
  windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: { code, message: 'Too many requests', requestId: req.id } }),
});

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(requestId);

  // Swagger UI needs inline scripts, so it is mounted before the strict global Helmet policy.
  if (env.DOCS_ENABLED) {
    app.use('/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openapi));
    app.get('/openapi.json', (_req, res) => res.json(openapi));
  }

  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || env.NODE_ENV === 'development' || env.CORS_ORIGINS.includes(origin)),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    maxAge: 600,
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(limiter(60_000, env.RATE_LIMIT_GLOBAL_PER_MIN, 'RATE_LIMITED'));

  app.use('/health', healthRoutes);
  app.use('/api/v1/auth', limiter(15 * 60_000, env.RATE_LIMIT_AUTH_PER_15MIN, 'AUTH_RATE_LIMITED'), authRoutes);
  app.use('/api/v1/profile', profileRoutes);
  app.use('/api/v1/ai/health', aiHealthRoutes);
  app.use('/api/v1/ai/food', aiFoodRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
