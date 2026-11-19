import React, { useState } from 'react';
import { ExternalLink, Loader2, Save, Search, X } from 'lucide-react';
import {
  GeneratedRecipeResponse,
  generateEvidenceRecipe,
} from '../lib/aiService';
import {
  Recipe,
  RECIPE_CATEGORY_LABELS,
  RecipeCategory,
} from '../types';

interface AiRecipeGeneratorModalProps {
  open: boolean;
  nutritionistId: string;
  onClose: () => void;
  onSaveGeneratedRecipe: (
    data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
}

const VALID_CATEGORIES = new Set<RecipeCategory>([
  'cafe_da_manha',
  'almoco',
  'jantar',
  'lanche',
  'ceia',
  'sobremesa_fit',
]);

const INPUT_CLASS =
  'w-full px-3.5 py-2 text-sm bg-[#0A2622] text-[#F4FBF6] placeholder-[#85AF9B] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]';

export function AiRecipeGeneratorModal({
  open,
  nutritionistId,
  onClose,
  onSaveGeneratedRecipe,
}: AiRecipeGeneratorModalProps) {
  const [goalPrompt, setGoalPrompt] = useState('');
  const [category, setCategory] = useState<RecipeCategory>('almoco');
  const [restrictions, setRestrictions] = useState('');
  const [targetCalories, setTargetCalories] = useState(420);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedRecipeResponse | null>(null);

  if (!open) return null;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (goalPrompt.trim().length < 3) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await generateEvidenceRecipe({
        goalPrompt: goalPrompt.trim(),
        category,
        restrictions: restrictions.trim(),
        targetCalories: Number(targetCalories) || 400,
      });
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar a receita baseada em evidências.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const rec = result.recipe;
      const safeCat = VALID_CATEGORIES.has(rec.category)
        ? rec.category
        : category;
      await onSaveGeneratedRecipe({
        nutritionistId,
        title: rec.title,
        category: safeCat,
        description: rec.description,
        prepTimeMin: Number(rec.prepTimeMin) || 20,
        servings: Number(rec.servings) || 1,
        portionLabel: rec.portionLabel || '1 porção',
        calories: Number(rec.calories) || targetCalories,
        proteinG: Number(rec.proteinG) || 0,
        carbsG: Number(rec.carbsG) || 0,
        fatG: Number(rec.fatG) || 0,
        fiberG: Number(rec.fiberG) || 0,
        dietaryTags: rec.dietaryTags || [],
        ingredients: rec.ingredients || [],
        instructions: rec.instructions || [],
        clinicalTip: rec.clinicalTip || rec.scientificRationale || '',
        imageUrl: '',
      });
      setResult(null);
      setGoalPrompt('');
      onClose();
    } catch {
      setError('Falha ao salvar a receita na biblioteca.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-recipe-title"
    >
      <div className="glass-obsidian border-[#B7DB74]/30 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#B7DB74]/15">
          <div>
            <h2
              id="ai-recipe-title"
              className="font-editorial text-2xl font-medium text-[#F4FBF6]"
            >
              Criar Receita Clínica com Evidência Científica
            </h2>
            <p className="text-xs text-[#A8CCB9]">
              A IA consulta bibliotecas científicas atuais para propor ingredientes funcionais e macros equilibrados.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-2 text-[#A8CCB9] hover:text-[#F4FBF6] rounded-lg hover:bg-[#B7DB74]/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Foco clínico e perfil desejado
              </label>
              <input
                type="text"
                required
                value={goalPrompt}
                onChange={(e) => setGoalPrompt(e.target.value)}
                placeholder="Ex.: Jantar anti-inflamatório rico em ômega-3 e fibras solúveis para controle glicêmico"
                className={INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Refeição
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RecipeCategory)}
                  className={INPUT_CLASS}
                >
                  {(Object.keys(RECIPE_CATEGORY_LABELS) as RecipeCategory[]).map(
                    (k) => (
                      <option key={k} value={k}>
                        {RECIPE_CATEGORY_LABELS[k]}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Restrições obrigatórias
                </label>
                <input
                  type="text"
                  value={restrictions}
                  onChange={(e) => setRestrictions(e.target.value)}
                  placeholder="Ex.: Sem lactose, sem glúten"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Alvo calórico (kcal/porção)
                </label>
                <input
                  type="number"
                  min={80}
                  max={1400}
                  value={targetCalories}
                  onChange={(e) => setTargetCalories(Number(e.target.value))}
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || goalPrompt.trim().length < 3}
                className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Pesquisando literatura e formulando...
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    Pesquisar e gerar receita
                  </>
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="px-4 py-3 text-sm text-red-200 bg-red-950/60 border border-red-400/30 rounded-xl">
              {error}
            </div>
          )}

          {result && (
            <div className="border-t border-[#B7DB74]/15 pt-6 space-y-5">
              <div>
                <div className="text-xs text-[#C7E88B] font-medium mb-1">
                  {RECIPE_CATEGORY_LABELS[result.recipe.category] ||
                    RECIPE_CATEGORY_LABELS[category]}{' '}
                  · {result.recipe.prepTimeMin} min · {result.recipe.portionLabel}
                </div>
                <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
                  {result.recipe.title}
                </h3>
                <p className="text-sm text-[#A8CCB9] mt-1">
                  {result.recipe.description}
                </p>
              </div>

              <div className="grid grid-cols-5 border-y border-[#B7DB74]/15 py-3 text-center font-mono tabular-nums">
                <div>
                  <div className="text-[11px] font-sans text-[#85AF9B]">Energia</div>
                  <div className="text-sm font-semibold text-[#DDF3B2]">
                    {result.recipe.calories} kcal
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-[#85AF9B]">Proteína</div>
                  <div className="text-sm font-semibold text-[#F4FBF6]">
                    {result.recipe.proteinG}g
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-[#85AF9B]">Carboidrato</div>
                  <div className="text-sm font-semibold text-[#F4FBF6]">
                    {result.recipe.carbsG}g
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-[#85AF9B]">Gordura</div>
                  <div className="text-sm font-semibold text-[#F4FBF6]">
                    {result.recipe.fatG}g
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-[#85AF9B]">Fibras</div>
                  <div className="text-sm font-semibold text-[#F4FBF6]">
                    {result.recipe.fiberG}g
                  </div>
                </div>
              </div>

              {result.recipe.scientificRationale && (
                <div className="bg-[#0E332D] border border-[#B7DB74]/20 rounded-xl p-4">
                  <div className="text-xs font-semibold text-[#DDF3B2] mb-1">
                    Fundamentação científica
                  </div>
                  <p className="text-xs text-[#CBE3D6] leading-relaxed">
                    {result.recipe.scientificRationale}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <h4 className="text-xs font-semibold text-[#DDF3B2] mb-2">
                    Ingredientes
                  </h4>
                  <ul className="text-xs text-[#CBE3D6] space-y-1.5 list-disc pl-4 marker:text-[#B7DB74]">
                    {result.recipe.ingredients.map((ing, i) => (
                      <li key={i}>{ing}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#DDF3B2] mb-2">
                    Modo de preparo
                  </h4>
                  <ol className="text-xs text-[#CBE3D6] space-y-1.5 list-decimal pl-4 marker:text-[#B7DB74]">
                    {result.recipe.instructions.map((st, i) => (
                      <li key={i}>{st}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {result.sources.length > 0 && (
                <div className="pt-3 border-t border-[#B7DB74]/12 space-y-2">
                  <div className="text-xs font-semibold text-[#F4FBF6]">
                    Fontes científicas consultadas ({result.sources.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.sources.slice(0, 6).map((src, i) => (
                      <a
                        key={i}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#CBE3D6] bg-[#0E332D] border border-[#B7DB74]/20 rounded-full hover:border-[#DDF3B2] hover:text-[#DDF3B2]"
                      >
                        <span className="max-w-[200px] truncate">{src.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#B7DB74]/14">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-medium text-[#F4FBF6] bg-[#0E332D] border border-[#B7DB74]/25 rounded-full cursor-pointer"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-gold inline-flex items-center gap-2 px-6 py-2 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Salvando...' : 'Salvar na biblioteca de receitas'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
