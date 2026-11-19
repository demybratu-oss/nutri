import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  FlaskConical,
  Globe,
  Info,
  Loader2,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  analyzeCompoundingInteractions,
  generateCompoundingFormula,
  GroundingSource,
  InteractionAnalysisResponse,
  InteractionCategory,
  InteractionSeverity,
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
  SPECIALIST_PROFILE,
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

const INTERACTION_CATEGORY_LABELS: Record<InteractionCategory, string> = {
  interacao_ativos: 'Interação entre Ativos',
  contraindicacao_historico: 'Contraindicação pelo Histórico',
  duplicidade_ul: 'Duplicidade / Limite UL',
  alergia_excipiente: 'Alergia / Excipiente',
  horario_absorcao: 'Horário e Absorção',
};

const INTERACTION_SEVERITY_LABELS: Record<InteractionSeverity, string> = {
  critico: 'Crítico',
  moderado: 'Moderado',
  informativo: 'Informativo',
};

const SEVERITY_SORT_ORDER: Record<InteractionSeverity, number> = {
  critico: 0,
  moderado: 1,
  informativo: 2,
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

  // AI Interaction & Contraindication Analysis state
  const [analyzingInteractions, setAnalyzingInteractions] = useState(false);
  const [interactionResult, setInteractionResult] =
    useState<InteractionAnalysisResponse | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [analyzedFingerprint, setAnalyzedFingerprint] = useState<string | null>(
    null
  );
  const [confirmHighRiskIssue, setConfirmHighRiskIssue] = useState(false);

  const selectedPrescription =
    prescriptions.find((p) => p.id === selectedId) || null;
  const isIssued = selectedPrescription?.status === 'emitida';

  const linkedPatient = useMemo(
    () => patients.find((p) => p.id === patientId) || null,
    [patients, patientId]
  );

  const previousPatientPrescriptions = useMemo(() => {
    const normalizedName = patientName.trim().toLowerCase();
    return prescriptions.filter((rx) => {
      if (rx.id === selectedId) return false;
      if (patientId && rx.patientId === patientId) return true;
      if (
        normalizedName &&
        rx.patientName.trim().toLowerCase() === normalizedName
      ) {
        return true;
      }
      return false;
    });
  }, [prescriptions, selectedId, patientId, patientName]);

  const currentFingerprint = useMemo(
    () =>
      JSON.stringify({
        patientId,
        allergies: allergies.trim(),
        caseContext: caseContext.trim(),
        posology: posology.trim(),
        pharmaceuticalForm: pharmaceuticalForm.trim(),
        actives: actives.map((a) => `${a.name.trim()}|${a.dosage.trim()}|${a.unit.trim()}`),
      }),
    [patientId, allergies, caseContext, posology, pharmaceuticalForm, actives]
  );

  const isAnalysisStale =
    Boolean(interactionResult) &&
    analyzedFingerprint !== null &&
    analyzedFingerprint !== currentFingerprint;

  const hasCriticalAlert = Boolean(
    interactionResult &&
      (interactionResult.analysis.overallRisk === 'alto_risco' ||
        interactionResult.analysis.alerts.some((a) => a.severity === 'critico'))
  );

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
      setInteractionResult(null);
      setAnalyzedFingerprint(null);
      setInteractionError(null);
      setConfirmHighRiskIssue(false);
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
    setInteractionResult(null);
    setAnalyzedFingerprint(null);
    setInteractionError(null);
    setConfirmHighRiskIssue(false);
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
    setInteractionResult(null);
    setAnalyzedFingerprint(null);
    setInteractionError(null);
    setConfirmHighRiskIssue(false);
    setErrorMsg(null);
  }

  async function handleAnalyzeInteractions() {
    const cleanActives = actives.filter((a) => a.name.trim().length > 0);
    if (cleanActives.length === 0) {
      setInteractionError(
        'Adicione ao menos 1 vitamina ou suplemento na composição antes de analisar interações.'
      );
      return;
    }

    setAnalyzingInteractions(true);
    setInteractionError(null);
    setConfirmHighRiskIssue(false);
    const snapshotFingerprint = currentFingerprint;

    try {
      const res = await analyzeCompoundingInteractions({
        actives: cleanActives,
        posology: posology.trim(),
        pharmaceuticalForm: pharmaceuticalForm.trim(),
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
        previousPrescriptions: previousPatientPrescriptions.map((rx) => ({
          formulaTitle: rx.formulaTitle,
          status: rx.status,
          actives: rx.actives.map((x) => ({
            name: x.name,
            dosage: x.dosage,
            unit: x.unit,
          })),
        })),
      });

      setInteractionResult(res);
      setAnalyzedFingerprint(snapshotFingerprint);

      const risk = res.analysis.overallRisk;
      if (risk === 'alto_risco') {
        onNotify(
          'Atenção: a IA detectou contraindicação ou interação crítica nesta fórmula. Revise os alertas abaixo.'
        );
      } else if (risk === 'atencao') {
        onNotify(
          'Análise concluída com pontos de atenção clínica (absorção, horário ou dose).'
        );
      } else {
        onNotify(
          'Análise concluída: fórmula compatível e segura para o histórico informado.'
        );
      }
    } catch (err) {
      setInteractionError(
        err instanceof Error
          ? err.message
          : 'Não foi possível concluir a análise de interações agora.'
      );
    } finally {
      setAnalyzingInteractions(false);
    }
  }

  function handleApplySuggestedPrecautions() {
    const suggested =
      interactionResult?.analysis.suggestedPrecautionsText?.trim();
    if (!suggested) return;
    setPrecautions((prev) => {
      const base = prev.trim();
      if (!base) return suggested.slice(0, 800);
      if (base.includes(suggested)) return base;
      return `${base}\n${suggested}`.slice(0, 800);
    });
    onNotify('Alertas de segurança incorporados às Precauções do receituário.');
  }

  function handleApplySuggestedTiming() {
    const timing = interactionResult?.analysis.timingGuidance?.trim();
    if (!timing) return;
    setPosology(timing.slice(0, 500));
    onNotify('Orientação de horário aplicada na Posologia.');
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
    setConfirmHighRiskIssue(false);
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
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#F4FBF6] border border-[#B7DB74]/35 rounded-full hover:border-[#DDF3B2] cursor-pointer"
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
              <p className="text-[11px] tracking-[0.22em] uppercase text-sky-800 font-semibold">
                Prescrição Nutricional Magistral · Farmácia de Manipulação
              </p>
              <h1 className="font-editorial text-3xl font-bold text-slate-900 mt-1">
                {SPECIALIST_PROFILE.title}
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Nutrição Clínica Especializada · Formação: {SPECIALIST_PROFILE.formation}
              </p>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                {SPECIALIST_PROFILE.email} · Celular / WhatsApp: {SPECIALIST_PROFILE.phoneDisplay}
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
                {SPECIALIST_PROFILE.title}
              </div>
              <div className="text-[11px] text-slate-600">
                {SPECIALIST_PROFILE.formation}
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                {SPECIALIST_PROFILE.email} · {SPECIALIST_PROFILE.phoneDisplay}
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
              <h2 className="font-editorial text-2xl font-medium text-[#F4FBF6] leading-none">
                Manipulados
              </h2>
              <p className="text-xs text-[#A8CCB9] mt-1">
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
            <div className="p-4 rounded-xl bg-[#07201C] border border-[#B7DB74]/14 text-xs text-[#85AF9B] leading-relaxed">
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
                        ? 'bg-[#B7DB74]/14 border-[#DDF3B2]/60'
                        : 'bg-[#0A2622] border-[#B7DB74]/16 hover:border-[#B7DB74]/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => loadPrescriptionIntoEditor(rx)}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        {rx.status === 'emitida' && (
                          <Lock className="w-3 h-3 text-[#C7E88B] shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-[#F4FBF6] truncate">
                          {rx.formulaTitle}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#C7E88B] mt-0.5 truncate">
                        {rx.patientName} · {rx.actives.length} ativos
                      </div>
                      <div className="text-[10px] text-[#85AF9B] mt-0.5 truncate">
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
                      className="p-1 text-[#719C88] hover:text-red-300 cursor-pointer shrink-0"
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
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#B7DB74]/16">
          <div>
            <p className="text-xs tracking-[0.18em] text-[#C7E88B] font-medium">
              FARMÁCIA DE MANIPULAÇÃO · DRA. DIMITRA BRATU
            </p>
            <h2 className="font-editorial text-3xl font-medium text-[#F4FBF6]">
              Prescrição de Vitaminas Manipuladas
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPrintMode(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#F4FBF6] border border-[#B7DB74]/35 rounded-full hover:border-[#DDF3B2] hover:bg-[#B7DB74]/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[#C7E88B]" />
              <span>Receituário PDF</span>
            </button>
            <button
              type="button"
              onClick={onOpenRecipes}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#C7E88B] border border-[#B7DB74]/25 rounded-full hover:border-[#DDF3B2] transition-colors cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Receitas</span>
            </button>
          </div>
        </div>

        {/* Clinical Context & AI Formula Generator */}
        <div className="p-5 rounded-2xl bg-[#0A2622] border border-[#B7DB74]/22 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {patients.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
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
                  className="w-full px-3 py-2.5 text-xs bg-[#041210] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
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
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Nome do paciente no receituário
              </label>
              <input
                type="text"
                disabled={isIssued}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Nome completo"
                className="w-full px-3 py-2.5 text-xs bg-[#041210] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Especialidade clínica
              </label>
              <select
                disabled={isIssued}
                value={specialty}
                onChange={(e) =>
                  setSpecialty(e.target.value as ClinicalSpecialty)
                }
                className="w-full px-3 py-2.5 text-xs bg-[#041210] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
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
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Caso clínico, exames ou notas da videochamada
              </label>
              <textarea
                rows={2}
                disabled={isIssued}
                value={caseContext}
                onChange={(e) => setCaseContext(e.target.value)}
                placeholder="Ex.: Fadiga, queda de cabelo, vitamina D 21 ng/mL, B12 310 pg/mL, sono leve..."
                className="w-full px-3.5 py-2.5 text-xs bg-[#041210] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] resize-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Alergias e restrições obrigatórias
              </label>
              <textarea
                rows={2}
                disabled={isIssued}
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="Ex.: Sem lactose, vegano, alergia a corantes..."
                className="w-full px-3.5 py-2.5 text-xs bg-[#041210] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] resize-none disabled:opacity-60"
              />
            </div>
          </div>

          {!isIssued && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-[#85AF9B]">
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
            <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
              Título da fórmula manipulada
            </label>
            <input
              type="text"
              disabled={isIssued}
              value={formulaTitle}
              onChange={(e) => setFormulaTitle(e.target.value)}
              placeholder="Ex.: Fórmula Magistral de Energia e Imunidade"
              className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
              Forma farmacêutica
            </label>
            <input
              type="text"
              disabled={isIssued}
              value={pharmaceuticalForm}
              onChange={(e) => setPharmaceuticalForm(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
            />
          </div>
          <div className="md:col-span-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Doses
              </label>
              <input
                type="number"
                min={1}
                max={365}
                disabled={isIssued}
                value={totalDoses}
                onChange={(e) => setTotalDoses(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Dias
              </label>
              <input
                type="number"
                min={1}
                max={365}
                disabled={isIssued}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {/* Actives Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#C7E88B] flex items-center gap-2">
              <FlaskConical className="w-3.5 h-3.5" />
              Composição da Fórmula (Ativos & Dosagens)
            </h3>
            {!isIssued && actives.length < 20 && (
              <button
                type="button"
                onClick={() => setActives((prev) => [...prev, { ...EMPTY_ACTIVE }])}
                className="text-xs font-medium text-[#C7E88B] hover:text-[#DDF3B2] inline-flex items-center gap-1 cursor-pointer"
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
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 rounded-xl bg-[#07201C] border border-[#B7DB74]/16 items-center"
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
                  className="sm:col-span-4 px-3 py-2 text-xs bg-[#041210] text-[#F4FBF6] border border-[#B7DB74]/20 rounded-lg focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
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
                  className="sm:col-span-2 px-3 py-2 text-xs font-mono tabular-nums bg-[#041210] text-[#DDF3B2] border border-[#B7DB74]/20 rounded-lg focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
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
                  className="sm:col-span-1 px-2.5 py-2 text-xs font-mono bg-[#041210] text-[#F4FBF6] border border-[#B7DB74]/20 rounded-lg focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
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
                  className="sm:col-span-4 px-3 py-2 text-xs bg-[#041210] text-[#CBE3D6] border border-[#B7DB74]/20 rounded-lg focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
                />
                <div className="sm:col-span-1 flex justify-end">
                  {!isIssued && actives.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setActives((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label="Remover ativo"
                      className="p-1.5 text-[#719C88] hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* =============================================================== */}
          {/* AI INTERACTION & PATIENT CONTRAINDICATION ANALYZER              */}
          {/* =============================================================== */}
          <div className="pt-2 space-y-4">
            <div className="p-4 rounded-2xl bg-[#08221E] border border-[#B7DB74]/28 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
              <div className="space-y-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DDF3B2]">
                  <ShieldCheck className="w-4 h-4 text-[#C7E88B] shrink-0" />
                  <span>
                    Auditoria Clínica de Interações e Contraindicações (IA)
                  </span>
                </div>
                <p className="text-[11px] text-[#9CC2AF] leading-relaxed">
                  Cruza os ativos prescritos entre si e com{' '}
                  {linkedPatient ? (
                    <strong className="text-white">
                      o prontuário de {linkedPatient.fullName}
                    </strong>
                  ) : (
                    'os dados clínicos informados'
                  )}
                  {previousPatientPrescriptions.length > 0
                    ? ` + ${previousPatientPrescriptions.length} fórmula(s) anterior(es)`
                    : ''}{' '}
                  para detectar contraindicações, competição de absorção e
                  excessos (UL / ANVISA IN 28).
                </p>
              </div>

              <button
                type="button"
                disabled={analyzingInteractions}
                onClick={handleAnalyzeInteractions}
                className="btn-botanical inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {analyzingInteractions ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : interactionResult ? (
                  <RefreshCw className="w-3.5 h-3.5" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5" />
                )}
                <span>
                  {analyzingInteractions
                    ? 'Analisando interações e histórico...'
                    : interactionResult
                    ? 'Reanalisar Segurança'
                    : 'Analisar Interações com IA'}
                </span>
              </button>
            </div>

            {interactionError && (
              <div
                role="alert"
                className="px-4 py-3 text-xs text-red-200 bg-red-950/60 border border-red-400/35 rounded-xl"
              >
                {interactionError}
              </div>
            )}

            {interactionResult && (
              <div
                className={`rounded-2xl border p-5 space-y-4 ${
                  interactionResult.analysis.overallRisk === 'alto_risco'
                    ? 'bg-red-950/35 border-red-400/50'
                    : interactionResult.analysis.overallRisk === 'atencao'
                    ? 'bg-amber-950/30 border-amber-400/45'
                    : 'bg-emerald-950/30 border-emerald-400/45'
                }`}
              >
                {/* Stale warning if formula changed since last check */}
                {isAnalysisStale && (
                  <div className="px-3.5 py-2 rounded-xl bg-amber-950/65 border border-amber-400/40 text-[11px] text-amber-200 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      A composição ou os dados do paciente foram alterados após
                      esta análise.
                    </span>
                    <button
                      type="button"
                      disabled={analyzingInteractions}
                      onClick={handleAnalyzeInteractions}
                      className="font-semibold text-amber-100 underline cursor-pointer"
                    >
                      Reanalisar agora
                    </button>
                  </div>
                )}

                {/* Overall Risk Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {interactionResult.analysis.overallRisk === 'alto_risco' ? (
                      <div className="w-10 h-10 rounded-full bg-red-900/60 border border-red-400/50 flex items-center justify-center shrink-0">
                        <ShieldAlert className="w-5 h-5 text-red-200" />
                      </div>
                    ) : interactionResult.analysis.overallRisk === 'atencao' ? (
                      <div className="w-10 h-10 rounded-full bg-amber-900/60 border border-amber-400/50 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-amber-200" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-900/60 border border-emerald-400/50 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5 text-emerald-200" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-display text-2xl font-semibold text-white leading-none">
                          {interactionResult.analysis.overallRisk ===
                          'alto_risco'
                            ? 'Alerta Clínico Crítico · Revisar Antes de Emitir'
                            : interactionResult.analysis.overallRisk ===
                              'atencao'
                            ? 'Atenção Clínica · Ajustes Recomendados'
                            : 'Fórmula Segura · Compatível com o Histórico'}
                        </h4>
                      </div>
                      <p className="text-xs text-[#E4F3EC] leading-relaxed">
                        {interactionResult.analysis.summary}
                      </p>
                    </div>
                  </div>

                  {!isIssued &&
                    interactionResult.analysis.suggestedPrecautionsText && (
                      <button
                        type="button"
                        onClick={handleApplySuggestedPrecautions}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-semibold bg-[#051815] text-[#DDF3B2] border border-[#B7DB74]/40 hover:border-[#DDF3B2] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#C7E88B]" />
                        <span>Adicionar às Precauções</span>
                      </button>
                    )}
                </div>

                {/* Detailed Alerts List */}
                {interactionResult.analysis.alerts.length > 0 && (
                  <div className="space-y-2.5">
                    {[...interactionResult.analysis.alerts]
                      .sort(
                        (a, b) =>
                          SEVERITY_SORT_ORDER[a.severity] -
                          SEVERITY_SORT_ORDER[b.severity]
                      )
                      .map((alert, idx) => {
                        const isCrit = alert.severity === 'critico';
                        const isMod = alert.severity === 'moderado';
                        return (
                          <div
                            key={`${alert.title}-${idx}`}
                            className={`p-4 rounded-xl border space-y-2 ${
                              isCrit
                                ? 'bg-red-950/60 border-red-400/45'
                                : isMod
                                ? 'bg-amber-950/45 border-amber-400/38'
                                : 'bg-[#061A17]/90 border-[#B7DB74]/24'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                    isCrit
                                      ? 'bg-red-500/25 text-red-200 border border-red-400/50'
                                      : isMod
                                      ? 'bg-amber-500/20 text-amber-200 border border-amber-400/45'
                                      : 'bg-[#103831] text-[#DDF3B2] border border-[#B7DB74]/35'
                                  }`}
                                >
                                  {isCrit ? (
                                    <ShieldAlert className="w-3 h-3" />
                                  ) : isMod ? (
                                    <AlertTriangle className="w-3 h-3" />
                                  ) : (
                                    <Info className="w-3 h-3" />
                                  )}
                                  {INTERACTION_SEVERITY_LABELS[alert.severity]}
                                </span>
                                <span className="text-[11px] font-medium text-[#A8CCB9]">
                                  {INTERACTION_CATEGORY_LABELS[alert.category]}
                                </span>
                              </div>
                            </div>

                            <div className="text-sm font-semibold text-white">
                              {alert.title}
                            </div>

                            {alert.involvedItems.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {alert.involvedItems.map((item, i) => (
                                  <span
                                    key={`${item}-${i}`}
                                    className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-black/30 border border-white/12 text-[#E4F3EC]"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            )}

                            <p className="text-xs text-[#D5E9DF] leading-relaxed">
                              <strong className="text-white">Mecanismo:</strong>{' '}
                              {alert.mechanism}
                            </p>
                            <p className="text-xs text-[#DDF3B2] leading-relaxed">
                              <strong className="text-[#C7E88B]">
                                Conduta recomendada:
                              </strong>{' '}
                              {alert.recommendation}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Synergies & Timing Optimization */}
                {(interactionResult.analysis.synergies.length > 0 ||
                  interactionResult.analysis.timingGuidance) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {interactionResult.analysis.synergies.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-[#051815]/90 border border-[#B7DB74]/22 space-y-2">
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C7E88B]">
                          <Zap className="w-3.5 h-3.5" />
                          <span>Sinergias Positivas Identificadas</span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-[#CBE3D6]">
                          {interactionResult.analysis.synergies.map(
                            (syn, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-white">
                                  {syn.pair}:
                                </strong>{' '}
                                {syn.benefit}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                    {interactionResult.analysis.timingGuidance && (
                      <div className="p-3.5 rounded-xl bg-[#051815]/90 border border-[#B7DB74]/22 space-y-2 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DDF3B2]">
                            <Clock className="w-3.5 h-3.5 text-[#C7E88B]" />
                            <span>Otimização de Horário e Absorção</span>
                          </div>
                          <p className="text-xs text-[#CBE3D6] leading-relaxed">
                            {interactionResult.analysis.timingGuidance}
                          </p>
                        </div>
                        {!isIssued && (
                          <button
                            type="button"
                            onClick={handleApplySuggestedTiming}
                            className="self-start text-[11px] font-semibold text-[#C7E88B] hover:text-white underline cursor-pointer pt-1"
                          >
                            Aplicar sugestão na Posologia →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Grounded References for Interaction Audit */}
                {interactionResult.sources.length > 0 && (
                  <div className="pt-2 border-t border-white/10 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#C7E88B]">
                      <Globe className="w-3.5 h-3.5" />
                      <span>
                        Bases consultadas na auditoria de segurança (
                        {interactionResult.sources.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {interactionResult.sources.slice(0, 4).map((src, i) => (
                        <a
                          key={`${src.uri}-${i}`}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#051815] border border-[#D4F0E0]/18 hover:border-[#B7DB74] text-[11px] text-[#CBE3D6] hover:text-white transition-colors"
                        >
                          <span className="truncate max-w-[180px]">
                            {src.title}
                          </span>
                          <ExternalLink className="w-3 h-3 shrink-0 text-[#85AF9B]" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Posology & Pharmacy Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
              Posologia e horário de uso
            </label>
            <textarea
              rows={3}
              disabled={isIssued}
              value={posology}
              onChange={(e) => setPosology(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] resize-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
              Orientações à Farmácia de Manipulação
            </label>
            <textarea
              rows={3}
              disabled={isIssued}
              value={pharmacyNotes}
              onChange={(e) => setPharmacyNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] resize-none disabled:opacity-60"
            />
          </div>
        </div>

        {/* Rationale & Editable Precautions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#DDF3B2] mb-1.5">
              Fundamentação Científica (uso clínico)
            </label>
            <textarea
              rows={3}
              disabled={isIssued}
              value={clinicalRationale}
              onChange={(e) => setClinicalRationale(e.target.value)}
              placeholder="Justificativa clínica dos ativos escolhidos para o tratamento..."
              className="w-full px-3.5 py-2.5 text-xs bg-[#07201C] text-[#CBE3D6] placeholder-[#719C88] border border-[#B7DB74]/20 rounded-xl focus:outline-none focus:border-[#C7E88B] resize-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-amber-300 mb-1.5">
              Precauções, Interações e Segurança (impresso na receita)
            </label>
            <textarea
              rows={3}
              disabled={isIssued}
              value={precautions}
              onChange={(e) => setPrecautions(e.target.value)}
              placeholder="Ex.: Separar do consumo de café/laticínios por 2h; monitorar ferritina e vitamina D após 60 dias..."
              className="w-full px-3.5 py-2.5 text-xs bg-[#07201C] text-[#CBE3D6] placeholder-[#719C88] border border-amber-400/25 rounded-xl focus:outline-none focus:border-amber-300 resize-none disabled:opacity-60"
            />
          </div>
        </div>

        {/* Recommended Therapeutic Recipes */}
        {recommendedRecipes.length > 0 && (
          <div className="p-4 rounded-xl bg-[#0A2622] border border-[#B7DB74]/20 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#DDF3B2] flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Receitas Terapêuticas Integradas ao Tratamento</span>
              </div>
              <button
                type="button"
                onClick={onOpenRecipes}
                className="text-[11px] text-[#C7E88B] hover:underline cursor-pointer"
              >
                Abrir acervo de receitas →
              </button>
            </div>
            <ul className="space-y-1 text-xs text-[#CBE3D6] list-disc pl-4 marker:text-[#B7DB74]">
              {recommendedRecipes.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Grounded Scientific Citations */}
        {aiSources.length > 0 && (
          <div className="pt-3 border-t border-[#B7DB74]/14 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#C7E88B]">
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
                  className="group flex items-start justify-between gap-2 p-2.5 rounded-lg bg-[#061A17] border border-[#B7DB74]/16 hover:border-[#C7E88B]/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-[#F4FBF6] group-hover:text-[#DDF3B2] line-clamp-1">
                      {src.title}
                    </div>
                    <div className="text-[10px] font-mono text-[#85AF9B] truncate">
                      {src.domain}
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-[#85AF9B] group-hover:text-[#DDF3B2] shrink-0 mt-0.5" />
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

        {/* Inline High-Risk Emission Guard (never uses window.confirm) */}
        {confirmHighRiskIssue && !isIssued && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-red-950/65 border border-red-400/55 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 text-xs text-red-100">
              <ShieldAlert className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white">
                  A análise da IA detectou alerta(s) crítico(s) nesta fórmula.
                </strong>
                <span>
                  Recomenda-se revisar os ativos ou incorporar as precauções
                  antes de emitir o receituário oficial para a farmácia.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmHighRiskIssue(false)}
                className="px-3.5 py-2 rounded-full text-xs font-semibold bg-[#061A17] text-white border border-white/25 hover:border-[#B7DB74] cursor-pointer whitespace-nowrap"
              >
                Revisar fórmula
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="px-4 py-2 rounded-full text-xs font-semibold bg-red-600 hover:bg-red-500 text-white cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                Emitir mesmo assim
              </button>
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div className="pt-4 border-t border-[#B7DB74]/16 flex flex-wrap items-center justify-between gap-3">
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
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#F4FBF6] border border-[#B7DB74]/35 rounded-full hover:border-[#DDF3B2] hover:bg-[#B7DB74]/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-[#C7E88B]" />
                <span>{saving ? 'Salvando...' : 'Salvar rascunho'}</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (hasCriticalAlert && !confirmHighRiskIssue) {
                    setConfirmHighRiskIssue(true);
                    return;
                  }
                  void handleSave(true);
                }}
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
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C7E88B] hover:text-[#DDF3B2] cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Visualizar e imprimir receita</span>
          </button>
        </div>
      </section>
    </div>
  );
}
