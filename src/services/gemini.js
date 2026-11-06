import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

function parseJSON(text) {
  try { return JSON.parse(text); }
  catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    throw new Error('Gemini returned non-JSON response');
  }
}

async function withRetry(fn, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

export function getModel(systemInstruction) {
  return genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    systemInstruction,
    generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
  });
}

export async function generateJSON(model, prompt) {
  return withRetry(async () => {
    const result = await model.generateContent(prompt);
    return parseJSON(result.response.text());
  });
}

export async function generateJSONFromImage(model, imageBase64, mimeType, textPrompt = 'Analyse this image.') {
  return withRetry(async () => {
    const parts = [
      { inlineData: { data: imageBase64, mimeType } },
      { text: textPrompt },
    ];
    const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
    return parseJSON(result.response.text());
  });
}
