import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Crown,
  FileText,
  FlaskConical,
  MessageCircleHeart,
  Microscope,
  Video,
} from 'lucide-react';
import { RECIPE_IMAGES } from '../data/seedData';
import { auth, googleProvider } from '../lib/firebase';
import {
  CLINICAL_SPECIALTIES,
  ClinicalSpecialty,
  ConsultationMode,
  DEFAULT_SITE_SETTINGS,
  SiteMediaItem,
  SiteMediaSlotKey,
  SiteSettings,
} from '../types';
import {
  GoldHorizonDivider,
  MOTION_EASE,
  SpotlightCard,
  VerbenaEmblem,
} from './LuxuryPrimitives';
import { PublicDimitraModal } from './PublicDimitraModal';

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

interface AuthGateProps {
  siteSettings?: SiteSettings;
  siteMedia?: Partial<Record<SiteMediaSlotKey, SiteMediaItem>>;
  onSelectSubscriptionIntent?: (specialty: ClinicalSpecialty) => void;
}

export function AuthGate({
  siteSettings = DEFAULT_SITE_SETTINGS,
  siteMedia = {},
  onSelectSubscriptionIntent,
}: AuthGateProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publicChatOpen, setPublicChatOpen] = useState(false);
  const [publicChatMode, setPublicChatMode] = useState<ConsultationMode>('consulta');

  const heroImage = siteMedia.hero?.imageUrl || RECIPE_IMAGES.salmao;
  const methodImage = siteMedia.method?.imageUrl || RECIPE_IMAGES.frango;
  const bannerImage = siteMedia.banner?.imageUrl || RECIPE_IMAGES.abobora;

  const formatMoney = (v: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(v);

  function openDimitraChat(mode: ConsultationMode = 'consulta') {
    setPublicChatMode(mode);
    setPublicChatOpen(true);
  }

  async function handleGoogleLogin(specialtyIntent?: ClinicalSpecialty) {
    setLoading(true);
    setErrorMsg(null);
    if (specialtyIntent && onSelectSubscriptionIntent) {
      onSelectSubscriptionIntent(specialtyIntent);
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

  return (
    <div className="min-h-screen bg-[#0B0907] text-[#F5EFE6] relative overflow-x-hidden">
      {/* Subtle atmospheric amber/gold stage lights */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-36 right-[-8%] w-[620px] h-[620px] rounded-full bg-[#D9AF72]/10 blur-[130px]" />
        <div className="absolute top-[42%] -left-32 w-[480px] h-[480px] rounded-full bg-[#B5833E]/8 blur-[120px]" />
      </div>

      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="relative z-20 max-w-7xl mx-auto px-6 sm:px-10 h-20 flex items-center justify-between gap-8 border-b border-[#D9AF72]/15">
        <a
          href="#inicio"
          className="inline-flex items-center gap-3 whitespace-nowrap shrink-0"
        >
          <VerbenaEmblem className="w-7 h-7 shrink-0" />
          <div>
            <span className="block font-editorial text-xl tracking-[0.12em] font-semibold text-[#F7F1E5] leading-none">
              {siteSettings.brandName}
            </span>
            <span className="block text-[10px] tracking-[0.2em] text-[#DFBA7C] mt-1">
              {siteSettings.brandSubtitle}
            </span>
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm text-[#CFC5B8]">
          <a
            href="#assinatura"
            className="text-[#F0D29C] hover:text-[#FAF5EC] transition-colors whitespace-nowrap shrink-0"
          >
            Plano 12 Meses
          </a>
          <button
            type="button"
            onClick={() => openDimitraChat('consulta')}
            className="hover:text-[#F0D29C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Atendimento IA
          </button>
          <a
            href="#pilares"
            className="hover:text-[#F0D29C] transition-colors whitespace-nowrap shrink-0"
          >
            Pilares
          </a>
          <a
            href="#acervo"
            className="hover:text-[#F0D29C] transition-colors whitespace-nowrap shrink-0"
          >
            Receitas
          </a>
        </nav>

        <button
          type="button"
          onClick={() => handleGoogleLogin()}
          disabled={loading}
          className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          <span>{loading ? 'Conectando...' : 'Área do Assinante'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Hero Editorial Split */}
      <section
        id="inicio"
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 pt-12 pb-16 lg:pt-16 lg:pb-20"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: MOTION_EASE }}
            className="lg:col-span-6 space-y-6"
          >
            <p className="text-xs tracking-[0.22em] text-[#DFBA7C] font-medium">
              {siteSettings.heroEyebrow}
            </p>

            <h1 className="font-editorial text-5xl sm:text-6xl lg:text-[4.1rem] leading-[1.04] font-medium text-[#FAF5EC] tracking-tight text-balance">
              {siteSettings.heroTitle}
            </h1>

            <p className="text-sm sm:text-base text-[#BEB4A7] leading-relaxed max-w-lg">
              {siteSettings.heroDescription}
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <a
                href="#assinatura"
                className="btn-gold inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-semibold whitespace-nowrap shrink-0"
              >
                <Crown className="w-4 h-4" />
                <span>Assinar 12 Meses</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => openDimitraChat('consulta')}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-medium text-[#F2E9DB] border border-[#D9AF72]/35 bg-[#17120E]/70 hover:border-[#F0D29C]/70 hover:bg-[#1E1712] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <MessageCircleHeart className="w-4 h-4 text-[#E8C589]" />
                <span>Tirar Dúvidas (IA)</span>
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="px-4 py-3 text-xs text-red-200 bg-red-950/60 border border-red-400/30 rounded-xl max-w-lg"
              >
                {errorMsg}
              </div>
            )}

            {/* 3-Column Quantitative Trio mirroring reference */}
            <div className="grid grid-cols-3 gap-6 pt-6 max-w-md border-t border-[#D9AF72]/15">
              <div>
                <div className="font-editorial text-2xl sm:text-3xl font-semibold text-[#F0D29C] tabular-nums">
                  8+
                </div>
                <div className="text-xs text-[#A99E90] mt-0.5">
                  Bases Científicas
                </div>
              </div>
              <div className="border-l border-[#D9AF72]/15 pl-5">
                <div className="font-editorial text-2xl sm:text-3xl font-semibold text-[#F0D29C] tabular-nums">
                  100%
                </div>
                <div className="text-xs text-[#A99E90] mt-0.5">
                  Personalizado
                </div>
              </div>
              <div className="border-l border-[#D9AF72]/15 pl-5">
                <div className="font-editorial text-2xl sm:text-3xl font-semibold text-[#F0D29C] tabular-nums">
                  PDF
                </div>
                <div className="text-xs text-[#A99E90] mt-0.5">
                  Prescrição Pronta
                </div>
              </div>
            </div>
          </motion.div>

          {/* Dramatic Hero Dish Showcase */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.75, delay: 0.08, ease: MOTION_EASE }}
            className="lg:col-span-6 relative"
          >
            <div className="relative rounded-3xl overflow-hidden border border-[#D9AF72]/28 bg-[#14100D] shadow-[0_32px_90px_-24px_rgba(0,0,0,0.9)]">
              <img
                src={heroImage}
                alt={siteMedia.hero?.altText || 'Bowl de salmão grelhado com quinoa, abacate e edamame'}
                referrerPolicy="no-referrer"
                className="w-full h-[360px] sm:h-[440px] object-cover brightness-[0.88] contrast-[1.06]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#0B0907] via-[#0B0907]/25 to-transparent"
              />
              <div className="absolute bottom-0 inset-x-0 p-6 sm:p-7 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-[#E5C38A] tracking-wide mb-1">
                    Prescrição de alta adesão
                  </p>
                  <p className="font-editorial text-2xl text-[#FAF5EC] leading-snug">
                    Bowl de Salmão Grelhado & Quinoa Tricolor
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums text-xs text-[#D9CFC2] shrink-0">
                  <div className="text-sm font-semibold text-[#F0D29C]">
                    520 kcal
                  </div>
                  <div>39P · 38C · 23G</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Smoked Glass 4-Pillar Feature Strip (matching reference's rounded glass icon bar) */}
        <motion.div
          id="pilares"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: MOTION_EASE }}
          className="mt-14"
        >
          <SpotlightCard glowRim className="rounded-3xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#D9AF72]/15">
              <div className="p-6 flex flex-col items-center text-center gap-2.5">
                <ClipboardList className="w-6 h-6 text-[#E5C38A]" strokeWidth={1.5} />
                <div className="text-sm font-medium text-[#F5EFE6]">
                  Planos Sob Medida
                </div>
                <div className="text-xs text-[#A89E90]">
                  Metas de TMB, GET e macros por paciente
                </div>
              </div>
              <div className="p-6 flex flex-col items-center text-center gap-2.5">
                <BookOpen className="w-6 h-6 text-[#E5C38A]" strokeWidth={1.5} />
                <div className="text-sm font-medium text-[#F5EFE6]">
                  Receitas Padronizadas
                </div>
                <div className="text-xs text-[#A89E90]">
                  Inserção direta com ajuste de porção
                </div>
              </div>
              <div className="p-6 flex flex-col items-center text-center gap-2.5">
                <Microscope className="w-6 h-6 text-[#E5C38A]" strokeWidth={1.5} />
                <div className="text-sm font-medium text-[#F5EFE6]">
                  IA Científica Ativa
                </div>
                <div className="text-xs text-[#A89E90]">
                  PubMed, Cochrane, ESPEN, ISSN e SBD
                </div>
              </div>
              <div className="p-6 flex flex-col items-center text-center gap-2.5">
                <FileText className="w-6 h-6 text-[#E5C38A]" strokeWidth={1.5} />
                <div className="text-sm font-medium text-[#F5EFE6]">
                  Prescrição Elegante
                </div>
                <div className="text-xs text-[#A89E90]">
                  Caderno de receitas e impressão em PDF
                </div>
              </div>
            </div>
          </SpotlightCard>
        </motion.div>
      </section>

      <GoldHorizonDivider className="max-w-7xl mx-auto opacity-80" />

      {/* Exclusive 12-Month Subscription & Manipulated Vitamins Specialties Section */}
      <section
        id="assinatura"
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-16 lg:py-20 space-y-10"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs tracking-[0.22em] text-[#DFBA7C] font-medium">
              ASSINATURA ANUAL EXCLUSIVA · 12 MESES
            </p>
            <h2 className="font-editorial text-4xl sm:text-5xl font-medium text-[#FAF5EC] leading-[1.08]">
              Escolha Sua Especialidade para{' '}
              <span className="italic text-[#E8C589]">
                Vitaminas Manipuladas
              </span>
            </h2>
            <p className="text-sm text-[#BEB4A7] leading-relaxed">
              Acesse como assinante com plano referente a{' '}
              <strong className="text-[#FAF5EC]">12 meses</strong>: atendimento
              exclusivo por videochamada com a Nutricionista Dimitra Bratu,
              prescrição de vitaminas manipuladas para farmácia de manipulação e
              receitas terapêuticas sob medida.
            </p>
          </div>

          <SpotlightCard className="p-5 rounded-2xl shrink-0 lg:min-w-[300px]">
            <div className="text-xs text-[#DFBA7C] font-medium">
              {siteSettings.annualPlanHeadline}
            </div>
            <div className="font-editorial text-3xl font-semibold text-[#FAF5EC] mt-1 tabular-nums">
              12x de {formatMoney(siteSettings.annualCardInstallmentBrl)}
            </div>
            <div className="text-xs text-[#A89E90] mt-0.5 tabular-nums">
              ou {formatMoney(siteSettings.annualPixTotalBrl)} à vista no PIX (
              {siteSettings.annualPixDiscountLabel || '10% OFF'})
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#CFC5B8] mt-3 pt-3 border-t border-[#D9AF72]/16">
              <span className="inline-flex items-center gap-1">
                <Video className="w-3.5 h-3.5 text-[#E8C589]" /> Videochamada
              </span>
              <span className="inline-flex items-center gap-1">
                <FlaskConical className="w-3.5 h-3.5 text-[#E8C589]" /> Manipulados
              </span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-[#E8C589]" /> Receitas
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
              onClick={() => handleGoogleLogin(spec.id)}
              className="group text-left glass-obsidian rounded-2xl p-6 hover:border-[#F0D29C]/65 transition-all duration-300 cursor-pointer flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <span className="inline-block text-[11px] font-medium text-[#DFBA7C] tracking-wide">
                  {spec.focusTag}
                </span>
                <h3 className="font-editorial text-2xl font-medium text-[#FAF5EC] group-hover:text-[#F0D29C] leading-snug transition-colors">
                  {spec.title}
                </h3>
                <p className="text-xs text-[#B7ADA0] leading-relaxed">
                  {spec.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[#D9AF72]/14 flex items-center justify-between gap-3">
                <span className="text-[11px] font-mono text-[#CFC5B8] truncate">
                  {spec.keyActives}
                </span>
                <span className="w-8 h-8 rounded-full btn-gold flex items-center justify-center shrink-0">
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <GoldHorizonDivider className="max-w-7xl mx-auto opacity-65" />

      {/* Editorial Method Section (mirroring reference's Our Story split) */}
      <section
        id="metodo"
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-16 lg:py-20"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-[#D9AF72]/20 bg-[#15110E]">
            <img
              src={methodImage}
              alt={siteMedia.method?.altText || 'Frango às ervas com quinoa, brócolis e batata-doce'}
              referrerPolicy="no-referrer"
              className="w-full h-72 sm:h-80 object-cover brightness-90"
            />
          </div>

          <div className="lg:col-span-6 space-y-5">
            <div className="flex items-center gap-3 text-xs tracking-[0.2em] text-[#DFBA7C]">
              <span>Nosso método</span>
              <span className="w-12 h-px bg-[#D9AF72]/50" aria-hidden="true" />
            </div>
            <h2 className="font-editorial text-4xl sm:text-5xl font-medium text-[#FAF5EC] leading-[1.1] text-balance">
              {siteSettings.methodTitle}
            </h2>
            <p className="text-sm text-[#BEB4A7] leading-relaxed">
              {siteSettings.methodDescription}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleGoogleLogin()}
                disabled={loading}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-xs font-semibold text-[#F5EFE6] border border-[#D9AF72]/40 hover:border-[#F0D29C] hover:bg-[#D9AF72]/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Acessar consultório agora</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#E8C589]" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Signature Recipe Gallery (mirroring Signature Menu 4-card dark glass row) */}
      <section
        id="acervo"
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-10"
      >
        <div className="flex items-end justify-between gap-4 mb-7">
          <div>
            <p className="text-xs tracking-[0.2em] text-[#DFBA7C] mb-1">
              Acervo clínico
            </p>
            <h2 className="font-editorial text-3xl sm:text-4xl font-medium tracking-wide text-[#FAF5EC]">
              Receitas Assinadas
            </h2>
          </div>
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            className="text-xs font-medium text-[#E5C38A] hover:text-[#F7DFB3] transition-colors cursor-pointer whitespace-nowrap"
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
              className="group text-left glass-obsidian rounded-2xl overflow-hidden hover:border-[#E5C38A]/50 transition-all duration-300 cursor-pointer flex flex-col"
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
                  className="absolute inset-0 bg-gradient-to-t from-[#120E0B] via-transparent to-transparent"
                />
              </div>
              <div className="p-4 flex items-end justify-between gap-3 flex-1">
                <div className="min-w-0">
                  <h3 className="font-editorial text-xl font-medium text-[#FAF5EC] leading-snug truncate">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#A89E90] mt-0.5 truncate">
                    {item.subtitle}
                  </p>
                </div>
                <span className="w-8 h-8 rounded-full btn-gold flex items-center justify-center shrink-0">
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Bottom Featured Scientific Banner (mirroring Chef's Tasting Menu card) */}
      <section
        id="ciencia"
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 pt-8 pb-20"
      >
        <SpotlightCard glowRim className="rounded-3xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8 p-7 sm:p-10">
            <div className="lg:col-span-4">
              <h2 className="font-editorial text-4xl sm:text-5xl italic font-medium text-[#FAF5EC] leading-[1.05]">
                {siteSettings.bannerTitle}
              </h2>
            </div>
            <div className="lg:col-span-5 space-y-4">
              <p className="text-sm text-[#C7BDB0] leading-relaxed">
                {siteSettings.bannerDescription}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => openDimitraChat('anamnese')}
                  className="btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <span>Iniciar anamnese guiada</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => openDimitraChat('suplementacao')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-xs font-medium text-[#F2E9DB] border border-[#D9AF72]/35 hover:border-[#F0D29C] hover:bg-[#D9AF72]/10 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Dúvidas de suplementação
                </button>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="rounded-2xl overflow-hidden border border-[#D9AF72]/25">
                <img
                  src={bannerImage}
                  alt={siteMedia.banner?.altText || 'Creme aveludado de abóbora cabotiá com gengibre'}
                  referrerPolicy="no-referrer"
                  className="w-full h-36 object-cover brightness-90"
                />
              </div>
            </div>
          </div>
        </SpotlightCard>
      </section>

      <PublicDimitraModal
        open={publicChatOpen}
        initialMode={publicChatMode}
        onClose={() => setPublicChatOpen(false)}
      />
    </div>
  );
}
