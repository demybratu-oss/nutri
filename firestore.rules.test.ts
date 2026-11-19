/**
 * Phase 0 Security Test Specification for Verbena Nutrição Firestore Rules.
 * Verifies that all 12 adversarial "Dirty Dozen" payloads are rejected by the ruleset.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: 'patients' | 'recipes' | 'mealPlans' | 'consultations' | 'consultationMessages';
  operation: 'create' | 'get' | 'list' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload: Record<string, unknown>;
}

export const dirtyDozenPayloads: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Patient Create',
    collection: 'patients',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      nutritionistId: 'other_nutritionist_uid',
      fullName: 'Carlos Eduardo Silva',
      email: 'carlos@example.com',
      phone: '11999990000',
      birthYear: 1990,
      sex: 'M',
      weightKg: 82,
      heightCm: 178,
      activityLevel: 'moderado',
      goal: 'emagrecimento',
      restrictions: [],
      clinicalNotes: '',
      targetCalories: 2100,
      targetProteinG: 160,
      targetCarbsG: 200,
      targetFatG: 70,
      waterTargetLiters: 2.8,
      status: 'ativo',
    },
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Patient Create',
    collection: 'patients',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      nutritionistId: 'auth_uid',
      fullName: 'Mariana Costa',
      isAdmin: true,
    },
  },
  {
    id: 3,
    name: 'PII Cross-Tenant Read',
    collection: 'patients',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    payload: { targetDocOwner: 'user_a', requesterUid: 'user_b' },
  },
  {
    id: 4,
    name: 'Unscoped List Query Scraping',
    collection: 'patients',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    payload: { whereClause: null, requesterUid: 'user_b' },
  },
  {
    id: 5,
    name: 'Orphaned MealPlan Creation',
    collection: 'mealPlans',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      nutritionistId: 'auth_uid',
      patientId: 'nonexistent_patient_999',
      title: 'Plano Órfão',
      status: 'ativo',
    },
  },
  {
    id: 6,
    name: 'Cross-Tenant MealPlan Hijack',
    collection: 'mealPlans',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      nutritionistId: 'user_b',
      patientId: 'patient_owned_by_user_a',
      title: 'Sequestro de Prontuário',
      status: 'ativo',
    },
  },
  {
    id: 7,
    name: 'Terminal State Mutation on Concluded MealPlan',
    collection: 'mealPlans',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: {
      existingStatus: 'concluido',
      title: 'Alterando histórico finalizado',
    },
  },
  {
    id: 8,
    name: 'Immutable Field Tampering (patientId / createdAt)',
    collection: 'mealPlans',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: {
      patientId: 'different_patient_id',
    },
  },
  {
    id: 9,
    name: 'Client-Spoofed Timestamp on Recipe Create',
    collection: 'recipes',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      nutritionistId: 'auth_uid',
      title: 'Receita com data falsa',
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
  {
    id: 10,
    name: 'ID Poisoning Attack',
    collection: 'recipes',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      documentId: 'invalid id with spaces and $pecial chars ' + 'a'.repeat(150),
    },
  },
  {
    id: 11,
    name: 'Unverified Email Write',
    collection: 'patients',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      email_verified: false,
      nutritionistId: 'auth_uid',
    },
  },
  {
    id: 12,
    name: 'Array Overflow & Value Poisoning on Recipe Update',
    collection: 'recipes',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: {
      calories: '500',
      ingredients: Array.from({ length: 35 }, (_, i) => `Ingrediente ${i + 1}`),
    },
  },
  {
    id: 13,
    name: 'Cross-Tenant Consultation Message Injection',
    collection: 'consultationMessages',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      parentOwner: 'user_a',
      requesterUid: 'user_b',
      role: 'user',
      content: 'Mensagem injetada em consulta de terceiros',
    },
  },
  {
    id: 14,
    name: 'Closed Consultation Mutation',
    collection: 'consultationMessages',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      parentStatus: 'encerrada',
      role: 'user',
      content: 'Tentativa de enviar mensagem em atendimento encerrado',
    },
  },
];
