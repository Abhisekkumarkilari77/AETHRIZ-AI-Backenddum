import { z } from 'zod';

export const updateProfileBody = z.object({
  fullName: z.string().trim().min(1).max(120),
  countryCode: z.string().regex(/^[A-Z]{2}$/, 'ISO 3166-1 alpha-2, uppercase'),
  preferredLanguage: z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/),
  dateOfBirth: z.iso.date(),
}).partial().strict().refine(o => Object.keys(o).length > 0, 'At least one field is required');
