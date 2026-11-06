const err = { description: 'Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } };
const body = ref => ({ required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } });
const secured = [{ bearerAuth: [] }];

export const openapi = {
  openapi: '3.0.3',
  info: { title: 'AETHRIZ AI API', version: '0.1.0', description: 'Phase 1: foundation, authentication and profile.' },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' }, details: { type: 'array', items: { type: 'object' } } } } } },
      Register: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8, maxLength: 72 }, fullName: { type: 'string' } } },
      Login: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } },
      Refresh: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } },
      Email: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
      Password: { type: 'object', required: ['password'], properties: { password: { type: 'string', minLength: 8 } } },
      ProfileUpdate: { type: 'object', properties: { fullName: { type: 'string' }, countryCode: { type: 'string', example: 'IN' }, preferredLanguage: { type: 'string', example: 'te' }, dateOfBirth: { type: 'string', format: 'date' } } },
    },
  },
  paths: {
    '/health/live': { get: { tags: ['Health'], summary: 'Liveness', responses: { 200: { description: 'OK' } } } },
    '/health/ready': { get: { tags: ['Health'], summary: 'Readiness (checks database)', responses: { 200: { description: 'OK' }, 503: err } } },
    '/api/v1/auth/register': { post: { tags: ['Auth'], summary: 'Register (email verification required)', requestBody: body('Register'), responses: { 201: { description: 'Created' }, 400: err } } },
    '/api/v1/auth/login': { post: { tags: ['Auth'], summary: 'Login', requestBody: body('Login'), responses: { 200: { description: 'Session' }, 401: err, 403: err } } },
    '/api/v1/auth/refresh': { post: { tags: ['Auth'], summary: 'Refresh session', requestBody: body('Refresh'), responses: { 200: { description: 'Session' }, 401: err } } },
    '/api/v1/auth/logout': { post: { tags: ['Auth'], summary: 'Logout (revokes all sessions)', security: secured, responses: { 204: { description: 'Done' }, 401: err } } },
    '/api/v1/auth/password/forgot': { post: { tags: ['Auth'], summary: 'Send password reset email', requestBody: body('Email'), responses: { 200: { description: 'Always generic' } } } },
    '/api/v1/auth/password/update': { post: { tags: ['Auth'], summary: 'Set a new password', security: secured, requestBody: body('Password'), responses: { 204: { description: 'Done' }, 400: err, 401: err } } },
    '/api/v1/auth/verification/resend': { post: { tags: ['Auth'], summary: 'Resend verification email', requestBody: body('Email'), responses: { 200: { description: 'Always generic' } } } },
    '/api/v1/profile/me': {
      get: { tags: ['Profile'], summary: 'Get my profile', security: secured, responses: { 200: { description: 'Profile' }, 401: err } },
      patch: { tags: ['Profile'], summary: 'Update my profile', security: secured, requestBody: body('ProfileUpdate'), responses: { 200: { description: 'Profile' }, 400: err, 401: err } },
      delete: { tags: ['Profile'], summary: 'Delete my account (soft delete)', security: secured, responses: { 204: { description: 'Done' }, 401: err } },
    },
  },
};
