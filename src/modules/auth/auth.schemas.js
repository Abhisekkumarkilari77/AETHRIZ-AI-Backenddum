import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().min(8).max(72)
  .refine(v => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must contain a letter and a number');

export const registerBody = z.object({
  email, password, fullName: z.string().trim().min(1).max(120).optional(),
}).strict();
export const loginBody = z.object({ email, password: z.string().min(1).max(72) }).strict();
export const refreshBody = z.object({ refreshToken: z.string().min(10).max(2048) }).strict();
export const emailBody = z.object({ email }).strict();
export const passwordUpdateBody = z.object({ password }).strict();
