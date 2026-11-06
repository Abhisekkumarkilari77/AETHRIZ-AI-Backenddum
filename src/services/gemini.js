import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

/**
 * Returns a configured Gemini model instance.
 * @param {string} systemInstruction
 * @param {object} [responseSchema] – JSON schema for structured output
 */
export function getModel(systemInstruction, responseSchema) {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'AI service is not configured');
  }

  const generationConfig = { temperature: 0.2, maxOutputTokens: 1500 };
  if (responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = responseSchema;
  }
  return new GoogleGenerativeAI(env.GEMINI_API_KEY).getGenerativeModel({
    model: env.GEMINI_MODEL,
    systemInstruction,
    generationConfig,
  });
}

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    throw new Error('Gemini returned non-JSON response');
  }
}

/** Text-only prompt → parsed JSON. */
export async function generateJSON(model, prompt) {
  const result = await model.generateContent(prompt);
  return parseJSON(result.response.text());
}

/** Image + optional text → parsed JSON. */
export async function generateJSONFromImage(model, imageBase64, mimeType, textPrompt = 'Analyse this image.') {
  const parts = [
    { inlineData: { data: imageBase64, mimeType } },
    { text: textPrompt },
  ];
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  return parseJSON(result.response.text());
}
