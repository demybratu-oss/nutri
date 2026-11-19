import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  Globe,
  Loader2,
  Lock,
  Plus,
  Printer,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  generateCompoundingFormula,
  GroundingSource,
} from '../lib/aiService';
import {
  createCompoundingPrescription,
  deleteCompoundingPrescription,
  issueCompoundingPrescription,
  updateCompoundingPrescription,
} from '../lib/firestoreService';
import {
  AnnualSubscription,
  CLINICAL_SPECIALTIES,
  ClinicalSpecialty,
  CompoundingActive,
  CompoundingPrescription,
  Patient,
  Recipe,
  SPECIALTY_LABELS,
} from '../types';
import { SpotlightCard } from './LuxuryPrimitives';

export interface CompoundingPrefill {
  patientId: string;
  patientName: string;
  specialty: ClinicalSpecialty;
  clinicalCaseNotes: string;
}

interface CompoundingPrescriptionsViewProps {
  userId: string;
  patients: Patient[];
  recipes: Recipe[];
  prescriptions: CompoundingPrescription[];
  activeSubscription: AnnualSubscription | null;
  prefill?: CompoundingPrefill | null;
  onConsumePrefill?: () => void;
  onOpenRecipes: () => void;
  onNotify: (message: string) => void;
}

const EMPTY_ACTIVE: CompoundingActive = {
  name: '',
  dosage: '',
  unit: 'mg',
  purpose: '',
};

export function CompoundingPrescriptionsView({
  userId,
  patients,
  recipes,
  prescriptions,
  activeSubscription,
  prefill,
  onConsumePrefill,
  onOpenRecipes,
  onNotify,
}: CompoundingPrescriptionsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);

  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState(
    activeSubscription?.subscriberName || ''
  );
  const [specialty, setSpecialty] = useState<ClinicalSpecialty>(
    activeSubscription?.specialty || 'metabolica_emagrecimento'
  );
  const [caseContext, setCaseContext] = useState(
    activeSubscription?.healthFocus || ''
  );
  const [allergies, setAllergies] = useState(activeSubscription?.allergies || '');

  const [formulaTitle, setFormulaTitle] = useState('');
  const [pharmaceuticalForm, setPharmaceuticalForm] = useState(
    'Cápsulas vegetais gastro-resistentes'
  );
  const [totalDoses, setTotalDoses] = useState(60);
  const [durationDays, setDurationDays] = useState(60);
  const [posology, setPosology] = useState(
    'Tomar 1 dose ao dia imediatamente após o almoço, por 60 dias.'
  );
  const [pharmacyNotes, setPharmacyNotes] = useState(
    'Manipular com excipiente livre de lactose, glúten e corantes artificiais. Rotular com nome completo do paciente, composição e validade.'
  );
  const [clinicalRationale, setClinicalRationale] = useState('');
  const [precautions, setPrecautions] = useState('');
  const [actives, setActives] = useState<CompoundingActive[]>([
    {
      name: 'Magnésio Bisglicinato',
      dosage: '200',
      unit: 'mg',
      purpose: 'Suporte neuromuscular, metabolismo energético e sono reparador',
    },
    {
      name: 'Vitamina D3 (Colecalciferol)',
      dosage: '2000',
      unit: 'UI',
      purpose: 'Modulação imune, saúde óssea e sensibilidade metabólica',
    },
    {
      name: 'Zinco Quelado (Bisglicinato)',
      dosage: '15',
      unit: 'mg',
      purpose: 'Ação antioxidante, imunidade e integridade epitelial',
    },
  ]);
  const [recommendedRecipes, setRecommendedRecipes] = useState<string[]>([]);
  const [aiSources, setAiSources] = useState<GroundingSource[]>([]);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedPrescription =
    prescriptions.find((p) => p.id === selectedId) || null;
  const isIssued = selectedPrescription?.status === 'emitida';

  useEffect(() => {
    if (prefill) {
      setSelectedId(null);
      setPrintMode(false);
      setPatientId(prefill.patientId);
      setPatientName(prefill.patientName);
      setSpecialty(prefill.specialty);
      setCaseContext(prefill.clinicalCaseNotes);
      setFormulaTitle('');
      setAiSources([]);
      onConsumePrefill?.();
    }
  }, [prefill]);

  function loadPrescriptionIntoEditor(rx: CompoundingPrescription) {
    setSelectedId(rx.id);
    setPrintMode(false);
    setPatientId(rx.patientId);
    setPatientName(rx.patientName);
    setSpecialty(rx.specialty);
    setFormulaTitle(rx.formulaTitle);
    setPharmaceuticalForm(rx.pharmaceuticalForm);
    setTotalDoses(rx.totalDoses);
    setDurationDays(rx.durationDays);
    setPosology(rx.posology);
    setPharmacyNotes(rx.pharmacyNotes);
    setClinicalRationale(rx.clinicalRationale);
    setPrecautions(rx.precautions);
    setActives(rx.actives.length > 0 ? rx.actives : [{ ...EMPTY_ACTIVE }]);
    setRecommendedRecipes(rx.recommendedRecipes || []);
    setAiSources([]);
    setErrorMsg(null);
  }

  function handleStartNew() {
    setSelectedId(null);
    setPrintMode(false);
    setFormulaTitle('');
    setPharmaceuticalForm('Cápsulas vegetais gastro-resistentes');
    setTotalDoses(60);
    setDurationDays(60);
    setPosology('Tomar 1 dose ao dia após o almoço, por 60 dias.');
    setPharmacyNotes(
      'Excipiente livre de lactose, glúten e corantes artificiais. Dispensar em frasco âmbar protegido da umidade.'
    );
    setClinicalRationale('');
    setPrecautions('');
    setActives([{ ...EMPTY_ACTIVE }]);
    setRecommendedRecipes([]);
    setAiSources([]);
    setErrorMsg(null);
  }

  async function handleGenerateWithAi() {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const linkedPatient = patients.find((p) => p.id === patientId) || null;
      const res = await generateCompoundingFormula({
        specialtyLabel: SPECIALTY_LABELS[specialty],
        patientName:
          patientName.trim() ||
          linkedPatient?.fullName ||
          activeSubscription?.subscriberName ||
          'Paciente Assinante',
        patient: linkedPatient,
        clinicalCaseNotes: caseContext.trim(),
        allergies:
          allergies.trim() || linkedPatient?.restrictions.join(', ') || '',
        availableRecipes: recipes,
      });

      const f = res.formula;
      setFormulaTitle(f.formulaTitle || 'Fórmula Magistral Individualizada');
      setPharmaceuticalForm(
        f.pharmaceuticalForm || 'Cápsulas vegetais gastro-resistentes'
      );
      setTotalDoses(f.totalDoses || 60);
      setDurationDays(f.durationDays || 60);
      setPosology(f.posology || '');
      setPharmacyNotes(f.pharmacyNotes || '');
      setClinicalRationale(f.clinicalRationale || '');
      setPrecautions(f.precautions || '');
      if (Array.isArray(f.actives) && f.actives.length > 0) {
        setActives(f.actives);
      }
      setRecommendedRecipes(f.recommendedRecipes || []);
      setAiSources(res.sources || []);
      onNotify(
        'Fórmula manipulada baseada em evidências gerada! Revise e salve ou emita o receituário.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar a fórmula manipulada.'
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave(issueImmediately = false) {
    const cleanActives = actives.filter(
      (a) => a.name.trim().length > 0 && a.dosage.trim().length > 0
    );
    if (cleanActives.length === 0) {
      setErrorMsg('Adicione ao menos 1 ativo com dosagem na fórmula manipulada.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const resolvedName =
        patientName.trim() ||
        patients.find((p) => p.id === patientId)?.fullName ||
        activeSubscription?.subscriberName ||
        'Paciente Assinante';

      const payload = {
        userId,
        patientId,
        patientName: resolvedName,
        specialty,
        formulaTitle:
          formulaTitle.trim() ||
          `Fórmula Manipulada · ${SPECIALTY_LABELS[specialty]}`,
        pharmaceuticalForm: pharmaceuticalForm.trim(),
        totalDoses: Number(totalDoses) || 60,
        durationDays: Number(durationDays) || 60,
        posology: posology.trim(),
        pharmacyNotes: pharmacyNotes.trim(),
        clinicalRationale: clinicalRationale.trim(),
        precautions: precautions.trim(),
        status: issueImmediately ? ('emitida' as const) : ('rascunho' as const),
        actives: cleanActives,
        recommendedRecipes,
      };

      if (selectedId && !isIssued) {
        await updateCompoundingPrescription(selectedId, payload);
        if (issueImmediately) {
          await issueCompoundingPrescription(selectedId);
        }
        onNotify(
          issueImmediately
            ? 'Receituário de manipulação emitido e pronto para farmácia!'
            : 'Rascunho de fórmula manipulada salvo.'
        );
      } else {
        const newId = await createCompoundingPrescription(payload);
        setSelectedId(newId);
        onNotify(
          issueImmediately
            ? 'Receituário oficial de vitaminas manipuladas emitido!'
            : 'Fórmula manipulada salva no prontuário.'
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Erro ao salvar a prescrição manipulada.'
      );
    } finally {
      setSaving(false);
    }
  }

  // Official Printable Prescription Sheet for Farmácia de Manipulação
  if (printMode) {
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    return (
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPrintMode(false)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#FAF5EC] border border-[#D9AF72]/35 rounded-full hover:border-[#F0D29C] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao editor
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir / Salvar PDF para Farmácia de Manipulação
          </button>
        </div>

        {/* Crisp White Paper Prescription Document */}
        <article className="bg-white text-slate-900 rounded-2xl p-8 sm:p-12 max-w-3xl mx-auto shadow-2xl border border-slate-200 space-y-7">
          <header className="border-b-2 border-slate-900 pb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.22em] uppercase text-amber-800 font-semibold">
                Prescrição Nutricional Magistral · Farmácia de Manipulação
              </p>
              <h1 className="font-editorial text-3xl font-semibold text-slate-900 mt-1">
                Nutricionista Dimitra Bratu
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Nutrição Clínica Especializada & Suplementação Individualizada
              </p>
            </div>
            <div className="text-right text-xs text-slate-600 font-mono">
              <div>Data: {todayStr}</div>
              <div>Especialidade: {SPECIALTY_LABELS[specialty]}</div>
            </div>
          </header>

          <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm space-y-1">
            <div>
              <span className="text-slate-500">Paciente:</span>{' '}
              <strong className="text-slate-900">
                {patientName || 'Paciente Assinante'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Protocolo:</span>{' '}
              <strong className="text-slate-900">
                {formulaTitle || `Fórmula Manipulada · ${SPECIALTY_LABELS[specialty]}`}
              </strong>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Uso Oral — Manipular em Farmácia de Manipulação
              </h2>
              <span className="text-xs font-mono text-slate-700">
                {totalDoses} doses · {durationDays} dias
              </span>
            </div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-4">Ativo / Micronutriente</th>
                  <th className="py-2 px-3 text-right">Dosagem por dose</th>
                  <th className="py-2 pl-4">Finalidade Clínica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actives
                  .filter((a) => a.name.trim())
                  .map((a, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 pr-4 font-semibold text-slate-900">
                        {a.name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {a.dosage} {a.unit}
                      </td>
                      <td className="py-2.5 pl-4 text-xs text-slate-600">
                        {a.purpose}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            <div className="pt-2 text-xs text-slate-700 font-mono">
              Forma farmacêutica: <strong>{pharmaceuticalForm}</strong> · Avie{' '}
              <strong>{totalDoses} doses</strong> (tratamento para{' '}
              <strong>{durationDays} dias</strong>).
            </div>
          </section>

          <section className="space-y-3 text-sm">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Posologia e Modo de Uso
              </h3>
              <p className="text-slate-800 leading-relaxed">{posology}</p>
            </div>

            {pharmacyNotes && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Orientações Técnicas à Farmácia de Manipulação
                </h3>
                <p className="text-slate-700 text-xs leading-relaxed">
                  {pharmacyNotes}
                </p>
              </div>
            )}

            {precautions && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Precauções e Acompanhamento
                </h3>
                <p className="text-slate-700 text-xs leading-relaxed">
                  {precautions}
                </p>
              </div>
            )}

            {recommendedRecipes.length > 0 && (
              <div className="pt-3 border-t border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Receitas Terapêuticas Recomendadas no Tratamento
                </h3>
                <ul className="list-disc pl-5 text-xs text-slate-800 space-y-1">
                  {recommendedRecipes.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <footer className="pt-10 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-[11px] text-slate-500 max-w-sm">
              Prescrição nutricional individualizada conforme Resolução CFN nº
              656/2020. Leve este documento à farmácia de manipulação de sua
              confiança.
            </div>
            <div className="text-center min-w-[240px]">
              <div className="border-t border-slate-800 pt-2 text-sm font-editorial font-semibold text-slate-900">
                Nutricionista Dimitra Bratu
              </div>
              <div className="text-[11px] text-slate-500">
                Assinatura e Carimbo Profissional / CRN
              </div>
            </div>
          </footer>
        </article>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Saved Prescriptions List */}
      <aside className="lg:col-span-4 space-y-4">
        <SpotlightCard glowRim className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-editorial text-2xl font-medium text-[#FAF5EC] leading-none">
                Manipulados
              </h2>
              <p className="text-xs text-[#A89E90] mt-1">
                {prescriptions.length} fórmulas registradas
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartNew}
              className="btn-gold inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova fórmula
            </button>
          </div>

          {prescriptions.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#110D0A] border border-[#D9AF72]/14 text-xs text-[#8D8274] leading-relaxed">
              Crie prescrições de vitaminas manipuladas por especialidade para
              entregar à farmácia de manipulação de cada paciente.
            </div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {prescriptions.map((rx) => {
                const selected = rx.id === selectedId;
                return (
                  <div
                    key={rx.id}
                    className={`p-3.5 rounded-xl border transition-colors flex items-start justify-between gap-2 ${
                      selected
                        ? 'bg-[#D9AF72]/14 border-[#F0D29C]/60'
                        : 'bg-[#120E0B] border-[#D9AF72]/16 hover:border-[#D9AF72]/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => loadPrescriptionIntoEditor(rx)}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        {rx.status === 'emitida' && (
                          <Lock className="w-3 h-3 text-[#E8C589] shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-[#FAF5EC] truncate">
                          {rx.formulaTitle}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#DFBA7C] mt-0.5 truncate">
                        {rx.patientName} · {rx.actives.length} ativos
                      </div>
                      <div className="text-[10px] text-[#8D8274] mt-0.5 truncate">
                        {SPECIALTY_LABELS[rx.specialty]}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await deleteCompoundingPrescription(rx.id);
                        if (selectedId === rx.id) handleStartNew();
                        onNotify('Receituário removido.');
                      }}
                      aria-label="Excluir fórmula"
                      className="p-1 text-[#7C7164] hover:text-red-300 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SpotlightCard>
      </aside>

      {/* Right Column: Formula Builder & AI Compounding Assistant */}
      <section className="lg:col-span-8 glass-obsidian rounded-2xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#D9AF72]/16">
          <div>
            <p className="text-xs tracking-[0.18em] text-[#DFBA7C] font-medium">
              FARMÁCIA DE MANIPULAÇÃO · DRA. DIMITRA BRATU
            </p>
            <h2 className="font-editorial text-3xl font-medium text-[#FAF5EC]">
              Prescrição de Vitaminas Manipuladas
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPrintMode(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#F5EFE6] border border-[#D9AF72]/35 rounded-full hover:border-[#F0D29C] hover:bg-[#D9AF72]/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[#E8C589]" />
              <span>Receituário PDF</span>
            </button>
            <button
              type="button"
              onClick={onOpenRecipes}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#DFBA7C] border border-[#D9AF72]/25 rounded-full hover:border-[#F0D29C] transition-colors cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Receitas</span>
            </button>
          </div>
        </div>

        {/* Clinical Context & AI Formula Generator */}
        <div className="p-5 rounded-2xl bg-[#120E0B] border border-[#D9AF72]/22 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {patients.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
                  Vincular paciente
                </label>
                <select
                  disabled={isIssued}
                  value={patientId}
                  onChange={(e) => {
                    setPatientId(e.target.value);
                    const found = patients.find((p) => p.id === e.target.value);
                    if (found) {
                      setPatientName(found.fullName);
                      setAllergies(found.restrictions.join(', '));
                      if (found.clinicalNotes) setCaseContext(found.clinicalNotes);
                    }
                  }}
                  className="w-full px-3 py-2.5 text-xs bg-[#0B0907] text-[#FAF5EC] border border-[#D9AF72]/24 rounded-xl focus:outline-none focus:border-[#E8C589] disabled:opacity-60"
                >
                  <option value="">Paciente avulso / assinante</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
                Nome do paciente no receituário
              </label>
              <input
                type="text"
                disabled={isIssued}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Nome completo"
                className="w-full px-3 py-2.5 text-xs bg-[#0B0907] text-[#FAF5EC] border border-[#D9AF72]/24 rounded-xl focus:outline-none focus:border-[#E8C589] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
                Especialidade clínica
              </label>
              <select
                disabled={isIssued}
                value={specialty}
                onChange={(e) =>
                  setSpecialty(e.target.value as ClinicalSpecialty)
                }
                className="w-full px-3 py-2.5 text-xs bg-[#0B0907] text-[#FAF5EC] border border-[#D9AF72]/24 rounded-xl focus:outline-none focus:border-[#E8C589] disabled:opacity-60"
              >
                {CLINICAL_SPECIALTIES.map((spec) => (
                  <option key={spec.id} value={spec.id}>
                    {spec.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
                Caso clínico, exames ou notas da videochamada
              </label>
              <textarea
                rows={2}
                disabled={isIssued}
                value={caseContext}
                onChange={(e) => setCaseContext(e.target.value)}
                placeholder="Ex.: Fadiga, queda de cabelo, vitamina D 21 ng/mL, B12 310 pg/mL, sono leve..."
                className="w-full px-3.5 py-2.5 text-xs bg-[#0B0907] text-[#FAF5EC] border border-[#D9AF72]/24 rounded-xl focus:outline-none focus:border-[#E8C589] resize-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
                Alergias e restrições obrigatórias
              </label>
              <textarea
                rows={2}
                disabled={isIssued}
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="Ex.: Sem lactose, vegano, alergia a corantes..."
                className="w-full px-3.5 py-2.5 text-xs bg-[#0B0907] text-[#FAF5EC] border border-[#D9AF72]/24 rounded-xl focus:outline-none focus:border-[#E8C589] resize-none disabled:opacity-60"
              />
            </div>
          </div>

          {!isIssued && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-[#9D9284]">
                Busca científica ativa em PubMed, ESPEN, ISSN, CFN 656/2020 e
                ANVISA IN 28
              </span>
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerateWithAi}
                className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {generating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>
                  {generating
                    ? 'Pesquisando evidências e formulando...'
                    : 'Montar Fórmula Manipulada com IA'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Formula Details */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6">
            <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
              Título da fórmula manipulada
            </label>
            <input
              type="text"
              disabled={isIssued}
              value={formulaTitle}
              onChange={(e) => setFormulaTitle(e.target.value)}
              placeholder="Ex.: Fórmula Magistral de Energia e Imunidade"
              className="w-full px-3.5 py-2.5 text-sm bg-[#0E0B08] text-[#FAF5EC] border border-[#D9AF72]/24 rounded-xl focus:outline-none focus:border-[#E8C589] disabled:opacity-60"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
              Forma farmacêutica
            </label>
            <input
              type="text"
              disabled={isIssued}
              value={pharmaceuticalForm}
              onChange={(e) => setPharmaceuticalForm(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#0E0B08] text-[#FAF5EC] border border-[#D9AF72]/24 rounded-xl focus:outline-none focus:border-[#E8C589] disabled:opacity-60"
            />
          </div>
          <div className="md:col-span-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
                Doses
              </label>
              <input
                type="number"
                min={1}
                max={365}
                disabled={isIssued}
                value={totalDoses}
                onChange={(e) => setTotalDoses(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums bg-[#0E0B08] text-[#FAF5EC] border border-[#D9AF72]/24 rounded-xl focus:outline-none focus:border-[#E8C589] disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
                Dias
              </label>
              <input
                type="number"
                min={1}
                max={365}
                disabled={isIssued}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums bg-[#0E0B08] text-[#FAF5EC] border border-[#D9AF72]/24 rounded-xl focus:outline-none focus:border-[#E8C589] disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {/* Actives Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA7C] flex items-center gap-2">
              <FlaskConical className="w-3.5 h-3.5" />
              Composição da Fórmula (Ativos & Dosagens)
            </h3>
            {!isIssued && actives.length < 20 && (
              <button
                type="button"
                onClick={() => setActives((prev) => [...prev, { ...EMPTY_ACTIVE }])}
                className="text-xs font-medium text-[#E8C589] hover:text-[#F7DFB3] inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar ativo
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {actives.map((act, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 rounded-xl bg-[#110D0A] border border-[#D9AF72]/16 items-center"
              >
                <input
                  type="text"
                  disabled={isIssued}
                  value={act.name}
                  onChange={(e) =>
                    setActives((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, name: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Vitamina / Mineral (ex.: Magnésio Bisglicinato)"
                  className="sm:col-span-4 px-3 py-2 text-xs bg-[#0B0907] text-[#FAF5EC] border border-[#D9AF72]/20 rounded-lg focus:outline-none focus:border-[#E8C589] disabled:opacity-60"
                />
                <input
                  type="text"
                  disabled={isIssued}
                  value={act.dosage}
                  onChange={(e) =>
                    setActives((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, dosage: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Dose"
                  className="sm:col-span-2 px-3 py-2 text-xs font-mono tabular-nums bg-[#0B0907] text-[#F0D29C] border border-[#D9AF72]/20 rounded-lg focus:outline-none focus:border-[#E8C589] disabled:opacity-60"
                />
                <input
                  type="text"
                  disabled={isIssued}
                  value={act.unit}
                  onChange={(e) =>
                    setActives((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, unit: e.target.value } : item
                      )
                    )
                  }
                  placeholder="mg / mcg / UI"
                  className="sm:col-span-1 px-2.5 py-2 text-xs font-mono bg-[#0B0907] text-[#FAF5EC] border border-[#D9AF72]/20 rounded-lg focus:outline-none focus:border-[#E8C589] disabled:opacity-60"
                />
                <input
                  type="text"
                  disabled={isIssued}
                  value={act.purpose}
                  onChange={(e) =>
                    setActives((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, purpose: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Finalidade clínica"
                  className="sm:col-span-4 px-3 py-2 text-xs bg-[#0B0907] text-[#CFC5B8] border border-[#D9AF72]/20 rounded-lg focus:outline-none focus:border-[#E8C589] disabled:opacity-60"
                />
                <div className="sm:col-span-1 flex justify-end">
                  {!isIssued && actives.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setActives((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label="Remover ativo"
                      className="p-1.5 text-[#7C7164] hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Posology & Pharmacy Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
              Posologia e horário de uso
            </label>
            <textarea
              rows={3}
              disabled={isIssued}
              value={posology}
              onChange={(e) => setPosology(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-[#0E0B08] text-[#FAF5EC] border border-[#D9AF72]/24 rounded-xl focus:outline-none focus:border-[#E8C589] resize-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
              Orientações à Farmácia de Manipulação
            </label>
            <textarea
              rows={3}
              disabled={isIssued}
              value={pharmacyNotes}
              onChange={(e) => setPharmacyNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-[#0E0B08] text-[#FAF5EC] border border-[#D9AF72]/24 rounded-xl focus:outline-none focus:border-[#E8C589] resize-none disabled:opacity-60"
            />
          </div>
        </div>

        {(clinicalRationale || precautions) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clinicalRationale && (
              <div className="p-4 rounded-xl bg-[#110D0A] border border-[#D9AF72]/18 space-y-1">
                <div className="text-xs font-semibold text-[#F0D29C]">
                  Fundamentação Científica
                </div>
                <p className="text-xs text-[#CFC5B8] leading-relaxed">
                  {clinicalRationale}
                </p>
              </div>
            )}
            {precautions && (
              <div className="p-4 rounded-xl bg-[#110D0A] border border-[#D9AF72]/18 space-y-1">
                <div className="text-xs font-semibold text-amber-300">
                  Precauções e Segurança
                </div>
                <p className="text-xs text-[#CFC5B8] leading-relaxed">
                  {precautions}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Recommended Therapeutic Recipes */}
        {recommendedRecipes.length > 0 && (
          <div className="p-4 rounded-xl bg-[#120E0B] border border-[#D9AF72]/20 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#F0D29C] flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Receitas Terapêuticas Integradas ao Tratamento</span>
              </div>
              <button
                type="button"
                onClick={onOpenRecipes}
                className="text-[11px] text-[#E8C589] hover:underline cursor-pointer"
              >
                Abrir acervo de receitas →
              </button>
            </div>
            <ul className="space-y-1 text-xs text-[#CFC5B8] list-disc pl-4 marker:text-[#D9AF72]">
              {recommendedRecipes.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Grounded Scientific Citations */}
        {aiSources.length > 0 && (
          <div className="pt-3 border-t border-[#D9AF72]/14 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#DFBA7C]">
              <Globe className="w-3.5 h-3.5" />
              <span>Referências científicas consultadas ({aiSources.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {aiSources.slice(0, 4).map((src, idx) => (
                <a
                  key={`${src.uri}-${idx}`}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start justify-between gap-2 p-2.5 rounded-lg bg-[#0F0C09] border border-[#D9AF72]/16 hover:border-[#E8C589]/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-[#FAF5EC] group-hover:text-[#F0D29C] line-clamp-1">
                      {src.title}
                    </div>
                    <div className="text-[10px] font-mono text-[#8D8274] truncate">
                      {src.domain}
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-[#8D8274] group-hover:text-[#F0D29C] shrink-0 mt-0.5" />
                </a>
              ))}
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="px-4 py-3 text-xs text-red-200 bg-red-950/60 border border-red-400/30 rounded-xl"
          >
            {errorMsg}
          </div>
        )}

        {/* Action Footer */}
        <div className="pt-4 border-t border-[#D9AF72]/16 flex flex-wrap items-center justify-between gap-3">
          {isIssued ? (
            <div className="inline-flex items-center gap-2 text-xs text-emerald-300 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Receituário oficial emitido e protegido contra alterações.
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#FAF5EC] border border-[#D9AF72]/35 rounded-full hover:border-[#F0D29C] hover:bg-[#D9AF72]/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-[#E8C589]" />
                <span>{saving ? 'Salvando...' : 'Salvar rascunho'}</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Emitir Receituário para Manipulação</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setPrintMode(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E8C589] hover:text-[#F7DFB3] cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Visualizar e imprimir receita</span>
          </button>
        </div>
      </section>
    </div>
  );
}
