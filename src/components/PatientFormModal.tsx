import React, { useEffect, useState } from 'react';
import { Calculator, X } from 'lucide-react';
import {
  calculateBMI,
  classifyBMI,
  suggestNutritionTargets,
} from '../lib/nutrition';
import {
  ACTIVITY_LABELS,
  ActivityLevel,
  BiologicalSex,
  ClinicalGoal,
  GOAL_LABELS,
  Patient,
  PATIENT_STATUS_LABELS,
  PatientStatus,
} from '../types';

interface PatientFormModalProps {
  open: boolean;
  nutritionistId: string;
  initialPatient?: Patient | null;
  onClose: () => void;
  onSubmit: (
    data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
}

const DEFAULT_FORM = {
  fullName: '',
  email: '',
  phone: '',
  birthYear: 1992,
  sex: 'F' as BiologicalSex,
  weightKg: 68,
  heightCm: 165,
  activityLevel: 'moderado' as ActivityLevel,
  goal: 'emagrecimento' as ClinicalGoal,
  restrictionsText: '',
  clinicalNotes: '',
  targetCalories: 1700,
  targetProteinG: 122,
  targetCarbsG: 175,
  targetFatG: 56,
  waterTargetLiters: 2.4,
  status: 'ativo' as PatientStatus,
};

const INPUT_CLASS =
  'w-full px-3.5 py-2 text-sm bg-[#0A2622] text-[#F4FBF6] placeholder-[#85AF9B] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]';

export function PatientFormModal({
  open,
  nutritionistId,
  initialPatient,
  onClose,
  onSubmit,
}: PatientFormModalProps) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialPatient) {
      setForm({
        fullName: initialPatient.fullName,
        email: initialPatient.email,
        phone: initialPatient.phone,
        birthYear: initialPatient.birthYear,
        sex: initialPatient.sex,
        weightKg: initialPatient.weightKg,
        heightCm: initialPatient.heightCm,
        activityLevel: initialPatient.activityLevel,
        goal: initialPatient.goal,
        restrictionsText: initialPatient.restrictions.join(', '),
        clinicalNotes: initialPatient.clinicalNotes,
        targetCalories: initialPatient.targetCalories,
        targetProteinG: initialPatient.targetProteinG,
        targetCarbsG: initialPatient.targetCarbsG,
        targetFatG: initialPatient.targetFatG,
        waterTargetLiters: initialPatient.waterTargetLiters,
        status: initialPatient.status,
      });
    } else {
      const suggestion = suggestNutritionTargets({
        weightKg: DEFAULT_FORM.weightKg,
        heightCm: DEFAULT_FORM.heightCm,
        birthYear: DEFAULT_FORM.birthYear,
        sex: DEFAULT_FORM.sex,
        activityLevel: DEFAULT_FORM.activityLevel,
        goal: DEFAULT_FORM.goal,
      });
      setForm({
        ...DEFAULT_FORM,
        targetCalories: suggestion.targetCalories,
        targetProteinG: suggestion.targetProteinG,
        targetCarbsG: suggestion.targetCarbsG,
        targetFatG: suggestion.targetFatG,
        waterTargetLiters: suggestion.waterTargetLiters,
      });
    }
  }, [open, initialPatient]);

  if (!open) return null;

  const bmi = calculateBMI(form.weightKg, form.heightCm);
  const calc = suggestNutritionTargets({
    weightKg: Number(form.weightKg) || 65,
    heightCm: Number(form.heightCm) || 165,
    birthYear: Number(form.birthYear) || 1990,
    sex: form.sex,
    activityLevel: form.activityLevel,
    goal: form.goal,
  });

  function applySuggestedTargets() {
    setForm((prev) => ({
      ...prev,
      targetCalories: calc.targetCalories,
      targetProteinG: calc.targetProteinG,
      targetCarbsG: calc.targetCarbsG,
      targetFatG: calc.targetFatG,
      waterTargetLiters: calc.waterTargetLiters,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.fullName.trim().length < 2) {
      setError('Informe o nome completo do paciente.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const restrictions = form.restrictionsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await onSubmit(
        {
          nutritionistId,
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          birthYear: Number(form.birthYear),
          sex: form.sex,
          weightKg: Number(form.weightKg),
          heightCm: Number(form.heightCm),
          activityLevel: form.activityLevel,
          goal: form.goal,
          restrictions,
          clinicalNotes: form.clinicalNotes,
          targetCalories: Number(form.targetCalories),
          targetProteinG: Number(form.targetProteinG),
          targetCarbsG: Number(form.targetCarbsG),
          targetFatG: Number(form.targetFatG),
          waterTargetLiters: Number(form.waterTargetLiters),
          status: form.status,
        },
        initialPatient?.id
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? 'Não foi possível salvar os dados do paciente. Verifique os campos numéricos.'
          : 'Erro ao salvar paciente.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-modal-title"
    >
      <div className="glass-obsidian border-[#B7DB74]/30 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#B7DB74]/15">
          <h2
            id="patient-modal-title"
            className="font-editorial text-2xl font-medium text-[#F4FBF6]"
          >
            {initialPatient ? 'Editar Prontuário do Paciente' : 'Cadastrar Novo Paciente'}
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

          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wider text-[#C7E88B]">
              Identificação e contato
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Nome completo
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Ex.: Marina Albuquerque"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  maxLength={160}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="paciente@email.com"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-0000"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#B7DB74]/14 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-wider text-[#C7E88B]">
                Antropometria e perfil clínico
              </h3>
              <span className="text-xs font-mono tabular-nums text-[#DDF3B2]">
                IMC {bmi.toFixed(1)} ({classifyBMI(bmi)}) · TMB {calc.bmr} kcal · GET {calc.tdee} kcal
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Sexo
                </label>
                <select
                  value={form.sex}
                  onChange={(e) =>
                    setForm({ ...form, sex: e.target.value as BiologicalSex })
                  }
                  className={INPUT_CLASS}
                >
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Ano de nascimento
                </label>
                <input
                  type="number"
                  min={1920}
                  max={2026}
                  value={form.birthYear}
                  onChange={(e) =>
                    setForm({ ...form, birthYear: Number(e.target.value) })
                  }
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Peso (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={20}
                  max={300}
                  value={form.weightKg}
                  onChange={(e) =>
                    setForm({ ...form, weightKg: Number(e.target.value) })
                  }
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Altura (cm)
                </label>
                <input
                  type="number"
                  min={100}
                  max={240}
                  value={form.heightCm}
                  onChange={(e) =>
                    setForm({ ...form, heightCm: Number(e.target.value) })
                  }
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Nível de atividade
                </label>
                <select
                  value={form.activityLevel}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      activityLevel: e.target.value as ActivityLevel,
                    })
                  }
                  className={INPUT_CLASS}
                >
                  {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((key) => (
                    <option key={key} value={key}>
                      {ACTIVITY_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Objetivo clínico
                </label>
                <select
                  value={form.goal}
                  onChange={(e) =>
                    setForm({ ...form, goal: e.target.value as ClinicalGoal })
                  }
                  className={INPUT_CLASS}
                >
                  {(Object.keys(GOAL_LABELS) as ClinicalGoal[]).map((key) => (
                    <option key={key} value={key}>
                      {GOAL_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as PatientStatus })
                  }
                  className={INPUT_CLASS}
                >
                  {(Object.keys(PATIENT_STATUS_LABELS) as PatientStatus[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {PATIENT_STATUS_LABELS[key]}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#B7DB74]/14 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold tracking-wider text-[#C7E88B]">
                  Metas nutricionais diárias
                </h3>
                <p className="text-xs text-[#85AF9B]">
                  Sugestão Mifflin-St Jeor ajustada ao objetivo ou personalize manualmente.
                </p>
              </div>
              <button
                type="button"
                onClick={applySuggestedTargets}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#DDF3B2] bg-[#B7DB74]/12 border border-[#B7DB74]/35 rounded-full hover:bg-[#B7DB74]/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Calculator className="w-3.5 h-3.5" />
                Aplicar cálculo sugerido
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Energia (kcal)
                </label>
                <input
                  type="number"
                  min={800}
                  max={6000}
                  value={form.targetCalories}
                  onChange={(e) =>
                    setForm({ ...form, targetCalories: Number(e.target.value) })
                  }
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Proteína (g)
                </label>
                <input
                  type="number"
                  min={20}
                  max={400}
                  value={form.targetProteinG}
                  onChange={(e) =>
                    setForm({ ...form, targetProteinG: Number(e.target.value) })
                  }
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Carboidrato (g)
                </label>
                <input
                  type="number"
                  min={0}
                  max={800}
                  value={form.targetCarbsG}
                  onChange={(e) =>
                    setForm({ ...form, targetCarbsG: Number(e.target.value) })
                  }
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Gordura (g)
                </label>
                <input
                  type="number"
                  min={10}
                  max={250}
                  value={form.targetFatG}
                  onChange={(e) =>
                    setForm({ ...form, targetFatG: Number(e.target.value) })
                  }
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                  Água (L/dia)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={0.5}
                  max={8}
                  value={form.waterTargetLiters}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      waterTargetLiters: Number(e.target.value),
                    })
                  }
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#B7DB74]/14 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Restrições e alergias (separadas por vírgula)
              </label>
              <input
                type="text"
                value={form.restrictionsText}
                onChange={(e) =>
                  setForm({ ...form, restrictionsText: e.target.value })
                }
                placeholder="Ex.: Intolerância à lactose, Sem glúten, Alergia a frutos do mar"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Observações clínicas e anamnese
              </label>
              <textarea
                rows={3}
                maxLength={1500}
                value={form.clinicalNotes}
                onChange={(e) =>
                  setForm({ ...form, clinicalNotes: e.target.value })
                }
                placeholder="Horários de treino, preferências alimentares, histórico de exames..."
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
                : initialPatient
                  ? 'Salvar alterações'
                  : 'Cadastrar paciente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
