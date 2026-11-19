import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Crown,
  ExternalLink,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircleHeart,
  Microscope,
  Phone,
  Plus,
  ShieldCheck,
  Users,
  Video,
  X,
} from 'lucide-react';
import { AdminPanelView } from './components/AdminPanelView';
import { AdminPortalPage } from './components/AdminPortalPage';
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
import {
  VideoCallPrefill,
  VideoConsultationView,
} from './components/VideoConsultationView';
import { BOTANICAL_THEME_IMAGES } from './data/seedData';
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
  subscribeToAllPatientsAdmin,
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
  buildSpecialistWhatsAppUrl,
  ClinicalSpecialty,
  CompoundingPrescription,
  Consultation,
  DEFAULT_SITE_SETTINGS,
  isDraDimitraEmail,
  MealPlan,
  Patient,
  Recipe,
  SCHEMA_LIMITS,
  SiteMediaItem,
  SiteMediaSlotKey,
  SiteSettings,
  SPECIALIST_PROFILE,
  VideoSession,
} from './types';

function WorkspaceApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [routePath, setRoutePath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

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
  const [pendingVideoPrefill, setPendingVideoPrefill] =
    useState<VideoCallPrefill | null>(null);

  // Live Site CMS (public read) & Restricted Admin RBAC state
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(
    DEFAULT_SITE_SETTINGS
  );
  const [siteMedia, setSiteMedia] = useState<
    Partial<Record<SiteMediaSlotKey, SiteMediaItem>>
  >({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminAllPatients, setAdminAllPatients] = useState<Patient[]>([]);
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const salaId = params.get('sala');
      if (salaId) {
        setPendingVideoSessionId(salaId);
        setSection('video');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
    const handlePopState = () => {
      setRoutePath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function navigateRoute(path: string) {
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      window.scrollTo({ top: 0 });
    }
    setRoutePath(path);
  }

  const isAdminRoute =
    routePath === '/admin' ||
    routePath.startsWith('/admin/') ||
    routePath === '/administracao' ||
    routePath.startsWith('/administracao/');
  const isPublicPreviewRoute = routePath === '/site';

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
        setAdminChecked(true);
        setAdmins([]);
        setAdminAllPatients([]);
        setAdminAllSubscriptions([]);
        setAdminAllMealPlans([]);
        setAdminAllVideoSessions([]);
        setAdminAllCompounding([]);
        setDataLoading(false);
      } else {
        setAdminChecked(false);
        if (isDraDimitraEmail(firebaseUser.email)) {
          setIsAdmin(true);
          setAdminChecked(true);
          showToast(
            `Bem-vinda, ${SPECIALIST_PROFILE.title} (${SPECIALIST_PROFILE.email}) — perfil titular reconhecido automaticamente.`
          );
        }
        void checkUserIsAdmin(
          firebaseUser.uid,
          firebaseUser.email,
          firebaseUser.emailVerified
        )
          .then((allowed) => {
            setIsAdmin(allowed);
            if (!allowed) {
              setSection((curr) => (curr === 'admin' ? 'dashboard' : curr));
            }
          })
          .finally(() => {
            setAdminChecked(true);
          });
      }
    });
    return () => unsub();
  }, []);

  // Attach admin-only cross-platform listeners strictly when verified as admin
  useEffect(() => {
    if (!authReady || !user || !isAdmin) return;
    const unsubAdmins = subscribeToAdmins(setAdmins);
    const unsubAllPatients = subscribeToAllPatientsAdmin(setAdminAllPatients);
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
      unsubAllPatients();
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
    const planIdsToDelete = new Set<string>();
    for (const pl of [...mealPlans, ...adminAllMealPlans]) {
      if (pl.patientId === patientId) {
        planIdsToDelete.add(pl.id);
      }
    }
    for (const planId of planIdsToDelete) {
      await deleteMealPlan(planId);
    }
    await deletePatient(patientId);
    if (selectedPatientId === patientId) {
      setSelectedPatientId(null);
    }
    showToast('Paciente removido do consultório.');
  }

  // Dedicated standalone Administration Portal (/admin or /administracao)
  if (isAdminRoute) {
    return (
      <>
        <AdminPortalPage
          user={user}
          authReady={authReady}
          isAdmin={isAdmin}
          adminChecked={adminChecked}
          siteSettings={siteSettings}
          siteMedia={siteMedia}
          admins={admins}
          allPatients={adminAllPatients}
          allSubscriptions={adminAllSubscriptions}
          allMealPlans={adminAllMealPlans}
          allVideoSessions={adminAllVideoSessions}
          allCompounding={adminAllCompounding}
          onOpenPublicSite={() => navigateRoute(user ? '/site' : '/')}
          onOpenClinicalWorkspace={(patientId, targetSec) => {
            if (patientId) setSelectedPatientId(patientId);
            if (targetSec) setSection(targetSec);
            navigateRoute('/');
          }}
          onAddPatient={() => {
            setEditingPatient(null);
            setPatientModalOpen(true);
          }}
          onEditPatient={(pat) => {
            setEditingPatient(pat);
            setPatientModalOpen(true);
          }}
          onDeletePatient={handleDeletePatient}
          onCreateCompoundingFromCall={(prefillData) => {
            setCompoundingPrefill(prefillData);
            setSection('compounding');
            navigateRoute('/');
          }}
          onNotify={showToast}
        />

        {user && isAdmin && (
          <PatientFormModal
            open={patientModalOpen}
            nutritionistId={editingPatient?.nutritionistId || user.uid}
            initialPatient={editingPatient}
            onClose={() => {
              setPatientModalOpen(false);
              setEditingPatient(null);
            }}
            onSubmit={handleSavePatient}
          />
        )}

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: MOTION_EASE }}
              role="status"
              className="no-print fixed bottom-6 right-6 z-50 glass-botanical text-white text-xs font-medium px-4 py-3 rounded-xl border border-[#B7DB74]/45 shadow-[0_14px_40px_-10px_rgba(0,0,0,0.85)]"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Live Public Site Preview (/site) so logged-in Dra. Dimitra can review public changes without signing out
  if (isPublicPreviewRoute) {
    return (
      <div className="relative">
        <AuthGate
          siteSettings={siteSettings}
          siteMedia={siteMedia}
          onSelectSubscriptionIntent={(spec) => {
            setPendingSpecialty(spec);
            setSection('subscription');
            navigateRoute('/');
          }}
          onSelectVideoIntent={(intent) => {
            setPendingVideoPrefill({
              specialty: intent.specialty,
              chiefComplaint: intent.chiefComplaint,
            });
            setSection('video');
            navigateRoute('/');
          }}
          onOpenAdminPortal={() => navigateRoute('/admin')}
        />
        {user && (
          <div className="no-print fixed bottom-5 right-5 z-50 flex flex-wrap items-center gap-2 glass-botanical px-3 py-2 rounded-full border border-[#B7DB74]/50 shadow-[0_16px_42px_-10px_rgba(0,0,0,0.88)]">
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigateRoute('/admin')}
                className="btn-botanical inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Voltar ao Portal Admin
              </button>
            )}
            <button
              type="button"
              onClick={() => navigateRoute('/')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#E4F3EC] hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#B7DB74]" />
              Consultório
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#041210] flex flex-col items-center justify-center gap-4">
        <VerbenaEmblem className="w-10 h-10" />
        <div className="text-xs tracking-[0.2em] text-[#B7DB74]">
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
        onSelectVideoIntent={(intent) => {
          setPendingVideoPrefill({
            specialty: intent.specialty,
            chiefComplaint: intent.chiefComplaint,
          });
          setSection('video');
        }}
        onOpenAdminPortal={() => navigateRoute('/admin')}
      />
    );
  }

  const activeSubscription =
    subscriptions.find((s) => s.status === 'ativa') || null;

  const isDraDimitraAccount = isDraDimitraEmail(user.email);
  const nutritionistName = SPECIALIST_PROFILE.title;
  const activeWhatsappDisplay =
    siteSettings.whatsappContact || SPECIALIST_PROFILE.phoneDisplay;
  const specialistWhatsappHref = buildSpecialistWhatsAppUrl(
    undefined,
    activeWhatsappDisplay
  );

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
    <div className="min-h-screen bg-[#041210] text-[#F3FAF6] flex relative">
      {/* Subtle Botanical Emerald Spring Water Ambient Layer */}
      <div
        aria-hidden="true"
        className="no-print pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <img
          src={BOTANICAL_THEME_IMAGES.springWaterBackdrop}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#041210]/92 via-[#061D1A]/85 to-[#041210]/95" />
      </div>

      {/* Desktop Frosted Emerald Botanical Sidebar */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 z-20 bg-[#061C19]/88 backdrop-blur-xl border-r border-[#D4F0E0]/18">
        <div className="h-18 px-6 flex items-center gap-3 border-b border-[#D4F0E0]/16">
          <VerbenaEmblem className="w-7 h-7 shrink-0" />
          <div className="min-w-0">
            <div className="font-editorial text-xl tracking-[0.08em] font-semibold text-white leading-none whitespace-nowrap truncate">
              {siteSettings.brandName}
            </div>
            <div className="text-[10px] tracking-[0.14em] text-[#B7DB74] mt-1 whitespace-nowrap truncate">
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
                onClick={() => {
                  if (item.id === 'admin') {
                    navigateRoute('/admin');
                  } else {
                    setSection(item.id);
                  }
                }}
                className={`relative w-full flex items-center justify-between px-3.5 py-2.5 text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'text-white font-semibold'
                    : 'text-[#B5D6C5] hover:text-white hover:bg-[#14453E]/45 font-medium'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="activeSidebarIndicator"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-xl btn-botanical"
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
                        ? 'bg-[#041210]/30 text-[#E8F8DC]'
                        : 'bg-[#749543]/25 text-[#DDF3B2]'
                    }`}
                  >
                    {item.tag}
                  </span>
                ) : (
                  typeof item.count === 'number' && (
                    <span
                      className={`relative z-10 text-xs font-mono tabular-nums ${
                        active ? 'text-[#E8F8DC]' : 'text-[#7AA38F]'
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

        <div className="p-4 border-t border-[#D4F0E0]/16 space-y-3">
          <div className="px-2 space-y-1.5">
            <div className="flex items-center gap-2.5">
              {isDraDimitraAccount && (
                <img
                  src={
                    siteMedia.specialist_avatar?.imageUrl ||
                    SPECIALIST_PROFILE.photoUrl
                  }
                  alt={SPECIALIST_PROFILE.title}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover object-top border border-[#B7DB74]/70 shrink-0"
                />
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {isDraDimitraAccount
                    ? SPECIALIST_PROFILE.title
                    : user.displayName || 'Paciente Assinante'}
                </div>
                <div className="text-[11px] font-medium text-[#B7DB74] truncate">
                  {isDraDimitraAccount
                    ? 'Nutricionista Titular · Admin'
                    : 'Conta conectada'}
                </div>
              </div>
            </div>
            <div className="text-xs text-[#9CC2AF] truncate">{user.email}</div>
            <a
              href={specialistWhatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#DDF3B2] hover:text-white transition-colors pt-0.5"
            >
              <Phone className="w-3 h-3 text-[#B7DB74] shrink-0" />
              <span>{activeWhatsappDisplay}</span>
            </a>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigateRoute('/site')}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#DDF3B2] hover:text-white hover:bg-[#14453E]/45 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#B7DB74]" />
              Ver página pública
            </button>
          )}
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#B5D6C5] hover:text-white hover:bg-[#14453E]/45 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 text-[#B7DB74]" />
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
              className="relative w-64 max-w-[82vw] bg-[#061C19] h-full border-r border-[#D4F0E0]/20 flex flex-col"
            >
              <div className="h-16 px-5 flex items-center justify-between border-b border-[#D4F0E0]/16">
                <div className="flex items-center gap-2.5">
                  <VerbenaEmblem className="w-6 h-6" />
                  <span className="font-editorial text-lg tracking-[0.08em] font-semibold text-white whitespace-nowrap truncate">
                    {siteSettings.brandName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Fechar menu"
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
                        if (item.id === 'admin') {
                          navigateRoute('/admin');
                        } else {
                          setSection(item.id);
                        }
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm rounded-xl transition-colors cursor-pointer ${
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
              <div className="p-4 border-t border-[#D4F0E0]/16 space-y-1.5">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigateRoute('/site');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#DDF3B2] hover:bg-[#14453E]/45 rounded-xl"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#B7DB74]" />
                    Ver página pública
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#B5D6C5] hover:bg-[#14453E]/45 rounded-xl"
                >
                  <LogOut className="w-3.5 h-3.5 text-[#B7DB74]" />
                  Sair da conta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Viewport */}
      <div className="relative z-10 flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left + 1 Primary Botanical Action on right */}
        <header className="no-print h-18 bg-[#061A17]/82 backdrop-blur-xl border-b border-[#D4F0E0]/16 px-4 sm:px-8 flex items-center justify-between gap-6 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
              className="lg:hidden p-2 -ml-2 text-[#D1E8DC] hover:text-white rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 text-sm min-w-0">
              <span className="text-[#8DB5A2] hidden sm:inline whitespace-nowrap">
                Consultório
              </span>
              <span className="text-[#D4F0E0]/35 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-editorial text-2xl font-semibold text-white truncate tracking-wide">
                {sectionTitleMap[section]}
              </h1>
              {selectedPatientName && (
                <>
                  <span className="text-[#D4F0E0]/35 hidden md:inline" aria-hidden="true">
                    /
                  </span>
                  <span className="text-[#B7DB74] hidden md:inline truncate text-sm">
                    {selectedPatientName}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={primaryAction.onClick}
            className="btn-botanical inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap shrink-0"
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
                  specialistAvatarUrl={
                    siteMedia.specialist_avatar?.imageUrl ||
                    SPECIALIST_PROFILE.photoUrl
                  }
                  initialSessionId={pendingVideoSessionId}
                  onConsumeInitialSession={() => setPendingVideoSessionId(null)}
                  prefill={pendingVideoPrefill}
                  onConsumePrefill={() => setPendingVideoPrefill(null)}
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
                  specialistAvatarUrl={
                    siteMedia.specialist_avatar?.imageUrl ||
                    SPECIALIST_PROFILE.photoUrl
                  }
                  initialPatientId={selectedPatientId}
                  onSaveClinicalNote={handleSaveClinicalNoteFromChat}
                  onOpenPatientPlan={(patientId) => {
                    setSelectedPatientId(patientId);
                    setSection('plans');
                  }}
                  onEscalateToVideo={(videoData) => {
                    setPendingVideoPrefill(videoData);
                    setSection('video');
                    showToast(
                      'Encaminhado para agendamento de videochamada com a Dra. Dimitra Bratu.'
                    );
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

      {/* Frosted Botanical Emerald Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: MOTION_EASE }}
            role="status"
            className="no-print fixed bottom-6 right-6 z-50 glass-botanical text-white text-xs font-medium px-4 py-3 rounded-xl border border-[#B7DB74]/45 shadow-[0_14px_40px_-10px_rgba(0,0,0,0.85)]"
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
