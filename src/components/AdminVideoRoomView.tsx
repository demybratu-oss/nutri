import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FlaskConical,
  MessageCircle,
  Mic,
  MicOff,
  PauseCircle,
  PhoneOff,
  Plus,
  Radio,
  Save,
  Trash2,
  UserCheck,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import {
  adminLeaveVideoRoom,
  adminOpenVideoWaitingRoom,
  adminUpdateVideoSessionStatus,
  createVideoSession,
  deleteVideoSession,
  updateVideoSession,
} from '../lib/firestoreService';
import { calculateAge, calculateBMI } from '../lib/nutrition';
import {
  AnnualSubscription,
  CLINICAL_SPECIALTIES,
  ClinicalSpecialty,
  GOAL_LABELS,
  Patient,
  SPECIALIST_PROFILE,
  SPECIALTY_LABELS,
  VideoSession,
  VideoSessionStatus,
} from '../types';
import { SpotlightCard } from './LuxuryPrimitives';

interface AdminVideoRoomViewProps {
  adminUserId: string;
  specialistPhoto: string;
  allPatients: Patient[];
  allSubscriptions: AnnualSubscription[];
  allVideoSessions: VideoSession[];
  initialStartSessionId?: string | null;
  onConsumeInitialStartSession?: () => void;
  onPrescribeCompounding: (params: {
    patientId: string;
    patientName: string;
    specialty: ClinicalSpecialty;
    clinicalCaseNotes: string;
  }) => void;
  onNotify: (message: string) => void;
}

const STATUS_LABELS: Record<VideoSessionStatus, string> = {
  agendada: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

function buildRoomInviteUrl(sessionId: string): string {
  if (typeof window === 'undefined') return `/?sala=${sessionId}`;
  return `${window.location.origin}/?sala=${encodeURIComponent(sessionId)}`;
}

function buildWhatsAppInviteHref(
  phone: string | undefined,
  patientName: string,
  scheduledTime: string,
  roomUrl: string
): string {
  const firstName = patientName.trim().split(' ')[0] || 'paciente';
  const text = `Olá ${firstName}! Aqui é a Dra. Dimitra Bratu. Já iniciei nossa sala de videochamada (${scheduledTime}) e estou te aguardando. Entre agora pelo link: ${roomUrl}`;
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length >= 10) {
    const full = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function formatTimer(totalSec: number): string {
  const mins = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, '0');
  const secs = (totalSec % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export function AdminVideoRoomView({
  adminUserId,
  specialistPhoto,
  allPatients,
  allSubscriptions,
  allVideoSessions,
  initialStartSessionId,
  onConsumeInitialStartSession,
  onPrescribeCompounding,
  onNotify,
}: AdminVideoRoomViewProps) {
  const [filterTab, setFilterTab] = useState<'upcoming' | 'concluded' | 'all'>(
    'upcoming'
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const hosting = allVideoSessions.find(
      (s) => s.hostInRoom && s.status === 'em_andamento'
    );
    return hosting?.id || null;
  });
  const [inStudio, setInStudio] = useState<boolean>(() =>
    allVideoSessions.some((s) => s.hostInRoom && s.status === 'em_andamento')
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [callNotesDraft, setCallNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  // Quick scheduler / instant waiting room form inside /admin
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [newPatientId, setNewPatientId] = useState('');
  const [newPatientName, setNewPatientName] = useState('');
  const [newSpecialty, setNewSpecialty] = useState<ClinicalSpecialty>(
    'metabolica_emagrecimento'
  );
  const [newDate, setNewDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [newTime, setNewTime] = useState(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = now.getMinutes() < 30 ? '30' : '00';
    return `${h}:${m}`;
  });
  const [newComplaint, setNewComplaint] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const activeSession = useMemo(
    () => allVideoSessions.find((s) => s.id === activeSessionId) || null,
    [allVideoSessions, activeSessionId]
  );

  // Resolve patient contact info (phone / email / clinical profile) for any video session
  function resolveSessionContact(session: VideoSession) {
    const linkedPatient =
      (session.patientId
        ? allPatients.find((p) => p.id === session.patientId)
        : null) ||
      allPatients.find(
        (p) =>
          p.fullName.trim().toLowerCase() ===
          session.patientName.trim().toLowerCase()
      ) ||
      null;

    const linkedSub =
      allSubscriptions.find((s) => s.userId === session.userId) ||
      allSubscriptions.find(
        (s) =>
          s.subscriberName.trim().toLowerCase() ===
          session.patientName.trim().toLowerCase()
      ) ||
      null;

    return {
      patient: linkedPatient,
      phone: linkedPatient?.phone || linkedSub?.phone || '',
      email: linkedPatient?.email || linkedSub?.subscriberEmail || '',
    };
  }

  // Sync draft notes when switching active session
  useEffect(() => {
    if (activeSession) {
      setCallNotesDraft(activeSession.callNotes || '');
    }
  }, [activeSession?.id]);

  // Auto-open waiting room when triggered from Overview quick button
  useEffect(() => {
    if (!initialStartSessionId) return;
    const target = allVideoSessions.find((s) => s.id === initialStartSessionId);
    if (!target) return;
    onConsumeInitialStartSession?.();
    void handleStartWaitingRoom(target);
  }, [initialStartSessionId, allVideoSessions]);

  // Live call/waiting timer
  useEffect(() => {
    if (!inStudio) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [inStudio]);

  // Clean up camera/mic tracks on unmount
  useEffect(() => {
    return () => {
      stopMediaTracks();
    };
  }, []);

  // Re-attach MediaStream when studio mounts or toggles camera
  useEffect(() => {
    if (inStudio && localVideoRef.current && mediaStreamRef.current) {
      localVideoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [inStudio, camEnabled]);

  function stopMediaTracks() {
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }

  async function startHostMedia() {
    setMediaError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMediaError(
        'Câmera não detectada neste dispositivo. A sala de espera segue aberta normalmente.'
      );
      return;
    }
    try {
      stopMediaTracks();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      mediaStreamRef.current = stream;
      setCamEnabled(true);
      setMicEnabled(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch {
      setMediaError(
        'Permissão de câmera/microfone não liberada no navegador. Você pode ativar a câmera a qualquer momento ou seguir aguardando o paciente.'
      );
    }
  }

  function toggleMic() {
    const next = !micEnabled;
    setMicEnabled(next);
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getAudioTracks()) {
        track.enabled = next;
      }
    }
  }

  function toggleCam() {
    const next = !camEnabled;
    setCamEnabled(next);
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getVideoTracks()) {
        track.enabled = next;
      }
    }
  }

  async function handleStartWaitingRoom(session: VideoSession) {
    setBusySessionId(session.id);
    try {
      // If Dra. Dimitra was hosting another room, gracefully clear hostInRoom there first
      if (activeSessionId && activeSessionId !== session.id) {
        const previous = allVideoSessions.find((s) => s.id === activeSessionId);
        if (previous && previous.hostInRoom) {
          await adminLeaveVideoRoom(previous.id, {
            markConcluded: false,
            callNotes: callNotesDraft,
            durationMinutes: Math.max(
              previous.durationMinutes || 0,
              Math.round(elapsedSeconds / 60)
            ),
            returnToScheduled: !previous.patientInRoom,
          });
        }
      }

      await adminOpenVideoWaitingRoom(session.id);
      setActiveSessionId(session.id);
      setCallNotesDraft(session.callNotes || '');
      setElapsedSeconds(0);
      setInStudio(true);
      await startHostMedia();
      onNotify(
        `Sala aberta! Aguardando ${session.patientName} entrar na videochamada.`
      );
    } finally {
      setBusySessionId(null);
    }
  }

  async function handlePauseWaitingRoom() {
    if (!activeSession) return;
    setBusySessionId(activeSession.id);
    try {
      stopMediaTracks();
      await adminLeaveVideoRoom(activeSession.id, {
        markConcluded: false,
        callNotes: callNotesDraft,
        durationMinutes: Math.max(
          activeSession.durationMinutes || 0,
          Math.round(elapsedSeconds / 60)
        ),
        returnToScheduled: !activeSession.patientInRoom,
      });
      setInStudio(false);
      onNotify(
        `Você saiu da sala de ${activeSession.patientName}. A consulta continua disponível na fila.`
      );
    } finally {
      setBusySessionId(null);
    }
  }

  async function handleConcludeCall() {
    if (!activeSession) return;
    setBusySessionId(activeSession.id);
    try {
      stopMediaTracks();
      await adminLeaveVideoRoom(activeSession.id, {
        markConcluded: true,
        callNotes: callNotesDraft,
        durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
      });
      setInStudio(false);
      setActiveSessionId(null);
      onNotify(
        `Videochamada com ${activeSession.patientName} concluída e salva no histórico.`
      );
    } finally {
      setBusySessionId(null);
    }
  }

  async function handleSaveNotes() {
    if (!activeSession) return;
    setSavingNotes(true);
    try {
      await updateVideoSession(activeSession.id, {
        callNotes: callNotesDraft,
        durationMinutes: Math.max(
          activeSession.durationMinutes || 0,
          Math.round(elapsedSeconds / 60)
        ),
      });
      onNotify('Anotações da consulta salvas com sucesso.');
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleCopyRoomLink(sessionId: string) {
    const url = buildRoomInviteUrl(sessionId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSessionId(sessionId);
      onNotify('Link da sala de videochamada copiado!');
      window.setTimeout(() => {
        setCopiedSessionId((curr) => (curr === sessionId ? null : curr));
      }, 2500);
    } catch {
      onNotify(`Link da sala: ${url}`);
    }
  }

  async function handleQuickCreateSession(startWaitingImmediately: boolean) {
    const selectedPatient = allPatients.find((p) => p.id === newPatientId);
    const resolvedName =
      selectedPatient?.fullName || newPatientName.trim() || 'Paciente Agendado';

    // Prefer linking to the patient's subscriber userId if we can match by email/name so the patient sees the live banner in their portal!
    const matchedSub =
      (selectedPatient?.email
        ? allSubscriptions.find(
            (s) =>
              s.subscriberEmail.trim().toLowerCase() ===
              selectedPatient.email.trim().toLowerCase()
          )
        : null) ||
      allSubscriptions.find(
        (s) =>
          s.subscriberName.trim().toLowerCase() ===
          resolvedName.trim().toLowerCase()
      ) ||
      null;

    setCreatingRoom(true);
    try {
      const targetUserId = matchedSub?.userId || adminUserId;
      const newId = await createVideoSession({
        userId: targetUserId,
        patientId: selectedPatient?.id || '',
        patientName: resolvedName,
        specialty: newSpecialty,
        scheduledDate: newDate,
        scheduledTime: newTime,
        status: startWaitingImmediately ? 'em_andamento' : 'agendada',
        chiefComplaint: newComplaint.trim(),
        callNotes: '',
        durationMinutes: 0,
        ...(startWaitingImmediately
          ? {
              hostInRoom: true,
              hostJoinedAtIso: new Date().toISOString(),
            }
          : {}),
      });

      setShowQuickCreate(false);
      setNewPatientId('');
      setNewPatientName('');
      setNewComplaint('');

      if (startWaitingImmediately) {
        setActiveSessionId(newId);
        setCallNotesDraft('');
        setElapsedSeconds(0);
        setInStudio(true);
        await startHostMedia();
        onNotify(
          `Sala iniciada! Aguardando ${resolvedName} entrar na videochamada.`
        );
      } else {
        onNotify(
          `Videochamada agendada para ${resolvedName} em ${newDate} às ${newTime}.`
        );
      }
    } finally {
      setCreatingRoom(false);
    }
  }

  const upcomingSessions = useMemo(() => {
    return allVideoSessions
      .filter((s) => s.status === 'agendada' || s.status === 'em_andamento')
      .sort((a, b) => {
        // Active host rooms first, then chronological date + time
        if (a.hostInRoom && !b.hostInRoom) return -1;
        if (!a.hostInRoom && b.hostInRoom) return 1;
        const keyA = `${a.scheduledDate} ${a.scheduledTime}`;
        const keyB = `${b.scheduledDate} ${b.scheduledTime}`;
        return keyA.localeCompare(keyB);
      });
  }, [allVideoSessions]);

  const filteredSessions = useMemo(() => {
    if (filterTab === 'upcoming') return upcomingSessions;
    if (filterTab === 'concluded') {
      return allVideoSessions.filter(
        (s) => s.status === 'concluida' || s.status === 'cancelada'
      );
    }
    return allVideoSessions;
  }, [allVideoSessions, upcomingSessions, filterTab]);

  const activeContact = activeSession
    ? resolveSessionContact(activeSession)
    : null;

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* ACTIVE LIVE WAITING ROOM / VIDEO CALL STUDIO FOR DRA. DIMITRA     */}
      {/* ================================================================= */}
      {inStudio && activeSession && (
        <SpotlightCard
          glowRim
          className="rounded-3xl overflow-hidden border border-[#B7DB74]/45"
        >
          <div className="grid grid-cols-1 xl:grid-cols-12">
            {/* Video Stage Column */}
            <div className="xl:col-span-7 bg-[#041210] p-5 sm:p-6 flex flex-col justify-between gap-5 border-b xl:border-b-0 xl:border-r border-[#D4F0E0]/16">
              {/* Studio Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#C7E88B]">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    <span>
                      {activeSession.patientInRoom
                        ? 'PACIENTE NA SALA · CONSULTA AO VIVO'
                        : 'SALA ABERTA · AGUARDANDO PACIENTE ENTRAR'}
                    </span>
                  </div>
                  <h2 className="font-display text-3xl font-semibold text-white leading-none">
                    {activeSession.patientName}
                  </h2>
                  <p className="text-xs text-[#A8CCB9]">
                    {SPECIALTY_LABELS[activeSession.specialty]} · Agendado para{' '}
                    <span className="font-mono text-[#DDF3B2]">
                      {activeSession.scheduledDate} às{' '}
                      {activeSession.scheduledTime}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3.5 py-1.5 rounded-full bg-[#0E312B] border border-[#B7DB74]/40 font-mono tabular-nums text-xs text-[#DDF3B2]">
                    {activeSession.patientInRoom ? 'Em consulta' : 'Aguardando'}{' '}
                    · {formatTimer(elapsedSeconds)}
                  </span>
                </div>
              </div>

              {/* Dual Video Frames: Dra. Dimitra Live Camera + Patient Waiting/Connected Stage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Frame 1: Dra. Dimitra Bratu (Host Live Camera) */}
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#07201C] border border-[#B7DB74]/35 flex items-center justify-center">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      camEnabled && !mediaError ? 'block' : 'hidden'
                    }`}
                  />
                  {(!camEnabled || mediaError) && (
                    <div className="p-4 text-center space-y-2.5 flex flex-col items-center">
                      <img
                        src={specialistPhoto}
                        alt={SPECIALIST_PROFILE.title}
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 rounded-full object-cover object-top border-2 border-[#B7DB74]/75"
                      />
                      <div className="text-xs font-semibold text-white">
                        {SPECIALIST_PROFILE.title}
                      </div>
                      <p className="text-[11px] text-[#9CC2AF] leading-relaxed max-w-[230px]">
                        {mediaError || 'Sua câmera está desligada'}
                      </p>
                      {mediaError && (
                        <button
                          type="button"
                          onClick={startHostMedia}
                          className="text-[11px] font-medium text-[#C7E88B] hover:underline cursor-pointer"
                        >
                          Ativar câmera agora
                        </button>
                      )}
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-[#041210]/80 border border-[#B7DB74]/40 text-[11px] font-medium text-[#DDF3B2] backdrop-blur-xs">
                    Você · Dra. Dimitra Bratu
                  </div>
                </div>

                {/* Frame 2: Patient Real-Time Presence Frame */}
                <div
                  className={`relative aspect-[4/3] rounded-2xl overflow-hidden border flex flex-col items-center justify-center p-5 text-center transition-colors ${
                    activeSession.patientInRoom
                      ? 'bg-gradient-to-br from-[#12453B] via-[#07231E] to-[#041210] border-[#B7DB74]/65'
                      : 'bg-gradient-to-br from-[#0B2924] via-[#061A17] to-[#041210] border-[#D4F0E0]/22'
                  }`}
                >
                  {activeSession.patientInRoom ? (
                    <>
                      <div className="w-20 h-20 rounded-full bg-[#1C574B] border-2 border-[#C7E88B] flex items-center justify-center mb-3 shadow-[0_0_36px_-6px_rgba(183,219,116,0.55)]">
                        <UserCheck className="w-9 h-9 text-[#DDF3B2]" />
                      </div>
                      <div className="font-display text-2xl font-semibold text-white">
                        {activeSession.patientName}
                      </div>
                      <div className="text-xs font-semibold text-[#C7E88B] mt-1">
                        Conectado na sala de videochamada
                      </div>
                      <p className="text-[11px] text-[#A8CCB9] mt-2 max-w-[240px]">
                        Atendimento exclusivo em andamento. Registre a evolução
                        no prontuário ao lado.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="relative mb-3">
                        <span className="absolute inset-0 rounded-full bg-[#B7DB74]/25 animate-ping" />
                        <div className="relative w-18 h-18 rounded-full bg-[#103831] border border-[#B7DB74]/50 flex items-center justify-center">
                          <Clock className="w-8 h-8 text-[#C7E88B]" />
                        </div>
                      </div>
                      <div className="font-display text-xl font-semibold text-white">
                        Aguardando {activeSession.patientName.split(' ')[0]}...
                      </div>
                      <p className="text-[11px] text-[#A8CCB9] mt-1.5 leading-relaxed max-w-[250px]">
                        O paciente já recebe o aviso em tempo real de que você
                        está na sala. Chame no WhatsApp ou envie o link direto:
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5">
                        <a
                          href={buildWhatsAppInviteHref(
                            activeContact?.phone,
                            activeSession.patientName,
                            activeSession.scheduledTime,
                            buildRoomInviteUrl(activeSession.id)
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-botanical inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Chamar no WhatsApp</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyRoomLink(activeSession.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-[#DDF3B2] bg-[#0B2A25] border border-[#D4F0E0]/28 hover:border-[#B7DB74] transition-colors cursor-pointer"
                        >
                          {copiedSessionId === activeSession.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#C7E88B]" />
                              <span>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar link</span>
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Host Call Control Bar */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    micEnabled
                      ? 'bg-[#103831] border-[#B7DB74]/35 text-white'
                      : 'bg-red-950/75 border-red-400/45 text-red-200'
                  }`}
                >
                  {micEnabled ? (
                    <Mic className="w-4 h-4 text-[#C7E88B]" />
                  ) : (
                    <MicOff className="w-4 h-4" />
                  )}
                  <span>{micEnabled ? 'Microfone ativo' : 'Mudo'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleCam}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    camEnabled
                      ? 'bg-[#103831] border-[#B7DB74]/35 text-white'
                      : 'bg-red-950/75 border-red-400/45 text-red-200'
                  }`}
                >
                  {camEnabled ? (
                    <Camera className="w-4 h-4 text-[#C7E88B]" />
                  ) : (
                    <CameraOff className="w-4 h-4" />
                  )}
                  <span>{camEnabled ? 'Câmera ativa' : 'Câmera desligada'}</span>
                </button>

                <button
                  type="button"
                  disabled={busySessionId === activeSession.id}
                  onClick={handlePauseWaitingRoom}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium text-[#DDF3B2] bg-[#0B2A25] border border-[#D4F0E0]/28 hover:border-[#B7DB74] transition-colors cursor-pointer disabled:opacity-60"
                >
                  <PauseCircle className="w-4 h-4 text-[#B7DB74]" />
                  <span>Sair da espera</span>
                </button>

                <button
                  type="button"
                  disabled={busySessionId === activeSession.id}
                  onClick={handleConcludeCall}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-red-600/90 hover:bg-red-500 text-white transition-colors cursor-pointer disabled:opacity-60"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>Concluir consulta</span>
                </button>
              </div>
            </div>

            {/* Right Column: Patient Summary + Clinical Call Notes + Compounding Handoff */}
            <div className="xl:col-span-5 p-5 sm:p-6 bg-[#08221E] flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl font-semibold text-white">
                    Prontuário da Videochamada
                  </h3>
                  <p className="text-xs text-[#A8CCB9] mt-0.5">
                    Anotações clínicas para a prescrição de vitaminas manipuladas
                    e receitas.
                  </p>
                </div>
                {activeContact?.phone && (
                  <a
                    href={buildWhatsAppInviteHref(
                      activeContact.phone,
                      activeSession.patientName,
                      activeSession.scheduledTime,
                      buildRoomInviteUrl(activeSession.id)
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-[#DDF3B2] bg-[#0E312B] border border-[#B7DB74]/30 hover:border-[#B7DB74] shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#B7DB74]" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>

              {activeContact?.patient && (
                <div className="p-3 rounded-xl bg-[#051815] border border-[#D4F0E0]/16 text-xs text-[#CBE3D6] flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    <strong className="text-[#C7E88B]">Perfil:</strong>{' '}
                    {calculateAge(activeContact.patient.birthYear)} anos ·{' '}
                    {activeContact.patient.weightKg} kg · IMC{' '}
                    {calculateBMI(
                      activeContact.patient.weightKg,
                      activeContact.patient.heightCm
                    )}
                  </span>
                  <span>
                    <strong className="text-[#C7E88B]">Meta:</strong>{' '}
                    {GOAL_LABELS[activeContact.patient.goal]}
                  </span>
                  {activeContact.patient.restrictions.length > 0 && (
                    <span className="w-full text-[#F3D8A8]">
                      <strong>Restrições:</strong>{' '}
                      {activeContact.patient.restrictions.join(', ')}
                    </span>
                  )}
                </div>
              )}

              {activeSession.chiefComplaint && (
                <div className="p-3 rounded-xl bg-[#051815] border border-[#B7DB74]/22 text-xs text-[#CBE3D6]">
                  <span className="text-[#C7E88B] font-semibold block mb-0.5">
                    Queixa / foco informado pelo paciente:
                  </span>
                  {activeSession.chiefComplaint}
                </div>
              )}

              <textarea
                rows={7}
                value={callNotesDraft}
                onChange={(e) => setCallNotesDraft(e.target.value)}
                placeholder="Registre queixas, exames laboratoriais (vitamina D, B12, ferritina, glicemia), conduta nutricional e ativos manipulados definidos na videochamada..."
                className="w-full flex-1 px-4 py-3 text-sm bg-[#041210] text-white placeholder-[#719C88] border border-[#D4F0E0]/22 rounded-xl focus:outline-none focus:border-[#B7DB74] resize-none leading-relaxed"
              />

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={savingNotes}
                  onClick={handleSaveNotes}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-medium text-white border border-[#D4F0E0]/30 hover:border-[#B7DB74] hover:bg-[#113A34] transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5 text-[#C7E88B]" />
                  <span>{savingNotes ? 'Salvando...' : 'Salvar notas'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveNotes();
                    onPrescribeCompounding({
                      patientId: activeSession.patientId,
                      patientName: activeSession.patientName,
                      specialty: activeSession.specialty,
                      clinicalCaseNotes: [
                        activeSession.chiefComplaint,
                        callNotesDraft,
                      ]
                        .filter(Boolean)
                        .join('\n'),
                    });
                  }}
                  className="btn-botanical flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Prescrever Manipulados</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </SpotlightCard>
      )}

      {/* ================================================================= */}
      {/* HEADER BAR + FILTER + NEW VIDEO CALL BUTTON                       */}
      {/* ================================================================= */}
      <SpotlightCard className="p-5 sm:p-6 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold text-white leading-tight">
              Sala de Espera &amp; Agenda de Videochamadas
            </h2>
            <p className="text-xs text-[#A8CCB9] mt-1">
              Inicie a sala para aguardar qualquer paciente agendado. O paciente
              vê instantaneamente quando você entra e pode ser chamado pelo
              WhatsApp em 1 clique.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowQuickCreate((prev) => !prev)}
            className="btn-botanical inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            {showQuickCreate ? (
              <>
                <X className="w-3.5 h-3.5" />
                <span>Fechar formulário</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Videochamada</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Schedule / Instant Room Creation Panel */}
        {showQuickCreate && (
          <div className="p-5 rounded-2xl bg-[#051815] border border-[#B7DB74]/30 space-y-4">
            <div className="text-xs font-semibold text-[#C7E88B]">
              Agendar ou iniciar sala imediata para um paciente
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {allPatients.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-[#A8CCB9] mb-1">
                    Selecionar paciente cadastrado
                  </label>
                  <select
                    value={newPatientId}
                    onChange={(e) => {
                      setNewPatientId(e.target.value);
                      const found = allPatients.find(
                        (p) => p.id === e.target.value
                      );
                      if (found) setNewPatientName(found.fullName);
                    }}
                    className="w-full px-3 py-2 text-xs bg-[#041210] text-white border border-[#D4F0E0]/24 rounded-xl focus:outline-none focus:border-[#B7DB74]"
                  >
                    <option value="">Escolher ou digitar nome ao lado</option>
                    {allPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-[#A8CCB9] mb-1">
                  Nome do paciente
                </label>
                <input
                  type="text"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  placeholder="Nome completo do paciente"
                  className="w-full px-3 py-2 text-xs bg-[#041210] text-white placeholder-[#719C88] border border-[#D4F0E0]/24 rounded-xl focus:outline-none focus:border-[#B7DB74]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#A8CCB9] mb-1">
                  Especialidade
                </label>
                <select
                  value={newSpecialty}
                  onChange={(e) =>
                    setNewSpecialty(e.target.value as ClinicalSpecialty)
                  }
                  className="w-full px-3 py-2 text-xs bg-[#041210] text-white border border-[#D4F0E0]/24 rounded-xl focus:outline-none focus:border-[#B7DB74]"
                >
                  {CLINICAL_SPECIALTIES.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#A8CCB9] mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#041210] text-white border border-[#D4F0E0]/24 rounded-xl focus:outline-none focus:border-[#B7DB74]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#A8CCB9] mb-1">
                  Horário
                </label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#041210] text-white border border-[#D4F0E0]/24 rounded-xl focus:outline-none focus:border-[#B7DB74]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#A8CCB9] mb-1">
                  Foco / motivo da consulta (opcional)
                </label>
                <input
                  type="text"
                  value={newComplaint}
                  onChange={(e) => setNewComplaint(e.target.value)}
                  placeholder="Ex.: Retorno vitaminas manipuladas + exames"
                  className="w-full px-3 py-2 text-xs bg-[#041210] text-white placeholder-[#719C88] border border-[#D4F0E0]/24 rounded-xl focus:outline-none focus:border-[#B7DB74]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={creatingRoom}
                onClick={() => handleQuickCreateSession(true)}
                className="btn-botanical inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Iniciar sala agora e aguardar paciente</span>
              </button>
              <button
                type="button"
                disabled={creatingRoom}
                onClick={() => handleQuickCreateSession(false)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium text-white border border-[#D4F0E0]/28 hover:border-[#B7DB74] cursor-pointer disabled:opacity-60"
              >
                <Calendar className="w-3.5 h-3.5 text-[#C7E88B]" />
                <span>Somente agendar</span>
              </button>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {[
            {
              id: 'upcoming' as const,
              label: `Agendadas e Em Espera (${upcomingSessions.length})`,
            },
            {
              id: 'concluded' as const,
              label: `Concluídas / Canceladas (${
                allVideoSessions.length - upcomingSessions.length
              })`,
            },
            {
              id: 'all' as const,
              label: `Todas (${allVideoSessions.length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                filterTab === tab.id
                  ? 'btn-botanical text-white font-semibold'
                  : 'bg-[#08221E] text-[#A8CCB9] border border-[#D4F0E0]/18 hover:text-white hover:border-[#B7DB74]/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </SpotlightCard>

      {/* ================================================================= */}
      {/* SCHEDULED VIDEO CALLS QUEUE                                       */}
      {/* ================================================================= */}
      {filteredSessions.length === 0 ? (
        <SpotlightCard className="p-10 rounded-2xl text-center space-y-3">
          <VideoOff className="w-9 h-9 text-[#85AF9B] mx-auto" />
          <div className="font-display text-2xl font-semibold text-white">
            Nenhuma videochamada nesta visualização
          </div>
          <p className="text-xs text-[#A8CCB9] max-w-md mx-auto">
            Quando pacientes agendarem pelo site ou quando você criar um
            horário acima, basta clicar em{' '}
            <strong className="text-[#DDF3B2]">
              Iniciar sala e aguardar paciente
            </strong>
            .
          </p>
        </SpotlightCard>
      ) : (
        <div className="space-y-3.5">
          {filteredSessions.map((session) => {
            const contact = resolveSessionContact(session);
            const isCurrentlyHosted =
              inStudio && activeSessionId === session.id;
            const isWaiting =
              session.hostInRoom &&
              session.status === 'em_andamento' &&
              !session.patientInRoom;
            const bothConnected =
              session.hostInRoom && session.patientInRoom;
            const roomUrl = buildRoomInviteUrl(session.id);

            return (
              <div
                key={session.id}
                className={`glass-botanical rounded-2xl p-5 space-y-3.5 transition-colors ${
                  isCurrentlyHosted
                    ? 'border border-[#B7DB74]/60'
                    : 'border border-[#D4F0E0]/16'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-display text-2xl font-semibold text-white leading-none">
                        {session.patientName}
                      </h3>
                      {bothConnected ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-400/50 text-emerald-200">
                          <Radio className="w-3 h-3 animate-pulse" />
                          <span>Paciente conectado na sala</span>
                        </span>
                      ) : isWaiting ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#B7DB74]/20 border border-[#B7DB74]/55 text-[#E5F7C4]">
                          <Radio className="w-3 h-3 animate-pulse" />
                          <span>Sala aberta · Aguardando paciente</span>
                        </span>
                      ) : (
                        <span
                          className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                            session.status === 'concluida'
                              ? 'border-emerald-400/35 bg-emerald-950/50 text-emerald-300'
                              : session.status === 'cancelada'
                              ? 'border-red-400/35 bg-red-950/50 text-red-300'
                              : 'border-[#B7DB74]/30 bg-[#103831] text-[#DDF3B2]'
                          }`}
                        >
                          {STATUS_LABELS[session.status]}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#C7E88B]">
                      {SPECIALTY_LABELS[session.specialty]}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono tabular-nums text-[#9CC2AF]">
                      <span className="inline-flex items-center gap-1 text-white">
                        <Calendar className="w-3.5 h-3.5 text-[#B7DB74]" />
                        {session.scheduledDate}
                      </span>
                      <span className="inline-flex items-center gap-1 text-white">
                        <Clock className="w-3.5 h-3.5 text-[#B7DB74]" />
                        {session.scheduledTime}
                      </span>
                      {contact.phone && <span>{contact.phone}</span>}
                      {contact.email && <span>{contact.email}</span>}
                      {session.durationMinutes > 0 && (
                        <span>{session.durationMinutes} min</span>
                      )}
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {session.status !== 'concluida' &&
                      session.status !== 'cancelada' && (
                        <button
                          type="button"
                          disabled={busySessionId === session.id}
                          onClick={() => handleStartWaitingRoom(session)}
                          className="btn-botanical inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-60"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>
                            {isCurrentlyHosted
                              ? 'Sala aberta acima'
                              : session.hostInRoom
                              ? 'Retomar sala aberta'
                              : 'Iniciar sala e aguardar paciente'}
                          </span>
                        </button>
                      )}

                    <a
                      href={buildWhatsAppInviteHref(
                        contact.phone,
                        session.patientName,
                        session.scheduledTime,
                        roomUrl
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium text-[#DDF3B2] bg-[#0B2A25] border border-[#D4F0E0]/24 hover:border-[#B7DB74] transition-colors whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-[#B7DB74]" />
                      <span>WhatsApp</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyRoomLink(session.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium text-[#CBE3D6] bg-[#0B2A25] border border-[#D4F0E0]/22 hover:border-[#B7DB74] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {copiedSessionId === session.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#C7E88B]" />
                          <span>Link copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Link</span>
                        </>
                      )}
                    </button>

                    <select
                      aria-label={`Alterar status da videochamada de ${session.patientName}`}
                      value={session.status}
                      onChange={async (e) => {
                        const nextStatus = e.target.value as VideoSessionStatus;
                        await adminUpdateVideoSessionStatus(
                          session.id,
                          nextStatus
                        );
                        if (
                          activeSessionId === session.id &&
                          (nextStatus === 'concluida' ||
                            nextStatus === 'cancelada')
                        ) {
                          stopMediaTracks();
                          setInStudio(false);
                          setActiveSessionId(null);
                        }
                        onNotify(
                          `Videochamada de ${session.patientName} marcada como ${STATUS_LABELS[nextStatus]}.`
                        );
                      }}
                      className="px-2.5 py-2 rounded-xl text-xs bg-[#061A17] text-[#E4F3EC] border border-[#D4F0E0]/22 focus:outline-none focus:border-[#B7DB74]"
                    >
                      <option value="agendada">Agendada</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="concluida">Concluída</option>
                      <option value="cancelada">Cancelada</option>
                    </select>

                    <button
                      type="button"
                      onClick={async () => {
                        await deleteVideoSession(session.id);
                        if (activeSessionId === session.id) {
                          stopMediaTracks();
                          setInStudio(false);
                          setActiveSessionId(null);
                        }
                        onNotify('Agendamento de videochamada removido.');
                      }}
                      aria-label="Excluir videochamada"
                      className="p-2 text-[#85AF9B] hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {(session.chiefComplaint || session.callNotes) && (
                  <div className="p-3 rounded-xl bg-[#051815] border border-[#D4F0E0]/14 text-xs text-[#A8CCB9] space-y-1">
                    {session.chiefComplaint && (
                      <div>
                        <span className="text-[#C7E88B] font-medium">
                          Queixa / Objetivo:
                        </span>{' '}
                        {session.chiefComplaint}
                      </div>
                    )}
                    {session.callNotes && (
                      <div className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#C7E88B] shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{session.callNotes}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
