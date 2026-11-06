import { z } from 'zod';

export const healthAnalysisBody = z.object({
  // Basic profile
  age: z.number().int().min(1).max(120).optional(),
  sex: z.enum(['female', 'male', 'other', 'prefer_not_to_say']).optional(),
  height_cm: z.number().min(50).max(272).optional(),
  weight_kg: z.number().min(2).max(700).optional(),

  // Health profile
  medical_conditions: z.array(z.string().max(100)).max(20).default([]),
  allergies: z.array(z.string().max(100)).max(20).default([]),
  health_concerns: z.array(z.string().max(200)).max(10).default([]),

  // Lifestyle
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
  exercise_frequency: z.string().max(100).optional(),
  occupation_type: z.string().max(100).optional(),

  // Food habits
  meal_frequency: z.number().int().min(1).max(10).optional(),
  diet_preference: z.string().max(60).optional(),
  food_habits_notes: z.string().max(500).optional(),

  // Sleep
  sleep_hours: z.number().min(0).max(24).optional(),
  sleep_schedule: z.string().max(100).optional(),
  sleep_quality: z.enum(['poor', 'fair', 'good', 'excellent']).optional(),

  // Hydration
  water_intake_litres: z.number().min(0).max(20).optional(),

  // Mental wellbeing (self-reported, 1–10)
  stress_level: z.number().int().min(1).max(10).optional(),
  mood_level: z.number().int().min(1).max(10).optional(),
  energy_level: z.number().int().min(1).max(10).optional(),

  // Goals
  goals: z.array(z.string().max(100)).max(10).default([]),

  // Additional context
  notes: z.string().max(1000).optional(),

  // Response language
  language_code: z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/).default('en'),
}).strict();
