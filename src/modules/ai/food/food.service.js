import { getModel, generateJSONFromImage } from '../../../services/gemini.js';

const SYSTEM_INSTRUCTION = `You are the AETHRIZ Food and Product Analysis AI.

Your task is to analyse uploaded food and product images.

Instructions:
1. Identify the visible food items or products.
2. Classify the image as: meal, snack, beverage, packaged_product, nutrition_label, or unsupported.
3. Identify visible ingredients where possible.
4. Extract nutritional values from readable product labels.
5. Estimate food portion sizes only when visually reasonable.
6. Estimate nutritional values only when sufficient information is available.
7. Distinguish label-derived values from estimated values using nutrition_source field.
8. Never invent calories, protein, fibre, or other nutrients.
9. Explain assumptions and uncertainty.
10. Identify allergens only when supported by readable labels or user-provided information.
11. Generate relevant dietary recommendations.
12. Consider user-provided dietary preferences and goals.
13. Do not diagnose medical conditions.
14. Return the analysis in the specified JSON schema.
15. If the image is unclear or food cannot be identified, set image_quality to "poor" and explain in limitations.
16. Respond in the language specified by the language_code field.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    feature: { type: 'string' },
    language_code: { type: 'string' },
    image_category: { type: 'string' },
    image_quality: { type: 'string' },
    identified_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          estimated_portion: { type: 'string' },
          identification_confidence: { type: 'string' },
        },
        required: ['name', 'identification_confidence'],
      },
    },
    ingredients: { type: 'array', items: { type: 'string' } },
    allergens: { type: 'array', items: { type: 'string' } },
    product_details: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        brand: { type: 'string' },
        serving_size: { type: 'string' },
        barcode: { type: 'string' },
      },
    },
    nutrition: {
      type: 'object',
      properties: {
        calories_kcal: { type: 'number' },
        protein_g: { type: 'number' },
        carbohydrates_g: { type: 'number' },
        fat_g: { type: 'number' },
        fibre_g: { type: 'number' },
        sugar_g: { type: 'number' },
        sodium_mg: { type: 'number' },
      },
    },
    nutrition_source: { type: 'string' },
    assumptions: { type: 'array', items: { type: 'string' } },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['category', 'suggestion'],
      },
    },
    limitations: { type: 'array', items: { type: 'string' } },
  },
  required: ['feature', 'image_category', 'image_quality', 'identified_items', 'nutrition', 'nutrition_source', 'limitations'],
};

export async function runFoodScan(input) {
  const { image_base64, mime_type, language_code, ...userContext } = input;

  const textPrompt = `Analyse this food or product image and return a JSON report.

User context:
${JSON.stringify(userContext, null, 2)}

Respond in language: ${language_code}
Return valid JSON matching the required schema.`;

  const model = getModel(SYSTEM_INSTRUCTION, RESPONSE_SCHEMA);
  const result = await generateJSONFromImage(model, image_base64, mime_type, textPrompt);

  result.feature = 'food_scanning';
  result.language_code = language_code;

  // Null out any nutrition fields that Gemini may have hallucinated as 0
  // (0 is a valid value only for explicitly label-derived data)
  if (result.nutrition_source === 'image_estimation') {
    for (const key of Object.keys(result.nutrition ?? {})) {
      if (result.nutrition[key] === 0) result.nutrition[key] = null;
    }
  }

  return result;
}
