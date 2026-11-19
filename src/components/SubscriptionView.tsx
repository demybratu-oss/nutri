import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Check,
  CreditCard,
  Crown,
  FlaskConical,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import {
  cancelAnnualSubscription,
  createAnnualSubscription,
  updateSubscriptionPreferences,
} from '../lib/firestoreService';
import {
  AnnualSubscription,
  CLINICAL_SPECIALTIES,
  ClinicalSpecialty,
  DEFAULT_SITE_SETTINGS,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  SiteSettings,
  SPECIALTY_LABELS,
} from '../types';
import { GoldHorizonDivider, SpotlightCard, VerbenaEmblem } from './LuxuryPrimitives';

interface SubscriptionViewProps {
  userId: string;
  userName: string;
  userEmail: string;
  activeSubscription: AnnualSubscription | null;
  siteSettings?: SiteSettings;
  defaultSpecialty?: ClinicalSpecialty;
  onGoToVideo: () => void;
  onGoToCompounding: () => void;
  onGoToRecipes: () => void;
  onGoToConsultation: () => void;
  onNotify: (message: string) => void;
}

const formatMoneyBrl = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(v);

const INCLUDED_BENEFITS = [
  '12 meses de acompanhamento nutricional exclusivo com a Nutricionista Dimitra Bratu',
  'Videochamadas individuais para avaliação detalhada do seu caso de saúde',
  'Prescrição personalizada de vitaminas manipuladas pronta para farmácia de manipulação',
  'Plano alimentar individualizado + receitas clínicas terapêuticas para sua rotina',
  'Atendimento 24h pela IA da Dra. Dimitra Bratu conectada à literatura científica atual',
];

export function SubscriptionView({
  userId,
  userName,
  userEmail,
  activeSubscription,
  siteSettings = DEFAULT_SITE_SETTINGS,
  defaultSpecialty = 'metabolica_emagrecimento',
  onGoToVideo,
  onGoToCompounding,
  onGoToRecipes,
  onGoToConsultation,
  onNotify,
}: SubscriptionViewProps) {
  const paymentOptions: Array<{
    id: PaymentMethod;
    title: string;
    priceText: string;
    totalBrl: number;
    installmentLabel: string;
    badge?: string;
    icon: typeof CreditCard;
  }> = [
    {
      id: 'cartao_12x',
      title: 'Cartão de Crédito · 12 Meses',
      priceText: `12x de ${formatMoneyBrl(siteSettings.annualCardInstallmentBrl)}`,
      totalBrl: siteSettings.annualCardTotalBrl,
      installmentLabel: `12x de ${formatMoneyBrl(siteSettings.annualCardInstallmentBrl)} (Total ${formatMoneyBrl(siteSettings.annualCardTotalBrl)})`,
      badge: 'Mais escolhido',
      icon: CreditCard,
    },
    {
      id: 'pix_anual',
      title: 'PIX Anual à Vista (12 Meses)',
      priceText: formatMoneyBrl(siteSettings.annualPixTotalBrl),
      totalBrl: siteSettings.annualPixTotalBrl,
      installmentLabel: `À vista no PIX (${siteSettings.annualPixDiscountLabel || '10% OFF'})`,
      badge: siteSettings.annualPixDiscountLabel || '10% OFF',
      icon: QrCode,
    },
    {
      id: 'boleto_anual',
      title: 'Boleto Bancário Anual (12 Meses)',
      priceText: formatMoneyBrl(siteSettings.annualBoletoTotalBrl),
      totalBrl: siteSettings.annualBoletoTotalBrl,
      installmentLabel: 'Pagamento anual único (12 meses)',
      icon: Receipt,
    },
  ];

  const [specialty, setSpecialty] = useState<ClinicalSpecialty>(
    activeSubscription?.specialty || defaultSpecialty
  );
  const [subscriberName, setSubscriberName] = useState(
    activeSubscription?.subscriberName || userName || ''
  );
  const [phone, setPhone] = useState(activeSubscription?.phone || '');
  const [healthFocus, setHealthFocus] = useState(
    activeSubscription?.healthFocus || ''
  );
  const [allergies, setAllergies] = useState(activeSubscription?.allergies || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cartao_12x');
  const [submitting, setSubmitting] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeSubscription) {
      setSpecialty(activeSubscription.specialty);
      setSubscriberName(activeSubscription.subscriberName);
      setPhone(activeSubscription.phone);
      setHealthFocus(activeSubscription.healthFocus);
      setAllergies(activeSubscription.allergies);
    } else if (defaultSpecialty) {
      setSpecialty(defaultSpecialty);
    }
  }, [activeSubscription, defaultSpecialty]);

  const selectedPayment =
    paymentOptions.find((p) => p.id === paymentMethod) || paymentOptions[0];

  async function handleActivateSubscription(e: React.FormEvent) {
    e.preventDefault();
    if (subscriberName.trim().length < 2) {
      setErrorMsg('Informe seu nome completo para emissão da assinatura.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 1);
      const receiptCode = `DBR-${Date.now().toString(36).toUpperCase().slice(-6)}`;

      await createAnnualSubscription({
        userId,
        subscriberName: subscriberName.trim(),
        subscriberEmail: userEmail,
        phone: phone.trim(),
        specialty,
        healthFocus: healthFocus.trim(),
        allergies: allergies.trim(),
        planDurationMonths: 12,
        paymentMethod,
        totalAmountBrl: selectedPayment.totalBrl,
        installmentLabel: selectedPayment.installmentLabel,
        status: 'ativa',
        validUntilIso: validUntil.toISOString(),
        receiptCode,
      });
      onNotify(
        'Assinatura Anual (12 meses) ativada! Sua especialidade e acesso exclusivo já estão liberados.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível concluir a ativação da assinatura.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSubscription) return;
    setSavingPrefs(true);
    try {
      await updateSubscriptionPreferences(activeSubscription.id, {
        specialty,
        healthFocus,
        allergies,
        phone,
      });
      onNotify('Especialidade e preferências clínicas atualizadas.');
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleCancel() {
    if (!activeSubscription) return;
    await cancelAnnualSubscription(activeSubscription.id);
    onNotify('Assinatura anual marcada como cancelada.');
  }

  // Active Subscriber Dashboard
  if (activeSubscription) {
    const validUntilFormatted = new Date(
      activeSubscription.validUntilIso
    ).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    return (
      <div className="space-y-7">
        {/* Prestigious Annual Membership Card */}
        <SpotlightCard glowRim className="p-6 sm:p-8 rounded-3xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B7DB74]/16 border border-[#C7E88B]/45 text-xs font-semibold text-[#DDF3B2]">
                <Crown className="w-3.5 h-3.5" />
                <span>Assinatura Anual Ativa · 12 Meses</span>
              </div>
              <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#F4FBF6] leading-tight">
                {activeSubscription.subscriberName}
              </h2>
              <p className="text-sm text-[#CBE3D6]">
                Especialidade selecionada:{' '}
                <strong className="text-[#DDF3B2] font-semibold">
                  {SPECIALTY_LABELS[activeSubscription.specialty]}
                </strong>
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-mono tabular-nums text-[#A8CCB9]">
                <span>Comprovante: {activeSubscription.receiptCode}</span>
                <span>Vigência até: {validUntilFormatted}</span>
                <span>{PAYMENT_METHOD_LABELS[activeSubscription.paymentMethod]}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onGoToVideo}
                className="btn-gold inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap"
              >
                <Video className="w-4 h-4" />
                <span>Videochamada com Dra. Dimitra</span>
              </button>
              <button
                type="button"
                onClick={onGoToCompounding}
                className="inline-flex items-center gap-2 px-5 py-3 text-xs font-medium text-[#F4FBF6] border border-[#B7DB74]/38 rounded-full hover:border-[#DDF3B2] hover:bg-[#B7DB74]/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                <FlaskConical className="w-4 h-4 text-[#C7E88B]" />
                <span>Vitaminas Manipuladas</span>
              </button>
            </div>
          </div>

          <GoldHorizonDivider className="my-6 opacity-60" />

          {/* Quick Exclusive Journeys */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={onGoToVideo}
              className="text-left p-4 rounded-2xl bg-[#0A2622] border border-[#B7DB74]/20 hover:border-[#C7E88B]/55 transition-colors cursor-pointer group"
            >
              <Video className="w-5 h-5 text-[#C7E88B] mb-2" />
              <div className="text-xs font-semibold text-[#F4FBF6] group-hover:text-[#DDF3B2]">
                Consulta por Vídeo
              </div>
              <div className="text-[11px] text-[#85AF9B] mt-0.5">
                Agendar ou entrar na sala ao vivo
              </div>
            </button>
            <button
              type="button"
              onClick={onGoToCompounding}
              className="text-left p-4 rounded-2xl bg-[#0A2622] border border-[#B7DB74]/20 hover:border-[#C7E88B]/55 transition-colors cursor-pointer group"
            >
              <FlaskConical className="w-5 h-5 text-[#C7E88B] mb-2" />
              <div className="text-xs font-semibold text-[#F4FBF6] group-hover:text-[#DDF3B2]">
                Fórmulas Manipuladas
              </div>
              <div className="text-[11px] text-[#85AF9B] mt-0.5">
                Receituário para farmácia de manipulação
              </div>
            </button>
            <button
              type="button"
              onClick={onGoToRecipes}
              className="text-left p-4 rounded-2xl bg-[#0A2622] border border-[#B7DB74]/20 hover:border-[#C7E88B]/55 transition-colors cursor-pointer group"
            >
              <BookOpen className="w-5 h-5 text-[#C7E88B] mb-2" />
              <div className="text-xs font-semibold text-[#F4FBF6] group-hover:text-[#DDF3B2]">
                Receitas Terapêuticas
              </div>
              <div className="text-[11px] text-[#85AF9B] mt-0.5">
                Preparações assinadas para sua saúde
              </div>
            </button>
            <button
              type="button"
              onClick={onGoToConsultation}
              className="text-left p-4 rounded-2xl bg-[#0A2622] border border-[#B7DB74]/20 hover:border-[#C7E88B]/55 transition-colors cursor-pointer group"
            >
              <Sparkles className="w-5 h-5 text-[#C7E88B] mb-2" />
              <div className="text-xs font-semibold text-[#F4FBF6] group-hover:text-[#DDF3B2]">
                Dra. Dimitra IA 24h
              </div>
              <div className="text-[11px] text-[#85AF9B] mt-0.5">
                Tirar dúvidas a qualquer momento
              </div>
            </button>
          </div>
        </SpotlightCard>

        {/* Update Clinical Specialty & Health Focus */}
        <form
          onSubmit={handleSavePreferences}
          className="glass-obsidian rounded-2xl p-6 space-y-6"
        >
          <div>
            <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
              Especialidade Clínica das Suas Vitaminas Manipuladas
            </h3>
            <p className="text-xs text-[#A8CCB9] mt-1">
              Você pode atualizar o foco clínico do seu tratamento nutricional ao
              longo dos 12 meses de assinatura.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {CLINICAL_SPECIALTIES.map((spec) => {
              const selected = specialty === spec.id;
              return (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => setSpecialty(spec.id)}
                  className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    selected
                      ? 'bg-[#B7DB74]/15 border-[#DDF3B2] shadow-[0_0_24px_-10px_rgba(240,210,156,0.4)]'
                      : 'bg-[#0A2622] border-[#B7DB74]/16 hover:border-[#B7DB74]/45'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-medium text-[#C7E88B]">
                        {spec.focusTag}
                      </span>
                      {selected && (
                        <span className="w-5 h-5 rounded-full btn-gold flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="font-editorial text-xl font-medium text-[#F4FBF6] leading-snug">
                      {spec.title}
                    </div>
                    <p className="text-xs text-[#A8CCB9] mt-1.5 leading-relaxed">
                      {spec.description}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-[#B7DB74]/12 text-[11px] font-mono text-[#CBE3D6]">
                    {spec.keyActives}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                WhatsApp / Contato
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-0000"
                className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Alergias ou intolerâncias
              </label>
              <input
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="Ex.: Sem lactose, alergia a corantes..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Foco atual de saúde / sintomas
              </label>
              <input
                type="text"
                value={healthFocus}
                onChange={(e) => setHealthFocus(e.target.value)}
                placeholder="Ex.: Cansaço vespertino, melhora do sono..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#B7DB74]/14">
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-[#85AF9B] hover:text-red-300 transition-colors cursor-pointer"
            >
              Encerrar renovação da assinatura
            </button>
            <button
              type="submit"
              disabled={savingPrefs}
              className="btn-gold inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-60"
            >
              {savingPrefs ? 'Salvando...' : 'Salvar preferências clínicas'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Enrollment / 12-Month Subscription Checkout
  return (
    <form onSubmit={handleActivateSubscription} className="space-y-8">
      {/* Header Banner */}
      <SpotlightCard glowRim className="p-6 sm:p-8 rounded-3xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs tracking-[0.2em] text-[#C7E88B] font-medium">
              <Crown className="w-4 h-4" />
              <span>PROGRAMA ANUAL EXCLUSIVO · 12 MESES</span>
            </div>
            <h2 className="font-editorial text-3xl sm:text-5xl font-medium text-[#F4FBF6] leading-[1.08]">
              Acompanhamento de Saúde &{' '}
              <span className="italic text-[#C7E88B]">
                Vitaminas Manipuladas
              </span>
            </h2>
            <p className="text-sm text-[#CBE3D6] leading-relaxed">
              Escolha sua especialidade clínica e ative sua assinatura de{' '}
              <strong className="text-[#F4FBF6]">12 meses</strong> com a{' '}
              <strong className="text-[#DDF3B2]">
                Nutricionista Dra. Dimitra Bratu
              </strong>{' '}
              (formada pela Universidade Gama Filho — Rio de Janeiro, RJ):
              consultas especializadas por videochamada, fórmulas de vitaminas
              manipuladas prontas para farmácia de manipulação e receitas
              personalizadas para o seu tratamento.
            </p>
          </div>

          <div className="lg:col-span-5 p-5 rounded-2xl bg-[#0A2622]/95 border border-[#B7DB74]/25 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#DDF3B2]">
              <VerbenaEmblem className="w-5 h-5" />
              <span>Incluso nos 12 meses de acompanhamento</span>
            </div>
            <ul className="space-y-2.5">
              {INCLUDED_BENEFITS.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-xs text-[#CBE3D6] leading-relaxed"
                >
                  <Check className="w-3.5 h-3.5 text-[#C7E88B] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SpotlightCard>

      {/* Step 1: Choose Clinical Specialty */}
      <section className="space-y-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-[#C7E88B] mb-1">
            Passo 1 de 3
          </p>
          <h3 className="font-editorial text-3xl font-medium text-[#F4FBF6]">
            Escolha a Especialidade do Seu Tratamento & Manipulados
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CLINICAL_SPECIALTIES.map((spec) => {
            const selected = specialty === spec.id;
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => setSpecialty(spec.id)}
                className={`text-left p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  selected
                    ? 'bg-[#B7DB74]/15 border-[#DDF3B2] shadow-[0_0_28px_-10px_rgba(240,210,156,0.45)]'
                    : 'glass-obsidian hover:border-[#B7DB74]/45'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-medium text-[#C7E88B]">
                      {spec.focusTag}
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        selected
                          ? 'btn-gold border-transparent'
                          : 'border-[#B7DB74]/35'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3" />}
                    </span>
                  </div>
                  <div className="font-editorial text-2xl font-medium text-[#F4FBF6] leading-snug">
                    {spec.title}
                  </div>
                  <p className="text-xs text-[#94AED6] mt-2 leading-relaxed">
                    {spec.description}
                  </p>
                </div>
                <div className="pt-3 border-t border-[#B7DB74]/14 text-[11px] font-mono text-[#C7E88B]">
                  {spec.keyActives}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2 & 3: Patient Intake + 12-Month Payment Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Step 2: Clinical Intake */}
        <section className="lg:col-span-6 glass-obsidian rounded-2xl p-6 space-y-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-[#C7E88B] mb-1">
              Passo 2 de 3
            </p>
            <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
              Seus Dados para o Atendimento Exclusivo
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Nome completo do paciente assinante
              </label>
              <input
                type="text"
                required
                value={subscriberName}
                onChange={(e) => setSubscriberName(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full px-4 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                WhatsApp para lembretes de videochamada
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-0000"
                className="w-full px-4 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Principal queixa de saúde ou objetivo para a Dra. Dimitra
              </label>
              <textarea
                rows={3}
                value={healthFocus}
                onChange={(e) => setHealthFocus(e.target.value)}
                placeholder="Ex.: Quero ajustar exames de vitamina D e ferritina, melhorar disposição, sono e montar uma fórmula manipulada sob medida."
                className="w-full px-4 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B] resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1.5">
                Alergias, restrições alimentares ou medicações em uso
              </label>
              <input
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="Ex.: Intolerância à lactose, sem glúten..."
                className="w-full px-4 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B]"
              />
            </div>
          </div>
        </section>

        {/* Step 3: 12-Month Payment */}
        <section className="lg:col-span-6 glass-obsidian rounded-2xl p-6 space-y-5">
          <div>
            <p className="text-xs tracking-[0.2em] text-[#C7E88B] mb-1">
              Passo 3 de 3
            </p>
            <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
              Pagamento Referente a 12 Meses
            </h3>
          </div>

          <div className="space-y-3">
            {paymentOptions.map((opt) => {
              const Icon = opt.icon;
              const selected = paymentMethod === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPaymentMethod(opt.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                    selected
                      ? 'bg-[#B7DB74]/15 border-[#DDF3B2]'
                      : 'bg-[#0A2622] border-[#B7DB74]/18 hover:border-[#B7DB74]/45'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#B7DB74]/12 border border-[#B7DB74]/30 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#C7E88B]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#F4FBF6]">
                          {opt.title}
                        </span>
                        {opt.badge && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#B7DB74]/20 text-[#DDF3B2]">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#85AF9B] mt-0.5">
                        {opt.installmentLabel}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums text-sm font-semibold text-[#DDF3B2] shrink-0">
                    {opt.priceText}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-[#0A2622] border border-[#B7DB74]/16 space-y-2 text-xs">
            <div className="flex justify-between text-[#A8CCB9]">
              <span>Programa Anual (12 meses)</span>
              <span className="font-mono tabular-nums text-[#F4FBF6]">
                {SPECIALTY_LABELS[specialty]}
              </span>
            </div>
            <div className="flex justify-between text-[#A8CCB9]">
              <span>Condição escolhida</span>
              <span className="font-mono tabular-nums font-semibold text-[#DDF3B2]">
                {selectedPayment.priceText}
              </span>
            </div>
            <div className="pt-2 border-t border-[#B7DB74]/12 flex items-start gap-2 text-[11px] text-[#85AF9B]">
              <ShieldCheck className="w-4 h-4 text-[#B7DB74] shrink-0 mt-0.5" />
              <span>
                Confirmação imediata de matrícula anual (ambiente integrado sem
                cobrança de cartão real). Acesso liberado instantaneamente para
                videochamadas e prescrições manipuladas.
              </span>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="px-4 py-3 text-xs text-red-200 bg-red-950/60 border border-red-400/30 rounded-xl"
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full btn-gold inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold rounded-full cursor-pointer disabled:opacity-60"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>
              {submitting
                ? 'Ativando assinatura de 12 meses...'
                : 'Confirmar Assinatura Anual (12 Meses)'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      </div>
    </form>
  );
}
