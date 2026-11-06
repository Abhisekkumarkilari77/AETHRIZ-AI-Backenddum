import { jest } from '@jest/globals';

test('invalid environment fails fast naming variables but not values', async () => {
  jest.resetModules();
  const saved = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'short';
  await expect(import('../../src/config/env.js?bad')).rejects.toThrow(/SUPABASE_SECRET_KEY/);
  await import('../../src/config/env.js?bad').catch(e => expect(e.message).not.toContain('short'));
  process.env.SUPABASE_SECRET_KEY = saved;
});

test('Gemini key is optional for non-AI server routes', async () => {
  jest.resetModules();
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const { env } = await import('../../src/config/env.js?without-gemini');
    expect(env.GEMINI_API_KEY).toBeUndefined();
  } finally {
    if (saved === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = saved;
  }
});
