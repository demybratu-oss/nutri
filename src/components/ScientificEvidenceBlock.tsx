import { ExternalLink, Globe, Search } from 'lucide-react';
import { GroundingSource } from '../lib/aiService';

interface ScientificEvidenceBlockProps {
  markdown: string;
  sources: GroundingSource[];
  searchQueries?: string[];
  generatedAt?: string;
}

function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-[#F4FBF6]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export function FormattedClinicalMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: Array<
    | { type: 'h3'; text: string }
    | { type: 'ul'; items: string[] }
    | { type: 'p'; text: string }
  > = [];

  let currentList: string[] = [];

  function flushList() {
    if (currentList.length > 0) {
      blocks.push({ type: 'ul', items: [...currentList] });
      currentList = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith('### ') || line.startsWith('## ')) {
      flushList();
      blocks.push({ type: 'h3', text: line.replace(/^#{2,3}\s+/, '') });
    } else if (/^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      currentList.push(line.replace(/^([-*•]|\d+\.)\s+/, ''));
    } else {
      flushList();
      blocks.push({ type: 'p', text: line });
    }
  }
  flushList();

  return (
    <div className="space-y-4 text-sm text-[#CBE3D6] leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === 'h3') {
          return (
            <h3
              key={idx}
              className="font-editorial text-xl font-medium text-[#DDF3B2] pt-2 first:pt-0"
            >
              {block.text}
            </h3>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul
              key={idx}
              className="space-y-2 pl-4 list-disc marker:text-[#B7DB74]"
            >
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInlineBold(item)}</li>
              ))}
            </ul>
          );
        }
        return <p key={idx}>{renderInlineBold(block.text)}</p>;
      })}
    </div>
  );
}

export function ScientificEvidenceBlock({
  markdown,
  sources,
  searchQueries = [],
  generatedAt,
}: ScientificEvidenceBlockProps) {
  return (
    <div className="space-y-6">
      <FormattedClinicalMarkdown content={markdown} />

      {searchQueries.length > 0 && (
        <div className="pt-4 border-t border-[#B7DB74]/12">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#85AF9B] mb-1.5">
            <Search className="w-3.5 h-3.5 text-[#B7DB74]" />
            <span>Consultas realizadas nas bases científicas</span>
          </div>
          <p className="text-xs font-mono text-[#85AF9B]">
            {searchQueries.join(' · ')}
          </p>
        </div>
      )}

      {sources.length > 0 && (
        <div className="pt-4 border-t border-[#B7DB74]/16 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F4FBF6]">
              <Globe className="w-3.5 h-3.5 text-[#C7E88B]" />
              <span>Fontes científicas consultadas ({sources.length})</span>
            </div>
            {generatedAt && (
              <span className="text-[11px] font-mono tabular-nums text-[#85AF9B]">
                Atualizado às{' '}
                {new Date(generatedAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {sources.map((src, index) => (
              <a
                key={`${src.uri}-${index}`}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-3 p-3.5 bg-[#0A2622] border border-[#B7DB74]/18 rounded-xl hover:border-[#DDF3B2]/55 hover:bg-[#144239] transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#F4FBF6] group-hover:text-[#DDF3B2] line-clamp-2">
                    {src.title}
                  </div>
                  <div className="text-[11px] font-mono text-[#85AF9B] mt-0.5 truncate">
                    {src.domain}
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[#85AF9B] group-hover:text-[#DDF3B2] shrink-0 mt-0.5" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
