import { getModel, generateJSON } from '../../../services/gemini.js';

const SYSTEM_INSTRUCTION = `You are AETHRIZ Health AI. Analyse user health data and return a SHORT JSON report. Be concise. No long text.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    feature: { type: 'string' },
    language_code: { type: 'string' },
    summary: { type: 'string' },
    bmi: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        category: { type: 'string' },
        note: { type: 'string' },
      },
    },
    observations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          observation: { type: 'string' },
          basis: { type: 'string' },
        },
        required: ['category', 'observation', 'basis'],
      },
    },
    positive_habits: { type: 'array', items: { type: 'string' } },
    areas_for_improvement: { type: 'array', items: { type: 'string' } },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          suggestion: { type: 'string' },
          reasoning: { type: 'string' },
        },
        required: ['category', 'suggestion'],
      },
    },
    charts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          chart_type: { type: 'string' },
          title: { type: 'string' },
          data: { type: 'object' },
        },
        required: ['chart_type', 'title', 'data'],
      },
    },
    missing_information: { type: 'array', items: { type: 'string' } },
    limitations: { type: 'array', items: { type: 'string' } },
  },
  required: ['feature', 'summary', 'observations', 'recommendations', 'missing_information', 'limitations'],
};

/** Calculates BMI server-side (not delegated to AI). */
function calculateBMI(height_cm, weight_kg) {
  if (!height_cm || !weight_kg) return null;
  const bmi = weight_kg / ((height_cm / 100) ** 2);
  const value = Math.round(bmi * 10) / 10;
  let category;
  if (value < 18.5) category = 'underweight';
  else if (value < 25) category = 'normal';
  else if (value < 30) category = 'overweight';
  else category = 'obese';
  return { value, category };
}

export async function runHealthAnalysis(input) {
  const bmi = calculateBMI(input.height_cm, input.weight_kg);

  const prompt = `Analyse this health data and return JSON with these exact keys: feature, summary, bmi(value,category), observations(array of {category,observation,basis}), positive_habits(array), areas_for_improvement(array), recommendations(array of {category,suggestion}), missing_information(array), limitations(array). Be brief.

Data: ${JSON.stringify({ ...input, bmi_calculated: bmi })}
Language: ${input.language_code}`;

  const model = getModel(SYSTEM_INSTRUCTION);
  const result = await generateJSON(model, prompt);

  // Enforce feature tag and inject server-calculated BMI
  result.feature = 'health_analysis';
  result.language_code = input.language_code;
  if (bmi) result.bmi = { ...bmi, note: 'Calculated from user-provided height and weight. BMI is a screening tool, not a diagnostic measure.' };

  return result;
}
