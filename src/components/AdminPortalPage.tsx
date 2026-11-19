import React, { useMemo, useState } from 'react';
import { signInWithPopup, signOut, User } from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CreditCard,
  Edit3,
  ExternalLink,
  FlaskConical,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { BOTANICAL_THEME_IMAGES } from '../data/seedData';
import { auth, googleProvider } from '../lib/firebase';
import { adminUpdatePatientStatus } from '../lib/firestoreService';
import { calculateAge, calculateBMI, classifyBMI } from '../lib/nutrition';
import {
  AdminUser,
  AnnualSubscription,
  buildSpecialistWhatsAppUrl,
  ClinicalGoal,
  ClinicalSpecialty,
  CompoundingPrescription,
  GOAL_LABELS,
  MealPlan,
  Patient,
  PATIENT_STATUS_LABELS,
  PatientStatus,
  SiteMediaItem,
  SiteMediaSlotKey,
  SiteSettings,
  SPECIALIST_PROFILE,
  SPECIALTY_LABELS,
  VideoSession,
} from '../types';
import { AdminPanelView } from './AdminPanelView';
import { AdminVideoRoomView } from './AdminVideoRoomView';
import { MOTION_EASE, SpotlightCard, VerbenaEmblem } from './LuxuryPrimitives';

type AdminPortalSection =
  | 'overview'
  | 'video'
  | 'patients'
  | 'content'
  | 'subscribers'
  | 'plans'
  | 'admins';

interface AdminPortalPageProps {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  adminChecked: boolean;
  siteSettings: SiteSettings;
  siteMedia: Partial<Record<SiteMediaSlotKey, SiteMediaItem>>;
  admins: AdminUser[];
  allPatients: Patient[];
  allSubscriptions: AnnualSubscription[];
  allMealPlans: MealPlan[];
  allVideoSessions: VideoSession[];
  allCompounding: CompoundingPrescription[];
  onOpenPublicSite: () => void;
  onOpenClinicalWorkspace: (patientId?: string, openSection?: 'plans' | 'video' | 'dashboard') => void;
  onAddPatient: () => void;
  onEditPatient: (patient: Patient) => void;
  onDeletePatient: (patientId: string) => Promise<void>;
  onCreateCompoundingFromCall?: (params: {
    patientId: string;
    patientName: string;
    specialty: ClinicalSpecialty;
    clinicalCaseNotes: string;
  }) => void;
  onNotify: (message: string) => void;
}

const formatBrl = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

function buildPatientWhatsAppHref(phone: string, patientName: string): string {
  const digits = phone.replace(/\D/g, '');
  const fullDigits = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${fullDigits}?text=${encodeURIComponent(
    `Olá ${patientName.split(' ')[0]}, aqui é a Dra. Dimitra Bratu! Como está o seu acompanhamento nutricional?`
  )}`;
}

export function AdminPortalPage({
  user,
  authReady,
  isAdmin,
  adminChecked,
  siteSettings,
  siteMedia,
  admins,
  allPatients,
  allSubscriptions,
  allMealPlans,
  allVideoSessions,
  allCompounding,
  onOpenPublicSite,
  onOpenClinicalWorkspace,
  onAddPatient,
  onEditPatient,
  onDeletePatient,
  onCreateCompoundingFromCall,
  onNotify,
}: AdminPortalPageProps) {
  const [section, setSection] = useState<AdminPortalSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingStartVideoId, setPendingStartVideoId] = useState<string | null>(
    null
  );

  // Patient manager state
  const [patientSearch, setPatientSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PatientStatus>('all');
  const [goalFilter, setGoalFilter] = useState<'all' | ClinicalGoal>('all');
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [confirmDeletePatientId, setConfirmDeletePatientId] = useState<string | null>(null);
  const [busyPatientId, setBusyPatientId] = useState<string | null>(null);

  const specialistPhoto =
    siteMedia.specialist_avatar?.imageUrl || SPECIALIST_PROFILE.photoUrl;
  const specialistWhatsappDisplay =
    siteSettings.whatsappContact || SPECIALIST_PROFILE.phoneDisplay;
  const specialistWhatsappHref = buildSpecialistWhatsAppUrl(
    undefined,
    specialistWhatsappDisplay
  );

  async function handleAdminSignIn() {
    setLoginLoading(true);
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('popup-closed-by-user')) {
        setLoginError('Login cancelado. Clique novamente para acessar.');
      } else {
        setLoginError(
          'Não foi possível autenticar agora. Verifique se popups estão habilitados.'
        );
      }
    } finally {
      setLoginLoading(false);
    }
  }

  // Cross-platform metrics
  const activeSubs = useMemo(
    () => allSubscriptions.filter((s) => s.status === 'ativa'),
    [allSubscriptions]
  );
  const totalActiveRevenue = useMemo(
    () => activeSubs.reduce((sum, s) => sum + (Number(s.totalAmountBrl) || 0), 0),
    [activeSubs]
  );
  const activePatientsCount = useMemo(
    () => allPatients.filter((p) => p.status !== 'arquivado').length,
    [allPatients]
  );
  const upcomingVideoSessions = useMemo(
    () =>
      allVideoSessions
        .filter((v) => v.status === 'agendada' || v.status === 'em_andamento')
        .sort((a, b) => {
          if (a.hostInRoom && !b.hostInRoom) return -1;
          if (!a.hostInRoom && b.hostInRoom) return 1;
          return `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(
            `${b.scheduledDate} ${b.scheduledTime}`
          );
        }),
    [allVideoSessions]
  );
  const scheduledVideosCount = upcomingVideoSessions.length;

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    return allPatients.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (goalFilter !== 'all' && p.goal !== goalFilter) return false;
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.clinicalNotes.toLowerCase().includes(q) ||
        p.restrictions.some((r) => r.toLowerCase().includes(q)) ||
        GOAL_LABELS[p.goal].toLowerCase().includes(q)
      );
    });
  }, [allPatients, patientSearch, statusFilter, goalFilter]);

  async function handleQuickPatientStatus(
    patient: Patient,
    nextStatus: PatientStatus
  ) {
    setBusyPatientId(patient.id);
    try {
      await adminUpdatePatientStatus(patient.id, nextStatus);
      onNotify(
        `Status de ${patient.fullName} alterado para ${PATIENT_STATUS_LABELS[nextStatus]}.`
      );
    } finally {
      setBusyPatientId(null);
    }
  }

  async function handleConfirmDeletePatient(patient: Patient) {
    setBusyPatientId(patient.id);
    try {
      await onDeletePatient(patient.id);
      setConfirmDeletePatientId(null);
    } finally {
      setBusyPatientId(null);
    }
  }

  // 1. Loading Auth/RBAC Check
  if (!authReady || (user && !adminChecked)) {
    return (
      <div className="min-h-screen bg-[#041210] text-[#F3FAF6] flex flex-col items-center justify-center gap-4">
        <VerbenaEmblem className="w-10 h-10" />
        <div className="text-xs tracking-[0.2em] text-[#B7DB74]">
          Verificando credenciais administrativas...
        </div>
      </div>
    );
  }

  // 2. Standalone Admin Login Screen (completely separate from the public landing page)
  if (!user) {
    return (
      <div className="min-h-screen bg-[#041210] text-[#F3FAF6] relative flex flex-col justify-between overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0"
        >
          <img
            src={BOTANICAL_THEME_IMAGES.springWaterBackdrop}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#041210]/85 via-[#061D1A]/85 to-[#041210]/96" />
        </div>

        <header className="relative z-10 max-w-6xl w-full mx-auto px-6 h-20 flex items-center justify-between gap-6 border-b border-[#D4F0E0]/16">
          <div className="inline-flex items-center gap-3 whitespace-nowrap shrink-0">
            <VerbenaEmblem className="w-7 h-7" />
            <span className="font-display text-xl tracking-[0.08em] font-semibold text-white">
              Portal Administrativo
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenPublicSite}
            className="inline-flex items-center gap-2 text-xs font-medium text-[#DDF3B2] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para a página pública</span>
          </button>
        </header>

        <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
          <SpotlightCard
            glowRim
            className="max-w-lg w-full rounded-3xl p-8 sm:p-10 space-y-6 text-center"
          >
            <div className="flex flex-col items-center gap-3">
              <img
                src={specialistPhoto}
                alt={SPECIALIST_PROFILE.title}
                referrerPolicy="no-referrer"
                className="w-24 h-24 rounded-full object-cover object-top border-2 border-[#B7DB74]/75 shadow-[0_14px_32px_-12px_rgba(0,0,0,0.85)]"
              />
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C7E88B]">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Acesso Restrito · Administração do Site e Pacientes</span>
                </div>
                <h1 className="font-display text-4xl font-semibold text-white leading-tight">
                  {SPECIALIST_PROFILE.title}
                </h1>
                <p className="text-xs text-[#A8CCB9]">
                  {SPECIALIST_PROFILE.formation}
                </p>
              </div>
            </div>

            <p className="text-sm text-[#CBE3D6] leading-relaxed">
              Esta área é exclusiva para gerenciamento completo do conteúdo,
              fotos, preços, assinantes, agenda e prontuários de pacientes.
              Entre com o e-mail titular{' '}
              <span className="font-mono text-[#DDF3B2]">
                {SPECIALIST_PROFILE.email}
              </span>{' '}
              ou conta de administrador autorizada.
            </p>

            {loginError && (
              <div
                role="alert"
                className="px-4 py-3 text-xs text-red-100 bg-red-950/75 border border-red-400/35 rounded-xl text-left"
              >
                {loginError}
              </div>
            )}

            <div className="space-y-3 pt-1">
              <button
                type="button"
                disabled={loginLoading}
                onClick={handleAdminSignIn}
                className="btn-botanical w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full text-sm font-semibold cursor-pointer disabled:opacity-60"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {loginLoading
                    ? 'Verificando acesso...'
                    : 'Entrar como Administradora (Google)'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onOpenPublicSite}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium text-[#CBE3D6] border border-[#D4F0E0]/24 hover:border-[#B7DB74] hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Ir para o site público</span>
              </button>
            </div>
          </SpotlightCard>
        </main>

        <footer className="relative z-10 max-w-6xl w-full mx-auto px-6 py-6 border-t border-[#D4F0E0]/14 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#8DB5A2]">
          <span>
            {siteSettings.brandName} · Ambiente Administrativo Separado (/admin)
          </span>
          <span className="font-mono">
            {SPECIALIST_PROFILE.email} · {specialistWhatsappDisplay}
          </span>
        </footer>
      </div>
    );
  }

  // 3. Signed-in Non-Admin Block Screen
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#041210] text-[#F3FAF6] flex items-center justify-center px-6 py-12">
        <SpotlightCard
          glowRim
          className="max-w-lg w-full rounded-3xl p-8 sm:p-10 space-y-6 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-red-950/60 border border-red-400/35 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7 text-red-300" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-semibold text-white">
              Acesso Administrativo Restrito
            </h1>
            <p className="text-sm text-[#CBE3D6] leading-relaxed">
              A conta conectada (
              <span className="font-mono text-[#DDF3B2]">{user.email}</span>) não
              possui permissão administrativa. Somente{' '}
              <span className="font-mono text-white">
                {SPECIALIST_PROFILE.email}
              </span>{' '}
              ou administradores autorizados pela Dra. Dimitra Bratu podem
              acessar esta página.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenClinicalWorkspace(undefined, 'dashboard')}
              className="btn-botanical px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer"
            >
              Ir para Área do Assinante
            </button>
            <button
              type="button"
              onClick={async () => {
                await signOut(auth);
                void handleAdminSignIn();
              }}
              className="px-5 py-2.5 rounded-full text-xs font-medium text-white border border-[#D4F0E0]/30 hover:border-[#B7DB74] transition-colors cursor-pointer"
            >
              Trocar de conta Google
            </button>
            <button
              type="button"
              onClick={onOpenPublicSite}
              className="px-4 py-2.5 text-xs text-[#A8CCB9] hover:text-white transition-colors cursor-pointer"
            >
              Ver site público
            </button>
          </div>
        </SpotlightCard>
      </div>
    );
  }

  // 4. Authenticated Authorized Admin Standalone Portal
  const navItems: Array<{
    id: AdminPortalSection;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }> = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    {
      id: 'video',
      label: 'Sala de Videochamada',
      icon: Video,
      count: scheduledVideosCount,
    },
    {
      id: 'patients',
      label: 'Controle de Pacientes',
      icon: Users,
      count: allPatients.length,
    },
    {
      id: 'content',
      label: 'Conteúdo e Fotos do Site',
      icon: ImageIcon,
    },
    {
      id: 'subscribers',
      label: 'Assinantes e Pagamentos',
      icon: CreditCard,
      count: activeSubs.length,
    },
    {
      id: 'plans',
      label: 'Planos, Vídeos e Manipulados',
      icon: ClipboardList,
      count: allMealPlans.length + allVideoSessions.length + allCompounding.length,
    },
    {
      id: 'admins',
      label: 'Administradores',
      icon: ShieldCheck,
      count: admins.length + 1,
    },
  ];

  const sectionTitles: Record<AdminPortalSection, string> = {
    overview: 'Visão Geral Executiva',
    video: 'Sala de Videochamada · Aguardar Paciente',
    patients: 'Gestão Completa de Pacientes',
    content: 'Conteúdo, Textos e Fotos do Site Público',
    subscribers: 'Assinantes e Pagamentos (12 Meses)',
    plans: 'Preços, Planos Alimentares, Videochamadas e Manipulados',
    admins: 'Controle de Administradores e Segurança',
  };

  return (
    <div className="min-h-screen bg-[#041210] text-[#F3FAF6] flex relative">
      {/* Subtle Botanical Emerald Spring Water Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <img
          src={BOTANICAL_THEME_IMAGES.springWaterBackdrop}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#041210]/94 via-[#061D1A]/88 to-[#041210]/96" />
      </div>

      {/* Dedicated Standalone Admin Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 z-20 bg-[#051815]/92 backdrop-blur-xl border-r border-[#D4F0E0]/18">
        <div className="p-5 border-b border-[#D4F0E0]/16 space-y-3">
          <div className="flex items-center gap-3">
            <img
              src={specialistPhoto}
              alt={SPECIALIST_PROFILE.title}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-full object-cover object-top border-2 border-[#B7DB74]/75 shrink-0"
            />
            <div className="min-w-0">
              <div className="font-display text-lg tracking-wide font-semibold text-white leading-tight truncate">
                Admin · Dra. Dimitra
              </div>
              <div className="text-[11px] text-[#B7DB74] truncate">
                Portal Administrativo Exclusivo
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onOpenPublicSite}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#DDF3B2] bg-[#0B2A25] border border-[#D4F0E0]/22 hover:border-[#B7DB74] transition-colors cursor-pointer whitespace-nowrap"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Ver Site Público</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenClinicalWorkspace(undefined, 'dashboard')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#CBE3D6] bg-[#0B2A25] border border-[#D4F0E0]/22 hover:border-[#B7DB74] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <Stethoscope className="w-3 h-3" />
              <span>Consultório</span>
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5" aria-label="Navegação administrativa">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`relative w-full flex items-center justify-between px-3.5 py-2.5 text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'text-white font-semibold'
                    : 'text-[#B5D6C5] hover:text-white hover:bg-[#14453E]/45 font-medium'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="activeAdminSidebarIndicator"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-xl btn-botanical"
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10 flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span
                    className={`relative z-10 text-xs font-mono tabular-nums ${
                      active ? 'text-[#E8F8DC]' : 'text-[#7AA38F]'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#D4F0E0]/16 space-y-2.5">
          <div className="px-2 space-y-1">
            <div className="text-xs font-semibold text-white truncate">
              {SPECIALIST_PROFILE.title}
            </div>
            <div className="text-[11px] font-mono text-[#9CC2AF] truncate">
              {user.email}
            </div>
            <a
              href={specialistWhatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#DDF3B2] hover:text-white transition-colors"
            >
              <Phone className="w-3 h-3 text-[#B7DB74]" />
              <span>{specialistWhatsappDisplay}</span>
            </a>
          </div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#B5D6C5] hover:text-white hover:bg-[#14453E]/45 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-[#B7DB74]" />
            <span>Sair do Admin</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: MOTION_EASE }}
              className="relative w-72 max-w-[85vw] bg-[#051815] h-full border-r border-[#D4F0E0]/20 flex flex-col"
            >
              <div className="h-16 px-5 flex items-center justify-between border-b border-[#D4F0E0]/16">
                <span className="font-display text-lg font-semibold text-white">
                  Admin · Dra. Dimitra
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Fechar menu administrativo"
                  className="p-2 text-[#9CC2AF] hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSection(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm rounded-xl cursor-pointer ${
                        active
                          ? 'btn-botanical font-semibold text-white'
                          : 'text-[#B5D6C5] hover:bg-[#14453E]/45 font-medium'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </span>
                      {typeof item.count === 'number' && (
                        <span className="text-xs font-mono tabular-nums">
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-[#D4F0E0]/16 space-y-2">
                <button
                  type="button"
                  onClick={onOpenPublicSite}
                  className="w-full py-2 px-3 rounded-xl text-xs font-medium text-[#DDF3B2] border border-[#D4F0E0]/24 text-left flex items-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver Site Público</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenClinicalWorkspace(undefined, 'dashboard')}
                  className="w-full py-2 px-3 rounded-xl text-xs font-medium text-[#CBE3D6] border border-[#D4F0E0]/20 text-left flex items-center gap-2"
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Consultório Clínico</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Standalone Admin Viewport */}
      <div className="relative z-10 flex-1 lg:pl-72 flex flex-col min-w-0">
        <header className="h-18 bg-[#051815]/85 backdrop-blur-xl border-b border-[#D4F0E0]/16 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu administrativo"
              className="lg:hidden p-2 -ml-2 text-[#D1E8DC] hover:text-white rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 text-sm min-w-0">
              <span className="text-[#8DB5A2] hidden sm:inline whitespace-nowrap">
                Administração (/admin)
              </span>
              <span className="text-[#D4F0E0]/35 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-editorial text-2xl font-semibold text-white truncate tracking-wide">
                {sectionTitles[section]}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={onAddPatient}
            className="btn-botanical inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Novo Paciente</span>
          </button>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-7 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: MOTION_EASE }}
              className="space-y-6"
            >
              {/* ============================================================= */}
              {/* SECTION 1: EXECUTIVE OVERVIEW                                 */}
              {/* ============================================================= */}
              {section === 'overview' && (
                <div className="space-y-6">
                  <SpotlightCard glowRim className="p-6 sm:p-7 rounded-2xl">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <img
                          src={specialistPhoto}
                          alt={SPECIALIST_PROFILE.title}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-full object-cover object-top border-2 border-[#B7DB74]/75 shrink-0"
                        />
                        <div>
                          <div className="text-xs font-semibold text-[#C7E88B]">
                            Painel Exclusivo · Separado da Página Pública
                          </div>
                          <h2 className="font-display text-3xl font-semibold text-white leading-tight mt-0.5">
                            Bem-vinda, {SPECIALIST_PROFILE.title}
                          </h2>
                          <p className="text-xs text-[#A8CCB9] mt-1">
                            Controle completo de pacientes, conteúdo do site,
                            fotos, assinaturas 12 meses, videochamadas e fórmulas
                            manipuladas.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSection('video')}
                          className="btn-botanical inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Iniciar Videochamada</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSection('patients')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium text-white border border-[#D4F0E0]/30 hover:border-[#B7DB74] hover:bg-[#113A34] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Users className="w-3.5 h-3.5 text-[#B7DB74]" />
                          <span>Gerenciar Pacientes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSection('content')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium text-white border border-[#D4F0E0]/30 hover:border-[#B7DB74] hover:bg-[#113A34] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-[#B7DB74]" />
                          <span>Editar Fotos e Textos</span>
                        </button>
                      </div>
                    </div>
                  </SpotlightCard>

                  {/* 4 Key KPIs */}
                  <div className="glass-botanical rounded-2xl">
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#D4F0E0]/16">
                      <button
                        type="button"
                        onClick={() => setSection('patients')}
                        className="p-6 text-left hover:bg-[#14453E]/30 transition-colors cursor-pointer"
                      >
                        <div className="text-xs text-[#A8CCB9] mb-1">
                          Pacientes cadastrados
                        </div>
                        <div className="font-display text-4xl font-semibold tabular-nums text-[#C7E88B]">
                          {allPatients.length}
                        </div>
                        <div className="text-xs text-[#85AF9B] mt-1 tabular-nums">
                          {activePatientsCount} em atendimento ativo
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSection('subscribers')}
                        className="p-6 text-left hover:bg-[#14453E]/30 transition-colors cursor-pointer"
                      >
                        <div className="text-xs text-[#A8CCB9] mb-1">
                          Assinantes ativos (12 meses)
                        </div>
                        <div className="font-display text-4xl font-semibold tabular-nums text-white">
                          {activeSubs.length}
                        </div>
                        <div className="text-xs text-[#85AF9B] mt-1 tabular-nums">
                          Receita: {formatBrl(totalActiveRevenue)}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSection('video')}
                        className="p-6 text-left hover:bg-[#14453E]/30 transition-colors cursor-pointer"
                      >
                        <div className="text-xs text-[#A8CCB9] mb-1">
                          Videochamadas agendadas
                        </div>
                        <div className="font-display text-4xl font-semibold tabular-nums text-white">
                          {scheduledVideosCount}
                        </div>
                        <div className="text-xs text-[#85AF9B] mt-1 tabular-nums">
                          {allVideoSessions.length} sessões no histórico
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSection('plans')}
                        className="p-6 text-left hover:bg-[#14453E]/30 transition-colors cursor-pointer"
                      >
                        <div className="text-xs text-[#A8CCB9] mb-1">
                          Planos &amp; Manipulados
                        </div>
                        <div className="font-display text-4xl font-semibold tabular-nums text-white">
                          {allMealPlans.length + allCompounding.length}
                        </div>
                        <div className="text-xs text-[#85AF9B] mt-1 tabular-nums">
                          {allMealPlans.length} planos · {allCompounding.length}{' '}
                          fórmulas
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Scheduled Video Calls Quick Launcher */}
                  <SpotlightCard className="p-6 rounded-2xl space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display text-2xl font-semibold text-white">
                          Próximas Videochamadas Agendadas
                        </h3>
                        <p className="text-xs text-[#A8CCB9]">
                          Abra a sala de vídeo para aguardar o paciente agendado
                          em tempo real
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSection('video')}
                        className="text-xs font-medium text-[#DDF3B2] hover:text-white cursor-pointer"
                      >
                        Abrir Sala Completa →
                      </button>
                    </div>

                    {upcomingVideoSessions.length === 0 ? (
                      <div className="py-6 text-center space-y-3">
                        <p className="text-xs text-[#85AF9B]">
                          Nenhuma videochamada agendada no momento.
                        </p>
                        <button
                          type="button"
                          onClick={() => setSection('video')}
                          className="btn-botanical inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Agendar ou abrir sala agora</span>
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#D4F0E0]/12">
                        {upcomingVideoSessions.slice(0, 4).map((vid) => (
                          <div
                            key={vid.id}
                            className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-white">
                                  {vid.patientName}
                                </span>
                                {vid.hostInRoom && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#B7DB74]/20 border border-[#B7DB74]/50 text-[#E5F7C4]">
                                    {vid.patientInRoom
                                      ? 'Paciente na sala'
                                      : 'Aguardando paciente'}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[#9CC2AF]">
                                <span className="font-mono text-[#DDF3B2]">
                                  {vid.scheduledDate} · {vid.scheduledTime}
                                </span>{' '}
                                · {SPECIALTY_LABELS[vid.specialty]}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingStartVideoId(vid.id);
                                setSection('video');
                              }}
                              className="btn-botanical inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>
                                {vid.hostInRoom
                                  ? 'Voltar para sala'
                                  : 'Iniciar sala e aguardar'}
                              </span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </SpotlightCard>

                  {/* Recent Patients + Recent Subscribers Split */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SpotlightCard className="p-6 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-display text-2xl font-semibold text-white">
                            Pacientes Recentes
                          </h3>
                          <p className="text-xs text-[#A8CCB9]">
                            Últimos prontuários atualizados na plataforma
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSection('patients')}
                          className="text-xs font-medium text-[#DDF3B2] hover:text-white cursor-pointer"
                        >
                          Ver todos →
                        </button>
                      </div>

                      {allPatients.length === 0 ? (
                        <div className="py-8 text-center space-y-3">
                          <p className="text-xs text-[#85AF9B]">
                            Nenhum paciente cadastrado ainda.
                          </p>
                          <button
                            type="button"
                            onClick={onAddPatient}
                            className="btn-botanical inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Cadastrar primeiro paciente</span>
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-[#D4F0E0]/12">
                          {allPatients.slice(0, 5).map((p) => (
                            <div
                              key={p.id}
                              className="py-3 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white truncate">
                                  {p.fullName}
                                </div>
                                <div className="text-xs text-[#85AF9B] truncate">
                                  {GOAL_LABELS[p.goal]} · {p.targetCalories} kcal ·{' '}
                                  {PATIENT_STATUS_LABELS[p.status]}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => onEditPatient(p)}
                                className="px-3 py-1.5 rounded-lg text-xs text-[#DDF3B2] border border-[#D4F0E0]/24 hover:border-[#B7DB74] cursor-pointer shrink-0"
                              >
                                Editar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </SpotlightCard>

                    <SpotlightCard className="p-6 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-display text-2xl font-semibold text-white">
                            Assinantes Recentes (12 Meses)
                          </h3>
                          <p className="text-xs text-[#A8CCB9]">
                            Pagamentos e especialidades escolhidas
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSection('subscribers')}
                          className="text-xs font-medium text-[#DDF3B2] hover:text-white cursor-pointer"
                        >
                          Ver todos →
                        </button>
                      </div>

                      {allSubscriptions.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[#85AF9B]">
                          Nenhuma assinatura registrada até o momento.
                        </div>
                      ) : (
                        <div className="divide-y divide-[#D4F0E0]/12">
                          {allSubscriptions.slice(0, 5).map((sub) => (
                            <div
                              key={sub.id}
                              className="py-3 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white truncate">
                                  {sub.subscriberName}
                                </div>
                                <div className="text-xs text-[#85AF9B] truncate">
                                  {SPECIALTY_LABELS[sub.specialty]} ·{' '}
                                  {sub.status === 'ativa' ? 'Ativa' : 'Cancelada'}
                                </div>
                              </div>
                              <div className="text-xs font-mono tabular-nums text-[#C7E88B] shrink-0">
                                {formatBrl(sub.totalAmountBrl)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </SpotlightCard>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* SECTION 2: HOST VIDEO WAITING ROOM STUDIO                     */}
              {/* ============================================================= */}
              {section === 'video' && (
                <AdminVideoRoomView
                  adminUserId={user.uid}
                  specialistPhoto={specialistPhoto}
                  allPatients={allPatients}
                  allSubscriptions={allSubscriptions}
                  allVideoSessions={allVideoSessions}
                  initialStartSessionId={pendingStartVideoId}
                  onConsumeInitialStartSession={() =>
                    setPendingStartVideoId(null)
                  }
                  onPrescribeCompounding={(params) => {
                    if (onCreateCompoundingFromCall) {
                      onCreateCompoundingFromCall(params);
                    } else {
                      onOpenClinicalWorkspace(params.patientId || undefined, 'dashboard');
                    }
                  }}
                  onNotify={onNotify}
                />
              )}

              {/* ============================================================= */}
              {/* SECTION 3: COMPLETE PATIENT MANAGEMENT                        */}
              {/* ============================================================= */}
              {section === 'patients' && (
                <div className="space-y-6">
                  <SpotlightCard glowRim className="p-5 sm:p-6 rounded-2xl space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h2 className="font-display text-3xl font-semibold text-white">
                          Controle Total de Pacientes
                        </h2>
                        <p className="text-xs text-[#A8CCB9] mt-0.5 tabular-nums">
                          {filteredPatients.length} de {allPatients.length}{' '}
                          prontuários exibidos · Crie, edite, altere status,
                          visualize planos ou exclua registros
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onAddPatient}
                        className="btn-botanical inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap self-start md:self-auto"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Cadastrar Novo Paciente</span>
                      </button>
                    </div>

                    {/* Search & Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-[#D4F0E0]/14">
                      <div className="md:col-span-6 relative">
                        <Search className="w-4 h-4 text-[#85AF9B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="search"
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          placeholder="Buscar por nome, e-mail, telefone, restrição ou anamnese..."
                          className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#061A17] text-white placeholder-[#719C88] border border-[#D4F0E0]/22 rounded-xl focus:outline-none focus:border-[#B7DB74]"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <select
                          aria-label="Filtrar pacientes por status"
                          value={statusFilter}
                          onChange={(e) =>
                            setStatusFilter(
                              e.target.value as 'all' | PatientStatus
                            )
                          }
                          className="w-full px-3.5 py-2.5 text-xs bg-[#061A17] text-white border border-[#D4F0E0]/22 rounded-xl focus:outline-none focus:border-[#B7DB74]"
                        >
                          <option value="all">Todos os status</option>
                          <option value="ativo">Ativo</option>
                          <option value="em_acompanhamento">
                            Em acompanhamento
                          </option>
                          <option value="arquivado">Arquivado</option>
                        </select>
                      </div>

                      <div className="md:col-span-3">
                        <select
                          aria-label="Filtrar pacientes por objetivo"
                          value={goalFilter}
                          onChange={(e) =>
                            setGoalFilter(
                              e.target.value as 'all' | ClinicalGoal
                            )
                          }
                          className="w-full px-3.5 py-2.5 text-xs bg-[#061A17] text-white border border-[#D4F0E0]/22 rounded-xl focus:outline-none focus:border-[#B7DB74]"
                        >
                          <option value="all">Todos os objetivos</option>
                          {(Object.keys(GOAL_LABELS) as ClinicalGoal[]).map(
                            (g) => (
                              <option key={g} value={g}>
                                {GOAL_LABELS[g]}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    </div>
                  </SpotlightCard>

                  {filteredPatients.length === 0 ? (
                    <SpotlightCard className="p-12 rounded-2xl text-center space-y-4">
                      <Users className="w-9 h-9 text-[#85AF9B] mx-auto" />
                      <div className="space-y-1">
                        <h3 className="font-display text-2xl font-semibold text-white">
                          Nenhum paciente encontrado
                        </h3>
                        <p className="text-xs text-[#A8CCB9]">
                          Ajuste os filtros de busca ou cadastre um novo
                          paciente agora mesmo.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onAddPatient}
                        className="btn-botanical inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Novo Paciente</span>
                      </button>
                    </SpotlightCard>
                  ) : (
                    <div className="space-y-3.5">
                      {filteredPatients.map((patient) => {
                        const age = calculateAge(patient.birthYear);
                        const bmi = calculateBMI(
                          patient.weightKg,
                          patient.heightCm
                        );
                        const bmiCat = classifyBMI(bmi);
                        const linkedPlans = allMealPlans.filter(
                          (m) => m.patientId === patient.id
                        );
                        const linkedVideos = allVideoSessions.filter(
                          (v) => v.patientId === patient.id
                        );
                        const linkedFormulas = allCompounding.filter(
                          (c) => c.patientId === patient.id
                        );
                        const expanded = expandedPatientId === patient.id;
                        const busy = busyPatientId === patient.id;

                        return (
                          <div
                            key={patient.id}
                            className="glass-botanical rounded-2xl p-5 space-y-4"
                          >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <h3 className="font-display text-2xl font-semibold text-white leading-none">
                                    {patient.fullName}
                                  </h3>
                                  <span className="text-xs text-[#C7E88B]">
                                    · {GOAL_LABELS[patient.goal]}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#A8CCB9]">
                                  <span>
                                    {patient.sex === 'F' ? 'Feminino' : 'Masculino'},{' '}
                                    {age} anos
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    {patient.weightKg} kg · {patient.heightCm} cm
                                    (IMC {bmi} — {bmiCat})
                                  </span>
                                  {patient.email && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono">
                                        {patient.email}
                                      </span>
                                    </>
                                  )}
                                  {patient.phone && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono">
                                        {patient.phone}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Inline Admin Actions */}
                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <select
                                  aria-label={`Status de ${patient.fullName}`}
                                  disabled={busy}
                                  value={patient.status}
                                  onChange={(e) =>
                                    handleQuickPatientStatus(
                                      patient,
                                      e.target.value as PatientStatus
                                    )
                                  }
                                  className="px-3 py-1.5 text-xs bg-[#061A17] text-[#DDF3B2] border border-[#B7DB74]/35 rounded-lg focus:outline-none focus:border-[#B7DB74] cursor-pointer"
                                >
                                  <option value="ativo">Ativo</option>
                                  <option value="em_acompanhamento">
                                    Em acompanhamento
                                  </option>
                                  <option value="arquivado">Arquivado</option>
                                </select>

                                {patient.phone && (
                                  <a
                                    href={buildPatientWhatsAppHref(
                                      patient.phone,
                                      patient.fullName
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#DDF3B2] border border-[#D4F0E0]/26 rounded-lg hover:border-[#B7DB74] hover:bg-[#113A34] transition-colors whitespace-nowrap"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                    <span>WhatsApp</span>
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onEditPatient(patient)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white border border-[#D4F0E0]/26 rounded-lg hover:border-[#B7DB74] hover:bg-[#113A34] transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-[#B7DB74]" />
                                  <span>Editar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenClinicalWorkspace(patient.id, 'plans')
                                  }
                                  className="btn-botanical inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                                >
                                  <ClipboardList className="w-3.5 h-3.5" />
                                  <span>Abrir Plano</span>
                                </button>

                                {confirmDeletePatientId === patient.id ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() =>
                                        handleConfirmDeletePatient(patient)
                                      }
                                      className="px-3 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-600 rounded-lg cursor-pointer"
                                    >
                                      Confirmar exclusão
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmDeletePatientId(null)
                                      }
                                      className="px-2.5 py-1.5 text-xs text-[#A8CCB9] hover:text-white cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmDeletePatientId(patient.id)
                                    }
                                    aria-label={`Excluir ${patient.fullName}`}
                                    className="p-2 text-[#A8CCB9] hover:text-red-300 border border-[#D4F0E0]/18 hover:border-red-400/40 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Quantitative Clinical Strip */}
                            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#D4F0E0]/14 text-xs">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums text-[#CBE3D6]">
                                <span>
                                  Meta:{' '}
                                  <strong className="text-white">
                                    {patient.targetCalories} kcal
                                  </strong>
                                </span>
                                <span>P: {patient.targetProteinG}g</span>
                                <span>C: {patient.targetCarbsG}g</span>
                                <span>G: {patient.targetFatG}g</span>
                                <span>Água: {patient.waterTargetLiters}L</span>
                              </div>

                              <div className="flex flex-wrap items-center gap-4 text-[#A8CCB9] tabular-nums">
                                <span className="inline-flex items-center gap-1">
                                  <ClipboardList className="w-3.5 h-3.5 text-[#B7DB74]" />
                                  {linkedPlans.length} plano(s)
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Video className="w-3.5 h-3.5 text-[#B7DB74]" />
                                  {linkedVideos.length} vídeo(s)
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <FlaskConical className="w-3.5 h-3.5 text-[#B7DB74]" />
                                  {linkedFormulas.length} manipulado(s)
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedPatientId(
                                      expanded ? null : patient.id
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-[#DDF3B2] hover:text-white cursor-pointer"
                                >
                                  <span>
                                    {expanded
                                      ? 'Ocultar prontuário'
                                      : 'Ver anamnese'}
                                  </span>
                                  {expanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {expanded && (
                              <div className="p-4 rounded-xl bg-[#061A17]/85 border border-[#D4F0E0]/16 space-y-2.5 text-xs">
                                <div>
                                  <span className="text-[#C7E88B] font-semibold">
                                    Restrições alimentares:{' '}
                                  </span>
                                  <span className="text-[#E1F3E9]">
                                    {patient.restrictions.length > 0
                                      ? patient.restrictions.join(' · ')
                                      : 'Nenhuma restrição informada'}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-[#C7E88B] font-semibold mb-1">
                                    Anotações Clínicas / Anamnese:
                                  </div>
                                  <p className="text-[#CBE3D6] whitespace-pre-wrap leading-relaxed">
                                    {patient.clinicalNotes ||
                                      'Sem anotações clínicas registradas.'}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* SECTIONS 3–6: SITE CONTENT, SUBSCRIBERS, PLANS, ADMINS        */}
              {/* ============================================================= */}
              {(section === 'content' ||
                section === 'subscribers' ||
                section === 'plans' ||
                section === 'admins') && (
                <AdminPanelView
                  currentUserEmail={user.email || ''}
                  siteSettings={siteSettings}
                  siteMedia={siteMedia}
                  admins={admins}
                  allSubscriptions={allSubscriptions}
                  allMealPlans={allMealPlans}
                  allVideoSessions={allVideoSessions}
                  allCompounding={allCompounding}
                  controlledTab={section}
                  hideHeader
                  onNotify={onNotify}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
