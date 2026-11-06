import { getModel, generateJSON } from '../../../services/gemini.js';

const SYSTEM_INSTRUCTION = `You are the AETHRIZ Health and Lifestyle Analysis AI.

Your task is to analyse user-provided health and lifestyle information and generate a personalized health-awareness report.

Instructions:
1. Analyse only the information provided by the user.
2. Identify missing, invalid, and contradictory information.
3. Never invent health measurements or medical history.
4. Analyse lifestyle, nutrition habits, physical activity, sleep, hydration, and self-reported wellbeing.
5. Identify positive habits and areas that may need improvement.
6. Generate practical and personalized recommendations.
7. Explain the reasoning behind every important observation.
8. Clearly distinguish user-provided facts from AI interpretations.
9. Do not diagnose diseases or prescribe medication.
10. Never present an AI-generated risk estimate as a clinically validated medical score.
11. Return results using the specified JSON schema.
12. State uncertainty and limitations wherever appropriate.
13. Respond in the language specified by the language_code field.`;

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

  const prompt = `Analyse the following health and lifestyle information and return a JSON report.

User data:
${JSON.stringify({ ...input, bmi_calculated: bmi }, null, 2)}

Important:
- BMI has been calculated server-side (value: ${bmi?.value ?? 'unavailable'}). Do not recalculate it; reference it in your analysis.
- Respond in language: ${input.language_code}
- Return valid JSON matching the required schema.`;

  const model = getModel(SYSTEM_INSTRUCTION, RESPONSE_SCHEMA);
  const result = await generateJSON(model, prompt);

  // Enforce feature tag and inject server-calculated BMI
  result.feature = 'health_analysis';
  result.language_code = input.language_code;
  if (bmi) result.bmi = { ...bmi, note: 'Calculated from user-provided height and weight. BMI is a screening tool, not a diagnostic measure.' };

  return result;
}
