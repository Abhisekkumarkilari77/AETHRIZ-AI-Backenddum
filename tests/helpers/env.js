Object.assign(process.env, {
  NODE_ENV: 'test',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
  SUPABASE_SECRET_KEY: 'test-secret-key',
  SUPABASE_JWKS_URL: 'http://localhost:54321/auth/v1/.well-known/jwks.json',
  GEMINI_API_KEY: 'test-gemini-api-key',
  IP_HASH_SALT: 'test-salt-test-salt-test-salt',
  CORS_ORIGINS: 'http://allowed.test',
  RATE_LIMIT_AUTH_PER_15MIN: '1000',
});
