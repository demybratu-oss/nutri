import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Video,
  X,
} from 'lucide-react';
import {
  createVideoSession,
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

interface ClinicalCalendarPanelProps {
  userId: string;
  patients: Patient[];
  videoSessions: VideoSession[];
  activeSubscription: AnnualSubscription | null;
  onOpenVideoTab: () => void;
  onJoinVideoSession: (sessionId: string) => void;
  onNotify: (message: string) => void;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const STANDARD_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
];

const STATUS_LABELS: Record<VideoSession['status'], string> = {
  agendada: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

function toLocalDateIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatLongDatePt(iso: string): string {
  const date = parseLocalDate(iso);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function ClinicalCalendarPanel({
  userId,
  patients,
  videoSessions,
  activeSubscription,
  onOpenVideoTab,
  onJoinVideoSession,
  onNotify,
}: ClinicalCalendarPanelProps) {
  const todayIso = useMemo(() => toLocalDateIso(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(
    () => {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() };
    }
  );

  // Quick scheduling form state
  const [showForm, setShowForm] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [customPatientName, setCustomPatientName] = useState(
    activeSubscription?.subscriberName || ''
  );
  const [specialty, setSpecialty] = useState<ClinicalSpecialty>(
    activeSubscription?.specialty || 'metabolica_emagrecimento'
  );
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Group all video sessions by YYYY-MM-DD
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, VideoSession[]>();
    for (const s of videoSessions) {
      const key = s.scheduledDate;
      const list = map.get(key) || [];
      list.push(s);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    }
    return map;
  }, [videoSessions]);

  // Sessions on selected date
  const selectedDaySessions = useMemo(
    () => sessionsByDate.get(selectedDate) || [],
    [sessionsByDate, selectedDate]
  );

  // Active (non-cancelled) occupied slots map for selected date
  const occupiedByTime = useMemo(() => {
    const map = new Map<string, VideoSession>();
    for (const s of selectedDaySessions) {
      if (s.status !== 'cancelada') {
        map.set(s.scheduledTime, s);
      }
    }
    return map;
  }, [selectedDaySessions]);

  // Merge standard slots with any custom times already booked on that day
  const dayTimeSlots = useMemo(() => {
    const set = new Set<string>(STANDARD_SLOTS);
    for (const s of selectedDaySessions) {
      if (s.status !== 'cancelada' && s.scheduledTime) {
        set.add(s.scheduledTime);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [selectedDaySessions]);

  const conflictSession = occupiedByTime.get(scheduledTime) || null;

  // Monthly stats for current viewed month
  const monthPrefix = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(
    2,
    '0'
  )}`;
  const monthActiveCount = useMemo(
    () =>
      videoSessions.filter(
        (s) =>
          s.scheduledDate.startsWith(monthPrefix) && s.status !== 'cancelada'
      ).length,
    [videoSessions, monthPrefix]
  );

  const upcomingCount = useMemo(
    () =>
      videoSessions.filter(
        (s) =>
          s.scheduledDate >= todayIso &&
          (s.status === 'agendada' || s.status === 'em_andamento')
      ).length,
    [videoSessions, todayIso]
  );

  // Build 42-cell (6-week) calendar grid
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewMonth.year, viewMonth.month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(
      viewMonth.year,
      viewMonth.month + 1,
      0
    ).getDate();
    const prevMonthDays = new Date(
      viewMonth.year,
      viewMonth.month,
      0
    ).getDate();

    const cells: Array<{
      iso: string;
      day: number;
      inCurrentMonth: boolean;
    }> = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(
        viewMonth.year,
        viewMonth.month - 1,
        prevMonthDays - i
      );
      cells.push({
        iso: toLocalDateIso(d),
        day: d.getDate(),
        inCurrentMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewMonth.year, viewMonth.month, day);
      cells.push({
        iso: toLocalDateIso(d),
        day,
        inCurrentMonth: true,
      });
    }

    const totalNeeded = cells.length <= 35 ? 35 : 42;
    let nextDay = 1;
    while (cells.length < totalNeeded) {
      const d = new Date(viewMonth.year, viewMonth.month + 1, nextDay);
      cells.push({
        iso: toLocalDateIso(d),
        day: nextDay,
        inCurrentMonth: false,
      });
      nextDay += 1;
    }

    return cells;
  }, [viewMonth]);

  function handlePrevMonth() {
    setViewMonth((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 }
    );
  }

  function handleNextMonth() {
    setViewMonth((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 }
    );
  }

  function handleGoToday() {
    const now = new Date();
    setViewMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(todayIso);
  }

  function handleSelectDay(iso: string, inCurrentMonth: boolean) {
    setSelectedDate(iso);
    setFormError(null);
    if (!inCurrentMonth) {
      const d = parseLocalDate(iso);
      setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
    }
  }

  function handleSlotClick(time: string) {
    const existing = occupiedByTime.get(time);
    if (existing) {
      setShowForm(false);
      setFormError(null);
      if (existing.status !== 'concluida') {
        onJoinVideoSession(existing.id);
      }
      return;
    }
    setScheduledTime(time);
    setFormError(null);
    setShowForm(true);
  }

  function handleOpenNewBooking() {
    const firstFree =
      STANDARD_SLOTS.find((slot) => !occupiedByTime.has(slot)) || '09:00';
    setScheduledTime(firstFree);
    setFormError(null);
    setShowForm(true);
  }

  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (conflictSession) {
      setFormError(
        `O horário ${scheduledTime} já está ocupado por ${conflictSession.patientName}. Escolha outro horário livre.`
      );
      return;
    }

    const linkedPatient = patients.find((p) => p.id === selectedPatientId);
    const resolvedName =
      linkedPatient?.fullName || customPatientName.trim() || '';

    if (resolvedName.length < 2) {
      setFormError('Selecione um paciente ou informe o nome completo.');
      return;
    }

    setSubmitting(true);
    try {
      await createVideoSession({
        userId,
        patientId: linkedPatient?.id || '',
        patientName: resolvedName,
        specialty,
        scheduledDate: selectedDate,
        scheduledTime,
        status: 'agendada',
        chiefComplaint: chiefComplaint.trim(),
        callNotes: '',
        durationMinutes: 0,
      });
      setChiefComplaint('');
      setShowForm(false);
      onNotify(
        `Consulta de vídeo agendada para ${resolvedName} em ${selectedDate} às ${scheduledTime}.`
      );
    } catch {
      setFormError('Não foi possível agendar a consulta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelSession(session: VideoSession) {
    setCancellingId(session.id);
    try {
      await updateVideoSession(session.id, { status: 'cancelada' });
      onNotify(
        `Horário das ${session.scheduledTime} liberado (${session.patientName}).`
      );
    } finally {
      setCancellingId(null);
    }
  }

  const occupiedCountForDay = occupiedByTime.size;
  const freeCountForDay = dayTimeSlots.length - occupiedCountForDay;

  return (
    <section
      aria-label="Calendário clínico integrado às videochamadas"
      className="glass-obsidian rounded-2xl overflow-hidden"
    >
      {/* Top Section Header */}
      <div className="px-6 py-5 border-b border-[#B7DB74]/14 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
            Agenda Clínica e Videochamadas
          </h2>
          <p className="text-xs text-[#A8CCB9] mt-0.5 tabular-nums">
            {upcomingCount} próximas consultas · {monthActiveCount} neste mês ·
            Sincronizado em tempo real com Videochamadas
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={handleOpenNewBooking}
            className="btn-gold inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agendar consulta</span>
          </button>
          <button
            type="button"
            onClick={onOpenVideoTab}
            className="text-xs font-medium text-[#C7E88B] hover:text-[#DDF3B2] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Abrir Videochamadas</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Split: Calendar + Time Grid on Left, Day Schedule & Booking on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#B7DB74]/14">
        {/* Left: Monthly Calendar + Day Slots Overview */}
        <div className="lg:col-span-7 p-6 space-y-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-editorial text-xl font-medium text-[#F4FBF6] capitalize">
              {MONTH_NAMES[viewMonth.month]}{' '}
              <span className="font-mono tabular-nums text-[#C7E88B] text-base">
                {viewMonth.year}
              </span>
            </h3>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleGoToday}
                className="px-3 py-1.5 text-xs font-medium text-[#C7E88B] hover:text-[#F4FBF6] border border-[#B7DB74]/25 hover:border-[#C7E88B]/50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Mês anterior"
                className="p-2 text-[#A8CCB9] hover:text-[#F4FBF6] border border-[#B7DB74]/20 hover:border-[#C7E88B]/45 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Próximo mês"
                className="p-2 text-[#A8CCB9] hover:text-[#F4FBF6] border border-[#B7DB74]/20 hover:border-[#C7E88B]/45 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAY_LABELS.map((wd) => (
              <div
                key={wd}
                className="py-1.5 text-[11px] font-medium text-[#85AF9B]"
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarCells.map((cell) => {
              const daySessions = (sessionsByDate.get(cell.iso) || []).filter(
                (s) => s.status !== 'cancelada'
              );
              const activeSessionsCount = daySessions.length;
              const isSelected = cell.iso === selectedDate;
              const isToday = cell.iso === todayIso;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => handleSelectDay(cell.iso, cell.inCurrentMonth)}
                  aria-pressed={isSelected}
                  aria-label={`${cell.iso}${
                    activeSessionsCount > 0
                      ? `, ${activeSessionsCount} consulta${
                          activeSessionsCount > 1 ? 's' : ''
                        }`
                      : ', sem consultas'
                  }`}
                  className={`min-h-[54px] p-2 rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7E88B] ${
                    isSelected
                      ? 'bg-[#B7DB74]/20 border-[#C7E88B] text-[#F4FBF6]'
                      : isToday
                      ? 'bg-[#07201C] border-[#B7DB74]/45 text-[#F4FBF6] hover:bg-[#B7DB74]/10'
                      : cell.inCurrentMonth
                      ? 'bg-[#07201C]/65 border-[#B7DB74]/12 text-[#CBE3D6] hover:border-[#B7DB74]/35 hover:bg-[#07201C]'
                      : 'bg-transparent border-transparent text-[#85AF9B] hover:bg-[#0E332D]/60'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isSelected
                          ? 'font-semibold text-[#DDF3B2]'
                          : isToday
                          ? 'font-semibold text-[#C7E88B]'
                          : ''
                      }`}
                    >
                      {cell.day}
                    </span>
                    {isToday && (
                      <span className="text-[9px] font-medium text-[#C7E88B]">
                        Hoje
                      </span>
                    )}
                  </div>

                  {activeSessionsCount > 0 ? (
                    <div className="text-[10px] font-mono tabular-nums text-[#C7E88B] truncate">
                      {activeSessionsCount}{' '}
                      {activeSessionsCount === 1 ? 'horário' : 'horários'}
                    </div>
                  ) : (
                    <div className="h-3" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Daily Time Slot Availability Matrix */}
          <div className="pt-5 border-t border-[#B7DB74]/14 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-[#F4FBF6]">
                Grade de horários ·{' '}
                <span className="text-[#C7E88B] capitalize">
                  {formatLongDatePt(selectedDate)}
                </span>
              </div>
              <div className="text-xs text-[#85AF9B] tabular-nums">
                {occupiedCountForDay} ocupados · {freeCountForDay} livres
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {dayTimeSlots.map((slot) => {
                const booked = occupiedByTime.get(slot);
                const isSelectedSlot = showForm && scheduledTime === slot;

                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => handleSlotClick(slot)}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7E88B] ${
                      booked
                        ? 'bg-[#B7DB74]/14 border-[#B7DB74]/45 text-[#F4FBF6] hover:bg-[#B7DB74]/22'
                        : isSelectedSlot
                        ? 'bg-[#C7E88B]/20 border-[#DDF3B2] text-[#F4FBF6]'
                        : 'bg-[#061A17]/80 border-[#B7DB74]/15 text-[#A8CCB9] hover:border-[#B7DB74]/40 hover:text-[#F4FBF6]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-mono tabular-nums font-medium">
                        {slot}
                      </span>
                      <span
                        className={`text-[10px] font-medium ${
                          booked ? 'text-[#DDF3B2]' : 'text-[#85AF9B]'
                        }`}
                      >
                        {booked ? 'Ocupado' : 'Livre'}
                      </span>
                    </div>
                    <div className="text-[11px] truncate mt-1 text-[#A8CCB9]">
                      {booked
                        ? booked.patientName.split(' ')[0]
                        : 'Agendar vídeo'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Selected Day Appointments & Quick Booking Form */}
        <div className="lg:col-span-5 p-6 bg-[#07201C]/45 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-[#C7E88B] font-medium capitalize">
                  {formatLongDatePt(selectedDate)}
                </div>
                <h3 className="font-editorial text-xl font-medium text-[#F4FBF6] mt-0.5">
                  {showForm ? 'Agendar nova consulta' : 'Consultas do dia'}
                </h3>
              </div>

              {showForm ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormError(null);
                  }}
                  aria-label="Fechar formulário de agendamento"
                  className="p-1.5 text-[#A8CCB9] hover:text-[#F4FBF6] rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenNewBooking}
                  className="text-xs font-medium text-[#C7E88B] hover:text-[#DDF3B2] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo horário</span>
                </button>
              )}
            </div>

            {showForm && (
              <form
                onSubmit={handleCreateAppointment}
                className="space-y-3.5 pb-5 border-b border-[#B7DB74]/14"
              >
                {patients.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                      Paciente cadastrado
                    </label>
                    <select
                      value={selectedPatientId}
                      onChange={(e) => {
                        setSelectedPatientId(e.target.value);
                        const found = patients.find(
                          (p) => p.id === e.target.value
                        );
                        if (found) setCustomPatientName(found.fullName);
                      }}
                      className="w-full px-3 py-2 text-xs bg-[#041210] text-[#F4FBF6] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                    >
                      <option value="">Selecionar ou digitar nome abaixo</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                    Nome do paciente
                  </label>
                  <input
                    type="text"
                    required
                    value={customPatientName}
                    onChange={(e) => setCustomPatientName(e.target.value)}
                    placeholder="Nome completo do paciente"
                    className="w-full px-3 py-2 text-xs bg-[#041210] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                      Data
                    </label>
                    <input
                      type="date"
                      required
                      value={selectedDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleSelectDay(e.target.value, false);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#041210] text-[#F4FBF6] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                      Horário
                    </label>
                    <input
                      type="time"
                      required
                      value={scheduledTime}
                      onChange={(e) => {
                        setScheduledTime(e.target.value);
                        setFormError(null);
                      }}
                      className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#041210] text-[#F4FBF6] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                    />
                  </div>
                </div>

                {conflictSession && (
                  <div
                    role="alert"
                    className="px-3 py-2 text-xs text-amber-200 bg-amber-950/50 border border-amber-400/35 rounded-xl"
                  >
                    Horário ocupado por {conflictSession.patientName}. Escolha
                    um horário livre na grade ao lado.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                    Especialidade clínica
                  </label>
                  <select
                    value={specialty}
                    onChange={(e) =>
                      setSpecialty(e.target.value as ClinicalSpecialty)
                    }
                    className="w-full px-3 py-2 text-xs bg-[#041210] text-[#F4FBF6] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B]"
                  >
                    {CLINICAL_SPECIALTIES.map((spec) => (
                      <option key={spec.id} value={spec.id}>
                        {spec.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A8CCB9] mb-1">
                    Objetivo / pauta da consulta (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    placeholder="Ex.: Retorno de 30 dias, revisão de exames e ajuste de manipulados..."
                    className="w-full px-3 py-2 text-xs bg-[#041210] text-[#F4FBF6] placeholder-[#719C88] border border-[#B7DB74]/25 rounded-xl focus:outline-none focus:border-[#C7E88B] resize-none"
                  />
                </div>

                {formError && (
                  <p role="alert" className="text-xs text-red-300">
                    {formError}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={submitting || Boolean(conflictSession)}
                    className="btn-gold flex-1 px-4 py-2.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {submitting ? 'Agendando...' : 'Confirmar agendamento'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setFormError(null);
                    }}
                    className="px-4 py-2.5 text-xs font-medium text-[#A8CCB9] hover:text-[#F4FBF6] border border-[#B7DB74]/25 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Selected Day Sessions List */}
            {selectedDaySessions.length === 0 ? (
              <div className="py-8 text-center space-y-2.5">
                <CalendarIcon className="w-7 h-7 text-[#B7DB74]/50 mx-auto" />
                <div className="text-sm font-medium text-[#F4FBF6]">
                  Agenda livre nesta data
                </div>
                <p className="text-xs text-[#85AF9B] max-w-xs mx-auto leading-relaxed">
                  Clique em qualquer horário livre na grade ao lado para agendar
                  uma consulta de videochamada com o paciente.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#B7DB74]/12">
                {selectedDaySessions.map((session) => {
                  const isCancelled = session.status === 'cancelada';
                  const isConcluded = session.status === 'concluida';
                  return (
                    <div
                      key={session.id}
                      className={`py-3.5 first:pt-0 space-y-2 ${
                        isCancelled ? 'opacity-55' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs text-[#C7E88B] font-mono tabular-nums">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>{session.scheduledTime}</span>
                            <span aria-hidden="true" className="text-[#85AF9B]">
                              ·
                            </span>
                            <span
                              className={`font-sans font-medium ${
                                isConcluded
                                  ? 'text-emerald-300'
                                  : isCancelled
                                  ? 'text-red-300'
                                  : 'text-[#DDF3B2]'
                              }`}
                            >
                              {STATUS_LABELS[session.status]}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-[#F4FBF6] truncate mt-1">
                            {session.patientName}
                          </div>
                          <div className="text-xs text-[#A8CCB9] truncate">
                            {SPECIALTY_LABELS[session.specialty]}
                          </div>
                        </div>

                        {!isCancelled && (
                          <div className="flex items-center gap-2 shrink-0">
                            {!isConcluded && (
                              <button
                                type="button"
                                onClick={() => onJoinVideoSession(session.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full btn-gold cursor-pointer whitespace-nowrap"
                              >
                                <Video className="w-3 h-3" />
                                <span>Entrar</span>
                              </button>
                            )}
                            {session.status === 'agendada' && (
                              <button
                                type="button"
                                disabled={cancellingId === session.id}
                                onClick={() => handleCancelSession(session)}
                                className="px-2.5 py-1.5 text-xs font-medium text-[#A8CCB9] hover:text-red-300 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                              >
                                Liberar
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {session.chiefComplaint && (
                        <p className="text-xs text-[#85AF9B] line-clamp-2 leading-relaxed">
                          {session.chiefComplaint}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Summary Footer */}
          <div className="pt-4 border-t border-[#B7DB74]/14 flex items-center justify-between gap-3 text-xs text-[#85AF9B]">
            <span>
              Horários agendados aparecem automaticamente na sala de
              Videochamada.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
