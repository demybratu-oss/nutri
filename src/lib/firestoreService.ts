import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { buildDemoClinicalData } from '../data/seedData';
import {
  AdminUser,
  AnnualSubscription,
  ClinicalSpecialty,
  CompoundingPrescription,
  Consultation,
  ConsultationMessage,
  ConsultationMode,
  ConsultationSource,
  DEFAULT_SITE_SETTINGS,
  MealPlan,
  Patient,
  PRIMARY_ADMIN_EMAIL,
  Recipe,
  SiteMediaItem,
  SiteMediaSlotKey,
  SiteSettings,
  SubscriptionStatus,
  VideoSession,
  VideoSessionStatus,
} from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  emailToAdminDocId,
  generateSafeId,
  sanitizeAdminUserPayload,
  sanitizeCompoundingPrescriptionPayload,
  sanitizeConsultationMessagePayload,
  sanitizeConsultationPayload,
  sanitizeMealPlanPayload,
  sanitizePatientPayload,
  sanitizeRecipePayload,
  sanitizeSiteMediaPayload,
  sanitizeSiteSettingsPayload,
  sanitizeSubscriptionPayload,
  sanitizeVideoSessionPayload,
} from './nutrition';

export function subscribeToPatients(
  nutritionistId: string,
  onData: (patients: Patient[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'patients';
  const q = query(
    collection(db, path),
    where('nutritionistId', '==', nutritionistId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Patient[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Patient, 'id'>),
      }));
      items.sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export function subscribeToRecipes(
  nutritionistId: string,
  onData: (recipes: Recipe[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'recipes';
  const q = query(
    collection(db, path),
    where('nutritionistId', '==', nutritionistId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Recipe[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Recipe, 'id'>),
      }));
      items.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export function subscribeToMealPlans(
  nutritionistId: string,
  onData: (plans: MealPlan[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'mealPlans';
  const q = query(
    collection(db, path),
    where('nutritionistId', '==', nutritionistId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: MealPlan[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MealPlan, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function createPatient(
  input: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateSafeId('pat');
  const path = `patients/${id}`;
  const payload = sanitizePatientPayload(input);
  try {
    await setDoc(doc(db, 'patients', id), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePatient(
  id: string,
  input: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const path = `patients/${id}`;
  const payload = sanitizePatientPayload(input);
  const { nutritionistId: _omit, ...updatable } = payload;
  try {
    await updateDoc(doc(db, 'patients', id), {
      ...updatable,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePatient(id: string): Promise<void> {
  const path = `patients/${id}`;
  try {
    await deleteDoc(doc(db, 'patients', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createRecipe(
  input: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateSafeId('rec');
  const path = `recipes/${id}`;
  const payload = sanitizeRecipePayload(input);
  try {
    await setDoc(doc(db, 'recipes', id), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateRecipe(
  id: string,
  input: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const path = `recipes/${id}`;
  const payload = sanitizeRecipePayload(input);
  const { nutritionistId: _omit, ...updatable } = payload;
  try {
    await updateDoc(doc(db, 'recipes', id), {
      ...updatable,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteRecipe(id: string): Promise<void> {
  const path = `recipes/${id}`;
  try {
    await deleteDoc(doc(db, 'recipes', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createMealPlan(
  input: Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateSafeId('plan');
  const path = `mealPlans/${id}`;
  const payload = sanitizeMealPlanPayload(input);
  try {
    await setDoc(doc(db, 'mealPlans', id), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateMealPlan(
  id: string,
  input: Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const path = `mealPlans/${id}`;
  const payload = sanitizeMealPlanPayload(input);
  const { nutritionistId: _omitNutri, patientId: _omitPat, ...updatable } = payload;
  try {
    await updateDoc(doc(db, 'mealPlans', id), {
      ...updatable,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function concludeMealPlan(id: string): Promise<void> {
  const path = `mealPlans/${id}`;
  try {
    await updateDoc(doc(db, 'mealPlans', id), {
      status: 'concluido',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMealPlan(id: string): Promise<void> {
  const path = `mealPlans/${id}`;
  try {
    await deleteDoc(doc(db, 'mealPlans', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Seeds realistic Brazilian clinical cases, recipes, and personalized meal plans.
 * Commits patients + recipes first so Firestore referential exists() checks succeed on mealPlans.
 */
export async function seedDemoClinicalWorkspace(nutritionistId: string): Promise<void> {
  const demo = buildDemoClinicalData(nutritionistId);

  try {
    const batch1 = writeBatch(db);
    for (const p of demo.patients) {
      const { id, ...rest } = p;
      const sanitized = sanitizePatientPayload(rest);
      batch1.set(doc(db, 'patients', id), {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const r of demo.recipes) {
      const { id, ...rest } = r;
      const sanitized = sanitizeRecipePayload(rest);
      batch1.set(doc(db, 'recipes', id), {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch1.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'patients+recipes (seed)');
  }

  try {
    const batch2 = writeBatch(db);
    for (const plan of demo.mealPlans) {
      const { id, ...rest } = plan;
      const sanitized = sanitizeMealPlanPayload(rest);
      batch2.set(doc(db, 'mealPlans', id), {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch2.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'mealPlans (seed)');
  }
}

export function subscribeToConsultations(
  nutritionistId: string,
  onData: (consultations: Consultation[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'consultations';
  const q = query(
    collection(db, path),
    where('nutritionistId', '==', nutritionistId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Consultation[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Consultation, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export function subscribeToConsultationMessages(
  consultationId: string,
  nutritionistId: string,
  onData: (messages: ConsultationMessage[]) => void,
  onError?: (err: Error) => void
) {
  const path = `consultations/${consultationId}/messages`;
  const q = query(
    collection(db, 'consultations', consultationId, 'messages'),
    where('nutritionistId', '==', nutritionistId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ConsultationMessage[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ConsultationMessage, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        if (ta !== tb) return ta - tb;
        return a.id.localeCompare(b.id);
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function createConsultationSession(input: {
  nutritionistId: string;
  patientId: string;
  patientName: string;
  title: string;
  mode: ConsultationMode;
  lastMessagePreview: string;
}): Promise<string> {
  const id = generateSafeId('cons');
  const path = `consultations/${id}`;
  const payload = sanitizeConsultationPayload({
    ...input,
    status: 'aberta',
    messageCount: 0,
  });
  try {
    await setDoc(doc(db, 'consultations', id), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function appendConsultationMessage(params: {
  consultationId: string;
  nutritionistId: string;
  role: 'user' | 'assistant';
  content: string;
  sources: ConsultationSource[];
  nextMessageCount: number;
  title?: string;
  mode?: ConsultationMode;
}): Promise<string> {
  const msgId = generateSafeId('msg');
  const msgPath = `consultations/${params.consultationId}/messages/${msgId}`;
  const msgPayload = sanitizeConsultationMessagePayload({
    nutritionistId: params.nutritionistId,
    role: params.role,
    content: params.content,
    sources: params.sources,
  });

  try {
    await setDoc(
      doc(db, 'consultations', params.consultationId, 'messages', msgId),
      {
        ...msgPayload,
        createdAt: serverTimestamp(),
      }
    );

    const updateFields: Record<string, unknown> = {
      lastMessagePreview: msgPayload.content.replace(/\s+/g, ' ').slice(0, 220),
      messageCount: Math.min(500, Math.max(0, Math.round(params.nextMessageCount))),
      updatedAt: serverTimestamp(),
    };
    if (params.title) {
      const safeTitle = params.title.trim().slice(0, 140);
      if (safeTitle.length >= 2) {
        updateFields.title = safeTitle;
      }
    }
    if (params.mode) {
      updateFields.mode = params.mode;
    }

    await updateDoc(doc(db, 'consultations', params.consultationId), updateFields);
    return msgId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, msgPath);
  }
}

export async function concludeConsultationSession(id: string): Promise<void> {
  const path = `consultations/${id}`;
  try {
    await updateDoc(doc(db, 'consultations', id), {
      status: 'encerrada',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteConsultationSession(
  id: string,
  nutritionistId: string
): Promise<void> {
  const path = `consultations/${id}`;
  try {
    const msgsQuery = query(
      collection(db, 'consultations', id, 'messages'),
      where('nutritionistId', '==', nutritionistId)
    );
    const msgsSnap = await getDocs(msgsQuery);
    if (!msgsSnap.empty) {
      const batch = writeBatch(db);
      for (const msgDoc of msgsSnap.docs) {
        batch.delete(msgDoc.ref);
      }
      await batch.commit();
    }
    await deleteDoc(doc(db, 'consultations', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// Annual 12-Month Subscriptions
// =============================================================================

export function subscribeToUserSubscriptions(
  userId: string,
  onData: (items: AnnualSubscription[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'subscriptions';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: AnnualSubscription[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AnnualSubscription, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export async function createAnnualSubscription(
  input: Omit<AnnualSubscription, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateSafeId('sub');
  const path = `subscriptions/${id}`;
  const payload = sanitizeSubscriptionPayload(input);
  try {
    await setDoc(doc(db, 'subscriptions', id), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSubscriptionPreferences(
  id: string,
  updates: {
    specialty: ClinicalSpecialty;
    healthFocus: string;
    allergies: string;
    phone: string;
  }
): Promise<void> {
  const path = `subscriptions/${id}`;
  try {
    await updateDoc(doc(db, 'subscriptions', id), {
      specialty: updates.specialty,
      healthFocus: updates.healthFocus.trim().slice(0, 600),
      allergies: updates.allergies.trim().slice(0, 300),
      phone: updates.phone.trim().slice(0, 40),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cancelAnnualSubscription(id: string): Promise<void> {
  const path = `subscriptions/${id}`;
  try {
    await updateDoc(doc(db, 'subscriptions', id), {
      status: 'cancelada',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// =============================================================================
// Video Consultations with Nutricionista Dimitra Bratu
// =============================================================================

export function subscribeToVideoSessions(
  userId: string,
  onData: (items: VideoSession[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'videoSessions';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: VideoSession[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<VideoSession, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export async function createVideoSession(
  input: Omit<VideoSession, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateSafeId('vid');
  const path = `videoSessions/${id}`;
  const payload = sanitizeVideoSessionPayload(input);
  try {
    await setDoc(doc(db, 'videoSessions', id), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateVideoSession(
  id: string,
  updates: {
    specialty?: ClinicalSpecialty;
    scheduledDate?: string;
    scheduledTime?: string;
    chiefComplaint?: string;
    callNotes?: string;
    durationMinutes?: number;
    status?: VideoSessionStatus;
    hostInRoom?: boolean;
    patientInRoom?: boolean;
    hostJoinedAtIso?: string;
    patientJoinedAtIso?: string;
  }
): Promise<void> {
  const path = `videoSessions/${id}`;
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.specialty !== undefined) clean.specialty = updates.specialty;
  if (updates.scheduledDate !== undefined)
    clean.scheduledDate = updates.scheduledDate.trim().slice(0, 20);
  if (updates.scheduledTime !== undefined)
    clean.scheduledTime = updates.scheduledTime.trim().slice(0, 12);
  if (updates.chiefComplaint !== undefined)
    clean.chiefComplaint = updates.chiefComplaint.trim().slice(0, 600);
  if (updates.callNotes !== undefined)
    clean.callNotes = updates.callNotes.trim().slice(0, 3000);
  if (updates.durationMinutes !== undefined)
    clean.durationMinutes = Math.min(240, Math.max(0, Math.round(updates.durationMinutes)));
  if (updates.status !== undefined) clean.status = updates.status;
  if (typeof updates.hostInRoom === 'boolean') clean.hostInRoom = updates.hostInRoom;
  if (typeof updates.patientInRoom === 'boolean') clean.patientInRoom = updates.patientInRoom;
  if (updates.hostJoinedAtIso !== undefined)
    clean.hostJoinedAtIso = updates.hostJoinedAtIso.trim().slice(0, 40);
  if (updates.patientJoinedAtIso !== undefined)
    clean.patientJoinedAtIso = updates.patientJoinedAtIso.trim().slice(0, 40);

  try {
    await updateDoc(doc(db, 'videoSessions', id), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteVideoSession(id: string): Promise<void> {
  const path = `videoSessions/${id}`;
  try {
    await deleteDoc(doc(db, 'videoSessions', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// Compounding Prescriptions (Vitaminas Manipuladas para Farmácia de Manipulação)
// =============================================================================

export function subscribeToCompoundingPrescriptions(
  userId: string,
  onData: (items: CompoundingPrescription[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'compoundingPrescriptions';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CompoundingPrescription[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CompoundingPrescription, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export async function createCompoundingPrescription(
  input: Omit<CompoundingPrescription, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateSafeId('rx');
  const path = `compoundingPrescriptions/${id}`;
  const payload = sanitizeCompoundingPrescriptionPayload(input);
  try {
    await setDoc(doc(db, 'compoundingPrescriptions', id), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCompoundingPrescription(
  id: string,
  input: Omit<CompoundingPrescription, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const path = `compoundingPrescriptions/${id}`;
  const payload = sanitizeCompoundingPrescriptionPayload(input);
  const { userId: _u, patientId: _p, ...updatable } = payload;
  try {
    await updateDoc(doc(db, 'compoundingPrescriptions', id), {
      ...updatable,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function issueCompoundingPrescription(id: string): Promise<void> {
  const path = `compoundingPrescriptions/${id}`;
  try {
    await updateDoc(doc(db, 'compoundingPrescriptions', id), {
      status: 'emitida',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCompoundingPrescription(id: string): Promise<void> {
  const path = `compoundingPrescriptions/${id}`;
  try {
    await deleteDoc(doc(db, 'compoundingPrescriptions', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// Public Site Settings & Site Media (Real-Time CMS)
// =============================================================================

export function subscribeToSiteSettings(
  onData: (settings: SiteSettings) => void
) {
  return onSnapshot(
    doc(db, 'siteSettings', 'main'),
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_SITE_SETTINGS);
        return;
      }
      const remote = snap.data() as Partial<SiteSettings>;
      onData({
        ...DEFAULT_SITE_SETTINGS,
        ...remote,
        whatsappContact:
          remote.whatsappContact && remote.whatsappContact.trim().length > 0
            ? remote.whatsappContact
            : DEFAULT_SITE_SETTINGS.whatsappContact,
      });
    },
    () => {
      onData(DEFAULT_SITE_SETTINGS);
    }
  );
}

export function subscribeToSiteMedia(
  onData: (mediaMap: Partial<Record<SiteMediaSlotKey, SiteMediaItem>>) => void
) {
  const q = query(
    collection(db, 'siteMedia'),
    where('isPublic', '==', true)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const map: Partial<Record<SiteMediaSlotKey, SiteMediaItem>> = {};
      for (const d of snapshot.docs) {
        const data = d.data() as SiteMediaItem;
        map[data.slotKey] = data;
      }
      onData(map);
    },
    () => {
      onData({});
    }
  );
}

// =============================================================================
// Admin RBAC Verification & Restricted Management
// =============================================================================

export async function checkUserIsAdmin(
  uid: string,
  email: string | null | undefined,
  emailVerified: boolean
): Promise<boolean> {
  if (!emailVerified || !email) return false;
  if (email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL) {
    return true;
  }
  try {
    const byEmail = await getDoc(doc(db, 'admins', emailToAdminDocId(email)));
    if (byEmail.exists()) return true;
  } catch {
    // Not authorized or unreadable
  }
  try {
    const byUid = await getDoc(doc(db, 'admins', uid));
    if (byUid.exists()) return true;
  } catch {
    // Not authorized
  }
  return false;
}

export function subscribeToAdmins(
  onData: (items: AdminUser[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'admins';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: AdminUser[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AdminUser, 'id'>),
      }));
      items.sort((a, b) => a.email.localeCompare(b.email));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export async function grantAdminAccess(input: {
  email: string;
  displayName: string;
  roleLabel: string;
  addedByEmail: string;
}): Promise<string> {
  const id = emailToAdminDocId(input.email);
  const path = `admins/${id}`;
  const payload = sanitizeAdminUserPayload(input);
  try {
    await setDoc(doc(db, 'admins', id), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function revokeAdminAccess(adminId: string): Promise<void> {
  const path = `admins/${adminId}`;
  try {
    await deleteDoc(doc(db, 'admins', adminId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSiteSettings(
  input: Omit<SiteSettings, 'updatedAt'>
): Promise<void> {
  const path = 'siteSettings/main';
  const payload = sanitizeSiteSettingsPayload(input);
  try {
    await setDoc(doc(db, 'siteSettings', 'main'), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveSiteMediaSlot(input: {
  slotKey: SiteMediaSlotKey;
  label: string;
  imageUrl: string;
  altText: string;
  updatedByEmail: string;
}): Promise<void> {
  const path = `siteMedia/${input.slotKey}`;
  const payload = sanitizeSiteMediaPayload(input);
  try {
    await setDoc(doc(db, 'siteMedia', input.slotKey), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function resetSiteMediaSlot(
  slotKey: SiteMediaSlotKey
): Promise<void> {
  const path = `siteMedia/${slotKey}`;
  try {
    await deleteDoc(doc(db, 'siteMedia', slotKey));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// Admin-Only Cross-Platform Oversight Listeners & Mutations
// =============================================================================

export function subscribeToAllSubscriptionsAdmin(
  onData: (items: AnnualSubscription[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'subscriptions';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: AnnualSubscription[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AnnualSubscription, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export function subscribeToAllMealPlansAdmin(
  onData: (items: MealPlan[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'mealPlans';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: MealPlan[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MealPlan, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export function subscribeToAllVideoSessionsAdmin(
  onData: (items: VideoSession[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'videoSessions';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: VideoSession[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<VideoSession, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export function subscribeToAllCompoundingAdmin(
  onData: (items: CompoundingPrescription[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'compoundingPrescriptions';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: CompoundingPrescription[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CompoundingPrescription, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export async function adminUpdateSubscriptionStatus(
  id: string,
  status: SubscriptionStatus
): Promise<void> {
  const path = `subscriptions/${id}`;
  try {
    await updateDoc(doc(db, 'subscriptions', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteSubscription(id: string): Promise<void> {
  const path = `subscriptions/${id}`;
  try {
    await deleteDoc(doc(db, 'subscriptions', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToAllPatientsAdmin(
  onData: (items: Patient[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'patients';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: Patient[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Patient, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export async function adminUpdatePatientStatus(
  id: string,
  status: Patient['status']
): Promise<void> {
  const path = `patients/${id}`;
  try {
    await updateDoc(doc(db, 'patients', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateVideoSessionStatus(
  id: string,
  status: VideoSession['status']
): Promise<void> {
  const path = `videoSessions/${id}`;
  try {
    await updateDoc(doc(db, 'videoSessions', id), {
      status,
      ...(status === 'concluida' || status === 'cancelada'
        ? { hostInRoom: false, patientInRoom: false }
        : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminOpenVideoWaitingRoom(id: string): Promise<void> {
  const path = `videoSessions/${id}`;
  try {
    await updateDoc(doc(db, 'videoSessions', id), {
      status: 'em_andamento',
      hostInRoom: true,
      hostJoinedAtIso: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminLeaveVideoRoom(
  id: string,
  options: {
    markConcluded: boolean;
    callNotes: string;
    durationMinutes: number;
    returnToScheduled?: boolean;
  }
): Promise<void> {
  const path = `videoSessions/${id}`;
  const payload: Record<string, unknown> = {
    hostInRoom: false,
    callNotes: options.callNotes.trim().slice(0, 3000),
    durationMinutes: Math.min(240, Math.max(0, Math.round(options.durationMinutes))),
    updatedAt: serverTimestamp(),
  };
  if (options.markConcluded) {
    payload.status = 'concluida';
    payload.patientInRoom = false;
  } else if (options.returnToScheduled) {
    payload.status = 'agendada';
  }
  try {
    await updateDoc(doc(db, 'videoSessions', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}



