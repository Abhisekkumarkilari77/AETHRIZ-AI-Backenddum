import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform(v => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SECRET_KEY: z.string().min(10),
  SUPABASE_JWKS_URL: z.url(),
  CORS_ORIGINS: z.string().default('').transform(s => s.split(',').map(x => x.trim()).filter(Boolean)),
  APP_URL: z.url().default('http://localhost:3000'),
  IP_HASH_SALT: z.string().min(16),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  DOCS_ENABLED: bool.default(true),
  RATE_LIMIT_GLOBAL_PER_MIN: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_AUTH_PER_15MIN: z.coerce.number().int().positive().default(20),
  GEMINI_API_KEY: z.string().min(10).optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast with variable names only (never print values - they may be secrets).
  const names = [...new Set(parsed.error.issues.map(i => i.path.join('.')))];
  throw new Error(`Invalid environment configuration: ${names.join(', ')}`);
}

export const env = Object.freeze(parsed.data);
export const isProd = env.NODE_ENV === 'production';
