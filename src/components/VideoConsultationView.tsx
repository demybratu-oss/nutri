import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  FlaskConical,
  Mic,
  MicOff,
  PhoneOff,
  Plus,
  Save,
  Trash2,
  Video,
  VideoOff,
} from 'lucide-react';
import {
  createVideoSession,
  deleteVideoSession,
  updateVideoSession,
} from '../lib/firestoreService';
import {
  AnnualSubscription,
  CLINICAL_SPECIALTIES,
  ClinicalSpecialty,
  Patient,
  SPECIALTY_LABELS,
  VideoSession,
} from '../types';
import { SpotlightCard, VerbenaEmblem } from './LuxuryPrimitives';

interface VideoConsultationViewProps {
  userId: string;
  patients: Patient[];
  videoSessions: VideoSession[];
  activeSubscription: AnnualSubscription | null;
  specialistAvatarUrl?: string;
  initialSessionId?: string | null;
  onConsumeInitialSession?: () => void;
  onCreateCompoundingFromCall: (params: {
    patientId: string;
    patientName: string;
    specialty: ClinicalSpecialty;
    clinicalCaseNotes: string;
  }) => void;
  onOpenRecipes: () => void;
  onNotify: (message: string) => void;
}

const STATUS_LABELS: Record<VideoSession['status'], string> = {
  agendada: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export function VideoConsultationView({
  userId,
  patients,
  videoSessions,
  activeSubscription,
  specialistAvatarUrl,
  initialSessionId,
  onConsumeInitialSession,
  onCreateCompoundingFromCall,
  onOpenRecipes,
  onNotify,
}: VideoConsultationViewProps) {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [customPatientName, setCustomPatientName] = useState<string>(
    activeSubscription?.subscriberName || ''
  );
  const [specialty, setSpecialty] = useState<ClinicalSpecialty>(
    activeSubscription?.specialty || 'metabolica_emagrecimento'
  );
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [scheduledTime, setScheduledTime] = useState<string>('15:00');
  const [chiefComplaint, setChiefComplaint] = useState<string>(
    activeSubscription?.healthFocus || ''
  );
  const [creating, setCreating] = useState(false);

  // Active Live Call State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [callNotesDraft, setCallNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const activeSession =
    videoSessions.find((s) => s.id === activeSessionId) || null;

  const occupiedSlotsForDate = videoSessions
    .filter(
      (s) => s.scheduledDate === scheduledDate && s.status !== 'cancelada'
    )
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  const timeConflictSession =
    occupiedSlotsForDate.find((s) => s.scheduledTime === scheduledTime) || null;

  useEffect(() => {
    if (activeSession) {
      setCallNotesDraft(activeSession.callNotes || '');
    }
  }, [activeSession?.id]);

  useEffect(() => {
    if (!initialSessionId) return;
    const target = videoSessions.find((s) => s.id === initialSessionId);
    if (!target) return;
    onConsumeInitialSession?.();
    void handleJoinExisting(target);
  }, [initialSessionId, videoSessions]);

  useEffect(() => {
    if (!inCall) return;
    const timer = window.setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [inCall]);

  useEffect(() => {
    return () => {
      stopMediaTracks();
    };
  }, []);

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

  async function startLocalMedia() {
    setMediaError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMediaError(
        'Câmera não detectada neste navegador. A sala clínica segue ativa em modo consultório.'
      );
      return;
    }
    try {
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
        'Permissão de câmera/microfone não concedida ou dispositivo indisponível. Você pode habilitar no navegador ou seguir registrando o atendimento clínico abaixo.'
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

  async function handleScheduleOrStart(startImmediately: boolean) {
    if (!startImmediately && timeConflictSession) {
      onNotify(
        `Horário ${scheduledTime} já está ocupado por ${timeConflictSession.patientName}. Escolha outro horário.`
      );
      return;
    }

    const linkedPatient = patients.find((p) => p.id === selectedPatientId);
    const resolvedName =
      linkedPatient?.fullName ||
      customPatientName.trim() ||
      activeSubscription?.subscriberName ||
      'Paciente Assinante';

    setCreating(true);
    try {
      const newId = await createVideoSession({
        userId,
        patientId: linkedPatient?.id || '',
        patientName: resolvedName,
        specialty,
        scheduledDate,
        scheduledTime,
        status: startImmediately ? 'em_andamento' : 'agendada',
        chiefComplaint: chiefComplaint.trim(),
        callNotes: '',
        durationMinutes: 0,
      });
      setActiveSessionId(newId);
      setCallNotesDraft('');
      if (startImmediately) {
        setCallSeconds(0);
        setInCall(true);
        await startLocalMedia();
        onNotify('Videochamada iniciada com a Nutricionista Dimitra Bratu.');
      } else {
        onNotify('Videochamada agendada com sucesso.');
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinExisting(session: VideoSession) {
    setActiveSessionId(session.id);
    setCallNotesDraft(session.callNotes || '');
    if (session.status === 'agendada') {
      await updateVideoSession(session.id, { status: 'em_andamento' });
    }
    setCallSeconds(0);
    setInCall(true);
    await startLocalMedia();
  }

  async function handleSaveCallNotes() {
    if (!activeSession || activeSession.status === 'concluida') return;
    setSavingNotes(true);
    try {
      await updateVideoSession(activeSession.id, {
        callNotes: callNotesDraft,
        durationMinutes: Math.max(1, Math.round(callSeconds / 60)),
      });
      onNotify('Anotações da videochamada salvas no prontuário.');
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleEndCall(markConcluded: boolean) {
    stopMediaTracks();
    setInCall(false);
    if (
      activeSession &&
      activeSession.status !== 'concluida' &&
      activeSession.status !== 'cancelada'
    ) {
      await updateVideoSession(activeSession.id, {
        callNotes: callNotesDraft,
        durationMinutes: Math.max(1, Math.round(callSeconds / 60)),
        ...(markConcluded ? { status: 'concluida' } : {}),
      });
      if (markConcluded) {
        onNotify(
          'Videochamada concluída! Agora você pode gerar a prescrição de vitaminas manipuladas.'
        );
      }
    }
  }

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSec % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="space-y-7">
      {/* Live Video Call Stage */}
      {inCall && activeSession && (
        <SpotlightCard glowRim className="rounded-3xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left Video Stage */}
            <div className="lg:col-span-7 bg-[#090705] p-5 sm:p-6 flex flex-col justify-between gap-4 border-b lg:border-b-0 lg:border-r border-[#D9AF72]/18">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] tracking-[0.18em] text-[#DFBA7C] font-medium">
                    SALA EXCLUSIVA · VIDEOCHAMADA
                  </p>
                  <h2 className="font-editorial text-2xl text-[#FAF5EC]">
                    Nutricionista Dimitra Bratu & {activeSession.patientName}
                  </h2>
                </div>
                <div className="px-3 py-1 rounded-full bg-[#19130F] border border-[#D9AF72]/35 font-mono tabular-nums text-xs text-[#F0D29C] shrink-0">
                  {formatTimer(callSeconds)}
                </div>
              </div>

              {/* Split Video Frames: Dra. Dimitra Stage + Local Patient/Camera Feed */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Dra. Dimitra Bratu Clinical Presence */}
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-[#1C150F] via-[#120E0A] to-[#0A0806] border border-[#D9AF72]/30 flex flex-col items-center justify-center p-5 text-center">
                  {specialistAvatarUrl ? (
                    <img
                      src={specialistAvatarUrl}
                      alt="Nutricionista Dimitra Bratu"
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#E8C589]/70 mb-3 shadow-[0_0_40px_-6px_rgba(217,175,114,0.45)]"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#D9AF72]/14 border border-[#E8C589]/55 flex items-center justify-center mb-3 shadow-[0_0_40px_-6px_rgba(217,175,114,0.45)]">
                      <VerbenaEmblem className="w-9 h-9" />
                    </div>
                  )}
                  <div className="font-editorial text-2xl text-[#FAF5EC]">
                    Dra. Dimitra Bratu
                  </div>
                  <div className="text-xs text-[#DFBA7C] mt-0.5">
                    Nutricionista Clínica Especialista
                  </div>
                  <div className="mt-3 text-[11px] px-3 py-1 rounded-full bg-[#D9AF72]/12 border border-[#D9AF72]/28 text-[#E8C589]">
                    {SPECIALTY_LABELS[activeSession.specialty]}
                  </div>
                </div>

                {/* Live Local Camera Feed */}
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#110D0A] border border-[#D9AF72]/25 flex items-center justify-center">
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
                    <div className="p-4 text-center space-y-2">
                      <VideoOff className="w-8 h-8 text-[#8D8274] mx-auto" />
                      <div className="text-xs font-medium text-[#FAF5EC]">
                        {activeSession.patientName}
                      </div>
                      <p className="text-[11px] text-[#8D8274] leading-relaxed">
                        {mediaError || 'Câmera pausada'}
                      </p>
                      {mediaError && (
                        <button
                          type="button"
                          onClick={startLocalMedia}
                          className="text-[11px] text-[#E8C589] hover:underline cursor-pointer"
                        >
                          Tentar ativar câmera novamente
                        </button>
                      )}
                    </div>
                  )}
                  <div className="absolute bottom-2.5 left-3 px-2.5 py-1 rounded-full bg-black/70 text-[11px] text-[#FAF5EC] backdrop-blur-xs">
                    Você · {activeSession.patientName.split(' ')[0]}
                  </div>
                </div>
              </div>

              {/* Call Controls */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    micEnabled
                      ? 'bg-[#18130F] border-[#D9AF72]/35 text-[#FAF5EC]'
                      : 'bg-red-950/70 border-red-400/40 text-red-200'
                  }`}
                >
                  {micEnabled ? (
                    <Mic className="w-4 h-4 text-[#E8C589]" />
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
                      ? 'bg-[#18130F] border-[#D9AF72]/35 text-[#FAF5EC]'
                      : 'bg-red-950/70 border-red-400/40 text-red-200'
                  }`}
                >
                  {camEnabled ? (
                    <Camera className="w-4 h-4 text-[#E8C589]" />
                  ) : (
                    <CameraOff className="w-4 h-4" />
                  )}
                  <span>{camEnabled ? 'Câmera ativa' : 'Câmera desligada'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleEndCall(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-red-600/90 hover:bg-red-500 text-white transition-colors cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>Concluir atendimento</span>
                </button>
              </div>
            </div>

            {/* Right Clinical Notes & Prescription Handoff */}
            <div className="lg:col-span-5 p-5 sm:p-6 bg-[#130F0C] flex flex-col gap-4">
              <div>
                <h3 className="font-editorial text-2xl font-medium text-[#FAF5EC]">
                  Prontuário da Videochamada
                </h3>
                <p className="text-xs text-[#A89E90] mt-0.5">
                  Registre sintomas, exames e condutas para gerar imediatamente as
                  vitaminas manipuladas.
                </p>
              </div>

              {activeSession.chiefComplaint && (
                <div className="p-3 rounded-xl bg-[#0F0C09] border border-[#D9AF72]/18 text-xs text-[#CFC5B8]">
                  <span className="text-[#DFBA7C] font-medium block mb-0.5">
                    Queixa principal informada:
                  </span>
                  {activeSession.chiefComplaint}
                </div>
              )}

              <textarea
                rows={7}
                value={callNotesDraft}
                onChange={(e) => setCallNotesDraft(e.target.value)}
                placeholder="Ex.: Paciente relata fadiga à tarde, vitamina D em 22 ng/mL, ferritina 28, sono fragmentado. Combinado fórmula manipulada noturna + ajuste de café da manhã proteico..."
                className="w-full flex-1 px-4 py-3 text-sm bg-[#0B0907] text-[#FAF5EC] placeholder-[#7C7164] border border-[#D9AF72]/24 rounded-xl focus:outline-none focus:border-[#E8C589] resize-none leading-relaxed"
              />

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={savingNotes}
                  onClick={handleSaveCallNotes}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-medium text-[#F5EFE6] border border-[#D9AF72]/35 hover:border-[#F0D29C] hover:bg-[#D9AF72]/10 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-[#E8C589]" />
                  <span>{savingNotes ? 'Salvando...' : 'Salvar notas'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveCallNotes();
                    onCreateCompoundingFromCall({
                      patientId: activeSession.patientId,
                      patientName: activeSession.patientName,
                      specialty: activeSession.specialty,
                      clinicalCaseNotes:
                        [activeSession.chiefComplaint, callNotesDraft]
                          .filter(Boolean)
                          .join('\n') || '',
                    });
                  }}
                  className="btn-gold flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Prescrever manipulados</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </SpotlightCard>
      )}

      {/* Scheduler + Sessions History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* New Video Session Form */}
        <SpotlightCard className="lg:col-span-5 p-6 space-y-5">
          <div>
            <p className="text-xs tracking-[0.2em] text-[#DFBA7C] mb-1">
              Atendimento por vídeo
            </p>
            <h2 className="font-editorial text-3xl font-medium text-[#FAF5EC] leading-tight">
              Videochamada com a{' '}
              <span className="italic text-[#E8C589]">Dra. Dimitra Bratu</span>
            </h2>
            <p className="text-xs text-[#A89E90] mt-1.5 leading-relaxed">
              Agende ou inicie agora sua consulta por vídeo para avaliação
              individualizada de saúde, definição das vitaminas manipuladas e
              receitas terapêuticas.
            </p>
          </div>

          <div className="space-y-4">
            {patients.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
                  Paciente cadastrado (opcional)
                </label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => {
                    setSelectedPatientId(e.target.value);
                    const found = patients.find((p) => p.id === e.target.value);
                    if (found) setCustomPatientName(found.fullName);
                  }}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0E0B08] text-[#FAF5EC] border border-[#D9AF72]/25 rounded-xl focus:outline-none focus:border-[#E8C589]"
                >
                  <option value="">Selecionar ou informar nome abaixo</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
                Nome do paciente
              </label>
              <input
                type="text"
                value={customPatientName}
                onChange={(e) => setCustomPatientName(e.target.value)}
                placeholder="Nome completo do paciente"
                className="w-full px-3.5 py-2.5 text-sm bg-[#0E0B08] text-[#FAF5EC] border border-[#D9AF72]/25 rounded-xl focus:outline-none focus:border-[#E8C589]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
                Especialidade do tratamento nutricional
              </label>
              <select
                value={specialty}
                onChange={(e) =>
                  setSpecialty(e.target.value as ClinicalSpecialty)
                }
                className="w-full px-3.5 py-2.5 text-sm bg-[#0E0B08] text-[#FAF5EC] border border-[#D9AF72]/25 rounded-xl focus:outline-none focus:border-[#E8C589]"
              >
                {CLINICAL_SPECIALTIES.map((spec) => (
                  <option key={spec.id} value={spec.id}>
                    {spec.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
                  Data
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-mono tabular-nums bg-[#0E0B08] text-[#FAF5EC] border border-[#D9AF72]/25 rounded-xl focus:outline-none focus:border-[#E8C589]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
                  Horário
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-mono tabular-nums bg-[#0E0B08] text-[#FAF5EC] border border-[#D9AF72]/25 rounded-xl focus:outline-none focus:border-[#E8C589]"
                />
              </div>
            </div>

            {occupiedSlotsForDate.length > 0 && (
              <div className="text-xs text-[#A89E90] space-y-1">
                <div className="font-mono tabular-nums">
                  Horários ocupados em {scheduledDate}:{' '}
                  <span className="text-[#DFBA7C]">
                    {occupiedSlotsForDate
                      .map(
                        (s) =>
                          `${s.scheduledTime} (${s.patientName.split(' ')[0]})`
                      )
                      .join(' · ')}
                  </span>
                </div>
                {timeConflictSession && (
                  <div className="text-amber-300">
                    Conflito detectado: {scheduledTime} já está reservado para{' '}
                    {timeConflictSession.patientName}.
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#BDB2A4] mb-1.5">
                Queixa principal / exames para avaliar no vídeo
              </label>
              <textarea
                rows={3}
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="Descreva sintomas, exames recentes ou dúvidas para a Dra. Dimitra Bratu..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#0E0B08] text-[#FAF5EC] border border-[#D9AF72]/25 rounded-xl focus:outline-none focus:border-[#E8C589] resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                disabled={creating}
                onClick={() => handleScheduleOrStart(true)}
                className="btn-gold flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Video className="w-4 h-4" />
                <span>Iniciar vídeo agora</span>
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => handleScheduleOrStart(false)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-medium text-[#F5EFE6] border border-[#D9AF72]/35 rounded-full hover:border-[#F0D29C] hover:bg-[#D9AF72]/10 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-[#E8C589]" />
                <span>Agendar</span>
              </button>
            </div>
          </div>
        </SpotlightCard>

        {/* Sessions List */}
        <section className="lg:col-span-7 glass-obsidian rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D9AF72]/16 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-editorial text-2xl font-medium text-[#FAF5EC]">
                Agenda & Histórico de Videochamadas
              </h3>
              <p className="text-xs text-[#A89E90]">
                Entre na sala ou gere diretamente as vitaminas manipuladas após a
                consulta
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenRecipes}
              className="text-xs font-medium text-[#E5C38A] hover:text-[#F7DFB3] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Receitas</span>
            </button>
          </div>

          {videoSessions.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Video className="w-8 h-8 text-[#D9AF72]/60 mx-auto" />
              <div className="text-sm font-medium text-[#FAF5EC]">
                Nenhuma videochamada registrada ainda
              </div>
              <p className="text-xs text-[#8D8274] max-w-md mx-auto">
                Use o painel ao lado para iniciar sua consulta por vídeo agora ou
                agendar um horário com a Nutricionista Dimitra Bratu.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#D9AF72]/12">
              {videoSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-5 hover:bg-[#D9AF72]/5 transition-colors space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[#FAF5EC]">
                          {session.patientName}
                        </span>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium ${
                            session.status === 'concluida'
                              ? 'border-emerald-400/35 bg-emerald-950/50 text-emerald-300'
                              : session.status === 'em_andamento'
                              ? 'border-[#F0D29C]/60 bg-[#D9AF72]/18 text-[#F0D29C]'
                              : 'border-[#D9AF72]/28 bg-[#1A140F] text-[#DFBA7C]'
                          }`}
                        >
                          {STATUS_LABELS[session.status]}
                        </span>
                      </div>
                      <div className="text-xs text-[#DFBA7C] mt-1">
                        {SPECIALTY_LABELS[session.specialty]}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-[#8D8274] mt-1">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {session.scheduledDate}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {session.scheduledTime}
                        </span>
                        {session.durationMinutes > 0 && (
                          <span>{session.durationMinutes} min</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {session.status !== 'concluida' &&
                        session.status !== 'cancelada' && (
                          <button
                            type="button"
                            onClick={() => handleJoinExisting(session)}
                            className="btn-gold inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Entrar na sala</span>
                          </button>
                        )}

                      <button
                        type="button"
                        onClick={() =>
                          onCreateCompoundingFromCall({
                            patientId: session.patientId,
                            patientName: session.patientName,
                            specialty: session.specialty,
                            clinicalCaseNotes: [
                              session.chiefComplaint,
                              session.callNotes,
                            ]
                              .filter(Boolean)
                              .join('\n'),
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#F0D29C] border border-[#D9AF72]/35 rounded-full hover:bg-[#D9AF72]/14 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        <span>Gerar manipulados</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await deleteVideoSession(session.id);
                          if (activeSessionId === session.id) {
                            stopMediaTracks();
                            setInCall(false);
                            setActiveSessionId(null);
                          }
                          onNotify('Registro de videochamada removido.');
                        }}
                        aria-label="Excluir videochamada"
                        className="p-1.5 text-[#8D8274] hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {(session.chiefComplaint || session.callNotes) && (
                    <div className="p-3 rounded-xl bg-[#100D0A] border border-[#D9AF72]/14 text-xs text-[#BDB2A4] space-y-1">
                      {session.chiefComplaint && (
                        <div>
                          <span className="text-[#DFBA7C]">Objetivo:</span>{' '}
                          {session.chiefComplaint}
                        </div>
                      )}
                      {session.callNotes && (
                        <div className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#E8C589] shrink-0 mt-0.5" />
                          <span className="line-clamp-3">{session.callNotes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
