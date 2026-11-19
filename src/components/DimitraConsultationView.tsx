import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BookMarked,
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  MessageCircleHeart,
  Pill,
  Plus,
  Send,
  Sparkles,
  Stethoscope,
  Trash2,
  UserRound,
  Video,
} from 'lucide-react';
import {
  DimitraChatTurn,
  sendDimitraConsultationMessage,
  SpecialistEscalation,
} from '../lib/aiService';
import {
  appendConsultationMessage,
  concludeConsultationSession,
  createConsultationSession,
  deleteConsultationSession,
  subscribeToConsultationMessages,
} from '../lib/firestoreService';
import { calculateBMI } from '../lib/nutrition';
import {
  buildSpecialistWhatsAppUrl,
  ClinicalSpecialty,
  CONSULTATION_MODE_LABELS,
  Consultation,
  ConsultationMessage,
  ConsultationMode,
  GOAL_LABELS,
  MealPlan,
  Patient,
  Recipe,
  SPECIALIST_ACADEMIC_FORMATION,
  SPECIALIST_PROFILE,
  SPECIALTY_LABELS,
} from '../types';
import { MOTION_EASE, SpotlightCard, VerbenaEmblem } from './LuxuryPrimitives';
import { FormattedClinicalMarkdown } from './ScientificEvidenceBlock';

interface DimitraConsultationViewProps {
  nutritionistId: string;
  patients: Patient[];
  mealPlans: MealPlan[];
  recipes: Recipe[];
  consultations: Consultation[];
  specialistAvatarUrl?: string;
  initialPatientId?: string | null;
  onSaveClinicalNote: (patient: Patient, noteSnippet: string) => Promise<void>;
  onOpenPatientPlan: (patientId: string) => void;
  onEscalateToVideo: (params: {
    patientId: string;
    patientName: string;
    specialty: ClinicalSpecialty;
    chiefComplaint: string;
  }) => void;
  onNotify: (message: string) => void;
}

const MODE_META: Record<
  ConsultationMode,
  { label: string; shortDesc: string; icon: typeof Stethoscope }
> = {
  consulta: {
    label: 'Consulta & Dúvidas',
    shortDesc: 'Atendimento clínico acolhedor e técnico',
    icon: MessageCircleHeart,
  },
  anamnese: {
    label: 'Anamnese Guiada',
    shortDesc: 'Entrevista nutricional passo a passo',
    icon: Stethoscope,
  },
  plano_substituicoes: {
    label: 'Plano & Substituições',
    shortDesc: 'Trocas equivalentes e rotina prática',
    icon: ClipboardList,
  },
  suplementacao: {
    label: 'Suplementação & Ciência',
    shortDesc: 'Doses, horários e evidências ISSN/ESPEN',
    icon: Pill,
  },
};

function getStarterPrompts(
  mode: ConsultationMode,
  patient: Patient | null,
  activePlan: MealPlan | null
): string[] {
  if (mode === 'anamnese') {
    return patient
      ? [
          `Vamos iniciar a anamnese nutricional completa de ${patient.fullName.split(' ')[0]}.`,
          'Quero revisar sono, intestino, hidratação e gatilhos de fome na rotina.',
          'Quais perguntas clínicas devo investigar antes de ajustar o plano atual?',
          'Me ajude a mapear barreiras de adesão e preferências alimentares.',
        ]
      : [
          'Olá Dra. Dimitra, gostaria de fazer minha primeira avaliação nutricional guiada.',
          'Quero melhorar minha energia, composição corporal e rotina alimentar.',
          'Tenho dificuldade com organização das refeições durante a semana.',
          'Gostaria de investigar sintomas digestivos e distensão abdominal.',
        ];
  }

  if (mode === 'plano_substituicoes') {
    return activePlan
      ? [
          `Quais substituições equivalentes posso oferecer para o almoço do plano "${activePlan.title}"?`,
          'Como adaptar o jantar quando precisar comer em restaurante?',
          'O que ajustar no lanche da tarde para controlar a vontade de doce à noite?',
          'Sugira opções práticas de pré-treino alinhadas às metas atuais.',
        ]
      : [
          'Por que sinto muita fome no fim da tarde e como equilibrar minhas refeições?',
          'Quais são boas substituições proteicas para o café da manhã sem lactose?',
          'Como montar um prato equilibrado em restaurante por quilo para emagrecimento?',
          'O que comer no pré-treino de musculação às 6h30 da manhã?',
        ];
  }

  if (mode === 'suplementacao') {
    return [
      'Creatina monohidratada precisa de fase de saturação e retém líquido subcutâneo?',
      'Quando indicar ômega-3 EPA/DHA e qual a faixa de dose com evidência clínica?',
      'Magnésio melhora qualidade do sono e recuperação muscular? Qual forma escolher?',
      'Whey protein isolado ou proteína vegetal: como escolher para o meu perfil?',
    ];
  }

  return patient
    ? [
        `Dra. Dimitra, quais prioridades nutricionais devo focar para o objetivo de ${GOAL_LABELS[patient.goal].toLowerCase()}?`,
        'Como distribuir proteínas ao longo do dia para maximizar saciedade e massa magra?',
        'Quais estratégias práticas ajudam a melhorar a resposta glicêmica pós-refeição?',
        'Qual a melhor abordagem para manter constância nos fins de semana sem culpa?',
      ]
    : [
        'Dra. Dimitra, como emagrecer de forma sustentável sem perder massa muscular?',
        'Qual a quantidade ideal de proteína por dia e como distribuir nas refeições?',
        'O que comer à noite para melhorar o sono e evitar compulsão alimentar?',
        'Como organizar a alimentação para reduzir inflamação e melhorar a disposição?',
      ];
}

export function DimitraConsultationView({
  nutritionistId,
  patients,
  mealPlans,
  recipes,
  consultations,
  specialistAvatarUrl = SPECIALIST_PROFILE.photoUrl,
  initialPatientId,
  onSaveClinicalNote,
  onOpenPatientPlan,
  onEscalateToVideo,
  onNotify,
}: DimitraConsultationViewProps) {
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(
    null
  );
  const [draftPatientId, setDraftPatientId] = useState<string>(
    initialPatientId || ''
  );
  const [mode, setMode] = useState<ConsultationMode>('consulta');
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [latestEscalation, setLatestEscalation] =
    useState<SpecialistEscalation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeConsultation = useMemo(
    () => consultations.find((c) => c.id === selectedConsultationId) || null,
    [consultations, selectedConsultationId]
  );

  const effectivePatientId = activeConsultation
    ? activeConsultation.patientId
    : draftPatientId;

  const linkedPatient = useMemo(
    () => patients.find((p) => p.id === effectivePatientId) || null,
    [patients, effectivePatientId]
  );

  const linkedActivePlan = useMemo(() => {
    if (!linkedPatient) return null;
    return (
      mealPlans.find(
        (pl) => pl.patientId === linkedPatient.id && pl.status === 'ativo'
      ) ||
      mealPlans.find((pl) => pl.patientId === linkedPatient.id) ||
      null
    );
  }, [mealPlans, linkedPatient]);

  useEffect(() => {
    if (activeConsultation) {
      setMode(activeConsultation.mode);
    }
  }, [activeConsultation?.id, activeConsultation?.mode]);

  useEffect(() => {
    if (!selectedConsultationId) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    setMessagesLoading(true);
    const unsub = subscribeToConsultationMessages(
      selectedConsultationId,
      nutritionistId,
      (list) => {
        setMessages(list);
        setMessagesLoading(false);
      },
      (err) => {
        setErrorMsg(err.message);
        setMessagesLoading(false);
      }
    );

    return () => unsub();
  }, [selectedConsultationId, nutritionistId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  function handleStartNewConsultation() {
    setSelectedConsultationId(null);
    setMessages([]);
    setFollowUps([]);
    setLatestEscalation(null);
    setErrorMsg(null);
  }

  async function handleSendMessage(customText?: string) {
    const text = (customText ?? input).trim();
    if (!text || sending) return;
    if (activeConsultation?.status === 'encerrada') return;

    setSending(true);
    setErrorMsg(null);
    if (!customText) setInput('');

    let consultationId = selectedConsultationId;
    let currentCount = activeConsultation?.messageCount ?? messages.length;

    try {
      if (!consultationId) {
        const autoTitle =
          text.length > 68 ? `${text.slice(0, 65).trim()}...` : text;
        consultationId = await createConsultationSession({
          nutritionistId,
          patientId: linkedPatient?.id || '',
          patientName: linkedPatient?.fullName || 'Atendimento Geral',
          title: autoTitle.length >= 2 ? autoTitle : 'Atendimento Nutricional',
          mode,
          lastMessagePreview: text.slice(0, 200),
        });
        setSelectedConsultationId(consultationId);
        currentCount = 0;
      }

      const historyForAi: DimitraChatTurn[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ];

      currentCount += 1;
      await appendConsultationMessage({
        consultationId,
        nutritionistId,
        role: 'user',
        content: text,
        sources: [],
        nextMessageCount: currentCount,
        mode,
      });

      const aiResponse = await sendDimitraConsultationMessage({
        messages: historyForAi,
        mode,
        patient: linkedPatient,
        activePlan: linkedActivePlan,
        availableRecipes: recipes,
      });

      currentCount += 1;
      await appendConsultationMessage({
        consultationId,
        nutritionistId,
        role: 'assistant',
        content: aiResponse.reply,
        sources: aiResponse.sources,
        nextMessageCount: currentCount,
        mode,
      });

      setFollowUps(aiResponse.suggestedFollowUps || []);
      setLatestEscalation(aiResponse.specialistEscalation || null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível concluir a resposta da Dra. Dimitra Bratu.'
      );
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  async function handleCopyMessage(msg: ConsultationMessage) {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId((curr) => (curr === msg.id ? null : curr)), 2000);
    } catch {
      onNotify('Não foi possível copiar o texto.');
    }
  }

  async function handleSaveToPatientNotes(msg: ConsultationMessage) {
    if (!linkedPatient) return;
    setSavingNoteId(msg.id);
    try {
      const compact = msg.content.replace(/[#*`]/g, '').replace(/\s+/g, ' ').trim();
      const snippet = `[Atendimento Dra. Dimitra IA]: ${compact.slice(0, 320)}`;
      await onSaveClinicalNote(linkedPatient, snippet);
      onNotify(`Orientação anexada à anamnese de ${linkedPatient.fullName}.`);
    } finally {
      setSavingNoteId(null);
    }
  }

  async function handleConcludeSession() {
    if (!activeConsultation || activeConsultation.status === 'encerrada') return;
    await concludeConsultationSession(activeConsultation.id);
    onNotify('Atendimento encerrado e arquivado no histórico.');
  }

  async function handleDeleteSession(cons: Consultation) {
    await deleteConsultationSession(cons.id, nutritionistId);
    if (selectedConsultationId === cons.id) {
      handleStartNewConsultation();
    }
    onNotify('Atendimento removido do histórico.');
  }

  const starterPrompts = getStarterPrompts(mode, linkedPatient, linkedActivePlan);
  const isLocked = activeConsultation?.status === 'encerrada';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Control & History Column */}
      <aside className="lg:col-span-4 space-y-5">
        <SpotlightCard glowRim className="p-5 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#B7DB74]/15 border border-[#B7DB74]/40 flex items-center justify-center shrink-0">
                <VerbenaEmblem className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-editorial text-lg font-medium text-[#F4FBF6] leading-tight truncate">
                  Dra. Dimitra Bratu
                </div>
                <div className="text-[11px] text-[#C7E88B] truncate">
                  Universidade Gama Filho · RJ
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleStartNewConsultation}
              className="btn-gold inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo
            </button>
          </div>

          {/* Patient Context Link */}
          <div>
            <label
              htmlFor="consultation-patient"
              className="block text-xs font-medium text-[#A8CCB9] mb-1.5"
            >
              Paciente vinculado ao atendimento
            </label>
            <select
              id="consultation-patient"
              value={effectivePatientId}
              disabled={Boolean(activeConsultation)}
              onChange={(e) => setDraftPatientId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] disabled:opacity-60"
            >
              <option value="">Atendimento geral (sem prontuário)</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} — {GOAL_LABELS[p.goal]}
                </option>
              ))}
            </select>

            {linkedPatient && (
              <div className="mt-3 p-3.5 rounded-xl bg-[#061A17]/90 border border-[#B7DB74]/20 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#F4FBF6] truncate">
                    {linkedPatient.fullName}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenPatientPlan(linkedPatient.id)}
                    className="text-[11px] text-[#C7E88B] hover:text-[#DDF3B2] cursor-pointer whitespace-nowrap"
                  >
                    Ver plano →
                  </button>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums text-[#A8CCB9]">
                  <span>
                    IMC {calculateBMI(linkedPatient.weightKg, linkedPatient.heightCm).toFixed(1)}
                  </span>
                  <span>{linkedPatient.targetCalories} kcal</span>
                  <span>P {linkedPatient.targetProteinG}g</span>
                </div>
                {linkedActivePlan && (
                  <div className="text-[11px] text-[#C7E88B] truncate">
                    Plano ativo: {linkedActivePlan.title}
                  </div>
                )}
                {linkedPatient.restrictions.length > 0 && (
                  <div className="text-[11px] text-amber-300/90">
                    Restrições: {linkedPatient.restrictions.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Consultation Mode Selector */}
          <div>
            <div className="text-xs font-medium text-[#A8CCB9] mb-2">
              Modalidade do atendimento
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {(Object.keys(MODE_META) as ConsultationMode[]).map((mKey) => {
                const meta = MODE_META[mKey];
                const Icon = meta.icon;
                const active = mode === mKey;
                return (
                  <button
                    key={mKey}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setMode(mKey)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer disabled:opacity-50 flex items-center gap-3 ${
                      active
                        ? 'bg-[#B7DB74]/16 border-[#C7E88B]/65 text-[#F4FBF6]'
                        : 'bg-[#07201C]/80 border-[#B7DB74]/14 text-[#A8CCB9] hover:border-[#B7DB74]/38 hover:text-[#F4FBF6]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-[#DDF3B2]' : 'text-[#85AF9B]'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">
                        {meta.label}
                      </div>
                      <div className="text-[11px] text-[#85AF9B] truncate">
                        {meta.shortDesc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </SpotlightCard>

        {/* Persisted Consultations History */}
        <section className="glass-obsidian rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#B7DB74]/14 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#F4FBF6] tracking-wide">
              Atendimentos salvos ({consultations.length})
            </h2>
          </div>

          {consultations.length === 0 ? (
            <div className="p-5 text-xs text-[#85AF9B] leading-relaxed">
              Os atendimentos realizados com a Dra. Dimitra Bratu (IA) ficam
              salvos aqui para consulta posterior.
            </div>
          ) : (
            <div className="divide-y divide-[#B7DB74]/10 max-h-[340px] overflow-y-auto">
              {consultations.map((cons) => {
                const selected = cons.id === selectedConsultationId;
                return (
                  <div
                    key={cons.id}
                    className={`group px-4 py-3.5 transition-colors flex items-start justify-between gap-2 ${
                      selected
                        ? 'bg-[#B7DB74]/14'
                        : 'hover:bg-[#B7DB74]/6'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedConsultationId(cons.id);
                        setFollowUps([]);
                        setErrorMsg(null);
                      }}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        {cons.status === 'encerrada' && (
                          <Lock className="w-3 h-3 text-[#85AF9B] shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-[#F4FBF6] truncate">
                          {cons.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#C7E88B] mt-0.5 truncate">
                        {cons.patientName || 'Atendimento Geral'} ·{' '}
                        {CONSULTATION_MODE_LABELS[cons.mode]}
                      </div>
                      {cons.lastMessagePreview && (
                        <div className="text-[11px] text-[#85AF9B] mt-1 line-clamp-1">
                          {cons.lastMessagePreview}
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteSession(cons)}
                      aria-label="Excluir atendimento"
                      className="p-1.5 text-[#719C88] hover:text-red-300 opacity-70 group-hover:opacity-100 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </aside>

      {/* Right Active Consultation Room */}
      <section className="lg:col-span-8 glass-obsidian rounded-2xl overflow-hidden flex flex-col min-h-[640px] max-h-[calc(100vh-148px)]">
        {/* Room Header */}
        <div className="px-6 py-4 border-b border-[#B7DB74]/16 bg-[#07201C]/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={specialistAvatarUrl}
              alt={SPECIALIST_PROFILE.title}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-full object-cover object-top border border-[#C7E88B]/65 shrink-0 shadow-[0_0_24px_-4px_rgba(183,219,116,0.35)]"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-editorial text-2xl font-medium text-[#F4FBF6] leading-none">
                  Nutricionista Dimitra Bratu
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-[#B7DB74]/35 bg-[#B7DB74]/10 text-[#DDF3B2] font-medium whitespace-nowrap">
                  {CONSULTATION_MODE_LABELS[mode]}
                </span>
              </div>
              <p className="text-xs text-[#A8CCB9] mt-1 truncate">
                {linkedPatient
                  ? `Atendendo prontuário de ${linkedPatient.fullName}${
                      linkedActivePlan ? ` · Plano "${linkedActivePlan.title}" conectado` : ''
                    }`
                  : `${SPECIALIST_ACADEMIC_FORMATION} · IA + Encaminhamento por Vídeo`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                onEscalateToVideo({
                  patientId: linkedPatient?.id || '',
                  patientName: linkedPatient?.fullName || '',
                  specialty:
                    latestEscalation?.specialty || 'metabolica_emagrecimento',
                  chiefComplaint:
                    latestEscalation?.reason ||
                    activeConsultation?.title ||
                    'Atendimento clínico especializado por videochamada com a Dra. Dimitra Bratu.',
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#DDF3B2] border border-[#B7DB74]/40 bg-[#0A2622] rounded-full hover:border-[#DDF3B2] hover:bg-[#0E332D] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Videochamada</span>
            </button>

            {activeConsultation && !isLocked && (
              <button
                type="button"
                onClick={handleConcludeSession}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#CBE3D6] border border-[#B7DB74]/28 rounded-full hover:border-[#C7E88B] hover:text-[#F4FBF6] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Lock className="w-3.5 h-3.5 text-[#B7DB74]" />
                Encerrar consulta
              </button>
            )}
            {isLocked && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-[#A8CCB9] bg-[#144239] border border-[#B7DB74]/20 rounded-full whitespace-nowrap">
                <Lock className="w-3 h-3 text-[#B7DB74]" />
                Consulta encerrada
              </span>
            )}
          </div>
        </div>

        {/* Messages Viewport */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 space-y-6">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-16 text-xs text-[#A8CCB9] gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#C7E88B]" />
              Carregando histórico da consulta...
            </div>
          ) : messages.length === 0 ? (
            <div className="space-y-6 max-w-2xl mx-auto py-4">
              {/* Warm Greeting in Dimitra Bratu's Voice */}
              <div className="p-6 rounded-2xl bg-[#0E332D]/90 border border-[#B7DB74]/25 space-y-3 relative overflow-hidden">
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#DDF3B2]/70 to-transparent"
                />
                <div className="flex items-center gap-2 text-xs font-medium text-[#C7E88B]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Boas-vindas ao Consultório Digital</span>
                </div>
                <p className="font-editorial text-2xl sm:text-3xl text-[#F4FBF6] leading-snug">
                  Olá
                  {linkedPatient
                    ? `, vamos cuidar do acompanhamento de ${linkedPatient.fullName.split(' ')[0]}`
                    : '! Eu sou a Nutricionista Dimitra Bratu'}
                  .
                </p>
                <p className="text-sm text-[#CBE3D6] leading-relaxed">
                  Estou aqui para realizar atendimentos, conduzir anamnese,
                  esclarecer dúvidas sobre alimentação, substituições do plano e
                  suplementação — sempre unindo escuta acolhedora, praticidade e
                  as evidências científicas mais atuais. Como posso te ajudar
                  agora?
                </p>
              </div>

              {/* Starter Prompts */}
              <div className="space-y-2.5">
                <div className="text-xs font-medium text-[#85AF9B]">
                  Sugestões para iniciar este atendimento
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={sending}
                      onClick={() => handleSendMessage(prompt)}
                      className="group text-left p-4 rounded-xl bg-[#0A2622] border border-[#B7DB74]/18 hover:border-[#C7E88B]/55 hover:bg-[#144239] transition-all cursor-pointer flex items-start justify-between gap-3"
                    >
                      <span className="text-xs text-[#CBE3D6] leading-relaxed group-hover:text-[#F4FBF6]">
                        {prompt}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#B7DB74] shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: MOTION_EASE }}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {isUser ? (
                    <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3.5 bg-gradient-to-br from-[#144239] to-[#144239] border border-[#B7DB74]/35 text-[#F4FBF6] text-sm leading-relaxed shadow-[0_10px_30px_-14px_rgba(0,0,0,0.8)]">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#C7E88B] mb-1">
                        <UserRound className="w-3 h-3" />
                        <span>
                          {linkedPatient
                            ? linkedPatient.fullName.split(' ')[0]
                            : 'Paciente / Consulta'}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="max-w-[95%] sm:max-w-[88%] rounded-2xl rounded-tl-sm p-5 bg-[#0E332D]/95 border border-[#B7DB74]/28 space-y-4 shadow-[0_14px_40px_-20px_rgba(2,6,18,0.85)]">
                      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[#B7DB74]/12">
                        <div className="flex items-center gap-2">
                          <VerbenaEmblem className="w-4 h-4 shrink-0" />
                          <span className="font-editorial text-base font-medium text-[#DDF3B2]">
                            Dra. Dimitra Bratu
                          </span>
                          <span className="text-[11px] text-[#85AF9B]">
                            Nutricionista Clínica
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] text-[#A8CCB9] hover:text-[#F4FBF6] hover:bg-[#B7DB74]/10 rounded-lg transition-colors cursor-pointer"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-[#C7E88B]" />
                                Copiado
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Copiar
                              </>
                            )}
                          </button>
                          {linkedPatient && (
                            <button
                              type="button"
                              disabled={savingNoteId === msg.id}
                              onClick={() => handleSaveToPatientNotes(msg)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] text-[#C7E88B] hover:bg-[#B7DB74]/12 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <BookMarked className="w-3 h-3" />
                              {savingNoteId === msg.id
                                ? 'Salvando...'
                                : 'Anexar à anamnese'}
                            </button>
                          )}
                        </div>
                      </div>

                      <FormattedClinicalMarkdown content={msg.content} />

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pt-3 border-t border-[#B7DB74]/14 space-y-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#C7E88B]">
                            <Globe className="w-3.5 h-3.5" />
                            <span>
                              Referências científicas consultadas ({msg.sources.length})
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {msg.sources.slice(0, 4).map((src, sIdx) => (
                              <a
                                key={`${src.uri}-${sIdx}`}
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
                    </div>
                  )}
                </motion.div>
              );
            })
          )}

          {/* Typing / Consulting State */}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-sm px-5 py-4 bg-[#0E332D] border border-[#B7DB74]/30 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-[#C7E88B] shrink-0" />
                <div className="text-xs text-[#CBE3D6]">
                  <span className="text-[#DDF3B2] font-medium">
                    IA Dra. Dimitra Bratu
                  </span>{' '}
                  está consultando evidências científicas e preparando sua
                  orientação...
                </div>
              </div>
            </div>
          )}

          {/* Smart Specialist Video Escalation Card */}
          {!sending &&
            latestEscalation?.needsSpecialistVideo &&
            messages.length > 0 && (
              <div className="rounded-2xl p-5 bg-gradient-to-br from-[#144239] via-[#0A2622] to-[#061A17] border border-[#C7E88B]/55 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#DDF3B2]">
                    <Video className="w-4 h-4 text-[#B7DB74]" />
                    <span>
                      Encaminhamento Especializado · Videochamada com Dra.
                      Dimitra Bratu
                    </span>
                  </div>
                  <p className="text-xs text-[#CBE3D6] leading-relaxed">
                    {latestEscalation.reason ||
                      'Este caso exige acompanhamento clínico individualizado por videochamada.'}
                  </p>
                  <div className="text-[11px] text-[#A8CCB9]">
                    Especialidade:{' '}
                    <span className="text-[#F4FBF6] font-medium">
                      {SPECIALTY_LABELS[latestEscalation.specialty]}
                    </span>{' '}
                    · {SPECIALIST_PROFILE.formation} ·{' '}
                    <a
                      href={buildSpecialistWhatsAppUrl(
                        `Olá Dra. Dimitra Bratu! Preciso de atendimento especializado em ${SPECIALTY_LABELS[latestEscalation.specialty]}.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#DDF3B2] hover:underline"
                    >
                      WhatsApp {SPECIALIST_PROFILE.phoneDisplay}
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onEscalateToVideo({
                      patientId: linkedPatient?.id || '',
                      patientName: linkedPatient?.fullName || '',
                      specialty: latestEscalation.specialty,
                      chiefComplaint:
                        latestEscalation.reason ||
                        'Encaminhamento da IA para avaliação clínica por videochamada.',
                    })
                  }
                  className="btn-azure inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Agendar / Iniciar Vídeo</span>
                </button>
              </div>
            )}

          {/* Contextual Quick Follow-Up Suggestions */}
          {!sending && !isLocked && followUps.length > 0 && messages.length > 0 && (
            <div className="pt-1 space-y-2">
              <div className="text-[11px] text-[#85AF9B]">
                Continuar atendimento:
              </div>
              <div className="flex flex-wrap gap-2">
                {followUps.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSendMessage(q)}
                    className="text-left text-xs px-3.5 py-2 rounded-full bg-[#0E332D] border border-[#B7DB74]/28 text-[#C7E88B] hover:border-[#DDF3B2] hover:bg-[#B7DB74]/12 transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
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

          <div ref={messagesEndRef} />
        </div>

        {/* Composer Footer */}
        <div className="p-4 sm:p-5 border-t border-[#B7DB74]/16 bg-[#07201C]/95">
          {isLocked ? (
            <div className="flex items-center justify-between gap-4 text-xs text-[#A8CCB9]">
              <span>
                Esta consulta foi encerrada e arquivada. Inicie um novo
                atendimento para continuar conversando com a Dra. Dimitra Bratu.
              </span>
              <button
                type="button"
                onClick={handleStartNewConsultation}
                className="btn-gold px-4 py-2 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                Novo atendimento
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-3"
            >
              <div className="flex-1 relative">
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={4000}
                  disabled={sending}
                  placeholder="Escreva sua dúvida nutricional, relate sintomas, rotina ou peça uma substituição para a Dra. Dimitra Bratu..."
                  className="w-full px-4 py-3 text-sm bg-[#041210] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B] resize-none leading-relaxed"
                />
              </div>
              <button
                type="submit"
                disabled={sending || input.trim().length < 2}
                className="btn-gold h-11 px-5 rounded-full inline-flex items-center gap-2 text-xs font-semibold cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Enviar</span>
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
