import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  MealPlan,
  MealSlot,
  Patient,
  Recipe,
  RecipeCategory,
} from '../types';
import { calculateAge, calculateBMI, MacroTotals } from './nutrition';

export interface GroundingSource {
  title: string;
  uri: string;
  domain: string;
}

export type ScientificLibraryFocus =
  | 'all'
  | 'pubmed_cochrane'
  | 'guidelines'
  | 'sports'
  | 'brazil';

export const LIBRARY_FOCUS_LABELS: Record<ScientificLibraryFocus, string> = {
  all: 'Todas as bibliotecas',
  pubmed_cochrane: 'PubMed & Cochrane',
  guidelines: 'Diretrizes (ESPEN / SBD / ABESO)',
  sports: 'Esportiva (ISSN / ACSM)',
  brazil: 'Brasil (SciELO / TACO / MS)',
};

export interface ResearchResult {
  answer: string;
  sources: GroundingSource[];
  searchQueries: string[];
  generatedAt: string;
}

export interface PlanAuditResult {
  analysis: string;
  sources: GroundingSource[];
  searchQueries: string[];
  generatedAt: string;
}

export interface GeneratedPlanResponse {
  plan: {
    title: string;
    objectiveSummary: string;
    generalGuidance: string;
    scientificRationale: string;
    meals: Array<{
      time: string;
      name: string;
      notes: string;
      items: Array<{
        recipeId?: string;
        name: string;
        portion: string;
        calories: number;
        proteinG: number;
        carbsG: number;
        fatG: number;
        fiberG: number;
        substitution: string;
      }>;
    }>;
  };
  sources: GroundingSource[];
  searchQueries: string[];
  generatedAt: string;
}

export interface GeneratedRecipeResponse {
  recipe: {
    title: string;
    category: RecipeCategory;
    description: string;
    prepTimeMin: number;
    servings: number;
    portionLabel: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    dietaryTags: string[];
    ingredients: string[];
    instructions: string[];
    clinicalTip: string;
    scientificRationale: string;
  };
  sources: GroundingSource[];
  searchQueries: string[];
  generatedAt: string;
}

function buildPatientContextPayload(patient: Patient) {
  return {
    fullName: patient.fullName,
    sex: patient.sex === 'F' ? 'Feminino' : 'Masculino',
    age: calculateAge(patient.birthYear),
    weightKg: patient.weightKg,
    heightCm: patient.heightCm,
    bmi: calculateBMI(patient.weightKg, patient.heightCm),
    activityLabel: ACTIVITY_LABELS[patient.activityLevel],
    goalLabel: GOAL_LABELS[patient.goal],
    restrictions: patient.restrictions,
    clinicalNotes: patient.clinicalNotes,
    targetCalories: patient.targetCalories,
    targetProteinG: patient.targetProteinG,
    targetCarbsG: patient.targetCarbsG,
    targetFatG: patient.targetFatG,
    waterTargetLiters: patient.waterTargetLiters,
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error || `Falha na comunicação com o servidor (HTTP ${res.status}).`
    );
  }
  return data as T;
}

export function queryNutritionScience(params: {
  query: string;
  libraryFocus: ScientificLibraryFocus;
  patient?: Patient | null;
}): Promise<ResearchResult> {
  return postJson<ResearchResult>('/api/nutrition-ai/research', {
    query: params.query,
    libraryFocus: params.libraryFocus,
    patientContext: params.patient
      ? buildPatientContextPayload(params.patient)
      : undefined,
  });
}

export function auditMealPlanWithScience(params: {
  patient: Patient;
  plan: Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt'> & { meals: MealSlot[] };
  totals: MacroTotals;
}): Promise<PlanAuditResult> {
  return postJson<PlanAuditResult>('/api/nutrition-ai/analyze-plan', {
    patient: buildPatientContextPayload(params.patient),
    plan: params.plan,
    totals: params.totals,
  });
}

export function generateEvidenceMealPlan(params: {
  patient: Patient;
  availableRecipes: Recipe[];
  customInstruction?: string;
}): Promise<GeneratedPlanResponse> {
  return postJson<GeneratedPlanResponse>('/api/nutrition-ai/generate-plan', {
    patient: buildPatientContextPayload(params.patient),
    availableRecipes: params.availableRecipes.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      portionLabel: r.portionLabel,
      calories: r.calories,
      proteinG: r.proteinG,
      carbsG: r.carbsG,
      fatG: r.fatG,
      fiberG: r.fiberG,
      dietaryTags: r.dietaryTags,
    })),
    customInstruction: params.customInstruction || '',
  });
}

export interface DimitraChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface DimitraGuestProfile {
  name?: string;
  goal?: string;
  restrictions?: string;
}

export interface DimitraConsultationResponse {
  reply: string;
  sources: GroundingSource[];
  searchQueries: string[];
  suggestedFollowUps: string[];
  generatedAt: string;
}

export function generateEvidenceRecipe(params: {
  goalPrompt: string;
  category: RecipeCategory;
  restrictions: string;
  targetCalories: number;
}): Promise<GeneratedRecipeResponse> {
  return postJson<GeneratedRecipeResponse>('/api/nutrition-ai/generate-recipe', params);
}

export function sendDimitraConsultationMessage(params: {
  messages: DimitraChatTurn[];
  mode: 'consulta' | 'anamnese' | 'plano_substituicoes' | 'suplementacao';
  patient?: Patient | null;
  activePlan?: MealPlan | null;
  availableRecipes?: Recipe[];
  guestProfile?: DimitraGuestProfile;
}): Promise<DimitraConsultationResponse> {
  return postJson<DimitraConsultationResponse>('/api/nutrition-ai/dimitra-chat', {
    messages: params.messages,
    mode: params.mode,
    patientContext: params.patient
      ? buildPatientContextPayload(params.patient)
      : undefined,
    activePlan: params.activePlan
      ? {
          title: params.activePlan.title,
          objectiveSummary: params.activePlan.objectiveSummary,
          generalGuidance: params.activePlan.generalGuidance,
          meals: params.activePlan.meals,
        }
      : undefined,
    availableRecipes: (params.availableRecipes || []).slice(0, 12).map((r) => ({
      title: r.title,
      portionLabel: r.portionLabel,
      calories: r.calories,
      proteinG: r.proteinG,
      carbsG: r.carbsG,
      fatG: r.fatG,
      dietaryTags: r.dietaryTags,
    })),
    guestProfile: params.guestProfile,
  });
}

export interface GeneratedCompoundingResponse {
  formula: {
    formulaTitle: string;
    pharmaceuticalForm: string;
    totalDoses: number;
    durationDays: number;
    posology: string;
    pharmacyNotes: string;
    clinicalRationale: string;
    precautions: string;
    actives: Array<{
      name: string;
      dosage: string;
      unit: string;
      purpose: string;
    }>;
    recommendedRecipes: string[];
  };
  sources: GroundingSource[];
  searchQueries: string[];
  generatedAt: string;
}

export function generateCompoundingFormula(params: {
  specialtyLabel: string;
  patientName: string;
  patient?: Patient | null;
  clinicalCaseNotes: string;
  allergies: string;
  availableRecipes: Recipe[];
}): Promise<GeneratedCompoundingResponse> {
  return postJson<GeneratedCompoundingResponse>(
    '/api/nutrition-ai/generate-compounding',
    {
      specialtyLabel: params.specialtyLabel,
      patientName: params.patientName,
      patientContext: params.patient
        ? buildPatientContextPayload(params.patient)
        : undefined,
      clinicalCaseNotes: params.clinicalCaseNotes,
      allergies: params.allergies,
      availableRecipes: params.availableRecipes.slice(0, 10).map((r) => ({
        title: r.title,
        portionLabel: r.portionLabel,
      })),
    }
  );
}
