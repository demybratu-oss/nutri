import type { Timestamp } from 'firebase/firestore';

export type BiologicalSex = 'F' | 'M';

export type ActivityLevel =
  | 'sedentario'
  | 'leve'
  | 'moderado'
  | 'intenso'
  | 'atleta';

export type ClinicalGoal =
  | 'emagrecimento'
  | 'hipertrofia'
  | 'reeducacao'
  | 'controle_glicemico'
  | 'performance';

export type PatientStatus = 'ativo' | 'em_acompanhamento' | 'arquivado';

export type RecipeCategory =
  | 'cafe_da_manha'
  | 'almoco'
  | 'jantar'
  | 'lanche'
  | 'ceia'
  | 'sobremesa_fit';

export type MealPlanStatus = 'rascunho' | 'ativo' | 'concluido';

export interface Patient {
  id: string;
  nutritionistId: string;
  fullName: string;
  email: string;
  phone: string;
  birthYear: number;
  sex: BiologicalSex;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: ClinicalGoal;
  restrictions: string[];
  clinicalNotes: string;
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  waterTargetLiters: number;
  status: PatientStatus;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Recipe {
  id: string;
  nutritionistId: string;
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
  imageUrl: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface MealItem {
  id: string;
  recipeId?: string;
  name: string;
  portion: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  substitution: string;
}

export interface MealSlot {
  id: string;
  time: string;
  name: string;
  notes: string;
  items: MealItem[];
}

export interface MealPlan {
  id: string;
  nutritionistId: string;
  patientId: string;
  title: string;
  objectiveSummary: string;
  status: MealPlanStatus;
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  waterTargetLiters: number;
  generalGuidance: string;
  meals: MealSlot[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type ConsultationMode =
  | 'consulta'
  | 'anamnese'
  | 'plano_substituicoes'
  | 'suplementacao';

export type ConsultationStatus = 'aberta' | 'encerrada';

export interface ConsultationSource {
  title: string;
  uri: string;
  domain: string;
}

export interface Consultation {
  id: string;
  nutritionistId: string;
  patientId: string;
  patientName: string;
  title: string;
  mode: ConsultationMode;
  status: ConsultationStatus;
  lastMessagePreview: string;
  messageCount: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ConsultationMessage {
  id: string;
  nutritionistId: string;
  role: 'user' | 'assistant';
  content: string;
  sources: ConsultationSource[];
  createdAt?: Timestamp | null;
}

export type ClinicalSpecialty =
  | 'metabolica_emagrecimento'
  | 'imunidade_longevidade'
  | 'saude_intestinal'
  | 'saude_mulher_hormonal'
  | 'performance_massa_magra'
  | 'sono_ansiedade_cognicao';

export type PaymentMethod = 'cartao_12x' | 'pix_anual' | 'boleto_anual';

export type SubscriptionStatus = 'ativa' | 'cancelada';

export interface AnnualSubscription {
  id: string;
  userId: string;
  subscriberName: string;
  subscriberEmail: string;
  phone: string;
  specialty: ClinicalSpecialty;
  healthFocus: string;
  allergies: string;
  planDurationMonths: number;
  paymentMethod: PaymentMethod;
  totalAmountBrl: number;
  installmentLabel: string;
  status: SubscriptionStatus;
  validUntilIso: string;
  receiptCode: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type VideoSessionStatus =
  | 'agendada'
  | 'em_andamento'
  | 'concluida'
  | 'cancelada';

export interface VideoSession {
  id: string;
  userId: string;
  patientId: string;
  patientName: string;
  specialty: ClinicalSpecialty;
  scheduledDate: string;
  scheduledTime: string;
  status: VideoSessionStatus;
  chiefComplaint: string;
  callNotes: string;
  durationMinutes: number;
  hostInRoom?: boolean;
  patientInRoom?: boolean;
  hostJoinedAtIso?: string;
  patientJoinedAtIso?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CompoundingActive {
  name: string;
  dosage: string;
  unit: string;
  purpose: string;
}

export type CompoundingStatus = 'rascunho' | 'emitida';

export interface CompoundingPrescription {
  id: string;
  userId: string;
  patientId: string;
  patientName: string;
  specialty: ClinicalSpecialty;
  formulaTitle: string;
  pharmaceuticalForm: string;
  totalDoses: number;
  durationDays: number;
  posology: string;
  pharmacyNotes: string;
  clinicalRationale: string;
  precautions: string;
  status: CompoundingStatus;
  actives: CompoundingActive[];
  recommendedRecipes: string[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ClinicalSpecialtyInfo {
  id: ClinicalSpecialty;
  title: string;
  shortTitle: string;
  description: string;
  keyActives: string;
  focusTag: string;
}

export const CLINICAL_SPECIALTIES: ClinicalSpecialtyInfo[] = [
  {
    id: 'metabolica_emagrecimento',
    title: 'Saúde Metabólica & Emagrecimento',
    shortTitle: 'Metabólica & Emagrecimento',
    description:
      'Modulação glicêmica, saciedade, sensibilidade à insulina e preservação de massa magra com micronutrientes sinérgicos.',
    keyActives: 'Cromo Picolinato · Magnésio · Inositol · Vitamina B12',
    focusTag: 'Metabolismo & Controle Glicêmico',
  },
  {
    id: 'imunidade_longevidade',
    title: 'Imunidade, Energia & Longevidade',
    shortTitle: 'Imunidade & Longevidade',
    description:
      'Reposição estratégica contra fadiga, estresse oxidativo e suporte mitocondrial para vitalidade diária.',
    keyActives: 'Vitamina D3 + K2 · Zinco Quelado · Selênio · CoQ10',
    focusTag: 'Vitalidade & Defesa Imune',
  },
  {
    id: 'saude_intestinal',
    title: 'Saúde Intestinal & Digestiva',
    shortTitle: 'Saúde Intestinal',
    description:
      'Protocolo para integridade da mucosa intestinal, redução de distensão abdominal e equilíbrio da microbiota.',
    keyActives: 'L-Glutamina · Zinco Carnosina · Probióticos · Fibras Prebióticas',
    focusTag: 'Microbiota & Digestão',
  },
  {
    id: 'saude_mulher_hormonal',
    title: 'Saúde da Mulher & Equilíbrio Hormonal',
    shortTitle: 'Saúde da Mulher',
    description:
      'Suporte nutricional individualizado para ciclos, TPM, SOP, perimenopausa, saúde óssea, cabelos e unhas.',
    keyActives: 'Ferro Quelado · Mio-Inositol · Vitamina B6 · Magnésio',
    focusTag: 'Equilíbrio Feminino',
  },
  {
    id: 'performance_massa_magra',
    title: 'Performance, Massa Magra & Recuperação',
    shortTitle: 'Performance & Hipertrofia',
    description:
      'Otimização de força, síntese proteica, eletrólitos e recuperação muscular alinhada à rotina de treinos.',
    keyActives: 'Creatina · Beta-Alanina · Magnésio Malato · Eletrólitos',
    focusTag: 'Esporte & Recuperação',
  },
  {
    id: 'sono_ansiedade_cognicao',
    title: 'Sono, Estresse & Foco Cognitivo',
    shortTitle: 'Sono & Foco Cognitivo',
    description:
      'Apoio ao ciclo circadiano, relaxamento noturno, clareza mental e proteção neurovascular com alta absorção.',
    keyActives: 'Magnésio Bisglicinato · L-Teanina · Ômega-3 DHA · Vitamina B9',
    focusTag: 'Sono Reparador & Mente',
  },
];

export const SPECIALTY_LABELS: Record<ClinicalSpecialty, string> = {
  metabolica_emagrecimento: 'Saúde Metabólica & Emagrecimento',
  imunidade_longevidade: 'Imunidade, Energia & Longevidade',
  saude_intestinal: 'Saúde Intestinal & Digestiva',
  saude_mulher_hormonal: 'Saúde da Mulher & Equilíbrio Hormonal',
  performance_massa_magra: 'Performance, Massa Magra & Recuperação',
  sono_ansiedade_cognicao: 'Sono, Estresse & Foco Cognitivo',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cartao_12x: 'Cartão de Crédito (12x de R$ 297,00)',
  pix_anual: 'PIX Anual à Vista (R$ 3.240,00 · 10% OFF)',
  boleto_anual: 'Boleto Anual 12 Meses (R$ 3.564,00)',
};

export type ActiveSection =
  | 'dashboard'
  | 'subscription'
  | 'video'
  | 'compounding'
  | 'consultation'
  | 'patients'
  | 'plans'
  | 'recipes'
  | 'research'
  | 'admin';

export const PRIMARY_ADMIN_EMAIL = 'demybratu@gmail.com';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  roleLabel: string;
  addedByEmail: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface SiteSettings {
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
  updatedAt?: Timestamp | null;
}

export const SPECIALIST_ACADEMIC_FORMATION =
  'Formação: Universidade Gama Filho · Rio de Janeiro - RJ';

export const SPECIALIST_PROFILE = {
  fullName: 'Dra. Dimitra Bratu',
  title: 'Nutricionista Dra. Dimitra Bratu',
  email: PRIMARY_ADMIN_EMAIL,
  phoneE164: '+5521980984243',
  phoneDisplay: '+55 (21) 98098-4243',
  whatsappDigits: '5521980984243',
  formation: 'Universidade Gama Filho · Rio de Janeiro - RJ',
  photoUrl:
    '/assets/aistudio/Nutritionist_standing_in_clinic___758238ed_2K_8a98a1e5.jpg',
} as const;

export function isDraDimitraEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.trim().toLowerCase() === SPECIALIST_PROFILE.email);
}

export function buildSpecialistWhatsAppUrl(
  message?: string,
  customPhone?: string
): string {
  const digits = (customPhone || SPECIALIST_PROFILE.whatsappDigits).replace(/\D/g, '');
  const resolved = digits.length >= 10 ? digits : SPECIALIST_PROFILE.whatsappDigits;
  const text =
    message ||
    'Olá Dra. Dimitra Bratu! Gostaria de agendar meu atendimento nutricional especializado.';
  return `https://wa.me/${resolved}?text=${encodeURIComponent(text)}`;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  brandName: 'DRA. DIMITRA BRATU',
  brandSubtitle: 'NUTRIÇÃO CLÍNICA · GAMA FILHO (RJ)',
  heroEyebrow: 'Universidade Gama Filho · Rio de Janeiro - RJ · Atendimento IA & Videochamada',
  heroTitle: 'Nutrição Inteligente com IA e Atendimento Especializado.',
  heroDescription:
    'Tire dúvidas imediatas no site com nossa IA baseada em ciência nutricional e avance para consulta especializada por videochamada com a Nutricionista Dra. Dimitra Bratu — formada pela Universidade Gama Filho (RJ) — com prescrição de vitaminas manipuladas e plano sob medida.',
  methodTitle: 'Atendimento em Dois Níveis: IA 24h e Especialista por Vídeo',
  methodDescription:
    'Inicie seu atendimento agora mesmo pela inteligência artificial conectada às maiores bibliotecas científicas. Quando seu caso exige avaliação clínica aprofundada, exames ou vitaminas manipuladas, a Dra. Dimitra Bratu (Universidade Gama Filho · RJ) assume pessoalmente por videochamada.',
  bannerTitle: 'Consulta Especializada por Videochamada',
  bannerDescription:
    'Casos clínicos complexos, leitura de exames, protocolos de vitaminas manipuladas para farmácia de manipulação e acompanhamento de 12 meses diretamente com a Nutricionista Dra. Dimitra Bratu.',
  annualPlanHeadline: 'Plano Anual Exclusivo (12 Meses)',
  annualCardInstallmentBrl: 297,
  annualCardTotalBrl: 3564,
  annualPixTotalBrl: 3240,
  annualPixDiscountLabel: '10% OFF',
  annualBoletoTotalBrl: 3564,
  whatsappContact: SPECIALIST_PROFILE.phoneDisplay,
  instagramHandle: '@dimitrabratu',
  updatedByEmail: PRIMARY_ADMIN_EMAIL,
};

export type SiteMediaSlotKey =
  | 'hero'
  | 'specialist_avatar'
  | 'method'
  | 'banner'
  | 'recipe_1'
  | 'recipe_2'
  | 'recipe_3'
  | 'recipe_4';

export interface SiteMediaItem {
  slotKey: SiteMediaSlotKey;
  label: string;
  imageUrl: string;
  altText: string;
  isPublic: true;
  updatedByEmail: string;
  updatedAt?: Timestamp | null;
}

export interface SiteMediaSlotConfig {
  slotKey: SiteMediaSlotKey;
  label: string;
  description: string;
  defaultAlt: string;
}

export const SITE_MEDIA_SLOTS: SiteMediaSlotConfig[] = [
  {
    slotKey: 'hero',
    label: 'Foto Principal (Capa do Site)',
    description: 'Imagem de destaque exibida no topo da página inicial.',
    defaultAlt: 'Bowl de salmão grelhado com quinoa, abacate e edamame',
  },
  {
    slotKey: 'specialist_avatar',
    label: 'Foto da Nutricionista Dimitra Bratu',
    description: 'Retrato exibido na sala de Videochamada e perfil da especialista.',
    defaultAlt: 'Nutricionista Dimitra Bratu',
  },
  {
    slotKey: 'method',
    label: 'Foto da Seção Nosso Método',
    description: 'Imagem editorial exibida ao lado da apresentação clínica.',
    defaultAlt: 'Frango às ervas com quinoa, brócolis e batata-doce',
  },
  {
    slotKey: 'banner',
    label: 'Foto do Banner de Atendimento',
    description: 'Imagem de destaque do banner inferior da página inicial.',
    defaultAlt: 'Creme aveludado de abóbora cabotiá com gengibre',
  },
  {
    slotKey: 'recipe_1',
    label: 'Vitrine Receita 1 (Salmão & Quinoa)',
    description: 'Primeiro card da galeria de receitas assinadas.',
    defaultAlt: 'Bowl de Salmão & Quinoa',
  },
  {
    slotKey: 'recipe_2',
    label: 'Vitrine Receita 2 (Overnight Oats)',
    description: 'Segundo card da galeria de receitas assinadas.',
    defaultAlt: 'Overnight Oats de Chia',
  },
  {
    slotKey: 'recipe_3',
    label: 'Vitrine Receita 3 (Omelete de Ervas)',
    description: 'Terceiro card da galeria de receitas assinadas.',
    defaultAlt: 'Omelete de Ervas & Ricota',
  },
  {
    slotKey: 'recipe_4',
    label: 'Vitrine Receita 4 (Creme de Abóbora)',
    description: 'Quarto card da galeria de receitas assinadas.',
    defaultAlt: 'Creme de Abóbora & Gengibre',
  },
];

export const CONSULTATION_MODE_LABELS: Record<ConsultationMode, string> = {
  consulta: 'Consulta & Dúvidas',
  anamnese: 'Anamnese Guiada',
  plano_substituicoes: 'Plano & Substituições',
  suplementacao: 'Suplementação & Ciência',
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentario: 'Sedentário (escritório / pouco exercício)',
  leve: 'Leve (1–2 treinos/semana)',
  moderado: 'Moderado (3–4 treinos/semana)',
  intenso: 'Intenso (5–6 treinos/semana)',
  atleta: 'Atleta (treino diário / 2x ao dia)',
};

export const GOAL_LABELS: Record<ClinicalGoal, string> = {
  emagrecimento: 'Emagrecimento',
  hipertrofia: 'Hipertrofia',
  reeducacao: 'Reeducação Alimentar',
  controle_glicemico: 'Controle Glicêmico',
  performance: 'Performance Esportiva',
};

export const PATIENT_STATUS_LABELS: Record<PatientStatus, string> = {
  ativo: 'Ativo',
  em_acompanhamento: 'Em acompanhamento',
  arquivado: 'Arquivado',
};

export const RECIPE_CATEGORY_LABELS: Record<RecipeCategory, string> = {
  cafe_da_manha: 'Café da Manhã',
  almoco: 'Almoço',
  jantar: 'Jantar',
  lanche: 'Lanche',
  ceia: 'Ceia',
  sobremesa_fit: 'Sobremesa Equilibrada',
};

export const PLAN_STATUS_LABELS: Record<MealPlanStatus, string> = {
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  concluido: 'Concluído (Histórico)',
};

/**
 * Validation limits synchronized verbatim with firebase-blueprint.json & firestore.rules.
 */
export const SCHEMA_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  PATIENT_NAME_MAX: 120,
  PATIENT_EMAIL_MAX: 160,
  PATIENT_PHONE_MAX: 40,
  PATIENT_NOTES_MAX: 1500,
  PATIENT_RESTRICTIONS_MAX: 15,
  RECIPE_TITLE_MAX: 120,
  RECIPE_DESC_MAX: 400,
  RECIPE_PORTION_MAX: 80,
  RECIPE_TIP_MAX: 500,
  RECIPE_IMAGE_MAX: 300,
  RECIPE_TAGS_MAX: 10,
  RECIPE_INGREDIENTS_MAX: 30,
  RECIPE_INSTRUCTIONS_MAX: 20,
  PLAN_TITLE_MAX: 140,
  PLAN_SUMMARY_MAX: 400,
  PLAN_GUIDANCE_MAX: 2000,
  PLAN_MEALS_MAX: 10,
  PLAN_ITEMS_PER_MEAL_MAX: 20,
  CONSULTATION_TITLE_MAX: 140,
  CONSULTATION_PREVIEW_MAX: 240,
  CONSULTATION_MESSAGE_MAX: 8000,
  CONSULTATION_SOURCES_MAX: 12,
} as const;
