import {
  ActivityLevel,
  BiologicalSex,
  ClinicalGoal,
  MealPlan,
  MealSlot,
  Patient,
  Recipe,
  SCHEMA_LIMITS,
} from '../types';

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  intenso: 1.725,
  atleta: 1.9,
};

export function calculateAge(birthYear: number): number {
  const currentYear = new Date().getFullYear();
  return Math.max(1, Math.min(110, currentYear - birthYear));
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm) return 0;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function classifyBMI(bmi: number): string {
  if (bmi < 18.5) return 'Abaixo do peso';
  if (bmi < 25) return 'Eutrofia';
  if (bmi < 30) return 'Sobrepeso';
  if (bmi < 35) return 'Obesidade grau I';
  if (bmi < 40) return 'Obesidade grau II';
  return 'Obesidade grau III';
}

/**
 * Mifflin-St Jeor equation for Basal Metabolic Rate (TMB)
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  birthYear: number,
  sex: BiologicalSex
): number {
  const age = calculateAge(birthYear);
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'M' ? base + 5 : base - 161);
}

/**
 * Total Daily Energy Expenditure (GET)
 */
export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  birthYear: number,
  sex: BiologicalSex,
  activityLevel: ActivityLevel
): number {
  const bmr = calculateBMR(weightKg, heightCm, birthYear, sex);
  return Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);
}

/**
 * Suggests daily calorie, macro, and hydration targets based on clinical goal.
 */
export function suggestNutritionTargets(params: {
  weightKg: number;
  heightCm: number;
  birthYear: number;
  sex: BiologicalSex;
  activityLevel: ActivityLevel;
  goal: ClinicalGoal;
}) {
  const tdee = calculateTDEE(
    params.weightKg,
    params.heightCm,
    params.birthYear,
    params.sex,
    params.activityLevel
  );

  let calories = tdee;
  let proteinPerKg = 1.6;
  let fatRatio = 0.25;

  switch (params.goal) {
    case 'emagrecimento':
      calories = Math.max(1200, Math.round(tdee * 0.82));
      proteinPerKg = 1.8;
      fatRatio = 0.25;
      break;
    case 'hipertrofia':
      calories = Math.round(tdee * 1.12);
      proteinPerKg = 2.0;
      fatRatio = 0.24;
      break;
    case 'controle_glicemico':
      calories = Math.max(1300, Math.round(tdee * 0.92));
      proteinPerKg = 1.7;
      fatRatio = 0.3;
      break;
    case 'performance':
      calories = Math.round(tdee * 1.08);
      proteinPerKg = 1.8;
      fatRatio = 0.22;
      break;
    case 'reeducacao':
    default:
      calories = tdee;
      proteinPerKg = 1.5;
      fatRatio = 0.27;
      break;
  }

  const targetCalories = clamp(Math.round(calories / 10) * 10, 800, 6000);
  const targetProteinG = clamp(Math.round(params.weightKg * proteinPerKg), 20, 400);
  const targetFatG = clamp(Math.round((targetCalories * fatRatio) / 9), 10, 250);
  const remainingKcal = Math.max(0, targetCalories - targetProteinG * 4 - targetFatG * 9);
  const targetCarbsG = clamp(Math.round(remainingKcal / 4), 0, 800);
  const waterTargetLiters = clamp(Number(((params.weightKg * 35) / 1000).toFixed(1)), 0.5, 8);

  return {
    bmr: calculateBMR(params.weightKg, params.heightCm, params.birthYear, params.sex),
    tdee,
    targetCalories,
    targetProteinG,
    targetCarbsG,
    targetFatG,
    waterTargetLiters,
  };
}

export interface MacroTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export function calculateMealTotals(meal: MealSlot): MacroTotals {
  return meal.items.reduce<MacroTotals>(
    (acc, item) => ({
      calories: acc.calories + (Number(item.calories) || 0),
      proteinG: acc.proteinG + (Number(item.proteinG) || 0),
      carbsG: acc.carbsG + (Number(item.carbsG) || 0),
      fatG: acc.fatG + (Number(item.fatG) || 0),
      fiberG: acc.fiberG + (Number(item.fiberG) || 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
  );
}

export function calculatePlanTotals(meals: MealSlot[]): MacroTotals {
  return meals.reduce<MacroTotals>(
    (acc, meal) => {
      const m = calculateMealTotals(meal);
      return {
        calories: Math.round(acc.calories + m.calories),
        proteinG: Number((acc.proteinG + m.proteinG).toFixed(1)),
        carbsG: Number((acc.carbsG + m.carbsG).toFixed(1)),
        fatG: Number((acc.fatG + m.fatG).toFixed(1)),
        fiberG: Number((acc.fiberG + m.fiberG).toFixed(1)),
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
  );
}

export function evaluateTargetAlignment(
  planned: number,
  target: number
): { label: string; tone: 'good' | 'low' | 'high'; percent: number } {
  if (!target || target <= 0) {
    return { label: 'Sem meta', tone: 'low', percent: 0 };
  }
  const ratio = planned / target;
  const percent = Math.round(ratio * 100);
  if (ratio >= 0.92 && ratio <= 1.08) {
    return { label: 'Na meta', tone: 'good', percent };
  }
  if (ratio < 0.92) {
    return { label: 'Abaixo da meta', tone: 'low', percent };
  }
  return { label: 'Acima da meta', tone: 'high', percent };
}

export function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.min(max, Math.max(min, val));
}

export function trimStr(val: string, maxLen: number): string {
  return (val || '').trim().slice(0, maxLen);
}

export function sanitizeStringArray(arr: string[], maxItems: number, maxItemLen = 280): string[] {
  return arr
    .map((item) => item.trim().slice(0, maxItemLen))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

export function sanitizePatientPayload(
  input: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>
) {
  return {
    nutritionistId: input.nutritionistId,
    fullName: trimStr(input.fullName, SCHEMA_LIMITS.PATIENT_NAME_MAX),
    email: trimStr(input.email, SCHEMA_LIMITS.PATIENT_EMAIL_MAX),
    phone: trimStr(input.phone, SCHEMA_LIMITS.PATIENT_PHONE_MAX),
    birthYear: Math.round(clamp(Number(input.birthYear), 1920, 2026)),
    sex: input.sex,
    weightKg: Number(clamp(Number(input.weightKg), 20, 300).toFixed(1)),
    heightCm: Number(clamp(Number(input.heightCm), 100, 240).toFixed(1)),
    activityLevel: input.activityLevel,
    goal: input.goal,
    restrictions: sanitizeStringArray(input.restrictions, SCHEMA_LIMITS.PATIENT_RESTRICTIONS_MAX, 60),
    clinicalNotes: trimStr(input.clinicalNotes, SCHEMA_LIMITS.PATIENT_NOTES_MAX),
    targetCalories: Math.round(clamp(Number(input.targetCalories), 800, 6000)),
    targetProteinG: Math.round(clamp(Number(input.targetProteinG), 20, 400)),
    targetCarbsG: Math.round(clamp(Number(input.targetCarbsG), 0, 800)),
    targetFatG: Math.round(clamp(Number(input.targetFatG), 10, 250)),
    waterTargetLiters: Number(clamp(Number(input.waterTargetLiters), 0.5, 8).toFixed(1)),
    status: input.status,
  };
}

export function sanitizeRecipePayload(
  input: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>
) {
  return {
    nutritionistId: input.nutritionistId,
    title: trimStr(input.title, SCHEMA_LIMITS.RECIPE_TITLE_MAX),
    category: input.category,
    description: trimStr(input.description, SCHEMA_LIMITS.RECIPE_DESC_MAX),
    prepTimeMin: Math.round(clamp(Number(input.prepTimeMin), 1, 360)),
    servings: Math.round(clamp(Number(input.servings), 1, 20)),
    portionLabel: trimStr(input.portionLabel, SCHEMA_LIMITS.RECIPE_PORTION_MAX) || '1 porção',
    calories: Math.round(clamp(Number(input.calories), 0, 2500)),
    proteinG: Number(clamp(Number(input.proteinG), 0, 200).toFixed(1)),
    carbsG: Number(clamp(Number(input.carbsG), 0, 300).toFixed(1)),
    fatG: Number(clamp(Number(input.fatG), 0, 150).toFixed(1)),
    fiberG: Number(clamp(Number(input.fiberG), 0, 80).toFixed(1)),
    dietaryTags: sanitizeStringArray(input.dietaryTags, SCHEMA_LIMITS.RECIPE_TAGS_MAX, 40),
    ingredients: sanitizeStringArray(input.ingredients, SCHEMA_LIMITS.RECIPE_INGREDIENTS_MAX, 240),
    instructions: sanitizeStringArray(input.instructions, SCHEMA_LIMITS.RECIPE_INSTRUCTIONS_MAX, 280),
    clinicalTip: trimStr(input.clinicalTip, SCHEMA_LIMITS.RECIPE_TIP_MAX),
    imageUrl: trimStr(input.imageUrl, SCHEMA_LIMITS.RECIPE_IMAGE_MAX),
  };
}

export function sanitizeMealPlanPayload(
  input: Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt'>
) {
  const sanitizedMeals: MealSlot[] = input.meals
    .slice(0, SCHEMA_LIMITS.PLAN_MEALS_MAX)
    .map((meal, index) => ({
      id: trimStr(meal.id || `meal_${index + 1}`, 64),
      time: trimStr(meal.time || '08:00', 16),
      name: trimStr(meal.name || `Refeição ${index + 1}`, 80),
      notes: trimStr(meal.notes || '', 400),
      items: (meal.items || [])
        .slice(0, SCHEMA_LIMITS.PLAN_ITEMS_PER_MEAL_MAX)
        .map((item, itemIdx) => ({
          id: trimStr(item.id || `item_${itemIdx + 1}`, 64),
          ...(item.recipeId ? { recipeId: trimStr(item.recipeId, 128) } : {}),
          name: trimStr(item.name || 'Alimento', 120),
          portion: trimStr(item.portion || '1 porção', 80),
          calories: Math.round(clamp(Number(item.calories), 0, 2500)),
          proteinG: Number(clamp(Number(item.proteinG), 0, 200).toFixed(1)),
          carbsG: Number(clamp(Number(item.carbsG), 0, 300).toFixed(1)),
          fatG: Number(clamp(Number(item.fatG), 0, 150).toFixed(1)),
          fiberG: Number(clamp(Number(item.fiberG), 0, 80).toFixed(1)),
          substitution: trimStr(item.substitution || '', 240),
        })),
    }));

  return {
    nutritionistId: input.nutritionistId,
    patientId: input.patientId,
    title: trimStr(input.title, SCHEMA_LIMITS.PLAN_TITLE_MAX),
    objectiveSummary: trimStr(input.objectiveSummary, SCHEMA_LIMITS.PLAN_SUMMARY_MAX),
    status: input.status,
    targetCalories: Math.round(clamp(Number(input.targetCalories), 800, 6000)),
    targetProteinG: Math.round(clamp(Number(input.targetProteinG), 20, 400)),
    targetCarbsG: Math.round(clamp(Number(input.targetCarbsG), 0, 800)),
    targetFatG: Math.round(clamp(Number(input.targetFatG), 10, 250)),
    waterTargetLiters: Number(clamp(Number(input.waterTargetLiters), 0.5, 8).toFixed(1)),
    generalGuidance: trimStr(input.generalGuidance, SCHEMA_LIMITS.PLAN_GUIDANCE_MAX),
    meals: sanitizedMeals,
  };
}

export function sanitizeConsultationPayload(input: {
  nutritionistId: string;
  patientId: string;
  patientName: string;
  title: string;
  mode: 'consulta' | 'anamnese' | 'plano_substituicoes' | 'suplementacao';
  status: 'aberta' | 'encerrada';
  lastMessagePreview: string;
  messageCount: number;
}) {
  const safeTitle = trimStr(input.title, SCHEMA_LIMITS.CONSULTATION_TITLE_MAX);
  return {
    nutritionistId: input.nutritionistId,
    patientId: trimStr(input.patientId, 128),
    patientName: trimStr(input.patientName, SCHEMA_LIMITS.PATIENT_NAME_MAX),
    title: safeTitle.length >= 2 ? safeTitle : 'Atendimento Nutricional',
    mode: input.mode,
    status: input.status,
    lastMessagePreview: trimStr(
      input.lastMessagePreview,
      SCHEMA_LIMITS.CONSULTATION_PREVIEW_MAX
    ),
    messageCount: Math.round(clamp(Number(input.messageCount), 0, 500)),
  };
}

export function sanitizeConsultationMessagePayload(input: {
  nutritionistId: string;
  role: 'user' | 'assistant';
  content: string;
  sources: Array<{ title: string; uri: string; domain: string }>;
}) {
  const safeSources = (input.sources || [])
    .slice(0, SCHEMA_LIMITS.CONSULTATION_SOURCES_MAX)
    .map((s) => ({
      title: trimStr(s.title || 'Fonte científica', 240) || 'Fonte científica',
      uri: trimStr(s.uri || '', 600),
      domain: trimStr(s.domain || 'pubmed', 160) || 'pubmed',
    }))
    .filter((s) => s.uri.length > 0);

  return {
    nutritionistId: input.nutritionistId,
    role: input.role,
    content: trimStr(input.content, SCHEMA_LIMITS.CONSULTATION_MESSAGE_MAX) || '...',
    sources: safeSources,
  };
}

export function sanitizeSubscriptionPayload(input: {
  userId: string;
  subscriberName: string;
  subscriberEmail: string;
  phone: string;
  specialty:
    | 'metabolica_emagrecimento'
    | 'imunidade_longevidade'
    | 'saude_intestinal'
    | 'saude_mulher_hormonal'
    | 'performance_massa_magra'
    | 'sono_ansiedade_cognicao';
  healthFocus: string;
  allergies: string;
  planDurationMonths: number;
  paymentMethod: 'cartao_12x' | 'pix_anual' | 'boleto_anual';
  totalAmountBrl: number;
  installmentLabel: string;
  status: 'ativa' | 'cancelada';
  validUntilIso: string;
  receiptCode: string;
}) {
  const safeName = trimStr(input.subscriberName, 120);
  return {
    userId: input.userId,
    subscriberName: safeName.length >= 2 ? safeName : 'Assinante Dimitra Bratu',
    subscriberEmail: trimStr(input.subscriberEmail, 160),
    phone: trimStr(input.phone, 40),
    specialty: input.specialty,
    healthFocus: trimStr(input.healthFocus, 600),
    allergies: trimStr(input.allergies, 300),
    planDurationMonths: 12,
    paymentMethod: input.paymentMethod,
    totalAmountBrl: Number(clamp(Number(input.totalAmountBrl), 100, 50000).toFixed(2)),
    installmentLabel: trimStr(input.installmentLabel, 80) || '12x R$ 297,00',
    status: input.status,
    validUntilIso: trimStr(input.validUntilIso, 40),
    receiptCode: trimStr(input.receiptCode, 40),
  };
}

export function sanitizeVideoSessionPayload(input: {
  userId: string;
  patientId: string;
  patientName: string;
  specialty:
    | 'metabolica_emagrecimento'
    | 'imunidade_longevidade'
    | 'saude_intestinal'
    | 'saude_mulher_hormonal'
    | 'performance_massa_magra'
    | 'sono_ansiedade_cognicao';
  scheduledDate: string;
  scheduledTime: string;
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
  chiefComplaint: string;
  callNotes: string;
  durationMinutes: number;
}) {
  const safeName = trimStr(input.patientName, 120);
  return {
    userId: input.userId,
    patientId: trimStr(input.patientId, 128),
    patientName: safeName.length >= 2 ? safeName : 'Paciente Assinante',
    specialty: input.specialty,
    scheduledDate: trimStr(input.scheduledDate, 20) || new Date().toISOString().slice(0, 10),
    scheduledTime: trimStr(input.scheduledTime, 12) || '14:00',
    status: input.status,
    chiefComplaint: trimStr(input.chiefComplaint, 600),
    callNotes: trimStr(input.callNotes, 3000),
    durationMinutes: Math.round(clamp(Number(input.durationMinutes), 0, 240)),
  };
}

export function sanitizeCompoundingPrescriptionPayload(input: {
  userId: string;
  patientId: string;
  patientName: string;
  specialty:
    | 'metabolica_emagrecimento'
    | 'imunidade_longevidade'
    | 'saude_intestinal'
    | 'saude_mulher_hormonal'
    | 'performance_massa_magra'
    | 'sono_ansiedade_cognicao';
  formulaTitle: string;
  pharmaceuticalForm: string;
  totalDoses: number;
  durationDays: number;
  posology: string;
  pharmacyNotes: string;
  clinicalRationale: string;
  precautions: string;
  status: 'rascunho' | 'emitida';
  actives: Array<{ name: string; dosage: string; unit: string; purpose: string }>;
  recommendedRecipes: string[];
}) {
  const safeName = trimStr(input.patientName, 120);
  const safeTitle = trimStr(input.formulaTitle, 140);
  const safeForm = trimStr(input.pharmaceuticalForm, 100);
  const safePosology = trimStr(input.posology, 500);

  const safeActives = (input.actives || [])
    .slice(0, 20)
    .map((a) => ({
      name: trimStr(a.name, 120),
      dosage: trimStr(String(a.dosage), 40),
      unit: trimStr(a.unit, 24) || 'mg',
      purpose: trimStr(a.purpose, 240),
    }))
    .filter((a) => a.name.length > 0 && a.dosage.length > 0);

  return {
    userId: input.userId,
    patientId: trimStr(input.patientId, 128),
    patientName: safeName.length >= 2 ? safeName : 'Paciente Assinante',
    specialty: input.specialty,
    formulaTitle: safeTitle.length >= 2 ? safeTitle : 'Fórmula Magistral Personalizada',
    pharmaceuticalForm:
      safeForm.length >= 2 ? safeForm : 'Cápsulas vegetais gastro-resistentes',
    totalDoses: Math.round(clamp(Number(input.totalDoses), 1, 365)),
    durationDays: Math.round(clamp(Number(input.durationDays), 1, 365)),
    posology:
      safePosology.length >= 2
        ? safePosology
        : 'Tomar 1 dose ao dia junto à refeição principal.',
    pharmacyNotes: trimStr(input.pharmacyNotes, 800),
    clinicalRationale: trimStr(input.clinicalRationale, 1500),
    precautions: trimStr(input.precautions, 800),
    status: input.status,
    actives: safeActives,
    recommendedRecipes: sanitizeStringArray(input.recommendedRecipes || [], 10, 240),
  };
}

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `${prefix}_${stamp}_${rand}`;
}

/**
 * Deterministic Firestore-safe document ID matching firestore.rules emailKey().
 */
export function emailToAdminDocId(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 128);
}

export function sanitizeAdminUserPayload(input: {
  email: string;
  displayName: string;
  roleLabel: string;
  addedByEmail: string;
}) {
  const cleanEmail = trimStr(input.email.toLowerCase(), 160);
  const cleanName = trimStr(input.displayName, 120);
  return {
    email: cleanEmail,
    displayName: cleanName.length >= 2 ? cleanName : 'Administrador',
    roleLabel: trimStr(input.roleLabel || 'Administrador do Site', 80),
    addedByEmail: trimStr(input.addedByEmail, 160),
  };
}

export function sanitizeSiteSettingsPayload(input: {
  brandName: string;
  brandSubtitle: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  methodTitle: string;
  methodDescription: string;
  bannerTitle: string;
  bannerDescription: string;
  annualPlanHeadline: string;
  annualCardInstallmentBrl: number;
  annualCardTotalBrl: number;
  annualPixTotalBrl: number;
  annualPixDiscountLabel: string;
  annualBoletoTotalBrl: number;
  whatsappContact: string;
  instagramHandle: string;
  updatedByEmail: string;
}) {
  const brand = trimStr(input.brandName, 80);
  const heroTitle = trimStr(input.heroTitle, 160);
  return {
    brandName: brand.length >= 2 ? brand : 'DIMITRA BRATU',
    brandSubtitle: trimStr(input.brandSubtitle, 80),
    heroEyebrow: trimStr(input.heroEyebrow, 120),
    heroTitle:
      heroTitle.length >= 4
        ? heroTitle
        : 'Nutrição Clínica com Atendimento Inteligente 24h',
    heroDescription: trimStr(input.heroDescription, 600),
    methodTitle: trimStr(input.methodTitle, 140),
    methodDescription: trimStr(input.methodDescription, 700),
    bannerTitle: trimStr(input.bannerTitle, 120),
    bannerDescription: trimStr(input.bannerDescription, 600),
    annualPlanHeadline: trimStr(input.annualPlanHeadline, 120),
    annualCardInstallmentBrl: Number(
      clamp(Number(input.annualCardInstallmentBrl) || 297, 10, 10000).toFixed(2)
    ),
    annualCardTotalBrl: Number(
      clamp(Number(input.annualCardTotalBrl) || 3564, 100, 100000).toFixed(2)
    ),
    annualPixTotalBrl: Number(
      clamp(Number(input.annualPixTotalBrl) || 3240, 100, 100000).toFixed(2)
    ),
    annualPixDiscountLabel: trimStr(input.annualPixDiscountLabel, 40),
    annualBoletoTotalBrl: Number(
      clamp(Number(input.annualBoletoTotalBrl) || 3564, 100, 100000).toFixed(2)
    ),
    whatsappContact: trimStr(input.whatsappContact, 60),
    instagramHandle: trimStr(input.instagramHandle, 60),
    updatedByEmail: trimStr(input.updatedByEmail, 160),
  };
}

export function sanitizeSiteMediaPayload(input: {
  slotKey: string;
  label: string;
  imageUrl: string;
  altText: string;
  updatedByEmail: string;
}) {
  const label = trimStr(input.label, 120);
  return {
    slotKey: trimStr(input.slotKey, 64),
    label: label.length >= 2 ? label : 'Foto do site',
    imageUrl: trimStr(input.imageUrl, 450000),
    altText: trimStr(input.altText, 200),
    isPublic: true as const,
    updatedByEmail: trimStr(input.updatedByEmail, 160),
  };
}

/**
 * Compresses an uploaded image file via Canvas so it fits cleanly inside a Firestore document.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxDimension = 1200,
  initialQuality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem válido (JPG, PNG ou WebP).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a imagem selecionada.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível processar esta imagem.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Navegador sem suporte a processamento de imagem.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let quality = initialQuality;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 420000 && quality > 0.35) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (dataUrl.length > 445000) {
          reject(
            new Error(
              'A imagem ainda ficou muito pesada. Escolha uma foto menor ou recorte antes de enviar.'
            )
          );
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

