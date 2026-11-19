import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
  Video,
  X,
} from 'lucide-react';
import {
  DimitraChatTurn,
  DimitraGuestProfile,
  GroundingSource,
  sendDimitraConsultationMessage,
  SpecialistEscalation,
} from '../lib/aiService';
import {
  buildSpecialistWhatsAppUrl,
  ClinicalSpecialty,
  CONSULTATION_MODE_LABELS,
  ConsultationMode,
  SPECIALIST_ACADEMIC_FORMATION,
  SPECIALIST_PROFILE,
  SPECIALTY_LABELS,
} from '../types';
import { MOTION_EASE, VerbenaEmblem } from './LuxuryPrimitives';
import { FormattedClinicalMarkdown } from './ScientificEvidenceBlock';

interface PublicMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: GroundingSource[];
  escalation?: SpecialistEscalation | null;
}

interface PublicDimitraModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: ConsultationMode;
  specialistAvatarUrl?: string;
  onRequestSpecialistVideo?: (intent: {
    specialty: ClinicalSpecialty;
    chiefComplaint: string;
  }) => void;
}

const PUBLIC_STARTERS: Record<ConsultationMode, string[]> = {
  consulta: [
    'Dra. Dimitra, como emagrecer com saúde preservando minha massa muscular?',
    'Tenho fadiga e vitamina D baixa — preciso de vitaminas manipuladas sob medida.',
    'Sinto muita vontade de doce à noite — como ajustar minha alimentação?',
    'O que comer para melhorar intestino preso e distensão abdominal?',
  ],
  anamnese: [
    'Quero iniciar minha primeira avaliação nutricional guiada com você.',
    'Preciso reorganizar minha rotina alimentar de segunda a sexta.',
    'Busco ganho de massa magra e melhora de energia nos treinos.',
    'Quero controlar glicemia e avaliar meus exames em videochamada.',
  ],
  plano_substituicoes: [
    'Quais substituições saudáveis para o pão francês no café da manhã?',
    'Como montar um prato equilibrado em restaurante por quilo?',
    'Opções práticas de lanche proteico para levar ao trabalho.',
    'O que comer antes e depois do treino de musculação?',
  ],
  suplementacao: [
    'Creatina funciona mesmo? Qual dose tomar e em qual horário?',
    'Ômega-3 ajuda na inflamação e saúde cardiovascular? Como escolher?',
    'Qual tipo de magnésio tem melhor evidência para sono e ansiedade?',
    'Quero prescrição manipulada individualizada para imunidade e foco.',
  ],
};

export function PublicDimitraModal({
  open,
  onClose,
  initialMode = 'consulta',
  specialistAvatarUrl = SPECIALIST_PROFILE.photoUrl,
  onRequestSpecialistVideo,
}: PublicDimitraModalProps) {
  const [mode, setMode] = useState<ConsultationMode>(initialMode);
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [guestProfile, setGuestProfile] = useState<DimitraGuestProfile>({
    name: '',
    goal: '',
    restrictions: '',
  });

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
  }, [open, initialMode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  async function handleSend(customText?: string) {
    const text = (customText ?? input).trim();
    if (!text || sending) return;

    const userMsg: PublicMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      sources: [],
    };

    const nextHistory: DimitraChatTurn[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInput('');
    setSending(true);
    setErrorMsg(null);

    try {
      const res = await sendDimitraConsultationMessage({
        messages: nextHistory,
        mode,
        guestProfile,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          sources: res.sources || [],
          escalation: res.specialistEscalation || null,
        },
      ]);
      setFollowUps(res.suggestedFollowUps || []);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível conectar ao atendimento no momento.'
      );
    } finally {
      setSending(false);
    }
  }

  function handleReset() {
    setMessages([]);
    setFollowUps([]);
    setErrorMsg(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Atendimento Online — Nutricionista Dra. Dimitra Bratu"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#041210]/85 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.25, ease: MOTION_EASE }}
            className="relative z-10 w-full max-w-4xl h-[90vh] max-h-[820px] bg-[#061A17] border border-[#B7DB74]/35 rounded-3xl shadow-[0_32px_90px_-20px_rgba(2,6,18,0.95)] flex flex-col overflow-hidden"
          >
            {/* Luminous Azure Top Rim */}
            <div
              aria-hidden="true"
              className="h-px w-full bg-gradient-to-r from-transparent via-[#DDF3B2]/80 to-transparent"
            />

            {/* Header */}
            <div className="px-5 sm:px-7 py-4 border-b border-[#B7DB74]/18 bg-[#0A2622] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={specialistAvatarUrl}
                  alt={SPECIALIST_PROFILE.title}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover object-top border border-[#C7E88B]/65 shrink-0"
                />
                <div className="min-w-0">
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F4FBF6] leading-none truncate">
                    Nutricionista Dra. Dimitra Bratu
                  </h2>
                  <p className="text-xs text-[#DDF3B2] mt-1 truncate">
                    Atendimento IA 24h · {SPECIALIST_ACADEMIC_FORMATION}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onRequestSpecialistVideo && (
                  <button
                    type="button"
                    onClick={() =>
                      onRequestSpecialistVideo({
                        specialty: 'metabolica_emagrecimento',
                        chiefComplaint:
                          guestProfile.goal ||
                          'Consulta especializada por videochamada com a Dra. Dimitra Bratu.',
                      })
                    }
                    className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#DDF3B2] border border-[#B7DB74]/40 rounded-full hover:bg-[#B7DB74]/14 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Videochamada</span>
                  </button>
                )}
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleReset}
                    title="Reiniciar conversa"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#A8CCB9] hover:text-white border border-[#B7DB74]/22 rounded-full hover:border-[#B7DB74]/55 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Nova consulta</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar atendimento"
                  className="p-2 text-[#A8CCB9] hover:text-white hover:bg-[#B7DB74]/12 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mode Bar & Optional Guest Profile */}
            <div className="px-5 sm:px-7 py-3 border-b border-[#B7DB74]/14 bg-[#061A17]/90 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(Object.keys(CONSULTATION_MODE_LABELS) as ConsultationMode[]).map(
                    (mKey) => {
                      const active = mode === mKey;
                      return (
                        <button
                          key={mKey}
                          type="button"
                          onClick={() => setMode(mKey)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'btn-azure font-semibold'
                              : 'text-[#A8CCB9] bg-[#0E332D] border border-[#B7DB74]/20 hover:border-[#C7E88B]/55 hover:text-white'
                          }`}
                        >
                          {CONSULTATION_MODE_LABELS[mKey]}
                        </button>
                      );
                    }
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowProfile((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#DDF3B2] hover:text-white cursor-pointer whitespace-nowrap"
                >
                  <UserRound className="w-3.5 h-3.5" />
                  <span>Personalizar seu perfil</span>
                  {showProfile ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {showProfile && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <input
                    type="text"
                    value={guestProfile.name || ''}
                    onChange={(e) =>
                      setGuestProfile((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Seu primeiro nome"
                    className="px-3 py-2 text-xs bg-[#0A2622] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                  />
                  <input
                    type="text"
                    value={guestProfile.goal || ''}
                    onChange={(e) =>
                      setGuestProfile((p) => ({ ...p, goal: e.target.value }))
                    }
                    placeholder="Objetivo (ex: emagrecimento, hipertrofia)"
                    className="px-3 py-2 text-xs bg-[#0A2622] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                  />
                  <input
                    type="text"
                    value={guestProfile.restrictions || ''}
                    onChange={(e) =>
                      setGuestProfile((p) => ({
                        ...p,
                        restrictions: e.target.value,
                      }))
                    }
                    placeholder="Restrições (ex: sem lactose, vegetariano)"
                    className="px-3 py-2 text-xs bg-[#0A2622] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                  />
                </div>
              )}
            </div>

            {/* Chat Stream */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 space-y-5">
              {messages.length === 0 ? (
                <div className="space-y-6 max-w-2xl mx-auto">
                  <div className="p-6 rounded-2xl bg-[#0E332D] border border-[#B7DB74]/26 space-y-2.5">
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#DDF3B2]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Atendimento IA + Encaminhamento para Videochamada</span>
                    </div>
                    <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#F4FBF6] leading-snug">
                      Olá{guestProfile.name ? `, ${guestProfile.name}` : ''}! Seja
                      bem-vindo ao consultório digital.
                    </h3>
                    <p className="text-sm text-[#CBE3D6] leading-relaxed">
                      Converse agora com a IA da{' '}
                      <strong className="text-white">
                        Nutricionista Dra. Dimitra Bratu (Universidade Gama Filho
                        — Rio de Janeiro, RJ)
                      </strong>
                      . Para dúvidas práticas, respondo imediatamente com
                      embasamento científico; para casos especializados, exames
                      ou vitaminas manipuladas, libero o agendamento da sua
                      videochamada direta com a Dra. Dimitra.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PUBLIC_STARTERS[mode].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleSend(prompt)}
                        className="group text-left p-4 rounded-xl bg-[#0A2622] border border-[#B7DB74]/20 hover:border-[#C7E88B]/60 hover:bg-[#0E332D] transition-all cursor-pointer flex items-start justify-between gap-3"
                      >
                        <span className="text-xs text-[#CBE3D6] leading-relaxed group-hover:text-white">
                          {prompt}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#B7DB74] shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) =>
                  msg.role === 'user' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] sm:max-w-[72%] rounded-2xl rounded-tr-sm px-4 py-3 bg-gradient-to-br from-[#144239] to-[#0E332D] border border-[#B7DB74]/40 text-[#F4FBF6] text-sm leading-relaxed">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="space-y-3">
                      <div className="max-w-[95%] sm:max-w-[88%] rounded-2xl rounded-tl-sm p-5 bg-[#0A2622] border border-[#B7DB74]/28 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-[#B7DB74]/14">
                          <VerbenaEmblem className="w-4 h-4 shrink-0" />
                          <span className="font-display text-sm font-semibold text-[#DDF3B2]">
                            Dra. Dimitra Bratu · IA Clínica
                          </span>
                          <span className="text-[11px] text-[#85AF9B]">
                            · Universidade Gama Filho (RJ)
                          </span>
                        </div>

                        <FormattedClinicalMarkdown content={msg.content} />

                        {msg.sources.length > 0 && (
                          <div className="pt-3 border-t border-[#B7DB74]/16 space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#C7E88B]">
                              <Globe className="w-3.5 h-3.5" />
                              <span>
                                Referências científicas ({msg.sources.length})
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {msg.sources.slice(0, 4).map((src, idx) => (
                                <a
                                  key={`${src.uri}-${idx}`}
                                  href={src.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group flex items-start justify-between gap-2 p-2.5 rounded-lg bg-[#061A17] border border-[#B7DB74]/18 hover:border-[#C7E88B]/55 transition-colors"
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

                      {msg.escalation?.needsSpecialistVideo &&
                        onRequestSpecialistVideo && (
                          <div className="max-w-[95%] sm:max-w-[88%] rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-[#144239] to-[#0A2622] border border-[#C7E88B]/55 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-xs font-semibold text-[#DDF3B2]">
                                <Video className="w-4 h-4 text-[#B7DB74]" />
                                <span>
                                  Atendimento Especializado · Dra. Dimitra Bratu
                                </span>
                              </div>
                              <p className="text-xs text-[#CBE3D6] leading-relaxed">
                                {msg.escalation.reason ||
                                  'Este caso pede avaliação individualizada por videochamada.'}
                              </p>
                              <div className="text-[11px] text-[#A8CCB9]">
                                {SPECIALTY_LABELS[msg.escalation.specialty]} ·{' '}
                                {SPECIALIST_PROFILE.formation} · WhatsApp{' '}
                                <a
                                  href={buildSpecialistWhatsAppUrl(
                                    `Olá Dra. Dimitra Bratu! Vim do atendimento IA sobre ${SPECIALTY_LABELS[msg.escalation.specialty]}.`
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#DDF3B2] hover:underline"
                                >
                                  {SPECIALIST_PROFILE.phoneDisplay}
                                </a>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onRequestSpecialistVideo({
                                  specialty: msg.escalation!.specialty,
                                  chiefComplaint:
                                    msg.escalation!.reason ||
                                    'Encaminhamento da IA para videochamada especializada.',
                                })
                              }
                              className="btn-azure inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Agendar Videochamada</span>
                            </button>
                          </div>
                        )}
                    </div>
                  )
                )
              )}

              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-sm px-5 py-4 bg-[#0A2622] border border-[#B7DB74]/28 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-[#C7E88B] shrink-0" />
                    <span className="text-xs text-[#CBE3D6]">
                      <strong className="text-[#DDF3B2] font-medium">
                        IA Dra. Dimitra Bratu
                      </strong>{' '}
                      está consultando evidências e preparando sua orientação...
                    </span>
                  </div>
                </div>
              )}

              {!sending && followUps.length > 0 && messages.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {followUps.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSend(q)}
                      className="text-left text-xs px-3.5 py-2 rounded-full bg-[#0A2622] border border-[#B7DB74]/30 text-[#DDF3B2] hover:border-[#DDF3B2] hover:bg-[#0E332D] transition-colors cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
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

              <div ref={endRef} />
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="p-4 sm:p-5 border-t border-[#B7DB74]/18 bg-[#061A17] flex items-end gap-3"
            >
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={4000}
                disabled={sending}
                placeholder="Digite sua dúvida nutricional ou descreva seu caso..."
                className="flex-1 px-4 py-3 text-sm bg-[#041210] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/26 rounded-xl focus:outline-none focus:border-[#C7E88B] resize-none leading-relaxed"
              />
              <button
                type="submit"
                disabled={sending || input.trim().length < 2}
                className="btn-azure h-11 px-5 rounded-full inline-flex items-center gap-2 text-xs font-semibold cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Enviar</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
