import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ClipboardList,
  CreditCard,
  Image as ImageIcon,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { BOTANICAL_THEME_IMAGES, RECIPE_IMAGES } from '../data/seedData';
import {
  adminDeleteSubscription,
  adminUpdateSubscriptionStatus,
  adminUpdateVideoSessionStatus,
  grantAdminAccess,
  resetSiteMediaSlot,
  revokeAdminAccess,
  saveSiteMediaSlot,
  saveSiteSettings,
} from '../lib/firestoreService';
import { compressImageFileToDataUrl } from '../lib/nutrition';
import {
  AdminUser,
  AnnualSubscription,
  CompoundingPrescription,
  MealPlan,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  PLAN_STATUS_LABELS,
  PRIMARY_ADMIN_EMAIL,
  SITE_MEDIA_SLOTS,
  SiteMediaItem,
  SiteMediaSlotKey,
  SiteSettings,
  SPECIALIST_PROFILE,
  SPECIALTY_LABELS,
  VideoSession,
} from '../types';
import { SpotlightCard } from './LuxuryPrimitives';

export type AdminTab = 'subscribers' | 'plans' | 'content' | 'admins';
type OversightTableTab = 'mealPlans' | 'videos' | 'compounding';

interface AdminPanelViewProps {
  currentUserEmail: string;
  siteSettings: SiteSettings;
  siteMedia: Partial<Record<SiteMediaSlotKey, SiteMediaItem>>;
  admins: AdminUser[];
  allSubscriptions: AnnualSubscription[];
  allMealPlans: MealPlan[];
  allVideoSessions: VideoSession[];
  allCompounding: CompoundingPrescription[];
  controlledTab?: AdminTab;
  hideHeader?: boolean;
  onNotify: (message: string) => void;
}

const DEFAULT_SLOT_IMAGES: Record<SiteMediaSlotKey, string> = {
  hero: SPECIALIST_PROFILE.photoUrl,
  specialist_avatar: SPECIALIST_PROFILE.photoUrl,
  method: BOTANICAL_THEME_IMAGES.bioactivesEditorial,
  banner: BOTANICAL_THEME_IMAGES.apothecaryVessel,
  recipe_1: RECIPE_IMAGES.salmao,
  recipe_2: RECIPE_IMAGES.overnight,
  recipe_3: RECIPE_IMAGES.omelete,
  recipe_4: RECIPE_IMAGES.abobora,
};

const formatBrl = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

export function AdminPanelView({
  currentUserEmail,
  siteSettings,
  siteMedia,
  admins,
  allSubscriptions,
  allMealPlans,
  allVideoSessions,
  allCompounding,
  controlledTab,
  hideHeader = false,
  onNotify,
}: AdminPanelViewProps) {
  const [internalTab, setInternalTab] = useState<AdminTab>(
    controlledTab || 'subscribers'
  );
  const activeTab = controlledTab || internalTab;
  const [oversightTab, setOversightTab] = useState<OversightTableTab>('mealPlans');

  // Subscribers filters
  const [subSearch, setSubSearch] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState<'all' | 'ativa' | 'cancelada'>('all');
  const [subPaymentFilter, setSubPaymentFilter] = useState<'all' | PaymentMethod>('all');
  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState<string | null>(null);
  const [busySubId, setBusySubId] = useState<string | null>(null);

  // Site settings form state
  const [settingsDraft, setSettingsDraft] = useState<SiteSettings>(siteSettings);
  const [savingSettings, setSavingSettings] = useState(false);

  // Media slot URL drafts & upload states
  const [urlDrafts, setUrlDrafts] = useState<Partial<Record<SiteMediaSlotKey, string>>>({});
  const [uploadingSlot, setUploadingSlot] = useState<SiteMediaSlotKey | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Admin grant form
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('Administrador do Site');
  const [grantingAdmin, setGrantingAdmin] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    setSettingsDraft(siteSettings);
  }, [siteSettings]);

  // Subscriber financial metrics
  const activeSubs = useMemo(
    () => allSubscriptions.filter((s) => s.status === 'ativa'),
    [allSubscriptions]
  );

  const totalActiveRevenue = useMemo(
    () => activeSubs.reduce((sum, s) => sum + (Number(s.totalAmountBrl) || 0), 0),
    [activeSubs]
  );

  const avgTicket = activeSubs.length > 0 ? totalActiveRevenue / activeSubs.length : 0;

  const paymentBreakdown = useMemo(() => {
    let card = 0;
    let pix = 0;
    let boleto = 0;
    for (const s of activeSubs) {
      if (s.paymentMethod === 'cartao_12x') card += 1;
      else if (s.paymentMethod === 'pix_anual') pix += 1;
      else boleto += 1;
    }
    return { card, pix, boleto };
  }, [activeSubs]);

  const filteredSubscriptions = useMemo(() => {
    const q = subSearch.trim().toLowerCase();
    return allSubscriptions.filter((sub) => {
      if (subStatusFilter !== 'all' && sub.status !== subStatusFilter) return false;
      if (subPaymentFilter !== 'all' && sub.paymentMethod !== subPaymentFilter)
        return false;
      if (!q) return true;
      return (
        sub.subscriberName.toLowerCase().includes(q) ||
        sub.subscriberEmail.toLowerCase().includes(q) ||
        sub.receiptCode.toLowerCase().includes(q) ||
        SPECIALTY_LABELS[sub.specialty].toLowerCase().includes(q)
      );
    });
  }, [allSubscriptions, subSearch, subStatusFilter, subPaymentFilter]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveSiteSettings({
        brandName: settingsDraft.brandName,
        brandSubtitle: settingsDraft.brandSubtitle,
        heroEyebrow: settingsDraft.heroEyebrow,
        heroTitle: settingsDraft.heroTitle,
        heroDescription: settingsDraft.heroDescription,
        methodTitle: settingsDraft.methodTitle,
        methodDescription: settingsDraft.methodDescription,
        bannerTitle: settingsDraft.bannerTitle,
        bannerDescription: settingsDraft.bannerDescription,
        annualPlanHeadline: settingsDraft.annualPlanHeadline,
        annualCardInstallmentBrl: Number(settingsDraft.annualCardInstallmentBrl),
        annualCardTotalBrl: Number(settingsDraft.annualCardTotalBrl),
        annualPixTotalBrl: Number(settingsDraft.annualPixTotalBrl),
        annualPixDiscountLabel: settingsDraft.annualPixDiscountLabel,
        annualBoletoTotalBrl: Number(settingsDraft.annualBoletoTotalBrl),
        whatsappContact: settingsDraft.whatsappContact,
        instagramHandle: settingsDraft.instagramHandle,
        updatedByEmail: currentUserEmail,
      });
      onNotify('Configurações e preços do site atualizados ao vivo.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleFileUpload(
    slotKey: SiteMediaSlotKey,
    label: string,
    defaultAlt: string,
    file: File | undefined
  ) {
    if (!file) return;
    setMediaError(null);
    setUploadingSlot(slotKey);
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      await saveSiteMediaSlot({
        slotKey,
        label,
        imageUrl: dataUrl,
        altText: defaultAlt,
        updatedByEmail: currentUserEmail,
      });
      onNotify(`Foto "${label}" atualizada no site.`);
    } catch (err) {
      setMediaError(
        err instanceof Error ? err.message : 'Não foi possível enviar a foto.'
      );
    } finally {
      setUploadingSlot(null);
    }
  }

  async function handleSaveUrlSlot(
    slotKey: SiteMediaSlotKey,
    label: string,
    defaultAlt: string
  ) {
    const rawUrl = (urlDrafts[slotKey] || '').trim();
    if (!rawUrl) return;
    if (!/^https?:\/\/|^\//i.test(rawUrl)) {
      setMediaError('Informe uma URL válida iniciando com https:// ou /');
      return;
    }
    setMediaError(null);
    setUploadingSlot(slotKey);
    try {
      await saveSiteMediaSlot({
        slotKey,
        label,
        imageUrl: rawUrl,
        altText: defaultAlt,
        updatedByEmail: currentUserEmail,
      });
      setUrlDrafts((prev) => ({ ...prev, [slotKey]: '' }));
      onNotify(`Foto "${label}" atualizada por link.`);
    } finally {
      setUploadingSlot(null);
    }
  }

  async function handleResetSlot(slotKey: SiteMediaSlotKey, label: string) {
    setUploadingSlot(slotKey);
    try {
      await resetSiteMediaSlot(slotKey);
      onNotify(`Foto padrão restaurada em "${label}".`);
    } finally {
      setUploadingSlot(null);
    }
  }

  async function handleToggleSubStatus(sub: AnnualSubscription) {
    setBusySubId(sub.id);
    try {
      const next = sub.status === 'ativa' ? 'cancelada' : 'ativa';
      await adminUpdateSubscriptionStatus(sub.id, next);
      onNotify(
        next === 'ativa'
          ? `Assinatura de ${sub.subscriberName} reativada.`
          : `Assinatura de ${sub.subscriberName} marcada como cancelada.`
      );
    } finally {
      setBusySubId(null);
    }
  }

  async function handleDeleteSub(sub: AnnualSubscription) {
    setBusySubId(sub.id);
    try {
      await adminDeleteSubscription(sub.id);
      setConfirmDeleteSubId(null);
      onNotify(`Registro de assinatura de ${sub.subscriberName} removido.`);
    } finally {
      setBusySubId(null);
    }
  }

  async function handleGrantAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError(null);
    const email = newAdminEmail.trim().toLowerCase();
    if (!email.includes('@') || email.length < 5) {
      setAdminError('Informe um endereço de e-mail Google válido.');
      return;
    }
    if (email === PRIMARY_ADMIN_EMAIL) {
      setAdminError('Este e-mail já é o Administrador Principal permanente.');
      return;
    }
    if (newAdminName.trim().length < 2) {
      setAdminError('Informe o nome completo da pessoa autorizada.');
      return;
    }

    setGrantingAdmin(true);
    try {
      await grantAdminAccess({
        email,
        displayName: newAdminName.trim(),
        roleLabel: newAdminRole.trim() || 'Administrador do Site',
        addedByEmail: currentUserEmail,
      });
      setNewAdminEmail('');
      setNewAdminName('');
      setNewAdminRole('Administrador do Site');
      onNotify(`Acesso administrativo liberado para ${email}.`);
    } catch {
      setAdminError('Não foi possível liberar o administrador. Tente novamente.');
    } finally {
      setGrantingAdmin(false);
    }
  }

  async function handleRevokeAdmin(admin: AdminUser) {
    await revokeAdminAccess(admin.id);
    setConfirmRevokeId(null);
    onNotify(`Acesso administrativo de ${admin.email} revogado.`);
  }

  const tabs: Array<{ id: AdminTab; label: string; icon: typeof CreditCard }> = [
    { id: 'subscribers', label: 'Assinantes e Pagamentos', icon: CreditCard },
    { id: 'plans', label: 'Planos e Preços', icon: ClipboardList },
    { id: 'content', label: 'Fotos e Textos do Site', icon: ImageIcon },
    { id: 'admins', label: 'Administradores', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-7">
      {!hideHeader && (
        <SpotlightCard glowRim className="p-6 rounded-2xl space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.18em] text-[#C7E88B] font-medium">
                Acesso Restrito · Administrador Autorizado
              </p>
              <h2 className="font-editorial text-3xl font-medium text-[#F4FBF6] mt-1">
                Central de Administração do Site
              </h2>
              <p className="text-xs text-[#A8CCB9] mt-1">
                Logado como {currentUserEmail} · Controle completo de fotos,
                textos, planos, pagamentos, assinantes e permissões
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#061A17] border border-[#B7DB74]/20 rounded-xl">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setInternalTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'btn-gold font-semibold'
                        : 'text-[#A8CCB9] hover:text-[#F4FBF6]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </SpotlightCard>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: SUBSCRIBERS & PAYMENTS                                        */}
      {/* ===================================================================== */}
      {activeTab === 'subscribers' && (
        <div className="space-y-6">
          {/* 4-Column Financial & Subscriber KPIs */}
          <div className="glass-obsidian rounded-2xl">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#B7DB74]/14">
              <div className="p-6">
                <div className="text-xs text-[#A8CCB9] mb-1">
                  Assinantes ativos (12 meses)
                </div>
                <div className="font-editorial text-3xl font-semibold tabular-nums text-[#C7E88B]">
                  {activeSubs.length}
                </div>
                <div className="text-xs text-[#85AF9B] mt-1 tabular-nums">
                  {allSubscriptions.length} registros no total
                </div>
              </div>

              <div className="p-6">
                <div className="text-xs text-[#A8CCB9] mb-1">
                  Receita anual ativa
                </div>
                <div className="font-editorial text-3xl font-semibold tabular-nums text-[#F4FBF6]">
                  {formatBrl(totalActiveRevenue)}
                </div>
                <div className="text-xs text-[#85AF9B] mt-1">
                  Soma dos planos ativos
                </div>
              </div>

              <div className="p-6">
                <div className="text-xs text-[#A8CCB9] mb-1">
                  Ticket médio anual
                </div>
                <div className="font-editorial text-3xl font-semibold tabular-nums text-[#F4FBF6]">
                  {formatBrl(avgTicket)}
                </div>
                <div className="text-xs text-[#85AF9B] mt-1">
                  Por assinatura de 12 meses
                </div>
              </div>

              <div className="p-6">
                <div className="text-xs text-[#A8CCB9] mb-1">
                  Meios de pagamento ativos
                </div>
                <div className="font-mono text-sm font-medium tabular-nums text-[#F4FBF6] mt-2 space-y-0.5">
                  <div>
                    Cartão 12x: <span className="text-[#C7E88B]">{paymentBreakdown.card}</span>
                  </div>
                  <div>
                    PIX Anual: <span className="text-[#C7E88B]">{paymentBreakdown.pix}</span> · Boleto:{' '}
                    <span className="text-[#C7E88B]">{paymentBreakdown.boleto}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Toolbar & Subscribers Table */}
          <section className="glass-obsidian rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#B7DB74]/14 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#85AF9B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  placeholder="Buscar por assinante, e-mail, especialidade ou comprovante..."
                  className="w-full pl-10 pr-4 py-2 text-xs bg-[#061A17] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/22 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 p-1 bg-[#061A17] border border-[#B7DB74]/18 rounded-lg">
                  {(['all', 'ativa', 'cancelada'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSubStatusFilter(st)}
                      className={`px-3 py-1 text-xs rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        subStatusFilter === st
                          ? 'bg-[#B7DB74]/22 text-[#DDF3B2] font-medium'
                          : 'text-[#A8CCB9] hover:text-[#F4FBF6]'
                      }`}
                    >
                      {st === 'all' ? 'Todas' : st === 'ativa' ? 'Ativas' : 'Canceladas'}
                    </button>
                  ))}
                </div>

                <select
                  value={subPaymentFilter}
                  onChange={(e) =>
                    setSubPaymentFilter(e.target.value as 'all' | PaymentMethod)
                  }
                  aria-label="Filtrar por forma de pagamento"
                  className="px-3 py-2 text-xs bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/22 rounded-lg focus:outline-none focus:border-[#C7E88B]"
                >
                  <option value="all">Todos os pagamentos</option>
                  <option value="cartao_12x">Cartão 12x</option>
                  <option value="pix_anual">PIX Anual</option>
                  <option value="boleto_anual">Boleto Anual</option>
                </select>
              </div>
            </div>

            {filteredSubscriptions.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <Users className="w-8 h-8 text-[#B7DB74]/50 mx-auto" />
                <div className="text-sm font-medium text-[#F4FBF6]">
                  Nenhuma assinatura encontrada
                </div>
                <p className="text-xs text-[#85AF9B]">
                  Quando novos clientes concluírem o plano anual de 12 meses,
                  todos os dados de pagamento e especialidade aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#B7DB74]/14 text-xs font-medium text-[#85AF9B] bg-[#07201C]/60">
                      <th className="py-3.5 px-6">Assinante</th>
                      <th className="py-3.5 px-4">Especialidade</th>
                      <th className="py-3.5 px-4">Pagamento & Comprovante</th>
                      <th className="py-3.5 px-4 text-right">Valor Anual</th>
                      <th className="py-3.5 px-4">Status & Vigência</th>
                      <th className="py-3.5 px-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#B7DB74]/10 text-xs">
                    {filteredSubscriptions.map((sub) => {
                      const validUntil = new Date(
                        sub.validUntilIso
                      ).toLocaleDateString('pt-BR');
                      const isActive = sub.status === 'ativa';
                      return (
                        <tr
                          key={sub.id}
                          className="hover:bg-[#B7DB74]/5 transition-colors"
                        >
                          <td className="py-4 px-6">
                            <div className="text-sm font-medium text-[#F4FBF6]">
                              {sub.subscriberName}
                            </div>
                            <div className="text-[#A8CCB9] mt-0.5">
                              {sub.subscriberEmail}
                              {sub.phone ? ` · ${sub.phone}` : ''}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-[#CBE3D6]">
                            <div>{SPECIALTY_LABELS[sub.specialty]}</div>
                            {sub.healthFocus && (
                              <div className="text-[#85AF9B] truncate max-w-[220px] mt-0.5">
                                {sub.healthFocus}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-[#CBE3D6]">
                            <div>{PAYMENT_METHOD_LABELS[sub.paymentMethod]}</div>
                            <div className="font-mono tabular-nums text-[#C7E88B] mt-0.5">
                              Recibo {sub.receiptCode}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right font-mono tabular-nums font-semibold text-[#F4FBF6]">
                            {formatBrl(sub.totalAmountBrl)}
                          </td>
                          <td className="py-4 px-4">
                            <div
                              className={`font-medium ${
                                isActive ? 'text-emerald-300' : 'text-red-300'
                              }`}
                            >
                              {isActive ? 'Ativa' : 'Cancelada'}
                            </div>
                            <div className="font-mono tabular-nums text-[#85AF9B] mt-0.5">
                              Até {validUntil}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                disabled={busySubId === sub.id}
                                onClick={() => handleToggleSubStatus(sub)}
                                className="px-3 py-1.5 text-xs font-medium text-[#DDF3B2] border border-[#B7DB74]/35 rounded-full hover:bg-[#B7DB74]/14 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                              >
                                {isActive ? 'Cancelar' : 'Reativar'}
                              </button>

                              {confirmDeleteSubId === sub.id ? (
                                <button
                                  type="button"
                                  disabled={busySubId === sub.id}
                                  onClick={() => handleDeleteSub(sub)}
                                  className="px-3 py-1.5 text-xs font-semibold text-red-200 bg-red-950/70 border border-red-400/45 rounded-full cursor-pointer whitespace-nowrap"
                                >
                                  Confirmar exclusão
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteSubId(sub.id)}
                                  aria-label="Remover assinatura"
                                  className="p-1.5 text-[#85AF9B] hover:text-red-300 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: PLANS, PRICING & CLINICAL OVERSIGHT                           */}
      {/* ===================================================================== */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          {/* Editable Annual Plan Pricing */}
          <form
            onSubmit={handleSaveSettings}
            className="glass-obsidian rounded-2xl p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
                  Valores do Plano Anual (12 Meses)
                </h3>
                <p className="text-xs text-[#A8CCB9] mt-0.5">
                  Os valores atualizados aqui passam a valer imediatamente na
                  página inicial e no checkout de assinatura.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingSettings}
                className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingSettings ? 'Salvando...' : 'Salvar valores'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Nome exibido do plano
                </label>
                <input
                  type="text"
                  value={settingsDraft.annualPlanHeadline}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      annualPlanHeadline: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Parcela Cartão 12x (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settingsDraft.annualCardInstallmentBrl}
                  onChange={(e) => {
                    const inst = Number(e.target.value);
                    setSettingsDraft({
                      ...settingsDraft,
                      annualCardInstallmentBrl: inst,
                      annualCardTotalBrl: Number((inst * 12).toFixed(2)),
                    });
                  }}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Total Cartão 12 Meses (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settingsDraft.annualCardTotalBrl}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      annualCardTotalBrl: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  PIX Anual à Vista (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settingsDraft.annualPixTotalBrl}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      annualPixTotalBrl: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Selo de desconto PIX
                </label>
                <input
                  type="text"
                  value={settingsDraft.annualPixDiscountLabel}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      annualPixDiscountLabel: e.target.value,
                    })
                  }
                  placeholder="10% OFF"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Boleto Anual 12 Meses (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settingsDraft.annualBoletoTotalBrl}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      annualBoletoTotalBrl: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>
            </div>
          </form>

          {/* Cross-Platform Clinical Records Overview */}
          <section className="glass-obsidian rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#B7DB74]/14 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
                  Visão Geral de Planos e Atendimentos
                </h3>
                <p className="text-xs text-[#A8CCB9] tabular-nums">
                  {allMealPlans.length} planos alimentares ·{' '}
                  {allVideoSessions.length} videochamadas ·{' '}
                  {allCompounding.length} fórmulas manipuladas
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-[#061A17] border border-[#B7DB74]/18 rounded-lg">
                {(
                  [
                    ['mealPlans', 'Planos Alimentares'],
                    ['videos', 'Videochamadas'],
                    ['compounding', 'Manipulados'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOversightTab(key)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      oversightTab === key
                        ? 'bg-[#B7DB74]/22 text-[#DDF3B2] font-medium'
                        : 'text-[#A8CCB9] hover:text-[#F4FBF6]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {oversightTab === 'mealPlans' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#B7DB74]/14 text-[#85AF9B] bg-[#07201C]/60">
                      <th className="py-3 px-6">Plano Alimentar</th>
                      <th className="py-3 px-4 text-right">Meta Diária</th>
                      <th className="py-3 px-4 text-right">Refeições</th>
                      <th className="py-3 px-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#B7DB74]/10">
                    {allMealPlans.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-[#85AF9B]">
                          Nenhum plano alimentar cadastrado ainda.
                        </td>
                      </tr>
                    ) : (
                      allMealPlans.map((plan) => (
                        <tr key={plan.id} className="hover:bg-[#B7DB74]/5">
                          <td className="py-3.5 px-6">
                            <div className="text-sm font-medium text-[#F4FBF6]">
                              {plan.title}
                            </div>
                            <div className="text-[#85AF9B] truncate max-w-md">
                              {plan.objectiveSummary || 'Sem resumo cadastrado'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#F4FBF6]">
                            {plan.targetCalories} kcal
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#CBE3D6]">
                            {plan.meals.length}
                          </td>
                          <td className="py-3.5 px-6 text-right text-[#C7E88B] font-medium">
                            {PLAN_STATUS_LABELS[plan.status]}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {oversightTab === 'videos' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#B7DB74]/14 text-[#85AF9B] bg-[#07201C]/60">
                      <th className="py-3 px-6">Paciente</th>
                      <th className="py-3 px-4">Especialidade</th>
                      <th className="py-3 px-4">Data e Horário</th>
                      <th className="py-3 px-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#B7DB74]/10">
                    {allVideoSessions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-[#85AF9B]">
                          Nenhuma videochamada agendada ainda.
                        </td>
                      </tr>
                    ) : (
                      allVideoSessions.map((vs) => (
                        <tr key={vs.id} className="hover:bg-[#B7DB74]/5">
                          <td className="py-3.5 px-6 text-sm font-medium text-[#F4FBF6]">
                            {vs.patientName}
                          </td>
                          <td className="py-3.5 px-4 text-[#CBE3D6]">
                            {SPECIALTY_LABELS[vs.specialty]}
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums text-[#C7E88B]">
                            {vs.scheduledDate} · {vs.scheduledTime}
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            <select
                              aria-label={`Alterar status da videochamada de ${vs.patientName}`}
                              value={vs.status}
                              onChange={async (e) => {
                                const nextStatus = e.target
                                  .value as VideoSession['status'];
                                await adminUpdateVideoSessionStatus(
                                  vs.id,
                                  nextStatus
                                );
                                onNotify(
                                  `Status da videochamada de ${vs.patientName} atualizado.`
                                );
                              }}
                              className="px-2.5 py-1.5 text-xs bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/28 rounded-lg focus:outline-none focus:border-[#C7E88B] cursor-pointer"
                            >
                              <option value="agendada">Agendada</option>
                              <option value="em_andamento">Em andamento</option>
                              <option value="concluida">Concluída</option>
                              <option value="cancelada">Cancelada</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {oversightTab === 'compounding' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#B7DB74]/14 text-[#85AF9B] bg-[#07201C]/60">
                      <th className="py-3 px-6">Fórmula Manipulada</th>
                      <th className="py-3 px-4">Paciente</th>
                      <th className="py-3 px-4 text-right">Ativos / Doses</th>
                      <th className="py-3 px-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#B7DB74]/10">
                    {allCompounding.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-[#85AF9B]">
                          Nenhuma prescrição de vitaminas manipuladas criada ainda.
                        </td>
                      </tr>
                    ) : (
                      allCompounding.map((rx) => (
                        <tr key={rx.id} className="hover:bg-[#B7DB74]/5">
                          <td className="py-3.5 px-6">
                            <div className="text-sm font-medium text-[#F4FBF6]">
                              {rx.formulaTitle}
                            </div>
                            <div className="text-[#85AF9B]">
                              {SPECIALTY_LABELS[rx.specialty]}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-[#CBE3D6]">
                            {rx.patientName}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#CBE3D6]">
                            {rx.actives.length} ativos · {rx.totalDoses} doses
                          </td>
                          <td className="py-3.5 px-6 text-right font-medium text-[#C7E88B] capitalize">
                            {rx.status}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: PHOTOS & SITE CONTENT CMS                                     */}
      {/* ===================================================================== */}
      {activeTab === 'content' && (
        <div className="space-y-7">
          {/* Photos Manager */}
          <section className="glass-obsidian rounded-2xl p-6 space-y-5">
            <div>
              <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
                Fotos do Site
              </h3>
              <p className="text-xs text-[#A8CCB9] mt-0.5">
                Envie fotos diretamente do seu computador ou celular (otimização
                automática) ou cole um link de imagem. As alterações aparecem
                imediatamente no site.
              </p>
            </div>

            {mediaError && (
              <div
                role="alert"
                className="px-4 py-3 text-xs text-red-200 bg-red-950/60 border border-red-400/35 rounded-xl"
              >
                {mediaError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {SITE_MEDIA_SLOTS.map((slot) => {
                const custom = siteMedia[slot.slotKey];
                const previewSrc =
                  custom?.imageUrl || DEFAULT_SLOT_IMAGES[slot.slotKey];
                const isBusy = uploadingSlot === slot.slotKey;

                return (
                  <div
                    key={slot.slotKey}
                    className="p-4 rounded-xl bg-[#07201C]/80 border border-[#B7DB74]/18 flex flex-col gap-3.5"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-24 h-20 rounded-lg overflow-hidden bg-[#144239] border border-[#B7DB74]/20 shrink-0 flex items-center justify-center">
                        {previewSrc ? (
                          <img
                            src={previewSrc}
                            alt={slot.defaultAlt}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-[#85AF9B]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-[#F4FBF6]">
                          {slot.label}
                        </div>
                        <p className="text-xs text-[#85AF9B] mt-0.5 leading-relaxed">
                          {slot.description}
                        </p>
                        <div className="text-[11px] text-[#C7E88B] mt-1">
                          {custom ? 'Foto personalizada ativa' : 'Usando imagem padrão'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="btn-gold inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isBusy ? 'Enviando...' : 'Enviar foto'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isBusy}
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            void handleFileUpload(
                              slot.slotKey,
                              slot.label,
                              slot.defaultAlt,
                              f
                            );
                            e.target.value = '';
                          }}
                        />
                      </label>

                      {custom && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleResetSlot(slot.slotKey, slot.label)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#A8CCB9] hover:text-[#F4FBF6] border border-[#B7DB74]/25 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restaurar padrão</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={urlDrafts[slot.slotKey] || ''}
                        onChange={(e) =>
                          setUrlDrafts((prev) => ({
                            ...prev,
                            [slot.slotKey]: e.target.value,
                          }))
                        }
                        placeholder="Ou cole o link (https://...) de uma foto"
                        className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-[#041210] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/20 rounded-lg focus:outline-none focus:border-[#C7E88B]"
                      />
                      <button
                        type="button"
                        disabled={isBusy || !(urlDrafts[slot.slotKey] || '').trim()}
                        onClick={() =>
                          handleSaveUrlSlot(slot.slotKey, slot.label, slot.defaultAlt)
                        }
                        className="px-3 py-1.5 text-xs font-medium text-[#DDF3B2] border border-[#B7DB74]/35 rounded-lg hover:bg-[#B7DB74]/14 transition-colors cursor-pointer disabled:opacity-45 whitespace-nowrap"
                      >
                        Aplicar link
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Site Copy & Brand Settings */}
          <form
            onSubmit={handleSaveSettings}
            className="glass-obsidian rounded-2xl p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
                  Textos, Identidade e Contatos do Site
                </h3>
                <p className="text-xs text-[#A8CCB9] mt-0.5">
                  Personalize o título principal, apresentação clínica e canais
                  de contato exibidos aos visitantes.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingSettings}
                className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingSettings ? 'Salvando...' : 'Salvar textos do site'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Nome da Marca / Profissional
                </label>
                <input
                  type="text"
                  required
                  value={settingsDraft.brandName}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, brandName: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Subtítulo da Marca
                </label>
                <input
                  type="text"
                  value={settingsDraft.brandSubtitle}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      brandSubtitle: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Frase de abertura (acima do título)
                </label>
                <input
                  type="text"
                  value={settingsDraft.heroEyebrow}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      heroEyebrow: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Título principal da capa
                </label>
                <input
                  type="text"
                  required
                  value={settingsDraft.heroTitle}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, heroTitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Descrição principal da capa
                </label>
                <textarea
                  rows={2}
                  value={settingsDraft.heroDescription}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      heroDescription: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Título da seção Nosso Método
                </label>
                <input
                  type="text"
                  value={settingsDraft.methodTitle}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      methodTitle: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Título do banner inferior
                </label>
                <input
                  type="text"
                  value={settingsDraft.bannerTitle}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      bannerTitle: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Texto da seção Nosso Método
                </label>
                <textarea
                  rows={2}
                  value={settingsDraft.methodDescription}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      methodDescription: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] resize-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Texto do banner inferior
                </label>
                <textarea
                  rows={2}
                  value={settingsDraft.bannerDescription}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      bannerDescription: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  WhatsApp oficial do consultório
                </label>
                <input
                  type="text"
                  value={settingsDraft.whatsappContact}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      whatsappContact: e.target.value,
                    })
                  }
                  placeholder="(11) 99999-0000"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                  Instagram
                </label>
                <input
                  type="text"
                  value={settingsDraft.instagramHandle}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      instagramHandle: e.target.value,
                    })
                  }
                  placeholder="@dimitrabratu"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                />
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: AUTHORIZED ADMINISTRATORS (RBAC)                              */}
      {/* ===================================================================== */}
      {activeTab === 'admins' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Grant Admin Access Form */}
          <form
            onSubmit={handleGrantAdmin}
            className="lg:col-span-5 glass-obsidian rounded-2xl p-6 space-y-4"
          >
            <div>
              <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
                Liberar Novo Administrador
              </h3>
              <p className="text-xs text-[#A8CCB9] mt-1 leading-relaxed">
                Somente os e-mails Google listados aqui (com conta verificada)
                podem enxergar esta área, editar fotos/textos ou ver assinantes
                e pagamentos.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                E-mail Google do administrador
              </label>
              <input
                type="email"
                required
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="nome@gmail.com"
                className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                Nome completo
              </label>
              <input
                type="text"
                required
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="Ex.: Equipe Clínica Dimitra"
                className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                Função / Cargo
              </label>
              <input
                type="text"
                value={newAdminRole}
                onChange={(e) => setNewAdminRole(e.target.value)}
                placeholder="Gestão Financeira / Equipe"
                className="w-full px-3.5 py-2.5 text-sm bg-[#061A17] text-[#F4FBF6] border border-[#B7DB74]/24 rounded-xl focus:outline-none focus:border-[#C7E88B]"
              />
            </div>

            {adminError && (
              <p role="alert" className="text-xs text-red-300">
                {adminError}
              </p>
            )}

            <button
              type="submit"
              disabled={grantingAdmin}
              className="w-full btn-gold inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-60"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {grantingAdmin ? 'Liberando acesso...' : 'Liberar acesso de administrador'}
              </span>
            </button>
          </form>

          {/* Authorized Admins List */}
          <section className="lg:col-span-7 glass-obsidian rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#B7DB74]/14">
              <h3 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
                Administradores Liberados
              </h3>
              <p className="text-xs text-[#A8CCB9] mt-0.5 tabular-nums">
                {admins.length + 1} conta{admins.length > 0 ? 's' : ''} com
                permissão administrativa ativa
              </p>
            </div>

            <div className="divide-y divide-[#B7DB74]/12">
              {/* Permanent Primary Admin */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-[#F4FBF6]">
                    {SPECIALIST_PROFILE.title} · Proprietária
                  </div>
                  <div className="text-xs font-mono text-[#C7E88B] mt-0.5">
                    {PRIMARY_ADMIN_EMAIL} · WhatsApp {SPECIALIST_PROFILE.phoneDisplay}
                  </div>
                  <div className="text-[11px] text-[#A8CCB9] mt-0.5">
                    {SPECIALIST_PROFILE.formation} · Reconhecimento automático ativo
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 shrink-0">
                  <Check className="w-3.5 h-3.5" />
                  <span>Acesso principal</span>
                </div>
              </div>

              {/* Delegated Admins */}
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-[#B7DB74]/5 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-[#F4FBF6]">
                      {admin.displayName}
                    </div>
                    <div className="text-xs text-[#A8CCB9] mt-0.5">
                      <span className="font-mono text-[#C7E88B]">
                        {admin.email}
                      </span>{' '}
                      · {admin.roleLabel}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {confirmRevokeId === admin.id ? (
                      <button
                        type="button"
                        onClick={() => handleRevokeAdmin(admin)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-red-200 bg-red-950/70 border border-red-400/45 rounded-full cursor-pointer whitespace-nowrap"
                      >
                        Confirmar revogação
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRevokeId(admin.id)}
                        className="px-3.5 py-1.5 text-xs font-medium text-[#A8CCB9] hover:text-red-300 border border-[#B7DB74]/20 hover:border-red-400/40 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Revogar acesso
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
