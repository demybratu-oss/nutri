import { useMemo, useState } from 'react';
import { ClipboardList, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import {
  calculateAge,
  calculateBMI,
  calculatePlanTotals,
  classifyBMI,
} from '../lib/nutrition';
import {
  ClinicalGoal,
  GOAL_LABELS,
  MealPlan,
  Patient,
  PATIENT_STATUS_LABELS,
} from '../types';

interface PatientsViewProps {
  patients: Patient[];
  mealPlans: MealPlan[];
  loading: boolean;
  onAddPatient: () => void;
  onEditPatient: (patient: Patient) => void;
  onDeletePatient: (patientId: string) => Promise<void>;
  onOpenPatientPlan: (patientId: string) => void;
}

export function PatientsView({
  patients,
  mealPlans,
  loading,
  onAddPatient,
  onEditPatient,
  onDeletePatient,
  onOpenPatientPlan,
}: PatientsViewProps) {
  const [search, setSearch] = useState('');
  const [goalFilter, setGoalFilter] = useState<'all' | ClinicalGoal>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((p) => {
      const matchesGoal = goalFilter === 'all' || p.goal === goalFilter;
      const matchesSearch =
        !q ||
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.restrictions.some((r) => r.toLowerCase().includes(q));
      return matchesGoal && matchesSearch;
    });
  }, [patients, search, goalFilter]);

  if (loading) {
    return (
      <div className="glass-obsidian rounded-2xl p-6 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-12 bg-[#1D1712] rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8D8274] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paciente por nome, e-mail ou restrição..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#15110E] text-[#FAF5EC] placeholder-[#7C7164] border border-[#D9AF72]/22 rounded-full focus:outline-none focus:border-[#E8C589]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#15110E] border border-[#D9AF72]/18 rounded-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setGoalFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              goalFilter === 'all'
                ? 'btn-gold font-semibold'
                : 'text-[#BDB2A4] hover:text-[#FAF5EC]'
            }`}
          >
            Todos ({patients.length})
          </button>
          {(Object.keys(GOAL_LABELS) as ClinicalGoal[]).map((goal) => (
            <button
              key={goal}
              type="button"
              onClick={() => setGoalFilter(goal)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                goalFilter === goal
                  ? 'btn-gold font-semibold'
                  : 'text-[#BDB2A4] hover:text-[#FAF5EC]'
              }`}
            >
              {GOAL_LABELS[goal]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-obsidian rounded-2xl p-10 text-center">
          <h3 className="font-editorial text-2xl font-medium text-[#FAF5EC] mb-2">
            {patients.length === 0
              ? 'Nenhum paciente cadastrado ainda'
              : 'Nenhum paciente encontrado para este filtro'}
          </h3>
          <p className="text-sm text-[#A89E90] mb-6">
            {patients.length === 0
              ? 'Cadastre o primeiro paciente para calcular metas nutricionais e montar seu plano alimentar.'
              : 'Tente limpar a busca ou selecionar outro objetivo clínico.'}
          </p>
          {patients.length === 0 && (
            <button
              type="button"
              onClick={onAddPatient}
              className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Cadastrar paciente
            </button>
          )}
        </div>
      ) : (
        <div className="glass-obsidian rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D9AF72]/15 text-xs font-medium text-[#9D9284] bg-[#100D0A]/65">
                  <th className="py-3.5 px-6">Paciente</th>
                  <th className="py-3.5 px-4">Objetivo & Status</th>
                  <th className="py-3.5 px-4 text-right">Peso / IMC</th>
                  <th className="py-3.5 px-4 text-right">Meta P / C / G</th>
                  <th className="py-3.5 px-4">Plano alimentar</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9AF72]/10 text-sm">
                {filtered.map((patient) => {
                  const age = calculateAge(patient.birthYear);
                  const bmi = calculateBMI(patient.weightKg, patient.heightCm);
                  const plansForPatient = mealPlans.filter(
                    (pl) => pl.patientId === patient.id
                  );
                  const activePlan =
                    plansForPatient.find((pl) => pl.status === 'ativo') ||
                    plansForPatient[0];
                  const plannedCalories = activePlan
                    ? calculatePlanTotals(activePlan.meals).calories
                    : 0;

                  return (
                    <tr
                      key={patient.id}
                      className="hover:bg-[#D9AF72]/6 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="font-semibold text-[#FAF5EC]">
                          {patient.fullName}
                        </div>
                        <div className="text-xs text-[#9D9284] mt-0.5">
                          {age} anos · {patient.sex === 'F' ? 'Feminino' : 'Masculino'}
                          {patient.phone ? ` · ${patient.phone}` : ''}
                        </div>
                        {patient.restrictions.length > 0 && (
                          <div className="text-xs text-amber-300/90 mt-1">
                            Restrições: {patient.restrictions.join(', ')}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <div className="text-[#FAF5EC] font-medium">
                          {GOAL_LABELS[patient.goal]}
                        </div>
                        <div className="text-xs text-[#9D9284] mt-0.5">
                          {PATIENT_STATUS_LABELS[patient.status]}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="font-mono tabular-nums text-[#FAF5EC]">
                          {patient.weightKg.toFixed(1)} kg
                        </div>
                        <div className="text-xs font-mono tabular-nums text-[#9D9284] mt-0.5">
                          IMC {bmi.toFixed(1)} · {classifyBMI(bmi)}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="font-mono tabular-nums font-semibold text-[#F0D29C]">
                          {patient.targetCalories} kcal
                        </div>
                        <div className="text-xs font-mono tabular-nums text-[#9D9284] mt-0.5">
                          {patient.targetProteinG}P · {patient.targetCarbsG}C ·{' '}
                          {patient.targetFatG}G
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        {activePlan ? (
                          <div>
                            <div className="text-[#FAF5EC] font-medium truncate max-w-[210px]">
                              {activePlan.title}
                            </div>
                            <div className="text-xs font-mono tabular-nums text-[#DFBA7C] mt-0.5">
                              {plannedCalories} kcal · {plansForPatient.length}{' '}
                              {plansForPatient.length === 1 ? 'versão' : 'versões'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-400/90 font-medium">
                            Sem plano cadastrado
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        {deletingId === patient.id ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="px-2.5 py-1.5 text-xs text-[#CFC5B8] bg-[#1B1510] border border-[#D9AF72]/20 rounded-lg cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeletePatient(patient.id);
                                setDeletingId(null);
                              }}
                              className="px-2.5 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer"
                            >
                              Excluir
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenPatientPlan(patient.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#F0D29C] bg-[#D9AF72]/10 border border-[#D9AF72]/35 rounded-full hover:bg-[#D9AF72]/20 hover:border-[#F0D29C] transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <ClipboardList className="w-3.5 h-3.5" />
                              Plano
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditPatient(patient)}
                              aria-label={`Editar ${patient.fullName}`}
                              className="p-2 text-[#A89E90] hover:text-[#FAF5EC] hover:bg-[#D9AF72]/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(patient.id)}
                              aria-label={`Excluir ${patient.fullName}`}
                              className="p-2 text-[#8D8274] hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
