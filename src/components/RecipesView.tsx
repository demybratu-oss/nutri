import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, FlaskConical, Plus, Search } from 'lucide-react';
import {
  Recipe,
  RECIPE_CATEGORY_LABELS,
  RecipeCategory,
} from '../types';
import { MOTION_EASE } from './LuxuryPrimitives';
import { RecipeImage } from './RecipeImage';

interface RecipesViewProps {
  recipes: Recipe[];
  loading: boolean;
  onAddRecipe: () => void;
  onOpenAiRecipeGenerator: () => void;
  onSelectRecipe: (recipe: Recipe) => void;
}

export function RecipesView({
  recipes,
  loading,
  onAddRecipe,
  onOpenAiRecipeGenerator,
  onSelectRecipe,
}: RecipesViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | RecipeCategory>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    recipes.forEach((r) => {
      r.dietaryTags.forEach((t) => {
        counts.set(t, (counts.get(t) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag]) => tag);
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      const matchesCat = categoryFilter === 'all' || r.category === categoryFilter;
      const matchesTag =
        tagFilter === 'all' ||
        r.dietaryTags.some((t) => t.toLowerCase() === tagFilter.toLowerCase());
      const matchesQuery =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.toLowerCase().includes(q)) ||
        r.dietaryTags.some((t) => t.toLowerCase().includes(q));
      return matchesCat && matchesTag && matchesQuery;
    });
  }, [recipes, search, categoryFilter, tagFilter]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div
            key={n}
            className="h-80 glass-obsidian rounded-2xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search + AI Recipe Button + Category Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#8D8274] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, ingrediente ou característica..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#15110E] text-[#FAF5EC] placeholder-[#7C7164] border border-[#D9AF72]/22 rounded-full focus:outline-none focus:border-[#E8C589]"
            />
          </div>
          <button
            type="button"
            onClick={onOpenAiRecipeGenerator}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#F0D29C] bg-[#D9AF72]/12 border border-[#D9AF72]/35 rounded-full hover:bg-[#D9AF72]/20 hover:border-[#F0D29C] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Criar receita com evidência
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#15110E] border border-[#D9AF72]/18 rounded-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              categoryFilter === 'all'
                ? 'btn-gold font-semibold'
                : 'text-[#BDB2A4] hover:text-[#FAF5EC]'
            }`}
          >
            Todas ({recipes.length})
          </button>
          {(Object.keys(RECIPE_CATEGORY_LABELS) as RecipeCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                categoryFilter === cat
                  ? 'btn-gold font-semibold'
                  : 'text-[#BDB2A4] hover:text-[#FAF5EC]'
              }`}
            >
              {RECIPE_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Dietary Filter Bar */}
      {availableTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-[#9D9284]">
            Perfil dietético:
          </span>
          <button
            type="button"
            onClick={() => setTagFilter('all')}
            className={`px-3 py-1 text-xs rounded-full transition-colors cursor-pointer whitespace-nowrap ${
              tagFilter === 'all'
                ? 'bg-[#D9AF72]/20 text-[#F5DCAC] border border-[#D9AF72]/50 font-medium'
                : 'bg-[#15110E] border border-[#D9AF72]/16 text-[#A89E90] hover:text-[#FAF5EC]'
            }`}
          >
            Qualquer perfil
          </button>
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setTagFilter(tagFilter === tag ? 'all' : tag)}
              className={`px-3 py-1 text-xs rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                tagFilter === tag
                  ? 'bg-[#D9AF72]/20 text-[#F5DCAC] border border-[#D9AF72]/50 font-medium'
                  : 'bg-[#15110E] border border-[#D9AF72]/16 text-[#A89E90] hover:text-[#FAF5EC]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="glass-obsidian rounded-2xl p-10 text-center">
          <h3 className="font-editorial text-2xl font-medium text-[#FAF5EC] mb-2">
            {recipes.length === 0
              ? 'Sua biblioteca de receitas está vazia'
              : 'Nenhuma receita corresponde aos filtros'}
          </h3>
          <p className="text-sm text-[#A89E90] mb-6">
            {recipes.length === 0
              ? 'Cadastre receitas padronizadas com composição nutricional para prescrever nos planos dos seus pacientes.'
              : 'Limpe os filtros ou cadastre uma nova preparação.'}
          </p>
          <button
            type="button"
            onClick={onAddRecipe}
            className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova receita
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((recipe, idx) => (
            <motion.button
              key={recipe.id}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: idx * 0.04, ease: MOTION_EASE }}
              onClick={() => onSelectRecipe(recipe)}
              className="group text-left glass-obsidian rounded-2xl overflow-hidden hover:border-[#E8C589]/50 transition-all duration-300 cursor-pointer flex flex-col"
            >
              <div className="relative overflow-hidden">
                <RecipeImage
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  category={recipe.category}
                  className="w-full aspect-[4/3] brightness-90 group-hover:scale-105 transition-transform duration-500"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#120E0B] via-transparent to-transparent"
                />
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <div className="text-xs text-[#9D9284] mb-1">
                  {RECIPE_CATEGORY_LABELS[recipe.category]} ·{' '}
                  <span className="font-mono tabular-nums">
                    {recipe.prepTimeMin} min
                  </span>{' '}
                  · {recipe.portionLabel}
                </div>

                <h3 className="font-editorial text-2xl font-medium text-[#FAF5EC] leading-snug mb-1.5">
                  {recipe.title}
                </h3>

                {recipe.description && (
                  <p className="text-xs text-[#B5AAA0] line-clamp-2 leading-relaxed mb-3">
                    {recipe.description}
                  </p>
                )}

                {recipe.dietaryTags.length > 0 && (
                  <p className="text-xs text-[#DFBA7C] mb-3 truncate">
                    {recipe.dietaryTags.join(' · ')}
                  </p>
                )}

                <div className="mt-auto pt-3 border-t border-[#D9AF72]/14 flex items-center justify-between gap-3">
                  <div className="text-xs font-mono tabular-nums">
                    <span className="font-semibold text-[#F0D29C]">
                      {recipe.calories} kcal
                    </span>{' '}
                    <span className="text-[#A89E90]">
                      · P {recipe.proteinG}g · C {recipe.carbsG}g · G {recipe.fatG}g
                    </span>
                  </div>
                  <span className="w-8 h-8 rounded-full btn-gold flex items-center justify-center shrink-0">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
