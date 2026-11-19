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
  X,
} from 'lucide-react';
import {
  DimitraChatTurn,
  DimitraGuestProfile,
  GroundingSource,
  sendDimitraConsultationMessage,
} from '../lib/aiService';
import { CONSULTATION_MODE_LABELS, ConsultationMode } from '../types';
import { MOTION_EASE, VerbenaEmblem } from './LuxuryPrimitives';
import { FormattedClinicalMarkdown } from './ScientificEvidenceBlock';

interface PublicMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: GroundingSource[];
}

interface PublicDimitraModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: ConsultationMode;
}

const PUBLIC_STARTERS: Record<ConsultationMode, string[]> = {
  consulta: [
    'Dra. Dimitra, como emagrecer com saúde preservando minha massa muscular?',
    'Qual a quantidade ideal de proteína por dia e como dividir nas refeições?',
    'Sinto muita vontade de doce à noite — como ajustar minha alimentação?',
    'O que comer para melhorar intestino preso e distensão abdominal?',
  ],
  anamnese: [
    'Quero iniciar minha primeira avaliação nutricional guiada com você, Dra. Dimitra.',
    'Preciso reorganizar minha rotina alimentar de segunda a sexta.',
    'Busco ganho de massa magra e melhora de energia nos treinos.',
    'Quero controlar glicemia e melhorar meus exames laboratoriais.',
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
    'Preciso de whey protein ou consigo bater proteína só com comida?',
  ],
};

export function PublicDimitraModal({
  open,
  onClose,
  initialMode = 'consulta',
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
      handleSend();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Atendimento Online — Nutricionista Dimitra Bratu"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.25, ease: MOTION_EASE }}
            className="relative z-10 w-full max-w-4xl h-[90vh] max-h-[820px] bg-[#100D0A] border border-[#D9AF72]/35 rounded-3xl shadow-[0_32px_90px_-20px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden"
          >
            {/* Luminous Gold Top Rim */}
            <div
              aria-hidden="true"
              className="h-px w-full bg-gradient-to-r from-transparent via-[#F0D29C]/75 to-transparent"
            />

            {/* Header */}
            <div className="px-5 sm:px-7 py-4 border-b border-[#D9AF72]/16 bg-[#130F0C] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#F3D59C]/25 via-[#D9AF72]/15 to-[#0E0B08] border border-[#E8C589]/55 flex items-center justify-center shrink-0">
                  <VerbenaEmblem className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-editorial text-2xl font-medium text-[#FAF5EC] leading-none truncate">
                    Nutricionista Dimitra Bratu
                  </h2>
                  <p className="text-xs text-[#DFBA7C] mt-1 truncate">
                    Atendimento Nutricional Especializado · Baseado em Evidências
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleReset}
                    title="Reiniciar conversa"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#BDB2A4] hover:text-[#FAF5EC] border border-[#D9AF72]/20 rounded-full hover:border-[#D9AF72]/45 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Nova consulta</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar atendimento"
                  className="p-2 text-[#A89E90] hover:text-[#FAF5EC] hover:bg-[#D9AF72]/10 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mode Bar & Optional Guest Profile */}
            <div className="px-5 sm:px-7 py-3 border-b border-[#D9AF72]/12 bg-[#0E0B08]/90 space-y-3">
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
                              ? 'btn-gold font-semibold'
                              : 'text-[#BDB2A4] bg-[#17120E] border border-[#D9AF72]/18 hover:border-[#D9AF72]/45 hover:text-[#FAF5EC]'
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
                  className="inline-flex items-center gap-1.5 text-xs text-[#E8C589] hover:text-[#F7DFB3] cursor-pointer whitespace-nowrap"
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
                    className="px-3 py-2 text-xs bg-[#14100C] text-[#FAF5EC] placeholder-[#7C7164] border border-[#D9AF72]/22 rounded-xl focus:outline-none focus:border-[#E8C589]"
                  />
                  <input
                    type="text"
                    value={guestProfile.goal || ''}
                    onChange={(e) =>
                      setGuestProfile((p) => ({ ...p, goal: e.target.value }))
                    }
                    placeholder="Objetivo (ex: emagrecimento, hipertrofia)"
                    className="px-3 py-2 text-xs bg-[#14100C] text-[#FAF5EC] placeholder-[#7C7164] border border-[#D9AF72]/22 rounded-xl focus:outline-none focus:border-[#E8C589]"
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
                    className="px-3 py-2 text-xs bg-[#14100C] text-[#FAF5EC] placeholder-[#7C7164] border border-[#D9AF72]/22 rounded-xl focus:outline-none focus:border-[#E8C589]"
                  />
                </div>
              )}
            </div>

            {/* Chat Stream */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 space-y-5">
              {messages.length === 0 ? (
                <div className="space-y-6 max-w-2xl mx-auto">
                  <div className="p-6 rounded-2xl bg-[#16110D] border border-[#D9AF72]/24 space-y-2.5">
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E8C589]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Atendimento Direto · Dra. Dimitra Bratu</span>
                    </div>
                    <h3 className="font-editorial text-2xl sm:text-3xl text-[#FAF5EC] leading-snug">
                      Olá{guestProfile.name ? `, ${guestProfile.name}` : ''}! Que
                      prazer receber você no meu consultório digital.
                    </h3>
                    <p className="text-sm text-[#C7BDB0] leading-relaxed">
                      Sou a Nutricionista Dimitra Bratu. Pode me perguntar sobre
                      alimentação, substituições, suplementação ou iniciar uma
                      anamnese guiada — respondo com acolhimento, clareza e
                      embasamento nas publicações mais atuais da ciência da
                      nutrição.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PUBLIC_STARTERS[mode].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleSend(prompt)}
                        className="group text-left p-4 rounded-xl bg-[#130F0B] border border-[#D9AF72]/18 hover:border-[#E8C589]/55 hover:bg-[#1A140F] transition-all cursor-pointer flex items-start justify-between gap-3"
                      >
                        <span className="text-xs text-[#DFD5C8] leading-relaxed group-hover:text-[#FAF5EC]">
                          {prompt}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#D9AF72] shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) =>
                  msg.role === 'user' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] sm:max-w-[72%] rounded-2xl rounded-tr-sm px-4 py-3 bg-gradient-to-br from-[#2B2014] to-[#1D160E] border border-[#D9AF72]/35 text-[#FAF5EC] text-sm leading-relaxed">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="flex justify-start">
                      <div className="max-w-[95%] sm:max-w-[88%] rounded-2xl rounded-tl-sm p-5 bg-[#15110D] border border-[#D9AF72]/22 border-l-2 border-l-[#E8C589] space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-[#D9AF72]/12">
                          <VerbenaEmblem className="w-4 h-4 shrink-0" />
                          <span className="font-editorial text-base font-medium text-[#F0D29C]">
                            Dra. Dimitra Bratu
                          </span>
                          <span className="text-[11px] text-[#8D8274]">
                            Nutricionista Clínica
                          </span>
                        </div>

                        <FormattedClinicalMarkdown content={msg.content} />

                        {msg.sources.length > 0 && (
                          <div className="pt-3 border-t border-[#D9AF72]/14 space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#DFBA7C]">
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
                      </div>
                    </div>
                  )
                )
              )}

              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-sm px-5 py-4 bg-[#15110D] border border-[#D9AF72]/24 border-l-2 border-l-[#E8C589] flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-[#E8C589] shrink-0" />
                    <span className="text-xs text-[#CFC5B8]">
                      <strong className="text-[#F0D29C] font-medium">
                        Dra. Dimitra Bratu
                      </strong>{' '}
                      está preparando sua orientação clínica...
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
                      className="text-left text-xs px-3.5 py-2 rounded-full bg-[#15110D] border border-[#D9AF72]/28 text-[#E8C589] hover:border-[#F0D29C] hover:bg-[#D9AF72]/12 transition-colors cursor-pointer"
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
                handleSend();
              }}
              className="p-4 sm:p-5 border-t border-[#D9AF72]/16 bg-[#110D0A] flex items-end gap-3"
            >
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={4000}
                disabled={sending}
                placeholder="Digite sua dúvida para a Nutricionista Dimitra Bratu..."
                className="flex-1 px-4 py-3 text-sm bg-[#0B0907] text-[#FAF5EC] placeholder-[#7C7164] border border-[#D9AF72]/25 rounded-xl focus:outline-none focus:border-[#E8C589] resize-none leading-relaxed"
              />
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
