import { getModel, generateJSONFromImage } from '../../../services/gemini.js';

const SYSTEM_INSTRUCTION = `You are AETHRIZ Food AI. Analyse food/product images and return a SHORT JSON report. Be concise.`;

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

  const textPrompt = `Analyse this food/product image. Return JSON with: feature, image_category(meal/snack/beverage/packaged_product/unsupported), image_quality(good/poor), identified_items(array of {name,estimated_portion,identification_confidence}), ingredients(array), allergens(array), nutrition({calories_kcal,protein_g,carbohydrates_g,fat_g,fibre_g,sugar_g,sodium_mg} use null if unknown), nutrition_source(label_derived or image_estimation), recommendations(array of {category,suggestion}), limitations(array). Be brief.

User context: ${JSON.stringify(userContext)}
Language: ${language_code}`;

  const model = getModel(SYSTEM_INSTRUCTION);
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
