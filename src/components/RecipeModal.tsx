import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { RECIPE_IMAGES } from '../data/seedData';
import {
  Recipe,
  RECIPE_CATEGORY_LABELS,
  RecipeCategory,
} from '../types';

interface RecipeModalProps {
  open: boolean;
  nutritionistId: string;
  initialRecipe?: Recipe | null;
  onClose: () => void;
  onSubmit: (
    data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
}

const IMAGE_PRESETS = [
  { label: 'Sem foto (padrão clínico)', url: '' },
  { label: 'Bowl de Salmão e Quinoa', url: RECIPE_IMAGES.salmao },
  { label: 'Overnight Oats com Frutas', url: RECIPE_IMAGES.overnight },
  { label: 'Omelete de Ervas e Ricota', url: RECIPE_IMAGES.omelete },
  { label: 'Frango às Ervas e Batata-Doce', url: RECIPE_IMAGES.frango },
  { label: 'Creme de Abóbora com Gengibre', url: RECIPE_IMAGES.abobora },
];

const DEFAULT_RECIPE = {
  title: '',
  category: 'almoco' as RecipeCategory,
  description: '',
  prepTimeMin: 20,
  servings: 1,
  portionLabel: '1 porção (300g)',
  calories: 380,
  proteinG: 30,
  carbsG: 35,
  fatG: 12,
  fiberG: 6,
  tagsText: 'Sem glúten, Equilibrada',
  ingredientsText: '',
  instructionsText: '',
  clinicalTip: '',
  imageUrl: '',
};

const INPUT_CLASS =
  'w-full px-3.5 py-2 text-sm bg-[#0A2622] text-[#F4FBF6] placeholder-[#85AF9B] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]';

export function RecipeModal({
  open,
  nutritionistId,
  initialRecipe,
  onClose,
  onSubmit,
}: RecipeModalProps) {
  const [form, setForm] = useState(DEFAULT_RECIPE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialRecipe) {
      setForm({
        title: initialRecipe.title,
        category: initialRecipe.category,
        description: initialRecipe.description,
        prepTimeMin: initialRecipe.prepTimeMin,
        servings: initialRecipe.servings,
        portionLabel: initialRecipe.portionLabel,
        calories: initialRecipe.calories,
        proteinG: initialRecipe.proteinG,
        carbsG: initialRecipe.carbsG,
        fatG: initialRecipe.fatG,
        fiberG: initialRecipe.fiberG,
        tagsText: initialRecipe.dietaryTags.join(', '),
        ingredientsText: initialRecipe.ingredients.join('\n'),
        instructionsText: initialRecipe.instructions.join('\n'),
        clinicalTip: initialRecipe.clinicalTip,
        imageUrl: initialRecipe.imageUrl,
      });
    } else {
      setForm(DEFAULT_RECIPE);
    }
  }, [open, initialRecipe]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.title.trim().length < 2) {
      setError('Informe o nome da receita.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const dietaryTags = form.tagsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const ingredients = form.ingredientsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const instructions = form.instructionsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      await onSubmit(
        {
          nutritionistId,
          title: form.title,
          category: form.category,
          description: form.description,
          prepTimeMin: Number(form.prepTimeMin),
          servings: Number(form.servings),
          portionLabel: form.portionLabel,
          calories: Number(form.calories),
          proteinG: Number(form.proteinG),
          carbsG: Number(form.carbsG),
          fatG: Number(form.fatG),
          fiberG: Number(form.fiberG),
          dietaryTags,
          ingredients,
          instructions,
          clinicalTip: form.clinicalTip,
          imageUrl: form.imageUrl,
        },
        initialRecipe?.id
      );
      onClose();
    } catch {
      setError('Não foi possível salvar a receita. Verifique os campos preenchidos.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-modal-title"
    >
      <div className="glass-obsidian border-[#B7DB74]/30 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#B7DB74]/15">
          <h2
            id="recipe-modal-title"
            className="font-editorial text-2xl font-medium text-[#F4FBF6]"
          >
            {initialRecipe ? 'Editar Receita' : 'Nova Receita Clínica'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-2 text-[#A8CCB9] hover:text-[#F4FBF6] rounded-lg hover:bg-[#B7DB74]/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="px-4 py-3 text-sm text-red-200 bg-red-950/60 border border-red-400/30 rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Título da receita
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex.: Panqueca de Aveia e Banana com Canela"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Refeição indicada
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as RecipeCategory })
                }
                className={INPUT_CLASS}
              >
                {(Object.keys(RECIPE_CATEGORY_LABELS) as RecipeCategory[]).map(
                  (key) => (
                    <option key={key} value={key}>
                      {RECIPE_CATEGORY_LABELS[key]}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
              Descrição breve
            </label>
            <input
              type="text"
              maxLength={400}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Resumo dos ingredientes principais e perfil da preparação"
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Medida da porção
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={form.portionLabel}
                onChange={(e) =>
                  setForm({ ...form, portionLabel: e.target.value })
                }
                placeholder="1 prato (320g)"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Tempo (min)
              </label>
              <input
                type="number"
                min={1}
                max={360}
                value={form.prepTimeMin}
                onChange={(e) =>
                  setForm({ ...form, prepTimeMin: Number(e.target.value) })
                }
                className={`${INPUT_CLASS} font-mono tabular-nums`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Rendimento (porções)
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.servings}
                onChange={(e) =>
                  setForm({ ...form, servings: Number(e.target.value) })
                }
                className={`${INPUT_CLASS} font-mono tabular-nums`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Foto ilustrativa
              </label>
              <select
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                className={INPUT_CLASS}
              >
                {IMAGE_PRESETS.map((preset) => (
                  <option key={preset.label} value={preset.url}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-[#B7DB74]/14 space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-[#C7E88B]">
              Informação nutricional (por porção)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Calorias (kcal)', key: 'calories', max: 2500, step: '1' },
                { label: 'Proteína (g)', key: 'proteinG', max: 200, step: '0.5' },
                { label: 'Carboidrato (g)', key: 'carbsG', max: 300, step: '0.5' },
                { label: 'Gordura (g)', key: 'fatG', max: 150, step: '0.5' },
                { label: 'Fibras (g)', key: 'fiberG', max: 80, step: '0.5' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                    {f.label}
                  </label>
                  <input
                    type="number"
                    step={f.step}
                    min={0}
                    max={f.max}
                    value={form[f.key as keyof typeof form]}
                    onChange={(e) =>
                      setForm({ ...form, [f.key]: Number(e.target.value) })
                    }
                    className={`${INPUT_CLASS} font-mono tabular-nums`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#B7DB74]/14">
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Ingredientes (um por linha)
              </label>
              <textarea
                rows={5}
                value={form.ingredientsText}
                onChange={(e) =>
                  setForm({ ...form, ingredientsText: e.target.value })
                }
                placeholder={'120g de filé de frango\n80g de quinoa cozida\n1 colher de chá de azeite'}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Modo de preparo (um passo por linha)
              </label>
              <textarea
                rows={5}
                value={form.instructionsText}
                onChange={(e) =>
                  setForm({ ...form, instructionsText: e.target.value })
                }
                placeholder={'Tempere o frango com limão e ervas.\nGrelhe em fogo médio por 4 minutos de cada lado.'}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Características dietéticas (separadas por vírgula)
              </label>
              <input
                type="text"
                value={form.tagsText}
                onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
                placeholder="Sem glúten, Sem lactose, Low carb"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Orientação clínica / substituição
              </label>
              <input
                type="text"
                maxLength={500}
                value={form.clinicalTip}
                onChange={(e) =>
                  setForm({ ...form, clinicalTip: e.target.value })
                }
                placeholder="Ex.: Pode substituir a proteína por tofu grelhado."
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#B7DB74]/14">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-medium text-[#F4FBF6] bg-[#0E332D] border border-[#B7DB74]/25 rounded-full hover:border-[#C7E88B] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-gold px-6 py-2.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {saving
                ? 'Salvando...'
                : initialRecipe
                  ? 'Salvar receita'
                  : 'Adicionar à biblioteca'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
