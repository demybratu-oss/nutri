import React, { useEffect, useRef, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Crown,
  Droplets,
  ExternalLink,
  FlaskConical,
  Globe,
  GraduationCap,
  HeartHandshake,
  Leaf,
  Loader2,
  Mail,
  Maximize2,
  MessageSquare,
  Microscope,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Sprout,
  UserRound,
  Video,
  Zap,
} from 'lucide-react';
import { BOTANICAL_THEME_IMAGES, RECIPE_IMAGES } from '../data/seedData';
import {
  DimitraChatTurn,
  GroundingSource,
  sendDimitraConsultationMessage,
  SpecialistEscalation,
} from '../lib/aiService';
import { auth, googleProvider } from '../lib/firebase';
import {
  buildSpecialistWhatsAppUrl,
  CLINICAL_SPECIALTIES,
  ClinicalSpecialty,
  CONSULTATION_MODE_LABELS,
  ConsultationMode,
  DEFAULT_SITE_SETTINGS,
  SiteMediaItem,
  SiteMediaSlotKey,
  SiteSettings,
  SPECIALIST_ACADEMIC_FORMATION,
  SPECIALIST_PROFILE,
  SPECIALTY_LABELS,
} from '../types';
import {
  BotanicalLeafDivider,
  GoldHorizonDivider,
  MOTION_EASE,
  SpotlightCard,
  VerbenaEmblem,
} from './LuxuryPrimitives';
import { PublicDimitraModal } from './PublicDimitraModal';
import { FormattedClinicalMarkdown } from './ScientificEvidenceBlock';

interface InlineAiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: GroundingSource[];
  escalation?: SpecialistEscalation | null;
}

const QUICK_AI_PROMPTS: Record<ConsultationMode, string[]> = {
  consulta: [
    'Como emagrecer preservando massa muscular no dia a dia?',
    'Tenho fadiga, vitamina D baixa e quero vitaminas manipuladas para meu caso.',
    'Sinto muita vontade de doce à noite — como ajustar minha alimentação?',
    'Quero avaliar meus exames e montar um protocolo intestinal individualizado.',
  ],
  anamnese: [
    'Quero iniciar minha triagem nutricional guiada com a IA agora.',
    'Preciso reorganizar minha rotina alimentar de segunda a sexta.',
    'Tenho resistência à insulina e preciso de acompanhamento especializado.',
    'Quero melhorar qualidade do sono, foco cognitivo e energia nos treinos.',
  ],
  plano_substituicoes: [
    'Quais substituições equilibradas para o pão francês no café da manhã?',
    'Como montar um prato saudável em restaurante por quilo?',
    'Opções práticas de lanche proteico para levar ao trabalho.',
    'O que comer antes e depois do treino de musculação?',
  ],
  suplementacao: [
    'Creatina funciona mesmo? Qual dose e horário recomendados?',
    'Qual magnésio tem melhor evidência científica para sono e ansiedade?',
    'Quero fórmula manipulada personalizada para imunidade e longevidade.',
    'Ômega-3 EPA/DHA: como escolher e qual dose usar com segurança?',
  ],
};

const BOTANICAL_BIOACTIVES = [
  {
    name: 'Chá Verde (EGCG)',
    summary: 'Energia celular limpa e alta ação antioxidante',
    prompt:
      'Quais são as evidências científicas do extrato de chá verde (EGCG) para metabolismo e ação antioxidante?',
  },
  {
    name: 'Cúrcuma Longa',
    summary: 'Modulação anti-inflamatória com alta biodisponibilidade',
    prompt:
      'Como utilizar Cúrcuma Longa (curcuminoides) na nutrição clínica e quais formas têm melhor absorção?',
  },
  {
    name: 'Magnésio Quelato',
    summary: 'Equilíbrio neuromuscular, qualidade do sono e foco',
    prompt:
      'Qual forma de magnésio manipulado (bisglicinato, dimalato, treonato) tem melhor evidência para sono e energia?',
  },
  {
    name: 'Ashwagandha',
    summary: 'Adaptógeno clínico para estresse, cortisol e vitalidade',
    prompt:
      'O que os estudos mais atuais dizem sobre Ashwagandha para controle de estresse, cortisol e sono?',
  },
  {
    name: 'Hortelã & Gengibre',
    summary: 'Conforto digestivo e suporte à saúde intestinal',
    prompt:
      'Como gengibre e hortelã auxiliam na digestão, distensão abdominal e saúde da microbiota intestinal?',
  },
] as const;

const ESSENTIAL_VITAMINS = [
  {
    symbol: 'B3',
    name: 'Niacinamida',
    benefit: 'Suporte ao metabolismo energético e saúde mitocondrial',
    prompt:
      'Qual o papel da Vitamina B3 (niacinamida) no metabolismo energético e quando avaliar suplementação manipulada?',
  },
  {
    symbol: 'B6',
    name: 'Piridoxal-5-Fosfato',
    benefit: 'Função neurológica, foco e síntese de neurotransmissores',
    prompt:
      'Por que a forma ativa da Vitamina B6 (piridoxal-5-fosfato) é usada em fórmulas manipuladas para foco e humor?',
  },
  {
    symbol: 'B12',
    name: 'Metilcobalamina',
    benefit: 'Formação celular, disposição diária e proteção neural',
    prompt:
      'Quais os níveis ideais de Vitamina B12 nos exames e quando a metilcobalamina manipulada é indicada?',
  },
  {
    symbol: 'C',
    name: 'Vitamina C & D3',
    benefit: 'Imunidade robusta, colágeno e defesa antioxidante',
    prompt:
      'Como otimizar Vitamina C e Vitamina D3 para imunidade e longevidade com base nas diretrizes atuais?',
  },
] as const;

const SIGNATURE_RECIPES_PREVIEW: Array<{
  slotKey: SiteMediaSlotKey;
  title: string;
  subtitle: string;
  defaultImage: string;
}> = [
  {
    slotKey: 'recipe_1',
    title: 'Bowl de Salmão & Quinoa',
    subtitle: 'Ômega-3 · 520 kcal · 39g proteína',
    defaultImage: RECIPE_IMAGES.salmao,
  },
  {
    slotKey: 'recipe_2',
    title: 'Overnight Oats de Chia',
    subtitle: 'Sem lactose · 365 kcal · 9,5g fibras',
    defaultImage: RECIPE_IMAGES.overnight,
  },
  {
    slotKey: 'recipe_3',
    title: 'Omelete de Ervas & Ricota',
    subtitle: 'Low carb · 310 kcal · 26g proteína',
    defaultImage: RECIPE_IMAGES.omelete,
  },
  {
    slotKey: 'recipe_4',
    title: 'Creme de Abóbora & Gengibre',
    subtitle: 'Funcional · 235 kcal · Sem glúten',
    defaultImage: RECIPE_IMAGES.abobora,
  },
];

export interface PublicVideoIntent {
  specialty: ClinicalSpecialty;
  chiefComplaint: string;
}

interface AuthGateProps {
  siteSettings?: SiteSettings;
  siteMedia?: Partial<Record<SiteMediaSlotKey, SiteMediaItem>>;
  onSelectSubscriptionIntent?: (specialty: ClinicalSpecialty) => void;
  onSelectVideoIntent?: (intent: PublicVideoIntent) => void;
  onOpenAdminPortal?: () => void;
}

export function AuthGate({
  siteSettings = DEFAULT_SITE_SETTINGS,
  siteMedia = {},
  onSelectSubscriptionIntent,
  onSelectVideoIntent,
  onOpenAdminPortal,
}: AuthGateProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publicChatOpen, setPublicChatOpen] = useState(false);
  const [publicChatMode, setPublicChatMode] = useState<ConsultationMode>('consulta');

  // Embedded Live AI Consultation state (works directly on the landing page)
  const [inlineMode, setInlineMode] = useState<ConsultationMode>('consulta');
  const [inlineMessages, setInlineMessages] = useState<InlineAiMessage[]>([]);
  const [inlineInput, setInlineInput] = useState('');
  const [inlineSending, setInlineSending] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineFollowUps, setInlineFollowUps] = useState<string[]>([]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const aiSectionRef = useRef<HTMLElement | null>(null);

  const specialistPhoto =
    siteMedia.specialist_avatar?.imageUrl || SPECIALIST_PROFILE.photoUrl;
  const heroFocalImage = siteMedia.hero?.imageUrl || specialistPhoto;
  const specialistVisual = specialistPhoto;
  const bannerImage =
    siteMedia.banner?.imageUrl || BOTANICAL_THEME_IMAGES.apothecaryVessel;
  const specialistWhatsappDisplay =
    siteSettings.whatsappContact || SPECIALIST_PROFILE.phoneDisplay;
  const specialistWhatsappHref = buildSpecialistWhatsAppUrl(
    undefined,
    specialistWhatsappDisplay
  );

  const formatMoney = (v: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(v);

  useEffect(() => {
    if (chatScrollRef.current && inlineMessages.length > 0) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [inlineMessages.length, inlineSending]);

  function openDimitraModal(mode: ConsultationMode = 'consulta') {
    setPublicChatMode(mode);
    setPublicChatOpen(true);
  }

  function askAiAboutCompound(prompt: string, mode: ConsultationMode = 'suplementacao') {
    setInlineMode(mode);
    aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    void handleSendInlineAi(prompt, mode);
  }

  async function handleGoogleLogin(options?: {
    specialtyIntent?: ClinicalSpecialty;
    videoIntent?: PublicVideoIntent;
  }) {
    setLoading(true);
    setErrorMsg(null);
    if (options?.videoIntent && onSelectVideoIntent) {
      onSelectVideoIntent(options.videoIntent);
    } else if (options?.specialtyIntent && onSelectSubscriptionIntent) {
      onSelectSubscriptionIntent(options.specialtyIntent);
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('popup-closed-by-user')) {
        setErrorMsg(
          'Login cancelado. Clique novamente para entrar com sua conta Google.'
        );
      } else {
        setErrorMsg(
          'Não foi possível autenticar no momento. Verifique se popups estão permitidos.'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSendInlineAi(
    customText?: string,
    overrideMode?: ConsultationMode
  ) {
    const text = (customText ?? inlineInput).trim();
    if (!text || inlineSending) return;
    const activeMode = overrideMode ?? inlineMode;

    const userMsg: InlineAiMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      sources: [],
    };

    const nextHistory: DimitraChatTurn[] = [
      ...inlineMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    setInlineMessages((prev) => [...prev, userMsg]);
    if (!customText) setInlineInput('');
    setInlineSending(true);
    setInlineError(null);

    try {
      const res = await sendDimitraConsultationMessage({
        messages: nextHistory,
        mode: activeMode,
      });

      setInlineMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          sources: res.sources || [],
          escalation: res.specialistEscalation || null,
        },
      ]);
      setInlineFollowUps(res.suggestedFollowUps || []);
    } catch (err) {
      setInlineError(
        err instanceof Error
          ? err.message
          : 'Não foi possível conectar ao atendimento de IA no momento.'
      );
    } finally {
      setInlineSending(false);
    }
  }

  function handleInlineKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendInlineAi();
    }
  }

  // Split headline into crisp white + botanical sage-lime accent like the attached reference
  const headlineWords = (siteSettings.heroTitle || DEFAULT_SITE_SETTINGS.heroTitle)
    .trim()
    .split(/\s+/);
  const splitPivot = Math.max(2, Math.ceil(headlineWords.length * 0.55));
  const headlinePrimary = headlineWords.slice(0, splitPivot).join(' ');
  const headlineAccent = headlineWords.slice(splitPivot).join(' ');

  return (
    <div className="min-h-screen bg-[#041210] text-[#F3FAF6] relative overflow-x-hidden">
      {/* Persistent Lush Emerald Spring Water Backdrop beneath frosted sea-glass panels */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <img
          src={BOTANICAL_THEME_IMAGES.springWaterBackdrop}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-40 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#041210]/70 via-[#061D1A]/75 to-[#041210]/92" />
      </div>

      {/* HERO WATERFALL STAGE (Full-bleed misty emerald forest waterfall inspired by reference) */}
      <div className="relative z-10 overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
        >
          <img
            src={BOTANICAL_THEME_IMAGES.heroWaterfall}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center brightness-[0.68] contrast-[1.05]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#041210]/92 via-[#051B18]/62 to-[#041210]/45" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#041210]/55 via-transparent to-[#041210]" />
        </div>

        {/* Floating Frosted Glass Capsule Top Bar — Strictly 3 Zones separated by gap-8 */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-8 pt-5">
          <header className="h-16 px-5 sm:px-7 rounded-full bg-[#071D1A]/62 backdrop-blur-xl border border-[#D4F0E0]/26 shadow-[0_12px_36px_-18px_rgba(0,0,0,0.75)] flex items-center justify-between gap-8">
            <a
              href="#inicio"
              className="inline-flex items-center gap-3 whitespace-nowrap shrink-0"
            >
              <VerbenaEmblem className="w-8 h-8 shrink-0" />
              <span className="font-display text-2xl tracking-[0.08em] font-semibold text-white leading-none">
                {siteSettings.brandName}
              </span>
            </a>

            <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#D6EDE0]">
              <a
                href="#bioativos"
                className="hover:text-[#B7DB74] transition-colors whitespace-nowrap shrink-0"
              >
                Bioativos
              </a>
              <a
                href="#atendimento-ia"
                className="text-[#C7E88B] hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Atendimento IA
              </a>
              <a
                href="#especialista"
                className="hover:text-[#B7DB74] transition-colors whitespace-nowrap shrink-0"
              >
                Dra. Dimitra
              </a>
              <a
                href="#assinatura"
                className="hover:text-[#B7DB74] transition-colors whitespace-nowrap shrink-0"
              >
                Plano 12 Meses
              </a>
              <a
                href="#acervo"
                className="hover:text-[#B7DB74] transition-colors whitespace-nowrap shrink-0"
              >
                Receitas
              </a>
            </nav>

            <button
              type="button"
              onClick={() => handleGoogleLogin()}
              disabled={loading}
              className="btn-botanical inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <span>{loading ? 'Conectando...' : 'Área do Assinante'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </header>
        </div>

        {/* Hero Main Composition: Left Botanical Typography | Center Apothecary Showcase | Right Vertical Glass Pillars */}
        <section
          id="inicio"
          className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 pt-12 pb-16 lg:pt-16 lg:pb-24"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Copy Column */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: MOTION_EASE }}
              className="lg:col-span-6 space-y-6"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-[#C7E88B]">
                <GraduationCap className="w-4 h-4 shrink-0 text-[#B7DB74]" />
                <span>{SPECIALIST_ACADEMIC_FORMATION}</span>
              </div>

              <h1 className="font-display text-5xl sm:text-6xl lg:text-[4.25rem] leading-[0.98] font-semibold tracking-[0.015em] text-balance">
                <span className="text-white">{headlinePrimary} </span>
                <span className="text-[#B7DB74]">{headlineAccent}</span>
              </h1>

              <BotanicalLeafDivider className="max-w-xs" />

              <p className="text-sm sm:text-base text-[#D4EAE0] leading-relaxed max-w-xl">
                {siteSettings.heroDescription}
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <a
                  href="#atendimento-ia"
                  className="btn-botanical inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-semibold whitespace-nowrap shrink-0"
                >
                  <span>Iniciar Atendimento IA</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    handleGoogleLogin({
                      videoIntent: {
                        specialty: 'metabolica_emagrecimento',
                        chiefComplaint:
                          'Consulta especializada por videochamada com a Dra. Dimitra Bratu.',
                      },
                    })
                  }
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-medium text-white border border-[#D4F0E0]/35 bg-[#08221F]/55 backdrop-blur-md hover:border-[#B7DB74] hover:bg-[#0F3631]/75 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Video className="w-4 h-4 text-[#B7DB74]" />
                  <span>Videochamada · Dra. Dimitra</span>
                </button>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="px-4 py-3 text-xs text-red-100 bg-red-950/75 border border-red-400/35 rounded-xl max-w-lg"
                >
                  {errorMsg}
                </div>
              )}

              {/* Direct Official Contact Line */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs text-[#C0DFCF] font-mono">
                <a
                  href={`mailto:${SPECIALIST_PROFILE.email}`}
                  className="inline-flex items-center gap-1.5 hover:text-[#B7DB74] transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[#B7DB74]" />
                  <span>{SPECIALIST_PROFILE.email}</span>
                </a>
                <a
                  href={specialistWhatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#DDF3B2] hover:text-white transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-[#B7DB74]" />
                  <span>WhatsApp {specialistWhatsappDisplay}</span>
                </a>
              </div>
            </motion.div>

            {/* Center Focal Portrait of Nutricionista Dra. Dimitra Bratu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.08, ease: MOTION_EASE }}
              className="lg:col-span-4"
            >
              <div className="relative rounded-3xl overflow-hidden border border-[#D4F0E0]/32 bg-[#071D1A]/70 shadow-[0_28px_60px_-20px_rgba(0,0,0,0.85)]">
                <img
                  src={heroFocalImage}
                  alt={
                    siteMedia.specialist_avatar?.altText ||
                    siteMedia.hero?.altText ||
                    'Nutricionista Dra. Dimitra Bratu em seu consultório'
                  }
                  referrerPolicy="no-referrer"
                  className="w-full aspect-[3/4] max-h-[470px] object-cover object-top"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#041210] via-[#041210]/20 to-transparent"
                />
                <div className="absolute bottom-0 inset-x-0 p-5 space-y-1.5">
                  <div className="text-[11px] font-medium text-[#C7E88B]">
                    Prescrição Clínica · Fórmulas Manipuladas
                  </div>
                  <div className="font-display text-2xl font-semibold text-white leading-tight">
                    {SPECIALIST_PROFILE.title}
                  </div>
                  <div className="text-xs text-[#C6E2D4]">
                    Universidade Gama Filho · Rio de Janeiro - RJ
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Vertical Frosted Glass Pillar Strip (mirrors USDA ORGANIC / PLANT POWERED / ZERO SUGAR column) */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.14, ease: MOTION_EASE }}
              className="lg:col-span-2"
            >
              <div className="glass-botanical rounded-3xl p-4 sm:p-5 grid grid-cols-3 lg:grid-cols-1 gap-4 lg:gap-0 lg:divide-y divide-[#D4F0E0]/18 text-center">
                <a
                  href="#atendimento-ia"
                  className="group flex flex-col items-center justify-center py-2 lg:py-4 gap-2 transition-colors"
                >
                  <div className="w-11 h-11 rounded-full border border-[#D4F0E0]/35 bg-[#0A2B26]/65 flex items-center justify-center group-hover:border-[#B7DB74] transition-colors">
                    <Microscope className="w-5 h-5 text-[#C7E88B]" />
                  </div>
                  <div className="font-display text-sm font-semibold tracking-wider text-white">
                    IA CIENTÍFICA
                  </div>
                  <div className="text-[11px] text-[#B4D6C5]">
                    Atendimento 24h
                  </div>
                </a>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    handleGoogleLogin({
                      videoIntent: {
                        specialty: 'metabolica_emagrecimento',
                        chiefComplaint:
                          'Videochamada especializada com a Dra. Dimitra Bratu.',
                      },
                    })
                  }
                  className="group flex flex-col items-center justify-center py-2 lg:py-4 gap-2 transition-colors cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-full border border-[#D4F0E0]/35 bg-[#0A2B26]/65 flex items-center justify-center group-hover:border-[#B7DB74] transition-colors">
                    <Video className="w-5 h-5 text-[#C7E88B]" />
                  </div>
                  <div className="font-display text-sm font-semibold tracking-wider text-white">
                    VIDEOCHAMADA
                  </div>
                  <div className="text-[11px] text-[#B4D6C5]">
                    Dra. Dimitra
                  </div>
                </button>

                <a
                  href="#assinatura"
                  className="group flex flex-col items-center justify-center py-2 lg:py-4 gap-2 transition-colors"
                >
                  <div className="w-11 h-11 rounded-full border border-[#D4F0E0]/35 bg-[#0A2B26]/65 flex items-center justify-center group-hover:border-[#B7DB74] transition-colors">
                    <FlaskConical className="w-5 h-5 text-[#C7E88B]" />
                  </div>
                  <div className="font-display text-sm font-semibold tracking-wider text-white">
                    MANIPULADOS
                  </div>
                  <div className="text-[11px] text-[#B4D6C5]">
                    Plano 12 Meses
                  </div>
                </a>
              </div>
            </motion.div>
          </div>
        </section>
      </div>

      {/* SECTION 1: "EXTRAÍDO DA NATUREZA · BIOATIVOS CLÍNICOS" (Mirrors SOURCED FROM NATURE 5-Column Frosted Strip) */}
      <section
        id="bioativos"
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 -mt-6 pb-10"
      >
        <SpotlightCard glowRim className="rounded-3xl p-6 sm:p-8">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-7">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-[0.06em] text-white">
              EXTRAÍDO DA NATUREZA · BIOATIVOS CLÍNICOS
            </h2>
            <BotanicalLeafDivider className="max-w-md mx-auto" />
            <p className="text-xs text-[#B6D7C6]">
              Clique em qualquer bioativo para consultar evidências científicas
              imediatamente na IA Nutricional
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 lg:divide-x divide-[#D4F0E0]/18">
            {BOTANICAL_BIOACTIVES.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => askAiAboutCompound(item.prompt, 'suplementacao')}
                className="group px-4 py-4 flex flex-col items-center text-center gap-2.5 hover:bg-[#14453E]/40 transition-colors rounded-xl lg:rounded-none cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full vitamin-ring flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Leaf className="w-5 h-5 text-[#C7E88B]" />
                </div>
                <div className="font-display text-lg font-semibold tracking-wide text-white group-hover:text-[#B7DB74] transition-colors">
                  {item.name}
                </div>
                <p className="text-xs text-[#BDDAC9] leading-relaxed">
                  {item.summary}
                </p>
              </button>
            ))}
          </div>
        </SpotlightCard>
      </section>

      {/* SECTION 2: 3 FROSTED GLASS CARE PILLARS (Mirrors NATURAL ENERGY / CLEAN INGREDIENTS / MIND & BODY BALANCE) */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <SpotlightCard className="rounded-3xl p-6 flex flex-col justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full border border-[#D4F0E0]/35 bg-[#0C332D]/70 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-[#C7E88B]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-2xl font-semibold tracking-wide text-white leading-none">
                  ATENDIMENTO IA 24H
                </h3>
                <p className="text-xs text-[#C2DED0] leading-relaxed">
                  Orientação nutricional instantânea no site com busca ativa em
                  PubMed, Cochrane, ESPEN, ISSN e SBD.
                </p>
              </div>
            </div>
            <a
              href="#atendimento-ia"
              className="w-full py-2.5 px-4 rounded-full border border-[#D4F0E0]/30 bg-[#0A2925]/55 hover:border-[#B7DB74] hover:bg-[#13423B]/70 text-center text-xs font-semibold tracking-wider text-white transition-colors"
            >
              CONVERSAR AGORA
            </a>
          </SpotlightCard>

          <SpotlightCard className="rounded-3xl p-6 flex flex-col justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full border border-[#D4F0E0]/35 bg-[#0C332D]/70 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#C7E88B]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-2xl font-semibold tracking-wide text-white leading-none">
                  FÓRMULAS LIMPAS
                </h3>
                <p className="text-xs text-[#C2DED0] leading-relaxed">
                  Vitaminas manipuladas sob medida para farmácia de manipulação,
                  ajustadas aos seus exames e objetivos.
                </p>
              </div>
            </div>
            <a
              href="#assinatura"
              className="w-full py-2.5 px-4 rounded-full border border-[#D4F0E0]/30 bg-[#0A2925]/55 hover:border-[#B7DB74] hover:bg-[#13423B]/70 text-center text-xs font-semibold tracking-wider text-white transition-colors"
            >
              VER ESPECIALIDADES
            </a>
          </SpotlightCard>

          <SpotlightCard className="rounded-3xl p-6 flex flex-col justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full border border-[#D4F0E0]/35 bg-[#0C332D]/70 flex items-center justify-center shrink-0">
                <Video className="w-5 h-5 text-[#C7E88B]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-2xl font-semibold tracking-wide text-white leading-none">
                  EQUILÍBRIO & VÍDEO
                </h3>
                <p className="text-xs text-[#C2DED0] leading-relaxed">
                  Para casos aprofundados, atendimento direto por videochamada
                  com a Nutricionista Dra. Dimitra Bratu.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                handleGoogleLogin({
                  videoIntent: {
                    specialty: 'metabolica_emagrecimento',
                    chiefComplaint:
                      'Consulta especializada por videochamada com a Dra. Dimitra Bratu.',
                  },
                })
              }
              className="w-full py-2.5 px-4 rounded-full border border-[#D4F0E0]/30 bg-[#0A2925]/55 hover:border-[#B7DB74] hover:bg-[#13423B]/70 text-center text-xs font-semibold tracking-wider text-white transition-colors cursor-pointer"
            >
              AGENDAR VIDEOCHAMADA
            </button>
          </SpotlightCard>
        </div>
      </section>

      {/* SECTION 3: "VITAMINAS ESSENCIAIS. PRESCRIÇÃO NATURAL." (Mirrors B3 / B6 / B12 / C Circular Emblem Showcase) */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-6">
        <SpotlightCard glowRim className="rounded-3xl p-6 sm:p-9">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-4 space-y-4">
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-wide text-white leading-[1.06]">
                VITAMINAS ESSENCIAIS.{' '}
                <span className="text-[#B7DB74]">PRESCRIÇÃO NATURAL.</span>
              </h2>
              <BotanicalLeafDivider className="max-w-[200px]" />
              <p className="text-xs sm:text-sm text-[#C4E1D2] leading-relaxed">
                Cada organismo exige dosagens próprias. Nossa prescrição
                magistral combina micronutrientes em formas ativas para energia,
                imunidade, sono e metabolismo equilibrado.
              </p>
              <a
                href="#assinatura"
                className="btn-botanical inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold tracking-wider whitespace-nowrap"
              >
                <span>VER PLANO DE MANIPULADOS</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="lg:col-span-8 rounded-2xl bg-[#07211D]/62 border border-[#D4F0E0]/20 p-5 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                {ESSENTIAL_VITAMINS.map((vit) => (
                  <button
                    key={vit.symbol}
                    type="button"
                    onClick={() => askAiAboutCompound(vit.prompt, 'suplementacao')}
                    className="group flex flex-col items-center text-center gap-2.5 p-2 rounded-2xl hover:bg-[#13423B]/45 transition-colors cursor-pointer"
                  >
                    <div className="w-16 h-16 rounded-full vitamin-ring flex items-center justify-center group-hover:border-[#B7DB74] transition-colors">
                      <span className="font-display text-2xl font-semibold text-white group-hover:text-[#DDF3B2]">
                        {vit.symbol}
                      </span>
                    </div>
                    <div className="font-display text-base font-semibold tracking-wide text-[#E7F6EC]">
                      {vit.name}
                    </div>
                    <p className="text-[11px] text-[#AED2C0] leading-relaxed">
                      {vit.benefit}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SpotlightCard>
      </section>

      <GoldHorizonDivider className="max-w-7xl mx-auto my-8 opacity-75" />

      {/* SECTION 4: LIVE EMBEDDED AI CONSULTATION RIGHT ON THE WEBSITE */}
      <section
        id="atendimento-ia"
        ref={aiSectionRef}
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-10 lg:py-14 space-y-8"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold text-[#B7DB74]">
              01. Atendimento Inteligente no Site
            </p>
            <h2 className="font-display text-4xl sm:text-5xl font-semibold text-white leading-[1.04]">
              Converse agora com a{' '}
              <span className="text-[#B7DB74]">IA Nutricional</span>
            </h2>
            <p className="text-sm text-[#C2DED0] leading-relaxed">
              Faça perguntas sobre alimentação, substituições, suplementos ou
              rotina agora mesmo. Quando a IA identificar que seu caso exige
              atenção mais especializada, ela encaminha você direto para{' '}
              <strong className="text-white">
                videochamada com a Nutricionista Dra. Dimitra Bratu
              </strong>
              .
            </p>
          </div>

          <button
            type="button"
            onClick={() => openDimitraModal(inlineMode)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium text-[#DDF3B2] border border-[#D4F0E0]/30 bg-[#082420]/70 hover:border-[#B7DB74] hover:bg-[#113A34] transition-colors cursor-pointer whitespace-nowrap self-start lg:self-auto"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Expandir janela do chat</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Interactive Embedded AI Chat Window */}
          <SpotlightCard
            glowRim
            className="lg:col-span-8 rounded-3xl flex flex-col min-h-[540px] max-h-[680px]"
          >
            {/* Mode Switcher Bar */}
            <div className="px-5 py-4 border-b border-[#D4F0E0]/18 bg-[#061A17]/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(CONSULTATION_MODE_LABELS) as ConsultationMode[]).map(
                  (mKey) => {
                    const active = inlineMode === mKey;
                    return (
                      <button
                        key={mKey}
                        type="button"
                        onClick={() => setInlineMode(mKey)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'btn-botanical font-semibold'
                            : 'text-[#C2DED0] bg-[#0A2925]/80 border border-[#D4F0E0]/20 hover:border-[#B7DB74]/60 hover:text-white'
                        }`}
                      >
                        {CONSULTATION_MODE_LABELS[mKey]}
                      </button>
                    );
                  }
                )}
              </div>

              {inlineMessages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setInlineMessages([]);
                    setInlineFollowUps([]);
                    setInlineError(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#9DC3B0] hover:text-white cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reiniciar</span>
                </button>
              )}
            </div>

            {/* Messages Stream */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5"
            >
              {inlineMessages.length === 0 ? (
                <div className="space-y-5">
                  <div className="p-5 rounded-2xl bg-[#08221F]/80 border border-[#D4F0E0]/20 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#C7E88B]">
                      <Sparkles className="w-3.5 h-3.5 text-[#B7DB74]" />
                      <span>
                        Consultório Digital · Dra. Dimitra Bratu (Gama Filho — RJ)
                      </span>
                    </div>
                    <p className="font-display text-2xl font-semibold text-white">
                      Como posso ajudar sua alimentação e saúde hoje?
                    </p>
                    <p className="text-xs sm:text-sm text-[#C2DED0] leading-relaxed">
                      Escolha uma pergunta rápida abaixo ou escreva sua dúvida.
                      Consulto evidências científicas atualizadas em tempo real e,
                      se o seu caso pedir avaliação clínica, exames ou vitaminas
                      manipuladas, preparo seu encaminhamento para videochamada
                      direta com a Dra. Dimitra Bratu.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {QUICK_AI_PROMPTS[inlineMode].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        disabled={inlineSending}
                        onClick={() => handleSendInlineAi(prompt)}
                        className="group text-left p-4 rounded-xl bg-[#07201C]/80 border border-[#D4F0E0]/18 hover:border-[#B7DB74]/60 hover:bg-[#0D322D] transition-all cursor-pointer flex items-start justify-between gap-3"
                      >
                        <span className="text-xs text-[#E1F3E9] leading-relaxed group-hover:text-white">
                          {prompt}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#B7DB74] shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                inlineMessages.map((msg) =>
                  msg.role === 'user' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 bg-gradient-to-br from-[#2B5228] to-[#1A3B27] border border-[#B7DB74]/40 text-white text-sm leading-relaxed">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#DDF3B2] mb-1">
                          <UserRound className="w-3 h-3" />
                          <span>Você</span>
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="space-y-3">
                      <div className="max-w-[96%] sm:max-w-[90%] rounded-2xl rounded-tl-sm p-5 bg-[#08221E]/90 border border-[#D4F0E0]/22 space-y-4">
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#D4F0E0]/14 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={specialistPhoto}
                              alt="Nutricionista Dra. Dimitra Bratu"
                              referrerPolicy="no-referrer"
                              className="w-6 h-6 rounded-full object-cover object-top border border-[#B7DB74]/60 shrink-0"
                            />
                            <span className="font-display text-sm font-semibold text-[#C7E88B]">
                              IA Clínica · Dra. Dimitra Bratu
                            </span>
                            <span className="text-[#8DB5A2] hidden sm:inline">
                              · Universidade Gama Filho (RJ)
                            </span>
                          </div>
                        </div>

                        <FormattedClinicalMarkdown content={msg.content} />

                        {msg.sources.length > 0 && (
                          <div className="pt-3 border-t border-[#D4F0E0]/16 space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#C7E88B]">
                              <Globe className="w-3.5 h-3.5" />
                              <span>
                                Evidências científicas consultadas (
                                {msg.sources.length})
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {msg.sources.slice(0, 4).map((src, idx) => (
                                <a
                                  key={`${src.uri}-${idx}`}
                                  href={src.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group flex items-start justify-between gap-2 p-2.5 rounded-lg bg-[#051614] border border-[#D4F0E0]/16 hover:border-[#B7DB74]/55 transition-colors"
                                >
                                  <div className="min-w-0">
                                    <div className="text-[11px] font-medium text-white group-hover:text-[#DDF3B2] line-clamp-1">
                                      {src.title}
                                    </div>
                                    <div className="text-[10px] font-mono text-[#8DB5A2] truncate">
                                      {src.domain}
                                    </div>
                                  </div>
                                  <ExternalLink className="w-3 h-3 text-[#8DB5A2] group-hover:text-[#DDF3B2] shrink-0 mt-0.5" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Smart Escalation Banner when the AI detects a specialized case */}
                      {msg.escalation?.needsSpecialistVideo && (
                        <div className="max-w-[96%] sm:max-w-[90%] rounded-2xl p-5 bg-gradient-to-br from-[#164232]/95 via-[#0C2C26]/95 to-[#061A17] border border-[#B7DB74]/50 shadow-[0_14px_34px_-14px_rgba(0,0,0,0.75)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[#DDF3B2]">
                              <Video className="w-4 h-4 text-[#B7DB74]" />
                              <span>
                                Encaminhamento Especializado · Videochamada com
                                Dra. Dimitra Bratu
                              </span>
                            </div>
                            <p className="text-xs text-[#E1F3E9] leading-relaxed">
                              {msg.escalation.reason ||
                                'Seu caso se beneficia de avaliação individualizada por videochamada com a Nutricionista Dra. Dimitra Bratu.'}
                            </p>
                            <div className="text-[11px] text-[#A8CCB9]">
                              Especialidade indicada:{' '}
                              <span className="text-white font-medium">
                                {SPECIALTY_LABELS[msg.escalation.specialty]}
                              </span>{' '}
                              · Universidade Gama Filho (RJ)
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <a
                              href={specialistWhatsappHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-medium text-[#DDF3B2] border border-[#D4F0E0]/30 hover:border-[#B7DB74] hover:bg-[#13423B]/70 transition-colors whitespace-nowrap"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                handleGoogleLogin({
                                  videoIntent: {
                                    specialty: msg.escalation!.specialty,
                                    chiefComplaint:
                                      msg.escalation!.reason ||
                                      'Encaminhamento da triagem IA para consulta especializada por videochamada.',
                                  },
                                })
                              }
                              className="btn-botanical inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Agendar Videochamada</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )
              )}

              {inlineSending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-sm px-5 py-4 bg-[#08221E] border border-[#D4F0E0]/24 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-[#B7DB74] shrink-0" />
                    <span className="text-xs text-[#D1E8DC]">
                      Consultando literatura científica e formulando sua
                      orientação nutricional...
                    </span>
                  </div>
                </div>
              )}

              {!inlineSending &&
                inlineFollowUps.length > 0 &&
                inlineMessages.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {inlineFollowUps.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleSendInlineAi(q)}
                        className="text-left text-xs px-3.5 py-2 rounded-full bg-[#08221E] border border-[#D4F0E0]/26 text-[#DDF3B2] hover:border-[#B7DB74] hover:bg-[#103831] transition-colors cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

              {inlineError && (
                <div
                  role="alert"
                  className="px-4 py-3 text-xs text-red-100 bg-red-950/75 border border-red-400/35 rounded-xl"
                >
                  {inlineError}
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendInlineAi();
              }}
              className="p-4 border-t border-[#D4F0E0]/18 bg-[#051715]/90 flex items-end gap-3"
            >
              <textarea
                rows={2}
                value={inlineInput}
                onChange={(e) => setInlineInput(e.target.value)}
                onKeyDown={handleInlineKeyDown}
                maxLength={4000}
                disabled={inlineSending}
                placeholder="Digite sua dúvida nutricional, sintomas ou objetivo para receber orientação imediata da IA..."
                className="flex-1 px-4 py-3 text-sm bg-[#041210] text-white placeholder-[#7AA38F] border border-[#D4F0E0]/24 rounded-xl focus:outline-none focus:border-[#B7DB74] resize-none leading-relaxed"
              />
              <button
                type="submit"
                disabled={inlineSending || inlineInput.trim().length < 2}
                className="btn-botanical h-11 px-5 rounded-full inline-flex items-center gap-2 text-xs font-semibold cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0"
              >
                {inlineSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Enviar</span>
              </button>
            </form>
          </SpotlightCard>

          {/* Right Column: Two-Tier Care Architecture & Official Dra. Dimitra Contacts */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            <SpotlightCard className="p-6 space-y-5 flex-1">
              <div className="text-xs font-semibold text-[#B7DB74]">
                Atendimento em 2 Níveis
              </div>

              <div className="space-y-4">
                <div className="pb-4 border-b border-[#D4F0E0]/16 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Sparkles className="w-4 h-4 text-[#B7DB74] shrink-0" />
                    <span>01. IA Clínica Direto no Site</span>
                  </div>
                  <p className="text-xs text-[#BDD9CA] leading-relaxed">
                    Dúvidas do dia a dia, substituições alimentares, orientações
                    de pré/pós-treino e síntese científica instantânea (PubMed,
                    Cochrane, ESPEN, ISSN, SBD).
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Video className="w-4 h-4 text-[#B7DB74] shrink-0" />
                    <span>02. Especialista Dra. Dimitra Bratu</span>
                  </div>
                  <p className="text-xs text-[#BDD9CA] leading-relaxed">
                    Para casos mais especializados — exames laboratoriais,
                    prescrição de vitaminas manipuladas, condições metabólicas,
                    hormonais ou intestinais — você é atendido por{' '}
                    <strong className="text-white">
                      videochamada individual
                    </strong>{' '}
                    com a própria Dra. Dimitra Bratu.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#D4F0E0]/16 space-y-2 text-xs text-[#D1E8DC]">
                <div className="font-medium text-[#C7E88B]">
                  {SPECIALIST_PROFILE.title}
                </div>
                <div>{SPECIALIST_PROFILE.formation}</div>
                <div className="flex flex-col gap-1.5 pt-1 text-[11px] font-mono">
                  <a
                    href={`mailto:${SPECIALIST_PROFILE.email}`}
                    className="inline-flex items-center gap-2 text-[#E1F3E9] hover:text-[#B7DB74] transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#B7DB74] shrink-0" />
                    <span>{SPECIALIST_PROFILE.email}</span>
                  </a>
                  <a
                    href={specialistWhatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#E1F3E9] hover:text-[#B7DB74] transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#B7DB74] shrink-0" />
                    <span>Celular / WhatsApp: {specialistWhatsappDisplay}</span>
                  </a>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    handleGoogleLogin({
                      videoIntent: {
                        specialty: 'metabolica_emagrecimento',
                        chiefComplaint:
                          'Desejo atendimento especializado por videochamada com a Dra. Dimitra Bratu.',
                      },
                    })
                  }
                  className="btn-botanical w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <Video className="w-4 h-4" />
                  <span>Agendar Videochamada Especializada</span>
                </button>
                <button
                  type="button"
                  onClick={() => openDimitraModal('consulta')}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium text-white border border-[#D4F0E0]/28 bg-[#0A2925]/60 hover:border-[#B7DB74] hover:bg-[#113A34] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#B7DB74]" />
                  <span>Abrir Chat em Tela Cheia</span>
                </button>
              </div>
            </SpotlightCard>
          </div>
        </div>
      </section>

      <GoldHorizonDivider className="max-w-7xl mx-auto opacity-75" />

      {/* SECTION 5: DRA. DIMITRA BRATU CREDENTIALS & VIDEO CONSULTATION */}
      <section
        id="especialista"
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-14 lg:py-16"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5 rounded-3xl overflow-hidden border border-[#D4F0E0]/28 bg-[#071F1C] relative min-h-[380px]">
            <img
              src={specialistVisual}
              alt={
                siteMedia.specialist_avatar?.altText ||
                'Nutricionista Dra. Dimitra Bratu — Universidade Gama Filho, Rio de Janeiro'
              }
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-top brightness-95"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#041210] via-[#041210]/30 to-transparent"
            />
            <div className="absolute bottom-0 inset-x-0 p-6">
              <div className="text-xs text-[#C7E88B] font-medium">
                Universidade Gama Filho · Rio de Janeiro - RJ
              </div>
              <div className="font-display text-3xl font-semibold text-white mt-0.5">
                Dra. Dimitra Bratu
              </div>
              <div className="text-xs text-[#D1E8DC] mt-1">
                Nutrição Clínica · Vitaminas Manipuladas · Videochamada
              </div>
            </div>
          </div>

          <SpotlightCard className="lg:col-span-7 rounded-3xl p-7 sm:p-9 flex flex-col justify-center space-y-5">
            <p className="text-xs font-semibold text-[#B7DB74]">
              02. Especialista Responsável
            </p>
            <h2 className="font-display text-4xl sm:text-5xl font-semibold text-white leading-[1.05] text-balance">
              {siteSettings.methodTitle}
            </h2>
            <p className="text-sm sm:text-base text-[#C2DED0] leading-relaxed">
              {siteSettings.methodDescription}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-2xl bg-[#07211D]/75 border border-[#D4F0E0]/20 space-y-1">
                <div className="text-xs font-semibold text-[#C7E88B]">
                  Formação Acadêmica
                </div>
                <div className="text-sm font-medium text-white">
                  Universidade Gama Filho
                </div>
                <div className="text-xs text-[#9EC2B0]">
                  Rio de Janeiro — RJ · Nutrição Clínica e Prescrição Magistral
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-[#07211D]/75 border border-[#D4F0E0]/20 space-y-1">
                <div className="text-xs font-semibold text-[#C7E88B]">
                  Atendimento por Videochamada
                </div>
                <div className="text-sm font-medium text-white">
                  Sala Exclusiva Integrada
                </div>
                <div className="text-xs text-[#9EC2B0]">
                  Avaliação de exames, sintomas e emissão direta das fórmulas
                  manipuladas
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  handleGoogleLogin({
                    videoIntent: {
                      specialty: 'imunidade_longevidade',
                      chiefComplaint:
                        'Atendimento especializado por videochamada com a Nutricionista Dra. Dimitra Bratu.',
                    },
                  })
                }
                className="btn-botanical inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Video className="w-4 h-4" />
                <span>Reservar Videochamada</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <a
                href={specialistWhatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-xs font-medium text-white border border-[#D4F0E0]/30 hover:border-[#B7DB74] hover:bg-[#113A34] transition-colors whitespace-nowrap"
              >
                <Phone className="w-3.5 h-3.5 text-[#B7DB74]" />
                <span>WhatsApp {specialistWhatsappDisplay}</span>
              </a>
              <a
                href={`mailto:${SPECIALIST_PROFILE.email}`}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-full text-xs font-medium text-[#D1E8DC] hover:text-white transition-colors whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5 text-[#B7DB74]" />
                <span>{SPECIALIST_PROFILE.email}</span>
              </a>
            </div>
          </SpotlightCard>
        </div>
      </section>

      <GoldHorizonDivider className="max-w-7xl mx-auto opacity-75" />

      {/* SECTION 6: 12-MONTH SUBSCRIPTION & SPECIALTIES FOR MANIPULATED VITAMINS */}
      <section
        id="assinatura"
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-14 lg:py-16 space-y-9"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold text-[#B7DB74]">
              03. Assinatura Anual · 12 Meses
            </p>
            <h2 className="font-display text-4xl sm:text-5xl font-semibold text-white leading-[1.05]">
              Escolha Sua Especialidade para{' '}
              <span className="text-[#B7DB74]">Vitaminas Manipuladas</span>
            </h2>
            <p className="text-sm text-[#C2DED0] leading-relaxed">
              Acompanhamento de <strong className="text-white">12 meses</strong>{' '}
              com videochamada exclusiva com a Dra. Dimitra Bratu (Universidade
              Gama Filho — RJ), fórmulas manipuladas para farmácia de manipulação
              e receitas terapêuticas.
            </p>
          </div>

          <SpotlightCard className="p-5 rounded-2xl shrink-0 lg:min-w-[300px]">
            <div className="text-xs text-[#C7E88B] font-semibold">
              {siteSettings.annualPlanHeadline}
            </div>
            <div className="font-display text-4xl font-semibold text-white mt-1 tabular-nums">
              12x de {formatMoney(siteSettings.annualCardInstallmentBrl)}
            </div>
            <div className="text-xs text-[#A5CAB7] mt-0.5 tabular-nums">
              ou {formatMoney(siteSettings.annualPixTotalBrl)} à vista no PIX (
              {siteSettings.annualPixDiscountLabel || '10% OFF'})
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#D1E8DC] mt-3 pt-3 border-t border-[#D4F0E0]/18">
              <span className="inline-flex items-center gap-1">
                <Video className="w-3.5 h-3.5 text-[#B7DB74]" /> Videochamada
              </span>
              <span className="inline-flex items-center gap-1">
                <FlaskConical className="w-3.5 h-3.5 text-[#B7DB74]" />{' '}
                Manipulados
              </span>
              <span className="inline-flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-[#B7DB74]" /> 12 Meses
              </span>
            </div>
          </SpotlightCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CLINICAL_SPECIALTIES.map((spec) => (
            <button
              key={spec.id}
              type="button"
              disabled={loading}
              onClick={() => handleGoogleLogin({ specialtyIntent: spec.id })}
              className="group text-left glass-botanical rounded-2xl p-6 hover:border-[#B7DB74]/70 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <span className="inline-block text-xs font-medium text-[#C7E88B]">
                  {spec.focusTag}
                </span>
                <h3 className="font-display text-2xl font-semibold text-white group-hover:text-[#DDF3B2] leading-snug transition-colors">
                  {spec.title}
                </h3>
                <p className="text-xs text-[#BAD8C8] leading-relaxed">
                  {spec.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[#D4F0E0]/16 flex items-center justify-between gap-3">
                <span className="text-[11px] font-mono text-[#D1E8DC] truncate">
                  {spec.keyActives}
                </span>
                <span className="w-8 h-8 rounded-full btn-botanical flex items-center justify-center shrink-0">
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 7: SIGNATURE RECIPES GALLERY */}
      <section
        id="acervo"
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-10"
      >
        <div className="flex items-end justify-between gap-4 mb-7">
          <div>
            <p className="text-xs font-semibold text-[#B7DB74] mb-1">
              04. Acervo Terapêutico
            </p>
            <h2 className="font-display text-4xl font-semibold text-white">
              Receitas Clínicas Assinadas
            </h2>
          </div>
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            className="text-xs font-medium text-[#DDF3B2] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Ver biblioteca completa →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SIGNATURE_RECIPES_PREVIEW.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => handleGoogleLogin()}
              className="group text-left glass-botanical rounded-2xl overflow-hidden hover:border-[#B7DB74]/65 transition-all duration-200 cursor-pointer flex flex-col"
            >
              <div className="relative overflow-hidden">
                <img
                  src={siteMedia[item.slotKey]?.imageUrl || item.defaultImage}
                  alt={siteMedia[item.slotKey]?.altText || item.title}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-[4/3] object-cover brightness-90 group-hover:scale-105 transition-transform duration-500"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#041210] via-transparent to-transparent"
                />
              </div>
              <div className="p-4 flex items-end justify-between gap-3 flex-1">
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-semibold text-white leading-snug truncate">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#A5CAB7] mt-0.5 truncate">
                    {item.subtitle}
                  </p>
                </div>
                <span className="w-8 h-8 rounded-full btn-botanical flex items-center justify-center shrink-0">
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Video Consultation Banner */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 pt-8 pb-10">
        <SpotlightCard glowRim className="rounded-3xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8 p-7 sm:p-10">
            <div className="lg:col-span-4 space-y-1.5">
              <div className="text-xs font-medium text-[#C7E88B]">
                Atendimento Especializado
              </div>
              <h2 className="font-display text-4xl font-semibold text-white leading-[1.05]">
                {siteSettings.bannerTitle}
              </h2>
            </div>
            <div className="lg:col-span-5 space-y-4">
              <p className="text-sm text-[#D1E8DC] leading-relaxed">
                {siteSettings.bannerDescription}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    handleGoogleLogin({
                      videoIntent: {
                        specialty: 'metabolica_emagrecimento',
                        chiefComplaint:
                          'Consulta clínica por videochamada com a Dra. Dimitra Bratu.',
                      },
                    })
                  }
                  className="btn-botanical inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Agendar Videochamada</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => openDimitraModal('suplementacao')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-xs font-medium text-white border border-[#D4F0E0]/30 hover:border-[#B7DB74] hover:bg-[#113A34] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Tirar dúvida na IA
                </button>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="rounded-2xl overflow-hidden border border-[#D4F0E0]/26">
                <img
                  src={bannerImage}
                  alt={
                    siteMedia.banner?.altText ||
                    'Tratamento nutricional clínico individualizado'
                  }
                  referrerPolicy="no-referrer"
                  className="w-full h-36 object-cover brightness-90"
                />
              </div>
            </div>
          </div>
        </SpotlightCard>
      </section>

      {/* Bottom 4-Icon Botanical Strip (mirrors SUSTAINABLE SOURCING / ECO FRIENDLY / GIVING BACK / PURIFIED WATER) */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-8 border-t border-[#D4F0E0]/18">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <Sprout className="w-6 h-6 text-[#C7E88B] shrink-0" />
            <div className="font-display text-sm font-semibold tracking-wider text-white leading-tight">
              ATIVOS NATURAIS &amp; BIOATIVOS
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Globe className="w-6 h-6 text-[#C7E88B] shrink-0" />
            <div className="font-display text-sm font-semibold tracking-wider text-white leading-tight">
              EVIDÊNCIA PUBMED &amp; COCHRANE
            </div>
          </div>
          <div className="flex items-center gap-3">
            <HeartHandshake className="w-6 h-6 text-[#C7E88B] shrink-0" />
            <div className="font-display text-sm font-semibold tracking-wider text-white leading-tight">
              CUIDADO DIRETO DRA. DIMITRA
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Droplets className="w-6 h-6 text-[#C7E88B] shrink-0" />
            <div className="font-display text-sm font-semibold tracking-wider text-white leading-tight">
              MANIPULAÇÃO SOB MEDIDA
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-7 border-t border-[#D4F0E0]/14 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9CC2AF]">
        <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-start">
          <VerbenaEmblem className="w-6 h-6 shrink-0" />
          <span className="font-display text-base font-semibold text-white">
            {siteSettings.brandName}
          </span>
          <span aria-hidden="true">·</span>
          <span>Universidade Gama Filho (RJ)</span>
        </div>
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4 font-mono">
          <a
            href={`mailto:${SPECIALIST_PROFILE.email}`}
            className="hover:text-[#DDF3B2] transition-colors"
          >
            {SPECIALIST_PROFILE.email}
          </a>
          <a
            href={specialistWhatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#DDF3B2] hover:text-white transition-colors"
          >
            WhatsApp: {specialistWhatsappDisplay}
          </a>
          {siteSettings.instagramHandle && (
            <span>{siteSettings.instagramHandle}</span>
          )}
          <a
            href="/admin"
            onClick={(e) => {
              if (onOpenAdminPortal) {
                e.preventDefault();
                onOpenAdminPortal();
              }
            }}
            className="inline-flex items-center gap-1.5 text-[#8DB5A2] hover:text-[#DDF3B2] transition-colors font-sans pl-2 border-l border-[#D4F0E0]/20"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#B7DB74]" />
            <span>Portal Administrativo</span>
          </a>
        </div>
      </footer>

      <PublicDimitraModal
        open={publicChatOpen}
        initialMode={publicChatMode}
        specialistAvatarUrl={specialistPhoto}
        onClose={() => setPublicChatOpen(false)}
        onRequestSpecialistVideo={(intent) => {
          setPublicChatOpen(false);
          void handleGoogleLogin({ videoIntent: intent });
        }}
      />
    </div>
  );
}
