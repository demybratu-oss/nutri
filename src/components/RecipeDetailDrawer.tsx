import { useState } from 'react';
import { Check, Edit3, Plus, Trash2, X } from 'lucide-react';
import {
  MealPlan,
  Patient,
  Recipe,
  RECIPE_CATEGORY_LABELS,
} from '../types';
import { RecipeImage } from './RecipeImage';

interface RecipeDetailDrawerProps {
  recipe: Recipe | null;
  patients: Patient[];
  mealPlans: MealPlan[];
  onClose: () => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipeId: string) => Promise<void>;
  onAssignToPlan: (
    planId: string,
    mealSlotId: string,
    recipe: Recipe,
    multiplier: number
  ) => Promise<void>;
}

export function RecipeDetailDrawer({
  recipe,
  patients,
  mealPlans,
  onClose,
  onEdit,
  onDelete,
  onAssignToPlan,
}: RecipeDetailDrawerProps) {
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedMealId, setSelectedMealId] = useState('');
  const [multiplier, setMultiplier] = useState(1);
  const [assigning, setAssigning] = useState(false);
  const [assignedSuccess, setAssignedSuccess] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!recipe) return null;

  const editablePlans = mealPlans.filter((p) => p.status !== 'concluido');
  const activePlan =
    editablePlans.find((p) => p.id === selectedPlanId) || editablePlans[0] || null;
  const effectivePlanId = activePlan?.id || '';
  const meals = activePlan?.meals || [];
  const effectiveMealId =
    meals.find((m) => m.id === selectedMealId)?.id || meals[0]?.id || '';

  async function handleAssign() {
    if (!recipe || !effectivePlanId || !effectiveMealId) return;
    setAssigning(true);
    setAssignedSuccess(false);
    try {
      await onAssignToPlan(effectivePlanId, effectiveMealId, recipe, multiplier);
      setAssignedSuccess(true);
      setTimeout(() => setAssignedSuccess(false), 3000);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={recipe.title}
    >
      <div className="bg-[#0A2622] w-full max-w-xl h-full border-l border-[#B7DB74]/24 flex flex-col overflow-hidden text-[#F4FBF6]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#B7DB74]/15">
          <div className="text-xs text-[#A8CCB9] flex items-center gap-2 min-w-0">
            <span className="font-medium text-[#C7E88B]">
              {RECIPE_CATEGORY_LABELS[recipe.category]}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{recipe.prepTimeMin} min</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{recipe.portionLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(recipe)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F4FBF6] bg-[#0A2622] border border-[#B7DB74]/25 rounded-full hover:border-[#C7E88B] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#C7E88B]" />
              Editar
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar detalhes da receita"
              className="p-2 text-[#A8CCB9] hover:text-[#F4FBF6] rounded-lg hover:bg-[#B7DB74]/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="relative">
            <RecipeImage
              src={recipe.imageUrl}
              alt={recipe.title}
              category={recipe.category}
              className="w-full h-60 brightness-90"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#0A2622] via-transparent to-transparent"
            />
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h2 className="font-editorial text-3xl font-medium text-[#F4FBF6] leading-tight mb-2">
                {recipe.title}
              </h2>
              {recipe.description && (
                <p className="text-sm text-[#A8CCB9] leading-relaxed">
                  {recipe.description}
                </p>
              )}
              {recipe.dietaryTags.length > 0 && (
                <p className="mt-3 text-xs text-[#C7E88B]">
                  {recipe.dietaryTags.join(' · ')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-5 border-y border-[#B7DB74]/16 py-4 text-center">
              <div>
                <div className="text-xs text-[#85AF9B] mb-1">Energia</div>
                <div className="text-base font-semibold font-mono tabular-nums text-[#DDF3B2]">
                  {recipe.calories}
                </div>
                <div className="text-[11px] text-[#85AF9B]">kcal</div>
              </div>
              <div>
                <div className="text-xs text-[#85AF9B] mb-1">Proteína</div>
                <div className="text-base font-semibold font-mono tabular-nums text-[#F4FBF6]">
                  {recipe.proteinG}g
                </div>
              </div>
              <div>
                <div className="text-xs text-[#85AF9B] mb-1">Carboidrato</div>
                <div className="text-base font-semibold font-mono tabular-nums text-[#F4FBF6]">
                  {recipe.carbsG}g
                </div>
              </div>
              <div>
                <div className="text-xs text-[#85AF9B] mb-1">Gordura</div>
                <div className="text-base font-semibold font-mono tabular-nums text-[#F4FBF6]">
                  {recipe.fatG}g
                </div>
              </div>
              <div>
                <div className="text-xs text-[#85AF9B] mb-1">Fibras</div>
                <div className="text-base font-semibold font-mono tabular-nums text-[#F4FBF6]">
                  {recipe.fiberG}g
                </div>
              </div>
            </div>

            {editablePlans.length > 0 && (
              <div className="bg-[#07201C] border border-[#B7DB74]/22 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#DDF3B2]">
                  Inserir diretamente no plano de um paciente
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    value={effectivePlanId}
                    onChange={(e) => {
                      setSelectedPlanId(e.target.value);
                      setSelectedMealId('');
                    }}
                    className="px-3 py-2 text-xs bg-[#07201C] text-[#F4FBF6] border border-[#B7DB74]/22 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                  >
                    {editablePlans.map((plan) => {
                      const pat = patients.find((p) => p.id === plan.patientId);
                      return (
                        <option key={plan.id} value={plan.id}>
                          {pat ? `${pat.fullName} — ${plan.title}` : plan.title}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    value={effectiveMealId}
                    onChange={(e) => setSelectedMealId(e.target.value)}
                    disabled={meals.length === 0}
                    className="px-3 py-2 text-xs bg-[#07201C] text-[#F4FBF6] border border-[#B7DB74]/22 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-50"
                  >
                    {meals.length === 0 ? (
                      <option value="">Plano sem refeições ainda</option>
                    ) : (
                      meals.map((meal) => (
                        <option key={meal.id} value={meal.id}>
                          {meal.time} · {meal.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-[#A8CCB9]">
                    <span>Porção:</span>
                    {[0.5, 1, 1.5, 2].map((mult) => (
                      <button
                        key={mult}
                        type="button"
                        onClick={() => setMultiplier(mult)}
                        className={`px-2.5 py-1 rounded-full text-xs font-mono tabular-nums cursor-pointer transition-colors ${
                          multiplier === mult
                            ? 'btn-gold font-semibold'
                            : 'bg-[#07201C] border border-[#B7DB74]/20 text-[#CBE3D6]'
                        }`}
                      >
                        {mult}x
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={assigning || !effectiveMealId}
                    className="btn-gold inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {assignedSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Adicionada ao plano
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        {assigning ? 'Inserindo...' : 'Adicionar ao plano'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-editorial text-xl font-medium text-[#F4FBF6] mb-3">
                Ingredientes ({recipe.servings}{' '}
                {recipe.servings === 1 ? 'porção' : 'porções'})
              </h3>
              {recipe.ingredients.length === 0 ? (
                <p className="text-sm text-[#85AF9B]">Nenhum ingrediente listado.</p>
              ) : (
                <ul className="space-y-2 text-sm text-[#CBE3D6]">
                  {recipe.ingredients.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 pb-2 border-b border-[#B7DB74]/10 last:border-b-0"
                    >
                      <span className="font-mono text-xs text-[#C7E88B] pt-0.5 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-editorial text-xl font-medium text-[#F4FBF6] mb-3">
                Modo de Preparo
              </h3>
              {recipe.instructions.length === 0 ? (
                <p className="text-sm text-[#85AF9B]">Nenhum passo cadastrado.</p>
              ) : (
                <ol className="space-y-3 text-sm text-[#CBE3D6] leading-relaxed">
                  {recipe.instructions.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="font-mono text-xs font-semibold text-[#DDF3B2] pt-0.5 tabular-nums">
                        {idx + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {recipe.clinicalTip && (
              <div className="bg-[#07201C] border border-[#B7DB74]/20 rounded-2xl p-4">
                <h3 className="text-xs font-semibold text-[#DDF3B2] mb-1.5">
                  Nota clínica e substituições
                </h3>
                <p className="text-sm text-[#CBE3D6] leading-relaxed">
                  {recipe.clinicalTip}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-[#B7DB74]/14 flex items-center justify-between">
              {confirmDelete ? (
                <div className="flex items-center gap-3 w-full justify-between">
                  <span className="text-xs text-red-300 font-medium">
                    Excluir esta receita permanentemente?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 text-xs font-medium text-[#CBE3D6] bg-[#0A2622] border border-[#B7DB74]/20 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await onDelete(recipe.id);
                        setConfirmDelete(false);
                        onClose();
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer"
                    >
                      Confirmar exclusão
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400/90 hover:text-red-300 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir receita
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
