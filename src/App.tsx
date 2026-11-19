import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookOpen,
  ClipboardList,
  Crown,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircleHeart,
  Microscope,
  Plus,
  ShieldCheck,
  Users,
  Video,
  X,
} from 'lucide-react';
import { AdminPanelView } from './components/AdminPanelView';
import { AiRecipeGeneratorModal } from './components/AiRecipeGeneratorModal';
import { AuthGate } from './components/AuthGate';
import {
  CompoundingPrefill,
  CompoundingPrescriptionsView,
} from './components/CompoundingPrescriptionsView';
import { DashboardView } from './components/DashboardView';
import { DimitraConsultationView } from './components/DimitraConsultationView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MOTION_EASE, VerbenaEmblem } from './components/LuxuryPrimitives';
import { MealPlanBuilder } from './components/MealPlanBuilder';
import { PatientFormModal } from './components/PatientFormModal';
import { PatientsView } from './components/PatientsView';
import { RecipeDetailDrawer } from './components/RecipeDetailDrawer';
import { RecipeModal } from './components/RecipeModal';
import { RecipesView } from './components/RecipesView';
import { ResearchView } from './components/ResearchView';
import { SubscriptionView } from './components/SubscriptionView';
import { VideoConsultationView } from './components/VideoConsultationView';
import { auth } from './lib/firebase';
import {
  checkUserIsAdmin,
  concludeMealPlan,
  createMealPlan,
  createPatient,
  createRecipe,
  deleteMealPlan,
  deletePatient,
  deleteRecipe,
  seedDemoClinicalWorkspace,
  subscribeToAdmins,
  subscribeToAllCompoundingAdmin,
  subscribeToAllMealPlansAdmin,
  subscribeToAllSubscriptionsAdmin,
  subscribeToAllVideoSessionsAdmin,
  subscribeToCompoundingPrescriptions,
  subscribeToConsultations,
  subscribeToMealPlans,
  subscribeToPatients,
  subscribeToRecipes,
  subscribeToSiteMedia,
  subscribeToSiteSettings,
  subscribeToUserSubscriptions,
  subscribeToVideoSessions,
  updateMealPlan,
  updatePatient,
  updateRecipe,
} from './lib/firestoreService';
import { generateSafeId } from './lib/nutrition';
import {
  ActiveSection,
  AdminUser,
  AnnualSubscription,
  ClinicalSpecialty,
  CompoundingPrescription,
  Consultation,
  DEFAULT_SITE_SETTINGS,
  MealPlan,
  Patient,
  Recipe,
  SCHEMA_LIMITS,
  SiteMediaItem,
  SiteMediaSlotKey,
  SiteSettings,
  VideoSession,
} from './types';

function WorkspaceApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [section, setSection] = useState<ActiveSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [subscriptions, setSubscriptions] = useState<AnnualSubscription[]>([]);
  const [videoSessions, setVideoSessions] = useState<VideoSession[]>([]);
  const [compoundingPrescriptions, setCompoundingPrescriptions] = useState<
    CompoundingPrescription[]
  >([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [aiRecipeModalOpen, setAiRecipeModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [inspectedRecipe, setInspectedRecipe] = useState<Recipe | null>(null);
  const [pendingResearchQuery, setPendingResearchQuery] = useState('');
  const [pendingSpecialty, setPendingSpecialty] = useState<ClinicalSpecialty>(
    'metabolica_emagrecimento'
  );
  const [compoundingPrefill, setCompoundingPrefill] =
    useState<CompoundingPrefill | null>(null);
  const [pendingVideoSessionId, setPendingVideoSessionId] = useState<
    string | null
  >(null);

  // Live Site CMS (public read) & Restricted Admin RBAC state
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(
    DEFAULT_SITE_SETTINGS
  );
  const [siteMedia, setSiteMedia] = useState<
    Partial<Record<SiteMediaSlotKey, SiteMediaItem>>
  >({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminAllSubscriptions, setAdminAllSubscriptions] = useState<
    AnnualSubscription[]
  >([]);
  const [adminAllMealPlans, setAdminAllMealPlans] = useState<MealPlan[]>([]);
  const [adminAllVideoSessions, setAdminAllVideoSessions] = useState<
    VideoSession[]
  >([]);
  const [adminAllCompounding, setAdminAllCompounding] = useState<
    CompoundingPrescription[]
  >([]);

  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => {
      setToast((curr) => (curr === message ? null : curr));
    }, 3200);
  }

  // Subscribe to public site settings & custom photos immediately (for landing page + app)
  useEffect(() => {
    const unsubSettings = subscribeToSiteSettings(setSiteSettings);
    const unsubMedia = subscribeToSiteMedia(setSiteMedia);
    return () => {
      unsubSettings();
      unsubMedia();
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setPatients([]);
        setRecipes([]);
        setMealPlans([]);
        setConsultations([]);
        setSubscriptions([]);
        setVideoSessions([]);
        setCompoundingPrescriptions([]);
        setIsAdmin(false);
        setAdmins([]);
        setAdminAllSubscriptions([]);
        setAdminAllMealPlans([]);
        setAdminAllVideoSessions([]);
        setAdminAllCompounding([]);
        setDataLoading(false);
      } else {
        void checkUserIsAdmin(
          firebaseUser.uid,
          firebaseUser.email,
          firebaseUser.emailVerified
        ).then((allowed) => {
          setIsAdmin(allowed);
          if (!allowed) {
            setSection((curr) => (curr === 'admin' ? 'dashboard' : curr));
          }
        });
      }
    });
    return () => unsub();
  }, []);

  // Attach admin-only cross-platform listeners strictly when verified as admin
  useEffect(() => {
    if (!authReady || !user || !isAdmin) return;
    const unsubAdmins = subscribeToAdmins(setAdmins);
    const unsubAllSubs = subscribeToAllSubscriptionsAdmin(
      setAdminAllSubscriptions
    );
    const unsubAllPlans = subscribeToAllMealPlansAdmin(setAdminAllMealPlans);
    const unsubAllVideos = subscribeToAllVideoSessionsAdmin(
      setAdminAllVideoSessions
    );
    const unsubAllCompounding = subscribeToAllCompoundingAdmin(
      setAdminAllCompounding
    );
    return () => {
      unsubAdmins();
      unsubAllSubs();
      unsubAllPlans();
      unsubAllVideos();
      unsubAllCompounding();
    };
  }, [authReady, user, isAdmin]);

  useEffect(() => {
    if (!authReady || !user) return;
    setDataLoading(true);
    setFirestoreError(null);

    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 3) setDataLoading(false);
    };

    const onErr = (err: Error) => {
      setFirestoreError(err.message);
      setDataLoading(false);
    };

    const unsubPatients = subscribeToPatients(
      user.uid,
      (list) => {
        setPatients(list);
        markLoaded();
      },
      onErr
    );
    const unsubRecipes = subscribeToRecipes(
      user.uid,
      (list) => {
        setRecipes(list);
        markLoaded();
      },
      onErr
    );
    const unsubPlans = subscribeToMealPlans(
      user.uid,
      (list) => {
        setMealPlans(list);
        markLoaded();
      },
      onErr
    );
    const unsubConsultations = subscribeToConsultations(
      user.uid,
      (list) => setConsultations(list),
      onErr
    );
    const unsubSubscriptions = subscribeToUserSubscriptions(
      user.uid,
      (list) => setSubscriptions(list),
      onErr
    );
    const unsubVideos = subscribeToVideoSessions(
      user.uid,
      (list) => setVideoSessions(list),
      onErr
    );
    const unsubCompounding = subscribeToCompoundingPrescriptions(
      user.uid,
      (list) => setCompoundingPrescriptions(list),
      onErr
    );

    return () => {
      unsubPatients();
      unsubRecipes();
      unsubPlans();
      unsubConsultations();
      unsubSubscriptions();
      unsubVideos();
      unsubCompounding();
    };
  }, [authReady, user]);

  useEffect(() => {
    if (!inspectedRecipe) return;
    const fresh = recipes.find((r) => r.id === inspectedRecipe.id);
    if (fresh) {
      setInspectedRecipe(fresh);
    }
  }, [recipes, inspectedRecipe?.id]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0B0907] flex flex-col items-center justify-center gap-4">
        <VerbenaEmblem className="w-10 h-10" />
        <div className="text-xs tracking-[0.2em] text-[#D9AF72]">
          Carregando consultório...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGate
        siteSettings={siteSettings}
        siteMedia={siteMedia}
        onSelectSubscriptionIntent={(spec) => {
          setPendingSpecialty(spec);
          setSection('subscription');
        }}
      />
    );
  }

  const activeSubscription =
    subscriptions.find((s) => s.status === 'ativa') || null;

  const nutritionistName = 'Nutricionista Dimitra Bratu';

  async function handleSavePatient(
    data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) {
    if (existingId) {
      await updatePatient(existingId, data);
      showToast('Prontuário do paciente atualizado.');
    } else {
      const newId = await createPatient(data);
      setSelectedPatientId(newId);
      showToast('Paciente cadastrado com sucesso.');
    }
  }

  async function handleDeletePatient(patientId: string) {
    const relatedPlans = mealPlans.filter((p) => p.patientId === patientId);
    for (const pl of relatedPlans) {
      await deleteMealPlan(pl.id);
    }
    await deletePatient(patientId);
    if (selectedPatientId === patientId) {
      setSelectedPatientId(null);
    }
    showToast('Paciente removido do consultório.');
  }

  async function handleSaveRecipe(
    data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) {
    if (existingId) {
      await updateRecipe(existingId, data);
      showToast('Receita atualizada na biblioteca.');
    } else {
      await createRecipe(data);
      showToast('Nova receita adicionada à biblioteca.');
    }
  }

  async function handleDeleteRecipe(recipeId: string) {
    await deleteRecipe(recipeId);
    showToast('Receita excluída da biblioteca.');
  }

  async function handleAssignRecipeToPlan(
    planId: string,
    mealSlotId: string,
    recipe: Recipe,
    multiplier: number
  ) {
    const plan = mealPlans.find((p) => p.id === planId);
    if (!plan || plan.status === 'concluido') return;

    const updatedMeals = plan.meals.map((meal) => {
      if (meal.id !== mealSlotId) return meal;
      return {
        ...meal,
        items: [
          ...meal.items,
          {
            id: generateSafeId('item'),
            recipeId: recipe.id,
            name: recipe.title,
            portion:
              multiplier === 1
                ? recipe.portionLabel
                : `${multiplier}x (${recipe.portionLabel})`,
            calories: Math.round(recipe.calories * multiplier),
            proteinG: Number((recipe.proteinG * multiplier).toFixed(1)),
            carbsG: Number((recipe.carbsG * multiplier).toFixed(1)),
            fatG: Number((recipe.fatG * multiplier).toFixed(1)),
            fiberG: Number((recipe.fiberG * multiplier).toFixed(1)),
            substitution: recipe.clinicalTip.slice(0, 220),
          },
        ],
      };
    });

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = plan;
    await updateMealPlan(planId, { ...rest, meals: updatedMeals });
    showToast(`Receita adicionada ao plano "${plan.title}".`);
  }

  async function handleSeedDemo() {
    if (!user) return;
    setSeeding(true);
    try {
      await seedDemoClinicalWorkspace(user.uid);
      showToast('Casos clínicos, receitas e planos de exemplo carregados.');
    } finally {
      setSeeding(false);
    }
  }

  const navItems: Array<{
    id: ActiveSection;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
    tag?: string;
  }> = [
    { id: 'dashboard', label: 'Painel Clínico', icon: LayoutDashboard },
    {
      id: 'subscription',
      label: 'Assinatura 12 Meses',
      icon: Crown,
      tag: activeSubscription ? 'Ativa' : undefined,
    },
    {
      id: 'video',
      label: 'Videochamada',
      icon: Video,
      count: videoSessions.length,
    },
    {
      id: 'compounding',
      label: 'Vitaminas Manipuladas',
      icon: FlaskConical,
      count: compoundingPrescriptions.length,
    },
    {
      id: 'consultation',
      label: 'Atendimento Dimitra',
      icon: MessageCircleHeart,
      count: consultations.length,
    },
    { id: 'patients', label: 'Pacientes', icon: Users, count: patients.length },
    {
      id: 'plans',
      label: 'Planos Alimentares',
      icon: ClipboardList,
      count: mealPlans.length,
    },
    { id: 'recipes', label: 'Receitas', icon: BookOpen, count: recipes.length },
    { id: 'research', label: 'Evidência Científica', icon: Microscope },
    ...(isAdmin
      ? [
          {
            id: 'admin' as ActiveSection,
            label: 'Administração',
            icon: ShieldCheck,
            tag: 'Restrito',
          },
        ]
      : []),
  ];

  const sectionTitleMap: Record<ActiveSection, string> = {
    dashboard: 'Painel Clínico',
    subscription: 'Assinatura Anual · 12 Meses',
    video: 'Videochamada · Dra. Dimitra Bratu',
    compounding: 'Vitaminas Manipuladas',
    consultation: 'Atendimento · Dra. Dimitra Bratu',
    patients: 'Pacientes',
    plans: 'Planos Alimentares',
    recipes: 'Biblioteca de Receitas',
    research: 'Evidência Científica',
    admin: 'Administração do Site',
  };

  const selectedPatientName =
    section === 'plans'
      ? patients.find((p) => p.id === selectedPatientId)?.fullName ||
        patients[0]?.fullName
      : null;

  const primaryAction =
    section === 'recipes'
      ? {
          label: 'Nova receita',
          onClick: () => {
            setEditingRecipe(null);
            setRecipeModalOpen(true);
          },
        }
      : {
          label: 'Novo paciente',
          onClick: () => {
            setEditingPatient(null);
            setPatientModalOpen(true);
          },
        };

  async function handleSaveClinicalNoteFromChat(
    patient: Patient,
    noteSnippet: string
  ) {
    const existingNotes = patient.clinicalNotes?.trim() || '';
    const combined = existingNotes
      ? `${existingNotes}\n${noteSnippet}`
      : noteSnippet;
    const truncated = combined.slice(0, SCHEMA_LIMITS.PATIENT_NOTES_MAX);
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = patient;
    await updatePatient(patient.id, {
      ...rest,
      clinicalNotes: truncated,
    });
  }

  return (
    <div className="min-h-screen bg-[#0B0907] text-[#F5EFE6] flex relative">
      {/* Ambient gold stage light */}
      <div
        aria-hidden="true"
        className="no-print pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-40 right-10 w-[560px] h-[560px] rounded-full bg-[#D9AF72]/7 blur-[140px]" />
        <div className="absolute bottom-[-120px] left-60 w-[440px] h-[440px] rounded-full bg-[#B5833E]/6 blur-[140px]" />
      </div>

      {/* Desktop Smoked Obsidian Sidebar */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 z-20 bg-[#100D0A]/92 backdrop-blur-xl border-r border-[#D9AF72]/16">
        <div className="h-18 px-6 flex items-center gap-3 border-b border-[#D9AF72]/14">
          <VerbenaEmblem className="w-7 h-7 shrink-0" />
          <div className="min-w-0">
            <div className="font-editorial text-lg tracking-[0.12em] font-semibold text-[#FAF5EC] leading-none whitespace-nowrap truncate">
              {siteSettings.brandName}
            </div>
            <div className="text-[10px] tracking-[0.16em] text-[#DFBA7C] mt-1 whitespace-nowrap truncate">
              {siteSettings.brandSubtitle}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5" aria-label="Navegação principal">
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
                    ? 'text-[#120D08] font-semibold'
                    : 'text-[#BDB2A4] hover:text-[#FAF5EC] hover:bg-[#D9AF72]/8 font-medium'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="activeSidebarIndicator"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-xl btn-gold"
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10 flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.tag ? (
                  <span
                    className={`relative z-10 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      active
                        ? 'bg-[#2C1E0B]/20 text-[#120D08]'
                        : 'bg-[#D9AF72]/18 text-[#F0D29C]'
                    }`}
                  >
                    {item.tag}
                  </span>
                ) : (
                  typeof item.count === 'number' && (
                    <span
                      className={`relative z-10 text-xs font-mono tabular-nums ${
                        active ? 'text-[#2C1E0B]/80' : 'text-[#84796B]'
                      }`}
                    >
                      {item.count}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#D9AF72]/14 space-y-3">
          <div className="px-2">
            <div className="text-sm font-medium text-[#FAF5EC] truncate">
              {nutritionistName}
            </div>
            <div className="text-xs text-[#8D8274] truncate">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#BDB2A4] hover:text-[#FAF5EC] hover:bg-[#D9AF72]/10 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 text-[#D9AF72]" />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="no-print fixed inset-0 z-50 lg:hidden flex">
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
              className="relative w-64 max-w-[82vw] bg-[#110D0A] h-full border-r border-[#D9AF72]/20 flex flex-col"
            >
              <div className="h-16 px-5 flex items-center justify-between border-b border-[#D9AF72]/14">
                <div className="flex items-center gap-2.5">
                  <VerbenaEmblem className="w-6 h-6" />
                  <span className="font-editorial text-base tracking-[0.12em] font-semibold text-[#FAF5EC] whitespace-nowrap">
                    DIMITRA BRATU
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Fechar menu"
                  className="p-2 text-[#A89E90] hover:text-[#FAF5EC] rounded-lg"
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
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm rounded-xl transition-colors cursor-pointer ${
                        active
                          ? 'btn-gold font-semibold'
                          : 'text-[#BDB2A4] hover:bg-[#D9AF72]/10 font-medium'
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
              <div className="p-4 border-t border-[#D9AF72]/14">
                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#BDB2A4] hover:bg-[#D9AF72]/10 rounded-xl"
                >
                  <LogOut className="w-3.5 h-3.5 text-[#D9AF72]" />
                  Sair da conta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Viewport */}
      <div className="relative z-10 flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left + 1 Primary Metallic Gold Action on right */}
        <header className="no-print h-18 bg-[#0E0B08]/85 backdrop-blur-xl border-b border-[#D9AF72]/14 px-4 sm:px-8 flex items-center justify-between gap-6 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
              className="lg:hidden p-2 -ml-2 text-[#CFC5B8] hover:text-[#FAF5EC] rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 text-sm min-w-0">
              <span className="text-[#8F8476] hidden sm:inline whitespace-nowrap">
                Consultório
              </span>
              <span className="text-[#D9AF72]/40 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-editorial text-2xl font-medium text-[#FAF5EC] truncate tracking-wide">
                {sectionTitleMap[section]}
              </h1>
              {selectedPatientName && (
                <>
                  <span className="text-[#D9AF72]/40 hidden md:inline" aria-hidden="true">
                    /
                  </span>
                  <span className="text-[#DFBA7C] hidden md:inline truncate text-sm">
                    {selectedPatientName}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={primaryAction.onClick}
            className="btn-gold inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            {primaryAction.label}
          </button>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-7 max-w-7xl w-full mx-auto">
          {firestoreError && (
            <div
              role="alert"
              className="mb-6 px-4 py-3 text-sm text-red-200 bg-red-950/60 border border-red-400/30 rounded-xl"
            >
              Não foi possível sincronizar alguns dados com o servidor. Verifique sua conexão ou recarregue a página.
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: MOTION_EASE }}
            >
              {section === 'dashboard' && (
                <DashboardView
                  userId={user.uid}
                  patients={patients}
                  recipes={recipes}
                  mealPlans={mealPlans}
                  videoSessions={videoSessions}
                  activeSubscription={activeSubscription}
                  loading={dataLoading}
                  seeding={seeding}
                  onSeedDemo={handleSeedDemo}
                  onOpenNewPatient={() => {
                    setEditingPatient(null);
                    setPatientModalOpen(true);
                  }}
                  onOpenNewRecipe={() => {
                    setEditingRecipe(null);
                    setRecipeModalOpen(true);
                  }}
                  onOpenPatientPlan={(patientId) => {
                    setSelectedPatientId(patientId);
                    setSection('plans');
                  }}
                  onSelectRecipe={(rec) => setInspectedRecipe(rec)}
                  onNavigatePatients={() => setSection('patients')}
                  onNavigateRecipes={() => setSection('recipes')}
                  onQuickResearch={(q) => {
                    setPendingResearchQuery(q);
                    setSection('research');
                  }}
                  onOpenConsultation={() => setSection('consultation')}
                  onOpenVideoTab={() => setSection('video')}
                  onJoinVideoSession={(sessionId) => {
                    setPendingVideoSessionId(sessionId);
                    setSection('video');
                  }}
                  onNotify={showToast}
                />
              )}

              {section === 'subscription' && (
                <SubscriptionView
                  userId={user.uid}
                  userName={user.displayName || ''}
                  userEmail={user.email || ''}
                  activeSubscription={activeSubscription}
                  siteSettings={siteSettings}
                  defaultSpecialty={pendingSpecialty}
                  onGoToVideo={() => setSection('video')}
                  onGoToCompounding={() => setSection('compounding')}
                  onGoToRecipes={() => setSection('recipes')}
                  onGoToConsultation={() => setSection('consultation')}
                  onNotify={showToast}
                />
              )}

              {section === 'video' && (
                <VideoConsultationView
                  userId={user.uid}
                  patients={patients}
                  videoSessions={videoSessions}
                  activeSubscription={activeSubscription}
                  specialistAvatarUrl={siteMedia.specialist_avatar?.imageUrl}
                  initialSessionId={pendingVideoSessionId}
                  onConsumeInitialSession={() => setPendingVideoSessionId(null)}
                  onCreateCompoundingFromCall={(prefillData) => {
                    setCompoundingPrefill(prefillData);
                    setSection('compounding');
                  }}
                  onOpenRecipes={() => setSection('recipes')}
                  onNotify={showToast}
                />
              )}

              {section === 'compounding' && (
                <CompoundingPrescriptionsView
                  userId={user.uid}
                  patients={patients}
                  recipes={recipes}
                  prescriptions={compoundingPrescriptions}
                  activeSubscription={activeSubscription}
                  prefill={compoundingPrefill}
                  onConsumePrefill={() => setCompoundingPrefill(null)}
                  onOpenRecipes={() => setSection('recipes')}
                  onNotify={showToast}
                />
              )}

              {section === 'consultation' && (
                <DimitraConsultationView
                  nutritionistId={user.uid}
                  patients={patients}
                  mealPlans={mealPlans}
                  recipes={recipes}
                  consultations={consultations}
                  initialPatientId={selectedPatientId}
                  onSaveClinicalNote={handleSaveClinicalNoteFromChat}
                  onOpenPatientPlan={(patientId) => {
                    setSelectedPatientId(patientId);
                    setSection('plans');
                  }}
                  onNotify={showToast}
                />
              )}

              {section === 'patients' && (
                <PatientsView
                  patients={patients}
                  mealPlans={mealPlans}
                  loading={dataLoading}
                  onAddPatient={() => {
                    setEditingPatient(null);
                    setPatientModalOpen(true);
                  }}
                  onEditPatient={(pat) => {
                    setEditingPatient(pat);
                    setPatientModalOpen(true);
                  }}
                  onDeletePatient={handleDeletePatient}
                  onOpenPatientPlan={(patientId) => {
                    setSelectedPatientId(patientId);
                    setSection('plans');
                  }}
                />
              )}

              {section === 'plans' && (
                <MealPlanBuilder
                  nutritionistId={user.uid}
                  nutritionistName={nutritionistName}
                  patients={patients}
                  recipes={recipes}
                  mealPlans={mealPlans}
                  selectedPatientId={selectedPatientId}
                  onSelectPatient={(id) => setSelectedPatientId(id)}
                  onCreatePlan={async (data) => {
                    const id = await createMealPlan(data);
                    showToast('Plano alimentar criado.');
                    return id;
                  }}
                  onUpdatePlan={async (planId, data) => {
                    await updateMealPlan(planId, data);
                    showToast('Plano alimentar salvo.');
                  }}
                  onConcludePlan={async (planId) => {
                    await concludeMealPlan(planId);
                    showToast('Plano marcado como concluído (histórico).');
                  }}
                  onDeletePlan={async (planId) => {
                    await deleteMealPlan(planId);
                    showToast('Plano alimentar excluído.');
                  }}
                  onInspectRecipe={(rec) => setInspectedRecipe(rec)}
                  onAddPatient={() => {
                    setEditingPatient(null);
                    setPatientModalOpen(true);
                  }}
                />
              )}

              {section === 'recipes' && (
                <RecipesView
                  recipes={recipes}
                  loading={dataLoading}
                  onAddRecipe={() => {
                    setEditingRecipe(null);
                    setRecipeModalOpen(true);
                  }}
                  onOpenAiRecipeGenerator={() => setAiRecipeModalOpen(true)}
                  onSelectRecipe={(rec) => setInspectedRecipe(rec)}
                />
              )}

              {section === 'research' && (
                <ResearchView
                  patients={patients}
                  initialQuery={pendingResearchQuery}
                  initialPatientId={selectedPatientId}
                  onConsumeInitialQuery={() => setPendingResearchQuery('')}
                />
              )}

              {section === 'admin' && isAdmin && (
                <AdminPanelView
                  currentUserEmail={user.email || ''}
                  siteSettings={siteSettings}
                  siteMedia={siteMedia}
                  admins={admins}
                  allSubscriptions={adminAllSubscriptions}
                  allMealPlans={adminAllMealPlans}
                  allVideoSessions={adminAllVideoSessions}
                  allCompounding={adminAllCompounding}
                  onNotify={showToast}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Modals & Drawers */}
      <PatientFormModal
        open={patientModalOpen}
        nutritionistId={user.uid}
        initialPatient={editingPatient}
        onClose={() => {
          setPatientModalOpen(false);
          setEditingPatient(null);
        }}
        onSubmit={handleSavePatient}
      />

      <RecipeModal
        open={recipeModalOpen}
        nutritionistId={user.uid}
        initialRecipe={editingRecipe}
        onClose={() => {
          setRecipeModalOpen(false);
          setEditingRecipe(null);
        }}
        onSubmit={handleSaveRecipe}
      />

      <AiRecipeGeneratorModal
        open={aiRecipeModalOpen}
        nutritionistId={user.uid}
        onClose={() => setAiRecipeModalOpen(false)}
        onSaveGeneratedRecipe={async (data) => {
          await createRecipe(data);
          showToast('Receita baseada em evidências salva na biblioteca.');
        }}
      />

      <RecipeDetailDrawer
        recipe={inspectedRecipe}
        patients={patients}
        mealPlans={mealPlans}
        onClose={() => setInspectedRecipe(null)}
        onEdit={(rec) => {
          setInspectedRecipe(null);
          setEditingRecipe(rec);
          setRecipeModalOpen(true);
        }}
        onDelete={handleDeleteRecipe}
        onAssignToPlan={handleAssignRecipeToPlan}
      />

      {/* Luminous Obsidian & Gold Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: MOTION_EASE }}
            role="status"
            className="no-print fixed bottom-6 right-6 z-50 glass-obsidian text-[#FAF5EC] text-xs font-medium px-4 py-3 rounded-xl border border-[#D9AF72]/40 shadow-[0_14px_40px_-10px_rgba(0,0,0,0.85)]"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceApp />
    </ErrorBoundary>
  );
}
