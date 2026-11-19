import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  FileText,
  FlaskConical,
  Loader2,
  Lock,
  Microscope,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  auditMealPlanWithScience,
  generateEvidenceMealPlan,
  GroundingSource,
  PlanAuditResult,
} from '../lib/aiService';
import {
  calculateAge,
  calculateBMI,
  calculateMealTotals,
  calculatePlanTotals,
  evaluateTargetAlignment,
  generateSafeId,
} from '../lib/nutrition';
import {
  GOAL_LABELS,
  MealItem,
  MealPlan,
  MealPlanStatus,
  MealSlot,
  Patient,
  PLAN_STATUS_LABELS,
  Recipe,
  RECIPE_CATEGORY_LABELS,
} from '../types';
import { SpotlightCard } from './LuxuryPrimitives';
import { ScientificEvidenceBlock } from './ScientificEvidenceBlock';

interface MealPlanBuilderProps {
  nutritionistId: string;
  nutritionistName: string;
  patients: Patient[];
  recipes: Recipe[];
  mealPlans: MealPlan[];
  selectedPatientId: string | null;
  onSelectPatient: (patientId: string) => void;
  onCreatePlan: (
    data: Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<string>;
  onUpdatePlan: (
    planId: string,
    data: Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onConcludePlan: (planId: string) => Promise<void>;
  onDeletePlan: (planId: string) => Promise<void>;
  onInspectRecipe: (recipe: Recipe) => void;
  onAddPatient: () => void;
}

const DEFAULT_MEALS: MealSlot[] = [
  { id: 'meal_cafe', time: '07:30', name: 'Café da Manhã', notes: '', items: [] },
  { id: 'meal_almoco', time: '12:30', name: 'Almoço', notes: '', items: [] },
  { id: 'meal_lanche', time: '16:30', name: 'Lanche da Tarde', notes: '', items: [] },
  { id: 'meal_jantar', time: '20:00', name: 'Jantar', notes: '', items: [] },
];

export function MealPlanBuilder({
  nutritionistId,
  nutritionistName,
  patients,
  recipes,
  mealPlans,
  selectedPatientId,
  onSelectPatient,
  onCreatePlan,
  onUpdatePlan,
  onConcludePlan,
  onDeletePlan,
  onInspectRecipe,
  onAddPatient,
}: MealPlanBuilderProps) {
  const activePatient =
    patients.find((p) => p.id === selectedPatientId) || patients[0] || null;

  const patientPlans = useMemo(
    () =>
      activePatient
        ? mealPlans.filter((pl) => pl.patientId === activePatient.id)
        : [],
    [mealPlans, activePatient]
  );

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<
    MealPlan,
    'id' | 'createdAt' | 'updatedAt'
  > | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [confirmConclude, setConfirmConclude] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<PlanAuditResult | null>(null);
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [generateInstruction, setGenerateInstruction] = useState('');
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [generatedEvidence, setGeneratedEvidence] = useState<{
    rationale: string;
    sources: GroundingSource[];
    searchQueries: string[];
    generatedAt: string;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [addingToMealId, setAddingToMealId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<'recipe' | 'custom'>('recipe');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeMultiplier, setRecipeMultiplier] = useState(1);
  const [customItem, setCustomItem] = useState({
    name: '',
    portion: '100g',
    calories: 150,
    proteinG: 12,
    carbsG: 18,
    fatG: 4,
    fiberG: 2,
    substitution: '',
  });

  const activePlan =
    patientPlans.find((pl) => pl.id === selectedPlanId) ||
    patientPlans.find((pl) => pl.status === 'ativo') ||
    patientPlans[0] ||
    null;

  useEffect(() => {
    setPrintMode(false);
    setConfirmConclude(false);
    setConfirmDelete(false);
    setAddingToMealId(null);
    setAuditResult(null);
    setAiError(null);
    if (activePlan) {
      setSelectedPlanId(activePlan.id);
      setDraft({
        nutritionistId: activePlan.nutritionistId,
        patientId: activePlan.patientId,
        title: activePlan.title,
        objectiveSummary: activePlan.objectiveSummary,
        status: activePlan.status,
        targetCalories: activePlan.targetCalories,
        targetProteinG: activePlan.targetProteinG,
        targetCarbsG: activePlan.targetCarbsG,
        targetFatG: activePlan.targetFatG,
        waterTargetLiters: activePlan.waterTargetLiters,
        generalGuidance: activePlan.generalGuidance,
        meals: activePlan.meals.map((m) => ({
          ...m,
          items: m.items.map((it) => ({ ...it })),
        })),
      });
      setDirty(false);
    } else {
      setSelectedPlanId(null);
      setDraft(null);
      setDirty(false);
    }
  }, [activePlan?.id, activePatient?.id]);

  const isLocked = draft?.status === 'concluido';

  const totals = useMemo(
    () => (draft ? calculatePlanTotals(draft.meals) : calculatePlanTotals([])),
    [draft]
  );

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.dietaryTags.some((t) => t.toLowerCase().includes(q)) ||
        RECIPE_CATEGORY_LABELS[r.category].toLowerCase().includes(q)
    );
  }, [recipes, recipeSearch]);

  const linkedRecipesInPlan = useMemo(() => {
    if (!draft) return [];
    const seen = new Set<string>();
    const list: Recipe[] = [];
    for (const meal of draft.meals) {
      for (const item of meal.items) {
        if (item.recipeId && !seen.has(item.recipeId)) {
          const found = recipes.find((r) => r.id === item.recipeId);
          if (found) {
            seen.add(item.recipeId);
            list.push(found);
          }
        }
      }
    }
    return list;
  }, [draft, recipes]);

  if (!activePatient) {
    return (
      <div className="glass-obsidian rounded-2xl p-10 text-center max-w-xl">
        <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6] mb-2">
          Cadastre um paciente para criar planos alimentares
        </h3>
        <p className="text-sm text-[#A8CCB9] mb-6">
          Cada plano alimentar é vinculado a um paciente com suas metas de calorias, macronutrientes e restrições clínicas.
        </p>
        <button
          type="button"
          onClick={onAddPatient}
          className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Cadastrar primeiro paciente
        </button>
      </div>
    );
  }

  async function handleCreateNewPlanForPatient() {
    if (!activePatient) return;
    const nextNumber = patientPlans.length + 1;
    const newId = await onCreatePlan({
      nutritionistId,
      patientId: activePatient.id,
      title: `Fase ${nextNumber} — ${GOAL_LABELS[activePatient.goal]}`,
      objectiveSummary: `Plano personalizado alinhado às metas de ${activePatient.targetCalories} kcal e ${activePatient.targetProteinG}g de proteína.`,
      status: 'ativo',
      targetCalories: activePatient.targetCalories,
      targetProteinG: activePatient.targetProteinG,
      targetCarbsG: activePatient.targetCarbsG,
      targetFatG: activePatient.targetFatG,
      waterTargetLiters: activePatient.waterTargetLiters,
      generalGuidance:
        'Priorizar alimentos in natura e minimamente processados. Manter boa mastigação e distribuição regular de água ao longo do dia.',
      meals: DEFAULT_MEALS.map((m) => ({
        ...m,
        id: generateSafeId('meal'),
        items: [],
      })),
    });
    setSelectedPlanId(newId);
  }

  async function handleDuplicatePlan() {
    if (!draft || !activePatient) return;
    const newId = await onCreatePlan({
      ...draft,
      nutritionistId,
      patientId: activePatient.id,
      title: `${draft.title} (Nova revisão)`.slice(0, 140),
      status: 'rascunho',
      meals: draft.meals.map((m) => ({
        ...m,
        id: generateSafeId('meal'),
        items: m.items.map((it) => ({ ...it, id: generateSafeId('item') })),
      })),
    });
    setSelectedPlanId(newId);
  }

  async function handleAuditWithScience() {
    if (!activePatient || !draft || auditing) return;
    setAuditing(true);
    setAiError(null);
    try {
      const res = await auditMealPlanWithScience({
        patient: activePatient,
        plan: draft,
        totals,
      });
      setAuditResult(res);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Não foi possível auditar o plano nas bibliotecas científicas.'
      );
    } finally {
      setAuditing(false);
    }
  }

  async function handleGenerateEvidencePlan() {
    if (!activePatient || generatingPlan) return;
    setGeneratingPlan(true);
    setAiError(null);
    try {
      const res = await generateEvidenceMealPlan({
        patient: activePatient,
        availableRecipes: recipes,
        customInstruction: generateInstruction.trim(),
      });
      const validRecipeIds = new Set(recipes.map((r) => r.id));
      const sanitizedMeals: MealSlot[] = (res.plan.meals || []).map((m, idx) => ({
        id: generateSafeId(`meal_${idx + 1}`),
        time: m.time || '08:00',
        name: m.name || `Refeição ${idx + 1}`,
        notes: m.notes || '',
        items: (m.items || []).map((it, itemIdx) => ({
          id: generateSafeId(`item_${itemIdx + 1}`),
          ...(it.recipeId && validRecipeIds.has(it.recipeId)
            ? { recipeId: it.recipeId }
            : {}),
          name: it.name || 'Alimento',
          portion: it.portion || '1 porção',
          calories: Number(it.calories) || 0,
          proteinG: Number(it.proteinG) || 0,
          carbsG: Number(it.carbsG) || 0,
          fatG: Number(it.fatG) || 0,
          fiberG: Number(it.fiberG) || 0,
          substitution: it.substitution || '',
        })),
      }));

      const newId = await onCreatePlan({
        nutritionistId,
        patientId: activePatient.id,
        title:
          res.plan.title ||
          `Plano Baseado em Evidências — ${GOAL_LABELS[activePatient.goal]}`,
        objectiveSummary: res.plan.objectiveSummary || '',
        status: 'ativo',
        targetCalories: activePatient.targetCalories,
        targetProteinG: activePatient.targetProteinG,
        targetCarbsG: activePatient.targetCarbsG,
        targetFatG: activePatient.targetFatG,
        waterTargetLiters: activePatient.waterTargetLiters,
        generalGuidance: res.plan.generalGuidance || '',
        meals: sanitizedMeals,
      });

      setSelectedPlanId(newId);
      setShowGeneratePanel(false);
      setGenerateInstruction('');
      setGeneratedEvidence({
        rationale: res.plan.scientificRationale || '',
        sources: res.sources || [],
        searchQueries: res.searchQueries || [],
        generatedAt: res.generatedAt,
      });
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar o plano baseado em evidências.'
      );
    } finally {
      setGeneratingPlan(false);
    }
  }

  async function handleSave() {
    if (!activePlan || !draft || isLocked) return;
    setSaving(true);
    try {
      await onUpdatePlan(activePlan.id, draft);
      setDirty(false);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function patchDraft(
    updater: (
      prev: Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt'>
    ) => Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt'>
  ) {
    if (isLocked) return;
    setDraft((prev) => (prev ? updater(prev) : prev));
    setDirty(true);
  }

  function addMealSlot() {
    patchDraft((prev) => {
      if (prev.meals.length >= 10) return prev;
      return {
        ...prev,
        meals: [
          ...prev.meals,
          {
            id: generateSafeId('meal'),
            time: '22:00',
            name: `Refeição ${prev.meals.length + 1}`,
            notes: '',
            items: [],
          },
        ],
      };
    });
  }

  function removeMealSlot(mealId: string) {
    patchDraft((prev) => ({
      ...prev,
      meals: prev.meals.filter((m) => m.id !== mealId),
    }));
  }

  function updateMealField(
    mealId: string,
    field: 'time' | 'name' | 'notes',
    value: string
  ) {
    patchDraft((prev) => ({
      ...prev,
      meals: prev.meals.map((m) =>
        m.id === mealId ? { ...m, [field]: value } : m
      ),
    }));
  }

  function addRecipeToMeal(mealId: string, recipe: Recipe, mult: number) {
    const newItem: MealItem = {
      id: generateSafeId('item'),
      recipeId: recipe.id,
      name: recipe.title,
      portion:
        mult === 1 ? recipe.portionLabel : `${mult}x (${recipe.portionLabel})`,
      calories: Math.round(recipe.calories * mult),
      proteinG: Number((recipe.proteinG * mult).toFixed(1)),
      carbsG: Number((recipe.carbsG * mult).toFixed(1)),
      fatG: Number((recipe.fatG * mult).toFixed(1)),
      fiberG: Number((recipe.fiberG * mult).toFixed(1)),
      substitution: recipe.clinicalTip.slice(0, 220),
    };
    patchDraft((prev) => ({
      ...prev,
      meals: prev.meals.map((m) =>
        m.id === mealId ? { ...m, items: [...m.items, newItem] } : m
      ),
    }));
    setAddingToMealId(null);
    setRecipeSearch('');
    setRecipeMultiplier(1);
  }

  function addCustomItemToMeal(mealId: string) {
    if (!customItem.name.trim()) return;
    const newItem: MealItem = {
      id: generateSafeId('item'),
      name: customItem.name.trim(),
      portion: customItem.portion.trim() || '1 porção',
      calories: Math.round(Number(customItem.calories) || 0),
      proteinG: Number((Number(customItem.proteinG) || 0).toFixed(1)),
      carbsG: Number((Number(customItem.carbsG) || 0).toFixed(1)),
      fatG: Number((Number(customItem.fatG) || 0).toFixed(1)),
      fiberG: Number((Number(customItem.fiberG) || 0).toFixed(1)),
      substitution: customItem.substitution.trim(),
    };
    patchDraft((prev) => ({
      ...prev,
      meals: prev.meals.map((m) =>
        m.id === mealId ? { ...m, items: [...m.items, newItem] } : m
      ),
    }));
    setCustomItem({
      name: '',
      portion: '100g',
      calories: 150,
      proteinG: 12,
      carbsG: 18,
      fatG: 4,
      fiberG: 2,
      substitution: '',
    });
    setAddingToMealId(null);
  }

  function removeItemFromMeal(mealId: string, itemId: string) {
    patchDraft((prev) => ({
      ...prev,
      meals: prev.meals.map((m) =>
        m.id === mealId
          ? { ...m, items: m.items.filter((it) => it.id !== itemId) }
          : m
      ),
    }));
  }

  function updateItemSubstitution(
    mealId: string,
    itemId: string,
    substitution: string
  ) {
    patchDraft((prev) => ({
      ...prev,
      meals: prev.meals.map((m) =>
        m.id === mealId
          ? {
              ...m,
              items: m.items.map((it) =>
                it.id === itemId ? { ...it, substitution } : it
              ),
            }
          : m
      ),
    }));
  }

  const bmi = calculateBMI(activePatient.weightKg, activePatient.heightCm);
  const age = calculateAge(activePatient.birthYear);

  // Clean crisp light paper print preview for patient PDF handover
  if (printMode && draft) {
    return (
      <div className="space-y-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 glass-obsidian rounded-2xl px-5 py-3.5">
          <div className="text-sm text-[#CBE3D6]">
            Visualização da prescrição alimentar de{' '}
            <strong className="text-[#F4FBF6]">{activePatient.fullName}</strong>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPrintMode(false)}
              className="px-4 py-2 text-xs font-medium text-[#F4FBF6] bg-[#0E332D] border border-[#B7DB74]/30 rounded-full hover:border-[#DDF3B2] cursor-pointer whitespace-nowrap"
            >
              Voltar ao editor
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-gold inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>

        <article className="bg-white text-slate-900 border border-[#B7DB74]/30 rounded-2xl p-8 sm:p-10 max-w-4xl mx-auto space-y-8 print:border-0 print:p-0">
          <header className="flex flex-wrap items-start justify-between gap-6 pb-6 border-b border-slate-200">
            <div>
              <p className="text-xs font-semibold tracking-wider text-amber-800 mb-1">
                VERBENA NUTRIÇÃO · PRESCRIÇÃO INDIVIDUALIZADA
              </p>
              <h1 className="font-editorial text-3xl font-semibold text-slate-900">
                {draft.title}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Paciente: <strong className="text-slate-900">{activePatient.fullName}</strong> ·{' '}
                {age} anos · {GOAL_LABELS[activePatient.goal]}
              </p>
              {activePatient.restrictions.length > 0 && (
                <p className="text-xs text-amber-800 mt-1">
                  Restrições consideradas: {activePatient.restrictions.join(', ')}
                </p>
              )}
            </div>
            <div className="text-right text-xs text-slate-500">
              <div className="font-semibold text-slate-900">{nutritionistName}</div>
              <div>Nutricionista Clínica</div>
              <div className="font-mono tabular-nums mt-1">
                Hidratação diária: {draft.waterTargetLiters.toFixed(1)} L
              </div>
            </div>
          </header>

          <section className="grid grid-cols-2 sm:grid-cols-5 gap-4 py-4 border-b border-slate-200 text-center">
            <div>
              <div className="text-xs text-slate-500">Energia</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                {totals.calories} kcal
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Proteínas</div>
              <div className="text-base font-bold font-mono tabular-nums text-amber-900">
                {totals.proteinG}g
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Carboidratos</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                {totals.carbsG}g
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Gorduras</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                {totals.fatG}g
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Fibras</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                {totals.fiberG}g
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="font-editorial text-2xl font-semibold text-slate-900">
              Distribuição das Refeições
            </h2>
            {draft.meals.map((meal) => {
              const mealTotals = calculateMealTotals(meal);
              return (
                <div
                  key={meal.id}
                  className="pb-5 border-b border-slate-200 last:border-b-0 space-y-2.5"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      <span className="font-mono tabular-nums text-amber-800 mr-2">
                        {meal.time}
                      </span>
                      {meal.name}
                    </h3>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {Math.round(mealTotals.calories)} kcal · P{' '}
                      {mealTotals.proteinG.toFixed(0)}g
                    </span>
                  </div>
                  {meal.notes && (
                    <p className="text-xs text-slate-600 italic">{meal.notes}</p>
                  )}
                  <ul className="space-y-2">
                    {meal.items.map((item) => (
                      <li key={item.id} className="text-sm text-slate-800">
                        <div className="flex items-baseline justify-between gap-4">
                          <span>
                            <strong>{item.name}</strong> — {item.portion}
                          </span>
                          <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                            {item.calories} kcal
                          </span>
                        </div>
                        {item.substitution && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            Opção de substituição: {item.substitution}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>

          {draft.generalGuidance && (
            <section className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-bold text-slate-900 mb-2">
                Orientações Gerais da Nutricionista
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {draft.generalGuidance}
              </p>
            </section>
          )}

          {linkedRecipesInPlan.length > 0 && (
            <section className="pt-4 border-t border-slate-200 space-y-5">
              <h2 className="font-editorial text-2xl font-semibold text-slate-900">
                Receitas Incluídas Neste Plano
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {linkedRecipesInPlan.map((rec) => (
                  <div
                    key={rec.id}
                    className="border border-slate-200 rounded-xl p-4 space-y-2.5 break-inside-avoid"
                  >
                    <h3 className="text-sm font-bold text-slate-900">
                      {rec.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {rec.portionLabel} · {rec.prepTimeMin} min · {rec.calories} kcal
                    </p>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 mb-1">
                        Ingredientes
                      </div>
                      <ul className="text-xs text-slate-600 space-y-0.5 list-disc pl-4">
                        {rec.ingredients.map((ing, i) => (
                          <li key={i}>{ing}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 mb-1">
                        Preparo
                      </div>
                      <ol className="text-xs text-slate-600 space-y-0.5 list-decimal pl-4">
                        {rec.instructions.map((st, i) => (
                          <li key={i}>{st}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
    );
  }

  const macroCards = draft
    ? [
        {
          label: 'Energia',
          planned: totals.calories,
          target: draft.targetCalories,
          unit: 'kcal',
        },
        {
          label: 'Proteínas',
          planned: totals.proteinG,
          target: draft.targetProteinG,
          unit: 'g',
        },
        {
          label: 'Carboidratos',
          planned: totals.carbsG,
          target: draft.targetCarbsG,
          unit: 'g',
        },
        {
          label: 'Gorduras',
          planned: totals.fatG,
          target: draft.targetFatG,
          unit: 'g',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Patient Selector & Clinical Summary Header */}
      <SpotlightCard glowRim className="p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
            <div className="min-w-[240px]">
              <label
                htmlFor="patient-plan-selector"
                className="block text-[11px] font-medium text-[#85AF9B] mb-1"
              >
                Paciente selecionado
              </label>
              <select
                id="patient-plan-selector"
                value={activePatient.id}
                onChange={(e) => onSelectPatient(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-semibold text-[#F4FBF6] bg-[#0A2622] border border-[#B7DB74]/28 rounded-full focus:outline-none focus:border-[#C7E88B]"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} — {GOAL_LABELS[p.goal]}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-[#A8CCB9] space-y-1 border-t sm:border-t-0 sm:border-l border-[#B7DB74]/16 pt-3 sm:pt-0 sm:pl-4">
              <div className="font-mono tabular-nums text-[#F4FBF6]">
                {age} anos · {activePatient.weightKg.toFixed(1)} kg ·{' '}
                {activePatient.heightCm} cm · IMC {bmi.toFixed(1)} · Água{' '}
                {activePatient.waterTargetLiters} L/dia
              </div>
              <div>
                {activePatient.restrictions.length > 0 ? (
                  <span className="text-amber-300/90 font-medium">
                    Restrições: {activePatient.restrictions.join(', ')}
                  </span>
                ) : (
                  <span>Sem restrições alimentares registradas</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setShowGeneratePanel((v) => !v)}
              className="btn-gold inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Gerar com evidência
            </button>
            {draft && (
              <button
                type="button"
                onClick={handleAuditWithScience}
                disabled={auditing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#DDF3B2] bg-[#B7DB74]/12 border border-[#B7DB74]/35 rounded-full hover:bg-[#B7DB74]/20 hover:border-[#DDF3B2] transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {auditing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Auditando...
                  </>
                ) : (
                  <>
                    <Microscope className="w-3.5 h-3.5" />
                    Auditar com ciência atual
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleCreateNewPlanForPatient}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#F4FBF6] bg-[#0E332D] border border-[#B7DB74]/24 rounded-full hover:border-[#C7E88B] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#C7E88B]" />
              Em branco
            </button>
            {draft && (
              <button
                type="button"
                onClick={() => setPrintMode(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#F4FBF6] bg-[#0E332D] border border-[#B7DB74]/24 rounded-full hover:border-[#C7E88B] transition-colors cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5 text-[#C7E88B]" />
                Prescrição / PDF
              </button>
            )}
          </div>
        </div>
      </SpotlightCard>

      {/* Evidence-Based Plan Generator Drawer */}
      {showGeneratePanel && (
        <SpotlightCard glowRim className="p-5 sm:p-6 space-y-3 border-[#C7E88B]/40">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-editorial text-xl font-medium text-[#F4FBF6]">
                Gerar plano alimentar personalizado baseado em evidências atuais
              </h3>
              <p className="text-xs text-[#A8CCB9] mt-0.5">
                A IA pesquisa diretrizes atualizadas (PubMed, Cochrane, ESPEN, ISSN, SBD, ABESO) para o perfil de{' '}
                <strong className="text-[#DDF3B2]">{activePatient.fullName}</strong>, respeita as restrições e reaproveita receitas compatíveis da sua biblioteca.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGeneratePanel(false)}
              aria-label="Fechar gerador"
              className="p-1.5 text-[#85AF9B] hover:text-[#F4FBF6] rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={generateInstruction}
              onChange={(e) => setGenerateInstruction(e.target.value)}
              placeholder="Diretriz opcional da nutricionista (ex.: foco anti-inflamatório, jantares leves, lanches práticos de trabalho)..."
              className="flex-1 px-4 py-2.5 text-xs bg-[#0A2622] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/25 rounded-full focus:outline-none focus:border-[#C7E88B]"
            />
            <button
              type="button"
              onClick={handleGenerateEvidencePlan}
              disabled={generatingPlan}
              className="btn-gold inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {generatingPlan ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Pesquisando literatura e montando plano...
                </>
              ) : (
                <>
                  <FlaskConical className="w-3.5 h-3.5" />
                  Montar plano científico
                </>
              )}
            </button>
          </div>
        </SpotlightCard>
      )}

      {aiError && (
        <div
          role="alert"
          className="px-4 py-3 text-sm text-red-200 bg-red-950/60 border border-red-400/30 rounded-xl flex items-center justify-between gap-4"
        >
          <span>{aiError}</span>
          <button
            type="button"
            onClick={() => setAiError(null)}
            className="text-xs font-medium text-red-100 hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {generatedEvidence && (
        <section className="glass-obsidian border-[#C7E88B]/40 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#B7DB74]/15">
            <div>
              <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
                Fundamentação Científica deste Plano
              </h3>
              <p className="text-xs text-[#A8CCB9] mt-0.5">
                Evidências recuperadas em tempo real nas bibliotecas de ciência da nutrição
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGeneratedEvidence(null)}
              aria-label="Ocultar fundamentação"
              className="p-1.5 text-[#85AF9B] hover:text-[#F4FBF6] rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ScientificEvidenceBlock
            markdown={generatedEvidence.rationale}
            sources={generatedEvidence.sources}
            searchQueries={generatedEvidence.searchQueries}
            generatedAt={generatedEvidence.generatedAt}
          />
        </section>
      )}

      {auditResult && (
        <section className="glass-obsidian border-[#C7E88B]/40 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-[#B7DB74]/15">
            <div>
              <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
                Parecer Científico — {activePatient.fullName}
              </h3>
              <p className="text-xs text-[#A8CCB9] mt-0.5">
                Análise comparada às diretrizes mais recentes da literatura nutricional
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAuditResult(null)}
              aria-label="Fechar parecer científico"
              className="p-1.5 text-[#85AF9B] hover:text-[#F4FBF6] rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ScientificEvidenceBlock
            markdown={auditResult.analysis}
            sources={auditResult.sources}
            searchQueries={auditResult.searchQueries}
            generatedAt={auditResult.generatedAt}
          />
        </section>
      )}

      {/* Plan Switcher Tabs */}
      {patientPlans.length > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-[#0E332D] border border-[#B7DB74]/18 rounded-full overflow-x-auto">
            {patientPlans.map((pl) => (
              <button
                key={pl.id}
                type="button"
                onClick={() => setSelectedPlanId(pl.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  activePlan?.id === pl.id
                    ? 'btn-gold font-semibold'
                    : 'text-[#A8CCB9] hover:text-[#F4FBF6]'
                }`}
              >
                {pl.status === 'concluido' && <Lock className="w-3 h-3" />}
                <span className="max-w-[200px] truncate">{pl.title}</span>
              </button>
            ))}
          </div>

          {draft && activePlan && (
            <div className="flex items-center gap-2">
              {!isLocked && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="btn-gold inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-45 whitespace-nowrap"
                >
                  {savedNotice ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Plano salvo
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      {saving
                        ? 'Salvando...'
                        : dirty
                          ? 'Salvar alterações'
                          : 'Salvo'}
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={handleDuplicatePlan}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#F4FBF6] bg-[#0E332D] border border-[#B7DB74]/24 rounded-full hover:border-[#C7E88B] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5 text-[#C7E88B]" />
                Duplicar
              </button>
            </div>
          )}
        </div>
      )}

      {!draft || !activePlan ? (
        <div className="glass-obsidian rounded-2xl p-10 text-center">
          <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6] mb-2">
            {activePatient.fullName} ainda não possui plano alimentar
          </h3>
          <p className="text-sm text-[#A8CCB9] mb-6 max-w-md mx-auto">
            Crie o primeiro plano personalizado já pré-configurado com as metas de{' '}
            <span className="font-mono tabular-nums text-[#DDF3B2]">
              {activePatient.targetCalories} kcal
            </span>{' '}
            deste paciente.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowGeneratePanel(true)}
              className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer"
            >
              <FlaskConical className="w-4 h-4" />
              Gerar com evidência científica
            </button>
            <button
              type="button"
              onClick={handleCreateNewPlanForPatient}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-[#F4FBF6] border border-[#B7DB74]/35 rounded-full hover:border-[#DDF3B2] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#C7E88B]" />
              Criar plano em branco
            </button>
          </div>
        </div>
      ) : (
        <>
          {isLocked && (
            <div className="bg-[#07201C] border border-[#B7DB74]/28 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[#CBE3D6]">
                <Lock className="w-4 h-4 text-[#C7E88B] shrink-0" />
                <span>
                  Este plano foi marcado como <strong className="text-[#F4FBF6]">Concluído (Histórico)</strong> e está bloqueado para edição. Use <strong className="text-[#F4FBF6]">Duplicar</strong> para iniciar uma nova fase.
                </span>
              </div>
              <button
                type="button"
                onClick={handleDuplicatePlan}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#DDF3B2] bg-[#B7DB74]/12 border border-[#B7DB74]/35 rounded-full hover:bg-[#B7DB74]/20 cursor-pointer whitespace-nowrap"
              >
                Criar nova revisão
              </button>
            </div>
          )}

          {/* Live Macro Reconciliation Strip */}
          <SpotlightCard glowRim className="rounded-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#B7DB74]/15">
              {macroCards.map((card) => {
                const status = evaluateTargetAlignment(card.planned, card.target);
                const barWidth = Math.min(100, Math.max(0, status.percent));
                const toneClass =
                  status.tone === 'good'
                    ? 'text-emerald-400'
                    : status.tone === 'high'
                      ? 'text-red-400'
                      : 'text-amber-300';
                const barColor =
                  status.tone === 'good'
                    ? 'bg-gradient-to-r from-[#B7DB74] to-[#DDF3B2]'
                    : status.tone === 'high'
                      ? 'bg-red-500'
                      : 'bg-amber-400/80';

                return (
                  <div key={card.label} className="p-5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#A8CCB9]">{card.label}</span>
                      <span className={`font-medium ${toneClass}`}>
                        {status.label} ({status.percent}%)
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between font-mono tabular-nums">
                      <span className="text-xl font-semibold text-[#F4FBF6]">
                        {card.planned}
                        <span className="text-xs font-normal text-[#85AF9B] ml-0.5">
                          {card.unit}
                        </span>
                      </span>
                      <span className="text-xs text-[#85AF9B]">
                        Meta {card.target} {card.unit}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-[#0E332D] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </SpotlightCard>

          {/* Plan Details & Targets Editor */}
          <section className="glass-obsidian rounded-2xl p-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-[#85AF9B] mb-1.5">
                  Título do plano
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  maxLength={140}
                  value={draft.title}
                  onChange={(e) =>
                    patchDraft((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 text-sm font-medium bg-[#0A2622] text-[#F4FBF6] border border-[#B7DB74]/22 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#85AF9B] mb-1.5">
                  Status do plano
                </label>
                <select
                  disabled={isLocked}
                  value={draft.status}
                  onChange={(e) =>
                    patchDraft((prev) => ({
                      ...prev,
                      status: e.target.value as MealPlanStatus,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-[#0A2622] text-[#F4FBF6] border border-[#B7DB74]/22 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
                >
                  <option value="rascunho">{PLAN_STATUS_LABELS.rascunho}</option>
                  <option value="ativo">{PLAN_STATUS_LABELS.ativo}</option>
                  {isLocked && (
                    <option value="concluido">{PLAN_STATUS_LABELS.concluido}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#85AF9B] mb-1.5">
                  Fibras planejadas · Água
                </label>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-2 text-sm font-mono tabular-nums bg-[#0A2622] border border-[#B7DB74]/18 rounded-xl text-[#DDF3B2] whitespace-nowrap">
                    {totals.fiberG}g fibras
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min={0.5}
                    max={8}
                    disabled={isLocked}
                    value={draft.waterTargetLiters}
                    onChange={(e) =>
                      patchDraft((prev) => ({
                        ...prev,
                        waterTargetLiters: Number(e.target.value),
                      }))
                    }
                    aria-label="Meta de água em litros"
                    className="w-20 px-2.5 py-2 text-sm font-mono tabular-nums bg-[#0A2622] text-[#F4FBF6] border border-[#B7DB74]/22 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
                  />
                  <span className="text-xs text-[#85AF9B]">L</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#B7DB74]/12">
              {[
                { label: 'Meta Energia (kcal)', field: 'targetCalories', min: 800, max: 6000, val: draft.targetCalories },
                { label: 'Meta Proteína (g)', field: 'targetProteinG', min: 20, max: 400, val: draft.targetProteinG },
                { label: 'Meta Carboidrato (g)', field: 'targetCarbsG', min: 0, max: 800, val: draft.targetCarbsG },
                { label: 'Meta Gordura (g)', field: 'targetFatG', min: 10, max: 250, val: draft.targetFatG },
              ].map((m) => (
                <div key={m.field}>
                  <label className="block text-[11px] font-medium text-[#85AF9B] mb-1">
                    {m.label}
                  </label>
                  <input
                    type="number"
                    min={m.min}
                    max={m.max}
                    disabled={isLocked}
                    value={m.val}
                    onChange={(e) =>
                      patchDraft((prev) => ({
                        ...prev,
                        [m.field]: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-[#0A2622] text-[#F4FBF6] border border-[#B7DB74]/20 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Meal Schedule Builder */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
                  Refeições do Dia
                </h2>
                <p className="text-xs text-[#A8CCB9]">
                  Adicione receitas da sua biblioteca ou alimentos avulsos com opções de substituição
                </p>
              </div>
              {!isLocked && draft.meals.length < 10 && (
                <button
                  type="button"
                  onClick={addMealSlot}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#DDF3B2] bg-[#0E332D] border border-[#B7DB74]/28 rounded-full hover:border-[#DDF3B2] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar refeição
                </button>
              )}
            </div>

            {draft.meals.map((meal) => {
              const mealTotals = calculateMealTotals(meal);
              const isAddingHere = addingToMealId === meal.id;

              return (
                <div
                  key={meal.id}
                  className="glass-obsidian rounded-2xl overflow-hidden"
                >
                  <div className="px-5 py-3.5 bg-[#07201C]/80 border-b border-[#B7DB74]/15 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
                      <input
                        type="time"
                        disabled={isLocked}
                        value={meal.time}
                        onChange={(e) =>
                          updateMealField(meal.id, 'time', e.target.value)
                        }
                        aria-label="Horário da refeição"
                        className="px-2.5 py-1 text-xs font-mono tabular-nums font-semibold text-[#DDF3B2] bg-[#0A2622] border border-[#B7DB74]/25 rounded-lg focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
                      />
                      <input
                        type="text"
                        disabled={isLocked}
                        maxLength={80}
                        value={meal.name}
                        onChange={(e) =>
                          updateMealField(meal.id, 'name', e.target.value)
                        }
                        aria-label="Nome da refeição"
                        className="flex-1 max-w-xs px-2.5 py-1 font-editorial text-xl font-medium text-[#F4FBF6] bg-transparent border border-transparent hover:border-[#B7DB74]/20 focus:bg-[#0E332D] focus:border-[#C7E88B] rounded-lg focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono tabular-nums text-[#A8CCB9]">
                        <strong className="text-[#DDF3B2]">
                          {Math.round(mealTotals.calories)} kcal
                        </strong>{' '}
                        · P {mealTotals.proteinG.toFixed(0)}g · C{' '}
                        {mealTotals.carbsG.toFixed(0)}g · G{' '}
                        {mealTotals.fatG.toFixed(0)}g
                      </span>

                      {!isLocked && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAddingToMealId(isAddingHere ? null : meal.id);
                              setAddMode('recipe');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#DDF3B2] bg-[#B7DB74]/12 border border-[#B7DB74]/35 rounded-full hover:bg-[#B7DB74]/22 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Item
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMealSlot(meal.id)}
                            aria-label={`Remover ${meal.name}`}
                            className="p-1.5 text-[#85AF9B] hover:text-red-400 rounded-lg hover:bg-red-950/50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-[#B7DB74]/10">
                    {meal.items.length === 0 ? (
                      <div className="px-5 py-5 text-xs text-[#85AF9B]">
                        Nenhum alimento ou receita incluído nesta refeição.
                      </div>
                    ) : (
                      meal.items.map((item) => {
                        const linkedRecipe = item.recipeId
                          ? recipes.find((r) => r.id === item.recipeId)
                          : null;

                        return (
                          <div
                            key={item.id}
                            className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                          >
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-[#F4FBF6]">
                                  {item.name}
                                </span>
                                <span className="text-xs text-[#85AF9B]">
                                  · {item.portion}
                                </span>
                                {linkedRecipe && (
                                  <button
                                    type="button"
                                    onClick={() => onInspectRecipe(linkedRecipe)}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-[#C7E88B] hover:underline cursor-pointer whitespace-nowrap"
                                  >
                                    <BookOpen className="w-3 h-3" />
                                    Ver receita
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[#85AF9B] shrink-0">
                                  Substituição:
                                </span>
                                {isLocked ? (
                                  <span className="text-xs text-[#A8CCB9]">
                                    {item.substitution || 'Não informada'}
                                  </span>
                                ) : (
                                  <input
                                    type="text"
                                    maxLength={240}
                                    value={item.substitution}
                                    onChange={(e) =>
                                      updateItemSubstitution(
                                        meal.id,
                                        item.id,
                                        e.target.value
                                      )
                                    }
                                    placeholder="Adicionar sugestão de substituição equivalente..."
                                    className="flex-1 text-xs text-[#CBE3D6] placeholder-[#85AF9B] bg-transparent border-b border-transparent hover:border-[#B7DB74]/25 focus:border-[#C7E88B] focus:outline-none py-0.5"
                                  />
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-mono tabular-nums text-[#A8CCB9]">
                                <strong className="text-[#DDF3B2]">
                                  {item.calories} kcal
                                </strong>{' '}
                                · {item.proteinG}P · {item.carbsG}C · {item.fatG}G
                              </span>
                              {!isLocked && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeItemFromMeal(meal.id, item.id)
                                  }
                                  aria-label={`Remover ${item.name}`}
                                  className="p-1 text-[#85AF9B] hover:text-red-400 rounded cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Inline Picker to Add Recipe or Custom Item */}
                  {isAddingHere && !isLocked && (
                    <div className="p-5 bg-[#061A17] border-t border-[#B7DB74]/16 space-y-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-1 p-1 bg-[#0E332D] border border-[#B7DB74]/18 rounded-full">
                          <button
                            type="button"
                            onClick={() => setAddMode('recipe')}
                            className={`px-3 py-1 text-xs font-medium rounded-full cursor-pointer ${
                              addMode === 'recipe'
                                ? 'btn-gold font-semibold'
                                : 'text-[#A8CCB9]'
                            }`}
                          >
                            Da biblioteca de receitas
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddMode('custom')}
                            className={`px-3 py-1 text-xs font-medium rounded-full cursor-pointer ${
                              addMode === 'custom'
                                ? 'btn-gold font-semibold'
                                : 'text-[#A8CCB9]'
                            }`}
                          >
                            Alimento personalizado
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setAddingToMealId(null)}
                          className="text-xs text-[#85AF9B] hover:text-[#F4FBF6] cursor-pointer"
                        >
                          Fechar
                        </button>
                      </div>

                      {addMode === 'recipe' ? (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 text-[#85AF9B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="search"
                                value={recipeSearch}
                                onChange={(e) => setRecipeSearch(e.target.value)}
                                placeholder="Filtrar receitas por título, categoria ou restrição..."
                                className="w-full pl-9 pr-3 py-2 text-xs bg-[#0E332D] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/20 rounded-full focus:outline-none focus:border-[#C7E88B]"
                              />
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-[#A8CCB9]">
                              <span>Porção:</span>
                              {[0.5, 1, 1.5, 2].map((mult) => (
                                <button
                                  key={mult}
                                  type="button"
                                  onClick={() => setRecipeMultiplier(mult)}
                                  className={`px-2.5 py-1 rounded-full font-mono tabular-nums cursor-pointer ${
                                    recipeMultiplier === mult
                                      ? 'btn-gold font-semibold'
                                      : 'bg-[#0E332D] border border-[#B7DB74]/20 text-[#CBE3D6]'
                                  }`}
                                >
                                  {mult}x
                                </button>
                              ))}
                            </div>
                          </div>

                          {filteredRecipes.length === 0 ? (
                            <p className="text-xs text-[#85AF9B] py-2">
                              Nenhuma receita encontrada.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                              {filteredRecipes.map((rec) => (
                                <button
                                  key={rec.id}
                                  type="button"
                                  onClick={() =>
                                    addRecipeToMeal(
                                      meal.id,
                                      rec,
                                      recipeMultiplier
                                    )
                                  }
                                  className="text-left p-3 bg-[#0E332D] border border-[#B7DB74]/18 rounded-xl hover:border-[#DDF3B2]/60 transition-colors cursor-pointer"
                                >
                                  <div className="text-xs font-semibold text-[#F4FBF6] truncate">
                                    {rec.title}
                                  </div>
                                  <div className="text-[11px] font-mono tabular-nums text-[#A8CCB9] mt-0.5">
                                    <span className="text-[#DDF3B2]">
                                      {Math.round(rec.calories * recipeMultiplier)} kcal
                                    </span>{' '}
                                    · P {(rec.proteinG * recipeMultiplier).toFixed(0)}g · C{' '}
                                    {(rec.carbsG * recipeMultiplier).toFixed(0)}g · G{' '}
                                    {(rec.fatG * recipeMultiplier).toFixed(0)}g
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-medium text-[#85AF9B] mb-1">
                                Alimento / preparação
                              </label>
                              <input
                                type="text"
                                value={customItem.name}
                                onChange={(e) =>
                                  setCustomItem({
                                    ...customItem,
                                    name: e.target.value,
                                  })
                                }
                                placeholder="Ex.: Pão integral com queijo cottage"
                                className="w-full px-3 py-1.5 text-xs bg-[#0E332D] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/20 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-[#85AF9B] mb-1">
                                Quantidade / medida
                              </label>
                              <input
                                type="text"
                                value={customItem.portion}
                                onChange={(e) =>
                                  setCustomItem({
                                    ...customItem,
                                    portion: e.target.value,
                                  })
                                }
                                placeholder="2 fatias + 2 col. sopa"
                                className="w-full px-3 py-1.5 text-xs bg-[#0E332D] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/20 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                            {[
                              { label: 'Kcal', key: 'calories', step: '1' },
                              { label: 'Prot (g)', key: 'proteinG', step: '0.5' },
                              { label: 'Carb (g)', key: 'carbsG', step: '0.5' },
                              { label: 'Gord (g)', key: 'fatG', step: '0.5' },
                              { label: 'Fibras (g)', key: 'fiberG', step: '0.5' },
                            ].map((f) => (
                              <div key={f.key}>
                                <label className="block text-[11px] text-[#85AF9B] mb-1">
                                  {f.label}
                                </label>
                                <input
                                  type="number"
                                  step={f.step}
                                  min={0}
                                  value={customItem[f.key as keyof typeof customItem]}
                                  onChange={(e) =>
                                    setCustomItem({
                                      ...customItem,
                                      [f.key]: Number(e.target.value),
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#0E332D] text-[#F4FBF6] border border-[#B7DB74]/20 rounded-xl"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <input
                              type="text"
                              value={customItem.substitution}
                              onChange={(e) =>
                                setCustomItem({
                                  ...customItem,
                                  substitution: e.target.value,
                                })
                              }
                              placeholder="Substituição opcional (ex.: 1 tapioca média com frango)"
                              className="flex-1 px-3 py-1.5 text-xs bg-[#0E332D] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/20 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                            />
                            <button
                              type="button"
                              onClick={() => addCustomItemToMeal(meal.id)}
                              disabled={!customItem.name.trim()}
                              className="btn-gold px-4 py-1.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-45 whitespace-nowrap"
                            >
                              Inserir na refeição
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="px-5 py-2.5 bg-[#07201C]/60 border-t border-[#B7DB74]/10">
                    <input
                      type="text"
                      disabled={isLocked}
                      maxLength={400}
                      value={meal.notes}
                      onChange={(e) =>
                        updateMealField(meal.id, 'notes', e.target.value)
                      }
                      placeholder="Observação específica desta refeição (ex.: horário pré-treino, modo de consumo)..."
                      className="w-full text-xs text-[#A8CCB9] placeholder-[#85AF9B] bg-transparent focus:outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </section>

          {/* General Clinical Guidance & Plan Lifecycle Actions */}
          <section className="glass-obsidian rounded-2xl p-6 space-y-5">
            <div>
              <label className="block font-editorial text-xl font-medium text-[#F4FBF6] mb-2">
                Orientações Gerais, Hidratação e Suplementação
              </label>
              <textarea
                rows={4}
                disabled={isLocked}
                maxLength={2000}
                value={draft.generalGuidance}
                onChange={(e) =>
                  patchDraft((prev) => ({
                    ...prev,
                    generalGuidance: e.target.value,
                  }))
                }
                placeholder="Recomendações de hidratação, temperos naturais, chás, suplementos prescritos ou orientações de retorno..."
                className="w-full px-4 py-3 text-sm bg-[#0A2622] text-[#F4FBF6] placeholder-[#85AF9B] border border-[#B7DB74]/20 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
              />
            </div>

            <div className="pt-4 border-t border-[#B7DB74]/14 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                {!isLocked &&
                  (confirmConclude ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[#F4FBF6] font-medium">
                        Concluir e travar este plano como histórico?
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirmConclude(false)}
                        className="px-2.5 py-1.5 text-[#CBE3D6] bg-[#07201C] border border-[#B7DB74]/20 rounded-lg cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (dirty) await handleSave();
                          await onConcludePlan(activePlan.id);
                          setConfirmConclude(false);
                        }}
                        className="btn-gold px-3 py-1.5 font-semibold rounded-lg cursor-pointer"
                      >
                        Confirmar conclusão
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmConclude(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A8CCB9] hover:text-[#F4FBF6] cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#B7DB74]" />
                      Concluir plano (arquivar histórico)
                    </button>
                  ))}

                {confirmDelete ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-red-300 font-medium">
                      Excluir este plano?
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1.5 text-[#CBE3D6] bg-[#07201C] border border-[#B7DB74]/20 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeletePlan(activePlan.id);
                        setConfirmDelete(false);
                      }}
                      className="px-3 py-1.5 font-semibold text-white bg-red-600 rounded-lg cursor-pointer"
                    >
                      Excluir
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400/90 hover:text-red-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir plano
                  </button>
                )}
              </div>

              {!isLocked && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="btn-gold inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-45 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Salvando...' : 'Salvar plano alimentar'}
                </button>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
