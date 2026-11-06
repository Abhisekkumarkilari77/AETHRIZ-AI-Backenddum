import { z } from 'zod';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export const foodScanBody = z.object({
  // Base64-encoded image data (without data URI prefix)
  image_base64: z.string().min(100),
  mime_type: z.enum(ALLOWED_MIME),

  // Optional user context to personalise recommendations
  dietary_preferences: z.string().max(200).optional(),
  allergies: z.array(z.string().max(100)).max(20).default([]),
  goals: z.array(z.string().max(100)).max(10).default([]),
  notes: z.string().max(500).optional(),

  language_code: z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/).default('en'),
}).strict();
