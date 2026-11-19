import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  Database,
  MessageCircleHeart,
  Microscope,
  Plus,
  Search,
} from 'lucide-react';
import { calculateBMI, calculatePlanTotals } from '../lib/nutrition';
import {
  AnnualSubscription,
  GOAL_LABELS,
  MealPlan,
  Patient,
  Recipe,
  RECIPE_CATEGORY_LABELS,
  VideoSession,
} from '../types';
import { ClinicalCalendarPanel } from './ClinicalCalendarPanel';
import {
  GoldHorizonDivider,
  MOTION_EASE,
  SpotlightCard,
} from './LuxuryPrimitives';
import { RecipeImage } from './RecipeImage';

interface DashboardViewProps {
  userId: string;
  patients: Patient[];
  recipes: Recipe[];
  mealPlans: MealPlan[];
  videoSessions: VideoSession[];
  activeSubscription: AnnualSubscription | null;
  loading: boolean;
  seeding: boolean;
  onSeedDemo: () => Promise<void>;
  onOpenNewPatient: () => void;
  onOpenNewRecipe: () => void;
  onOpenPatientPlan: (patientId: string) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onNavigatePatients: () => void;
  onNavigateRecipes: () => void;
  onQuickResearch: (query: string) => void;
  onOpenConsultation: () => void;
  onOpenVideoTab: () => void;
  onJoinVideoSession: (sessionId: string) => void;
  onNotify: (message: string) => void;
}

export function DashboardView({
  userId,
  patients,
  recipes,
  mealPlans,
  videoSessions,
  activeSubscription,
  loading,
  seeding,
  onSeedDemo,
  onOpenNewPatient,
  onOpenNewRecipe,
  onOpenPatientPlan,
  onSelectRecipe,
  onNavigatePatients,
  onNavigateRecipes,
  onQuickResearch,
  onOpenConsultation,
  onOpenVideoTab,
  onJoinVideoSession,
  onNotify,
}: DashboardViewProps) {
  const [quickQuery, setQuickQuery] = useState('');

  function handleQuickSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (quickQuery.trim().length < 3) return;
    onQuickResearch(quickQuery.trim());
    setQuickQuery('');
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-28 glass-obsidian rounded-2xl animate-pulse"
            />
          ))}
        </div>
        <div className="h-72 glass-obsidian rounded-2xl animate-pulse" />
      </div>
    );
  }

  const activePatients = patients.filter((p) => p.status !== 'arquivado');
  const activePlans = mealPlans.filter((p) => p.status === 'ativo');
  const avgCalories =
    activePatients.length > 0
      ? Math.round(
          activePatients.reduce((acc, p) => acc + p.targetCalories, 0) /
            activePatients.length
        )
      : 0;

  const isEmpty =
    patients.length === 0 && recipes.length === 0 && mealPlans.length === 0;

  if (isEmpty) {
    return (
      <div className="space-y-8">
        <SpotlightCard glowRim className="p-8 sm:p-12 max-w-3xl">
          <p className="text-xs tracking-[0.2em] text-[#C7E88B] mb-3">
            Consultório pronto para atendimento
          </p>
          <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#F4FBF6] leading-tight mb-4">
            Comece cadastrando seus pacientes ou{' '}
            <span className="italic text-[#C7E88B]">carregue casos clínicos</span>
          </h2>
          <p className="text-sm text-[#CBE3D6] leading-relaxed mb-8">
            Você pode iniciar do zero ou popular seu consultório com 4 pacientes
            brasileiros realistas, 6 receitas clínicas fotografadas e 3 planos
            alimentares personalizados completos para explorar todos os recursos
            imediatamente.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSeedDemo}
              disabled={seeding}
              className="btn-gold inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Database className="w-4 h-4" />
              {seeding
                ? 'Carregando casos...'
                : 'Carregar casos clínicos de exemplo'}
            </button>
            <button
              type="button"
              onClick={onOpenNewPatient}
              className="inline-flex items-center gap-2 px-5 py-3 text-xs font-medium text-[#F4FBF6] border border-[#B7DB74]/35 rounded-full hover:border-[#DDF3B2] hover:bg-[#B7DB74]/10 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 text-[#C7E88B]" />
              Cadastrar primeiro paciente
            </button>
          </div>
        </SpotlightCard>

        <ClinicalCalendarPanel
          userId={userId}
          patients={patients}
          videoSessions={videoSessions}
          activeSubscription={activeSubscription}
          onOpenVideoTab={onOpenVideoTab}
          onJoinVideoSession={onJoinVideoSession}
          onNotify={onNotify}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 4-column Smoked Glass KPI Strip mirroring reference's rounded bar */}
      <section aria-label="Resumo do consultório">
        <SpotlightCard glowRim className="rounded-2xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#B7DB74]/15">
            <div className="p-6">
              <div className="text-xs text-[#A8CCB9] mb-1.5">
                Pacientes em acompanhamento
              </div>
              <div className="font-editorial text-3xl font-semibold tabular-nums text-[#F4FBF6]">
                {activePatients.length}
              </div>
              <div className="text-xs text-[#85AF9B] mt-1">
                {patients.length} cadastrados no total
              </div>
            </div>

            <div className="p-6">
              <div className="text-xs text-[#A8CCB9] mb-1.5">
                Planos alimentares ativos
              </div>
              <div className="font-editorial text-3xl font-semibold tabular-nums text-[#C7E88B]">
                {activePlans.length}
              </div>
              <div className="text-xs text-[#85AF9B] mt-1">
                {mealPlans.length} prescrições registradas
              </div>
            </div>

            <div className="p-6">
              <div className="text-xs text-[#A8CCB9] mb-1.5">
                Biblioteca de receitas
              </div>
              <div className="font-editorial text-3xl font-semibold tabular-nums text-[#F4FBF6]">
                {recipes.length}
              </div>
              <div className="text-xs text-[#85AF9B] mt-1">
                Prontas para vincular aos planos
              </div>
            </div>

            <div className="p-6">
              <div className="text-xs text-[#A8CCB9] mb-1.5">
                Meta energética média
              </div>
              <div className="font-editorial text-3xl font-semibold tabular-nums text-[#F4FBF6]">
                {avgCalories > 0 ? `${avgCalories} kcal` : '—'}
              </div>
              <div className="text-xs text-[#85AF9B] mt-1">
                Baseada nos pacientes ativos
              </div>
            </div>
          </div>
        </SpotlightCard>
      </section>

      {/* Clinical Scheduling Calendar Integrated with Video Consultations */}
      <ClinicalCalendarPanel
        userId={userId}
        patients={patients}
        videoSessions={videoSessions}
        activeSubscription={activeSubscription}
        onOpenVideoTab={onOpenVideoTab}
        onJoinVideoSession={onJoinVideoSession}
        onNotify={onNotify}
      />

      {/* Active AI Consultation Card — Nutricionista Dimitra Bratu */}
      <SpotlightCard glowRim className="p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#DDF3B2]/25 to-[#6E8D3E]/15 border border-[#C7E88B]/45 text-[#DDF3B2] flex items-center justify-center shrink-0">
              <MessageCircleHeart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] tracking-[0.18em] text-[#C7E88B] font-medium">
                Atendimento Inteligente 24h
              </p>
              <h2 className="font-editorial text-2xl font-medium text-[#F4FBF6] leading-snug mt-0.5">
                Consultório Digital ·{' '}
                <span className="italic text-[#C7E88B]">
                  Nutricionista Dimitra Bratu (IA)
                </span>
              </h2>
              <p className="text-xs text-[#A8CCB9] mt-1 max-w-2xl">
                Realize atendimentos, anamnese guiada e tire dúvidas de pacientes
                com a voz clínica da Dra. Dimitra Bratu, conectada ao prontuário,
                plano alimentar ativo e bases científicas em tempo real.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenConsultation}
            className="btn-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Abrir atendimento IA</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </SpotlightCard>

      {/* Active Nutrition Science Quick Search Bar */}
      <SpotlightCard className="p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#B7DB74]/12 border border-[#B7DB74]/30 text-[#C7E88B] flex items-center justify-center shrink-0">
              <Microscope className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-editorial text-xl font-medium text-[#F4FBF6]">
                Consulta ativa em bibliotecas de ciência da nutrição
              </h2>
              <p className="text-xs text-[#A8CCB9] mt-0.5">
                PubMed, Cochrane, ESPEN, ISSN, SBD, ABESO e SciELO atualizados em tempo real
              </p>
            </div>
          </div>

          <form
            onSubmit={handleQuickSubmit}
            className="flex flex-col sm:flex-row gap-2.5 flex-1 lg:max-w-xl"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#85AF9B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="Pergunte sobre diretrizes, suplementos, macros ou patologias..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#061A17]/90 text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/22 rounded-full focus:outline-none focus:border-[#C7E88B]"
              />
            </div>
            <button
              type="submit"
              disabled={quickQuery.trim().length < 3}
              className="btn-gold px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0"
            >
              Buscar evidências
            </button>
          </form>
        </div>
      </SpotlightCard>

      {/* Active Patients & Personalized Plans Table */}
      <section className="glass-obsidian rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-[#B7DB74]/14">
          <div>
            <h2 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
              Pacientes e Planos Personalizados
            </h2>
            <p className="text-xs text-[#A8CCB9] mt-0.5">
              Acesso direto ao plano alimentar e adequação calórica de cada paciente
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigatePatients}
            className="text-xs font-medium text-[#C7E88B] hover:text-[#DDF3B2] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            Ver todos os pacientes
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#B7DB74]/14 text-xs font-medium text-[#85AF9B] bg-[#07201C]/60">
                <th className="py-3.5 px-6">Paciente</th>
                <th className="py-3.5 px-4">Objetivo</th>
                <th className="py-3.5 px-4 text-right">IMC</th>
                <th className="py-3.5 px-4 text-right">Meta diária</th>
                <th className="py-3.5 px-4">Plano ativo</th>
                <th className="py-3.5 px-6 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#B7DB74]/10 text-sm">
              {patients.slice(0, 6).map((patient) => {
                const patientPlan =
                  mealPlans.find(
                    (p) => p.patientId === patient.id && p.status === 'ativo'
                  ) || mealPlans.find((p) => p.patientId === patient.id);
                const plannedKcal = patientPlan
                  ? calculatePlanTotals(patientPlan.meals).calories
                  : 0;
                const bmi = calculateBMI(patient.weightKg, patient.heightCm);

                return (
                  <tr
                    key={patient.id}
                    className="hover:bg-[#B7DB74]/6 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="font-medium text-[#F4FBF6]">
                        {patient.fullName}
                      </div>
                      <div className="text-xs text-[#85AF9B] mt-0.5">
                        {patient.restrictions.length > 0
                          ? patient.restrictions.slice(0, 2).join(' · ')
                          : 'Sem restrições informadas'}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-[#CBE3D6]">
                      {GOAL_LABELS[patient.goal]}
                    </td>
                    <td className="py-4 px-4 text-right font-mono tabular-nums text-[#CBE3D6]">
                      {bmi.toFixed(1)}
                    </td>
                    <td className="py-4 px-4 text-right font-mono tabular-nums text-[#F4FBF6]">
                      {patient.targetCalories} kcal
                    </td>
                    <td className="py-4 px-4">
                      {patientPlan ? (
                        <div>
                          <div className="text-[#F4FBF6] font-medium truncate max-w-[230px]">
                            {patientPlan.title}
                          </div>
                          <div className="text-xs font-mono tabular-nums text-[#C7E88B]">
                            {plannedKcal} kcal planejadas ·{' '}
                            {patientPlan.meals.length} refeições
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-400/90 font-medium">
                          Pendente de prescrição
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenPatientPlan(patient.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#DDF3B2] border border-[#B7DB74]/35 bg-[#B7DB74]/10 rounded-full hover:bg-[#B7DB74]/20 hover:border-[#DDF3B2] transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {patientPlan ? 'Abrir plano' : 'Criar plano'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <GoldHorizonDivider className="opacity-65" />

      {/* Signature Featured Recipes Section */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-xs tracking-[0.2em] text-[#C7E88B] mb-1">
              Acervo assinado
            </p>
            <h2 className="font-editorial text-3xl font-medium text-[#F4FBF6]">
              Receitas Clínicas em Destaque
            </h2>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={onOpenNewRecipe}
              className="text-xs font-medium text-[#A8CCB9] hover:text-[#F4FBF6] cursor-pointer whitespace-nowrap"
            >
              Nova receita
            </button>
            <button
              type="button"
              onClick={onNavigateRecipes}
              className="text-xs font-medium text-[#C7E88B] hover:text-[#DDF3B2] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              Biblioteca completa
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.slice(0, 3).map((recipe, idx) => (
            <motion.button
              key={recipe.id}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.06, ease: MOTION_EASE }}
              onClick={() => onSelectRecipe(recipe)}
              className="group text-left glass-obsidian rounded-2xl overflow-hidden hover:border-[#C7E88B]/45 transition-all duration-300 cursor-pointer flex flex-col"
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
                  className="absolute inset-0 bg-gradient-to-t from-[#0A2622] via-transparent to-transparent"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="text-xs text-[#A8CCB9] mb-1">
                  {RECIPE_CATEGORY_LABELS[recipe.category]} ·{' '}
                  <span className="font-mono tabular-nums">
                    {recipe.prepTimeMin} min
                  </span>
                </div>
                <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6] leading-snug mb-3">
                  {recipe.title}
                </h3>
                <div className="mt-auto pt-3 border-t border-[#B7DB74]/14 flex items-center justify-between gap-3">
                  <div className="text-xs font-mono tabular-nums text-[#A8CCB9]">
                    <span className="font-semibold text-[#DDF3B2]">
                      {recipe.calories} kcal
                    </span>{' '}
                    · P {recipe.proteinG}g · C {recipe.carbsG}g
                  </div>
                  <span className="w-8 h-8 rounded-full btn-gold flex items-center justify-center shrink-0">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </section>
    </div>
  );
}
