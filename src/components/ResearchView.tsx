import React, { useEffect, useState } from 'react';
import { BookMarked, Loader2, Search, Send } from 'lucide-react';
import {
  LIBRARY_FOCUS_LABELS,
  queryNutritionScience,
  ResearchResult,
  ScientificLibraryFocus,
} from '../lib/aiService';
import { calculateBMI } from '../lib/nutrition';
import { GOAL_LABELS, Patient } from '../types';
import { SpotlightCard } from './LuxuryPrimitives';
import { ScientificEvidenceBlock } from './ScientificEvidenceBlock';

interface ResearchHistoryEntry {
  id: string;
  query: string;
  libraryFocus: ScientificLibraryFocus;
  patientName?: string;
  result: ResearchResult;
}

interface ResearchViewProps {
  patients: Patient[];
  initialQuery?: string;
  initialPatientId?: string | null;
  onConsumeInitialQuery?: () => void;
}

const SUGGESTED_CLINICAL_TOPICS = [
  'Ingestão proteica ideal (g/kg) e preservação de massa magra no emagrecimento segundo consensos recentes da ISSN e ESPEN',
  'Diretrizes atuais da SBD e ADA sobre fibras solúveis, carga glicêmica e ordem de ingestão dos alimentos no controle da HbA1c',
  'Evidências de meta-análises recentes na PubMed/Cochrane sobre creatina, ômega-3 e vitamina D na prática clínica',
  'Estratégias nutricionais baseadas em evidências para síndrome do intestino irritável e dieta low-FODMAP',
];

export function ResearchView({
  patients,
  initialQuery,
  initialPatientId,
  onConsumeInitialQuery,
}: ResearchViewProps) {
  const [query, setQuery] = useState('');
  const [libraryFocus, setLibraryFocus] =
    useState<ScientificLibraryFocus>('all');
  const [patientId, setPatientId] = useState<string>(initialPatientId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ResearchHistoryEntry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  const selectedPatient = patients.find((p) => p.id === patientId) || null;
  const activeEntry =
    history.find((h) => h.id === activeEntryId) || history[0] || null;

  async function runSearch(customQuery?: string) {
    const q = (customQuery ?? query).trim();
    if (q.length < 3 || loading) return;

    setLoading(true);
    setError(null);
    if (customQuery) setQuery(customQuery);

    try {
      const result = await queryNutritionScience({
        query: q,
        libraryFocus,
        patient: selectedPatient,
      });
      const entry: ResearchHistoryEntry = {
        id: `res_${Date.now()}`,
        query: q,
        libraryFocus,
        patientName: selectedPatient?.fullName,
        result,
      };
      setHistory((prev) => [entry, ...prev]);
      setActiveEntryId(entry.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível concluir a busca científica.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialQuery && initialQuery.trim().length >= 3) {
      const q = initialQuery.trim();
      onConsumeInitialQuery?.();
      runSearch(q);
    }
  }, [initialQuery]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch();
  }

  return (
    <div className="space-y-6">
      <SpotlightCard glowRim className="p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-editorial text-2xl font-medium text-[#FAF5EC]">
              Busca Ativa em Bibliotecas de Ciência da Nutrição
            </h2>
            <p className="text-xs text-[#A89E90] mt-0.5">
              Consulta em tempo real a PubMed, Cochrane, ESPEN, ISSN, SBD, ABESO, OMS e SciELO com referências verificáveis.
            </p>
          </div>

          <div className="min-w-[240px]">
            <label
              htmlFor="research-patient-context"
              className="block text-[11px] font-medium text-[#9D9284] mb-1"
            >
              Contextualizar para paciente (opcional)
            </label>
            <select
              id="research-patient-context"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-[#120E0B] text-[#FAF5EC] border border-[#D9AF72]/24 rounded-full focus:outline-none focus:border-[#E8C589]"
            >
              <option value="">Pesquisa científica geral</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({GOAL_LABELS[p.goal]})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedPatient && (
          <div className="text-xs text-[#CFC5B8] bg-[#120E0B] border border-[#D9AF72]/18 rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-[#F0D29C]">
              Caso ativo: {selectedPatient.fullName}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              IMC {calculateBMI(selectedPatient.weightKg, selectedPatient.heightCm).toFixed(1)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Meta {selectedPatient.targetCalories} kcal ({selectedPatient.targetProteinG}g prot)
            </span>
            {selectedPatient.restrictions.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-300/90">
                  Restrições: {selectedPatient.restrictions.join(', ')}
                </span>
              </>
            )}
          </div>
        )}

        {/* Library Focus Segmented Filter */}
        <div className="flex items-center gap-1 p-1 bg-[#120E0B] border border-[#D9AF72]/16 rounded-full overflow-x-auto">
          {(Object.keys(LIBRARY_FOCUS_LABELS) as ScientificLibraryFocus[]).map(
            (key) => (
              <button
                key={key}
                type="button"
                onClick={() => setLibraryFocus(key)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  libraryFocus === key
                    ? 'btn-gold font-semibold'
                    : 'text-[#BDB2A4] hover:text-[#FAF5EC]'
                }`}
              >
                {LIBRARY_FOCUS_LABELS[key]}
              </button>
            )
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8D8274] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex.: Quais as recomendações mais atuais da ESPEN e SBD para proteína em pacientes com pré-diabetes?"
              className="w-full pl-11 pr-4 py-2.5 text-sm bg-[#120E0B] text-[#FAF5EC] placeholder-[#7C7164] border border-[#D9AF72]/24 rounded-full focus:outline-none focus:border-[#E8C589]"
            />
          </div>
          <button
            type="submit"
            disabled={loading || query.trim().length < 3}
            className="btn-gold inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-full cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Pesquisando bases...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Consultar evidências
              </>
            )}
          </button>
        </form>

        <div className="space-y-2.5 pt-1">
          <span className="text-xs font-medium text-[#9D9284]">
            Consultas clínicas frequentes:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {SUGGESTED_CLINICAL_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                disabled={loading}
                onClick={() => runSearch(topic)}
                className="text-left px-4 py-3 text-xs text-[#CFC5B8] bg-[#120E0B]/85 border border-[#D9AF72]/16 rounded-xl hover:border-[#E8C589]/50 hover:text-[#FAF5EC] transition-colors cursor-pointer disabled:opacity-50"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </SpotlightCard>

      {error && (
        <div
          role="alert"
          className="px-5 py-4 text-sm text-red-200 bg-red-950/60 border border-red-400/30 rounded-xl"
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="glass-obsidian rounded-2xl p-8 flex items-center gap-4">
          <Loader2 className="w-5 h-5 text-[#E8C589] animate-spin shrink-0" />
          <div>
            <div className="text-sm font-semibold text-[#FAF5EC]">
              Consultando bibliotecas científicas em tempo real...
            </div>
            <div className="text-xs text-[#A89E90] mt-0.5">
              Buscando diretrizes, meta-análises e revisões mais recentes em{' '}
              {LIBRARY_FOCUS_LABELS[libraryFocus]}.
            </div>
          </div>
        </div>
      )}

      {!loading && activeEntry && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <article className="lg:col-span-8 glass-obsidian rounded-2xl p-6 sm:p-7 space-y-5">
            <header className="pb-4 border-b border-[#D9AF72]/15">
              <div className="text-xs text-[#DFBA7C] mb-1.5">
                {LIBRARY_FOCUS_LABELS[activeEntry.libraryFocus]}
                {activeEntry.patientName ? ` · Caso: ${activeEntry.patientName}` : ''}
              </div>
              <h3 className="font-editorial text-2xl font-medium text-[#FAF5EC] leading-snug">
                {activeEntry.query}
              </h3>
            </header>

            <ScientificEvidenceBlock
              markdown={activeEntry.result.answer}
              sources={activeEntry.result.sources}
              searchQueries={activeEntry.result.searchQueries}
              generatedAt={activeEntry.result.generatedAt}
            />
          </article>

          <aside className="lg:col-span-4 glass-obsidian rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F0D29C]">
              <BookMarked className="w-4 h-4" />
              <span>Pesquisas desta sessão ({history.length})</span>
            </div>
            <div className="divide-y divide-[#D9AF72]/12">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveEntryId(item.id)}
                  className={`w-full text-left py-3 first:pt-1 last:pb-0 transition-colors cursor-pointer ${
                    activeEntry.id === item.id
                      ? 'text-[#F0D29C] font-semibold'
                      : 'text-[#B5AAA0] hover:text-[#FAF5EC]'
                  }`}
                >
                  <div className="text-xs line-clamp-2">{item.query}</div>
                  <div className="text-[11px] text-[#8D8274] mt-1">
                    {item.result.sources.length} fontes ·{' '}
                    {LIBRARY_FOCUS_LABELS[item.libraryFocus]}
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
