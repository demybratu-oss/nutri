import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY não configurada no servidor. Verifique o painel Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface GroundingSource {
  title: string;
  uri: string;
  domain: string;
}

function extractGroundingMetadata(response: {
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: { uri?: string; title?: string };
      }>;
      webSearchQueries?: string[];
    };
  }>;
}): { sources: GroundingSource[]; searchQueries: string[] } {
  const meta = response.candidates?.[0]?.groundingMetadata;
  const chunks = meta?.groundingChunks || [];
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];

  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    let domain = '';
    try {
      domain = new URL(uri).hostname.replace(/^www\./, '');
    } catch {
      domain = uri;
    }
    sources.push({
      title: chunk.web?.title || domain || 'Fonte científica',
      uri,
      domain,
    });
  }

  const searchQueries = (meta?.webSearchQueries || []).filter(
    (q): q is string => typeof q === 'string' && q.trim().length > 0
  );

  return { sources, searchQueries };
}

function formatApiError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('GEMINI_API_KEY')) {
    return { status: 500, message: raw };
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message:
        'Chave da API Gemini inválida ou sem permissão. Verifique em Settings > Secrets.',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'Limite de requisições da API Gemini atingido temporariamente. Aguarde alguns instantes e tente novamente.',
    };
  }
  return {
    status: 500,
    message: raw || 'Erro ao consultar a inteligência artificial clínica.',
  };
}

const LIBRARY_FOCUS_INSTRUCTIONS: Record<string, string> = {
  all: 'Priorize artigos revisados por pares e diretrizes recentes de PubMed/NCBI, Cochrane Library, ESPEN, ISSN, ADA, SBD (Sociedade Brasileira de Diabetes), ABESO, OMS/WHO, SciELO e Tabela Brasileira de Composição de Alimentos (TACO/TBCA).',
  pubmed_cochrane:
    'Priorize exclusivamente revisões sistemáticas, meta-análises e ensaios clínicos randomizados indexados na PubMed (pubmed.ncbi.nlm.nih.gov), PMC e Cochrane Library (cochranelibrary.com).',
  guidelines:
    'Priorize diretrizes clínicas atualizadas da ESPEN, ASPEN, Sociedade Brasileira de Diabetes (SBD), ABESO, American Diabetes Association (ADA) e Organização Mundial da Saúde (OMS/WHO).',
  sports:
    'Priorize posicionamentos oficiais e revisões da International Society of Sports Nutrition (ISSN), ACSM, IOC Consensus Statements e PubMed em nutrição esportiva.',
  brazil:
    'Priorize publicações brasileiras em SciELO, diretrizes da SBD, ABESO, Guia Alimentar para a População Brasileira (Ministério da Saúde) e composição nutricional da Tabela TACO/TBCA.',
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // 1. Active Scientific Research Endpoint (Google Search Grounding)
  app.post('/api/nutrition-ai/research', async (req, res) => {
    try {
      const { query, libraryFocus = 'all', patientContext } = req.body || {};
      if (!query || typeof query !== 'string' || query.trim().length < 3) {
        res.status(400).json({ error: 'Informe uma pergunta clínica para pesquisa.' });
        return;
      }

      const ai = getAiClient();
      const focusInstruction =
        LIBRARY_FOCUS_INSTRUCTIONS[libraryFocus] || LIBRARY_FOCUS_INSTRUCTIONS.all;

      const patientBlock = patientContext
        ? `\n\nContexto clínico do paciente em atendimento (use para personalizar a aplicação prática, sem expor dados sensíveis):\n- Objetivo: ${patientContext.goalLabel}\n- Sexo/Idade: ${patientContext.sex}, ${patientContext.age} anos\n- Antropometria: ${patientContext.weightKg} kg, ${patientContext.heightCm} cm (IMC ${patientContext.bmi})\n- Nível de atividade: ${patientContext.activityLabel}\n- Restrições alimentares: ${patientContext.restrictions?.join(', ') || 'Nenhuma'}\n- Metas atuais: ${patientContext.targetCalories} kcal (P: ${patientContext.targetProteinG}g, C: ${patientContext.targetCarbsG}g, G: ${patientContext.targetFatG}g)\n- Anamnese: ${patientContext.clinicalNotes || 'Não informada'}`
        : '';

      const systemInstruction = `Você é um assistente científico de nutrição clínica baseada em evidências atuando para uma nutricionista profissional no Brasil.
Sempre utilize a busca na web para localizar as publicações, diretrizes, meta-análises e consensos mais atuais disponíveis.
${focusInstruction}

Regras obrigatórias de resposta (em Português do Brasil):
- Estruture a resposta de forma clara e escaneável usando exatamente estas seções em Markdown:
  ### Síntese das Evidências Atuais
  ### Conduta Prática e Parâmetros Quantitativos
  ### Pontos de Atenção e Contraindicações
- Cite explicitamente anos, instituições (ex.: ESPEN 2024, ISSN, SBD, Cochrane, PubMed) e faixas quantitativas (ex.: g/kg/dia, g de fibras, horários, suplementação) encontrados nas fontes.
- Se houver contexto de paciente fornecido, adapte a seção de Conduta Prática diretamente ao caso clínico.
- Seja objetivo, técnico, rigoroso e nunca invente estudos ou DOI inexistentes.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Pesquise na literatura científica de nutrição mais atual e responda à seguinte questão clínica:\n\n"${query.trim()}"${patientBlock}`,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
        },
      });

      const { sources, searchQueries } = extractGroundingMetadata(response);
      res.json({
        answer: response.text || 'Não foi possível sintetizar a resposta científica.',
        sources,
        searchQueries,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2. Active Meal Plan Scientific Audit Endpoint (Google Search Grounding)
  app.post('/api/nutrition-ai/analyze-plan', async (req, res) => {
    try {
      const { patient, plan, totals } = req.body || {};
      if (!patient || !plan) {
        res.status(400).json({ error: 'Dados do paciente e do plano são obrigatórios.' });
        return;
      }

      const ai = getAiClient();

      const mealsSummary = (plan.meals || [])
        .map(
          (m: { time: string; name: string; items: Array<{ name: string; portion: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }> }) =>
            `${m.time} - ${m.name}: ${
              m.items.length > 0
                ? m.items
                    .map(
                      (i) =>
                        `${i.name} (${i.portion} | ${i.calories}kcal, P:${i.proteinG}g, C:${i.carbsG}g, G:${i.fatG}g, F:${i.fiberG}g)`
                    )
                    .join('; ')
                : 'Sem itens'
            }`
        )
        .join('\n');

      const prompt = `Audite este plano alimentar personalizado buscando nas bibliotecas científicas mais atuais (PubMed, Cochrane, ESPEN, ISSN, SBD, ABESO, OMS) se a prescrição está alinhada às recomendações vigentes para o perfil deste paciente.

PERFIL DO PACIENTE:
- Sexo/Idade: ${patient.sex}, ${patient.age} anos
- Peso/Altura/IMC: ${patient.weightKg} kg, ${patient.heightCm} cm (IMC ${patient.bmi})
- Atividade: ${patient.activityLabel}
- Objetivo: ${patient.goalLabel}
- Restrições: ${patient.restrictions?.join(', ') || 'Nenhuma'}
- Anamnese: ${patient.clinicalNotes || 'Sem observações adicionais'}

METAS DO PLANO ("${plan.title}"):
- Meta: ${plan.targetCalories} kcal | Proteína ${plan.targetProteinG}g (${(plan.targetProteinG / Math.max(1, patient.weightKg)).toFixed(2)} g/kg) | Carboidrato ${plan.targetCarbsG}g | Gordura ${plan.targetFatG}g | Água ${plan.waterTargetLiters} L
- Planejado atualmente: ${totals?.calories ?? 0} kcal | Proteína ${totals?.proteinG ?? 0}g | Carboidrato ${totals?.carbsG ?? 0}g | Gordura ${totals?.fatG ?? 0}g | Fibras ${totals?.fiberG ?? 0}g

REFEIÇÕES PRESCRITAS:
${mealsSummary}

ORIENTAÇÕES ATUAIS:
${plan.generalGuidance || 'Nenhuma orientação registrada.'}

Entregue em Português do Brasil um parecer clínico objetivo estruturado exatamente em:
### Avaliação frente às Diretrizes Atuais
(Compare proteína g/kg, fibras, distribuição nas refeições, compatibilidade com restrições e objetivo.)
### Ajustes Prioritários Recomendados
(3 a 5 ajustes concretos e práticos com quantidades exatas.)
### Sugestão de Nota Clínica para o Paciente
(Um parágrafo curto pronto para anexar às orientações gerais do plano.)`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'Você é um consultor científico de nutrição clínica baseada em evidências. Use a busca na web para verificar as diretrizes mais recentes (PubMed, Cochrane, ESPEN, ISSN, SBD, ABESO) antes de emitir o parecer. Seja rigoroso, claro e prático.',
          tools: [{ googleSearch: {} }],
        },
      });

      const { sources, searchQueries } = extractGroundingMetadata(response);
      res.json({
        analysis: response.text || '',
        sources,
        searchQueries,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. Evidence-Based Personalized Meal Plan Generator (2-step: Search Grounding -> Structured JSON)
  app.post('/api/nutrition-ai/generate-plan', async (req, res) => {
    try {
      const { patient, availableRecipes = [], customInstruction = '' } = req.body || {};
      if (!patient) {
        res.status(400).json({ error: 'Dados do paciente são obrigatórios.' });
        return;
      }

      const ai = getAiClient();

      // Step 1: Retrieve current clinical evidence via Google Search Grounding
      const evidenceRes = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Pesquise nas diretrizes e bibliotecas científicas mais atuais (PubMed, Cochrane, ESPEN, ISSN, SBD, ABESO, Guia Alimentar Brasileiro) as melhores recomendações de distribuição de macronutrientes, fibras, fracionamento de proteínas, escolha de alimentos e horários de refeições para o seguinte perfil clínico:
- Objetivo: ${patient.goalLabel}
- Sexo/Idade: ${patient.sex}, ${patient.age} anos
- Peso: ${patient.weightKg} kg, Altura: ${patient.heightCm} cm (IMC ${patient.bmi})
- Atividade física: ${patient.activityLabel}
- Restrições: ${patient.restrictions?.join(', ') || 'Nenhuma'}
- Anamnese: ${patient.clinicalNotes || 'Não informada'}
${customInstruction ? `- Diretriz adicional da nutricionista: ${customInstruction}` : ''}

Retorne um resumo conciso em tópicos com parâmetros práticos baseados em evidências recentes.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const evidenceSummary = evidenceRes.text || '';
      const { sources, searchQueries } = extractGroundingMetadata(evidenceRes);

      const recipesCatalogText =
        availableRecipes.length > 0
          ? availableRecipes
              .map(
                (r: { id: string; title: string; category: string; portionLabel: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; dietaryTags: string[] }) =>
                  `- ID: "${r.id}" | Título: "${r.title}" | Cat: ${r.category} | Porção: ${r.portionLabel} | ${r.calories}kcal (P:${r.proteinG}g, C:${r.carbsG}g, G:${r.fatG}g, F:${r.fiberG}g) | Perfil: ${(r.dietaryTags || []).join(', ')}`
              )
              .join('\n')
          : 'Nenhuma receita cadastrada na biblioteca ainda.';

      // Step 2: Synthesize structured MealPlan JSON grounded on Step 1 evidence + patient targets
      const planRes = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Com base EXCLUSIVAMENTE nas evidências científicas atualizadas abaixo e no perfil do paciente, monte um plano alimentar completo e realista com alimentos brasileiros acessíveis.

EVIDÊNCIAS CIENTÍFICAS RECUPERADAS:
${evidenceSummary}

PERFIL E METAS DO PACIENTE:
- Nome: ${patient.fullName}
- Objetivo: ${patient.goalLabel}
- Restrições OBRIGATÓRIAS (respeite rigorosamente 100%): ${patient.restrictions?.join(', ') || 'Nenhuma'}
- Anamnese: ${patient.clinicalNotes || 'Sem observações'}
- Meta Energia: ${patient.targetCalories} kcal (a soma das refeições deve ficar entre 94% e 104% desta meta)
- Meta Proteína: ${patient.targetProteinG} g
- Meta Carboidrato: ${patient.targetCarbsG} g
- Meta Gordura: ${patient.targetFatG} g
- Meta Água: ${patient.waterTargetLiters} L/dia
${customInstruction ? `- Solicitação extra da nutricionista: ${customInstruction}` : ''}

RECEITAS DISPONÍVEIS NA BIBLIOTECA DA NUTRICIONISTA (reutilize as que forem compatíveis com as restrições do paciente informando o recipeId exato; se não compatível, crie itens alimentares coerentes com recipeId vazio ""):
${recipesCatalogText}

Crie 4 a 5 refeições bem distribuídas ao longo do dia com horários (HH:MM), medidas caseiras precisas, macronutrientes coerentes (calorias ≈ 4*P + 4*C + 9*G), substituições equivalentes e orientações gerais fundamentadas nas evidências.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              objectiveSummary: { type: Type.STRING },
              generalGuidance: { type: Type.STRING },
              scientificRationale: {
                type: Type.STRING,
                description:
                  'Resumo curto em português explicando quais diretrizes/evidências científicas embasaram este plano.',
              },
              meals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING },
                    name: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          recipeId: { type: Type.STRING },
                          name: { type: Type.STRING },
                          portion: { type: Type.STRING },
                          calories: { type: Type.NUMBER },
                          proteinG: { type: Type.NUMBER },
                          carbsG: { type: Type.NUMBER },
                          fatG: { type: Type.NUMBER },
                          fiberG: { type: Type.NUMBER },
                          substitution: { type: Type.STRING },
                        },
                        required: [
                          'name',
                          'portion',
                          'calories',
                          'proteinG',
                          'carbsG',
                          'fatG',
                          'fiberG',
                          'substitution',
                        ],
                      },
                    },
                  },
                  required: ['time', 'name', 'notes', 'items'],
                },
              },
            },
            required: [
              'title',
              'objectiveSummary',
              'generalGuidance',
              'scientificRationale',
              'meals',
            ],
          },
        },
      });

      const parsed = JSON.parse((planRes.text || '{}').trim());
      res.json({
        plan: parsed,
        sources,
        searchQueries,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4. Evidence-Based Clinical Recipe Generator (Search Grounding -> Structured Recipe JSON)
  app.post('/api/nutrition-ai/generate-recipe', async (req, res) => {
    try {
      const {
        goalPrompt,
        category = 'almoco',
        restrictions = '',
        targetCalories = 400,
      } = req.body || {};

      if (!goalPrompt || typeof goalPrompt !== 'string' || goalPrompt.trim().length < 3) {
        res.status(400).json({ error: 'Descreva o foco clínico ou ingredientes desejados.' });
        return;
      }

      const ai = getAiClient();

      // Step 1: Search current nutrition science for functional ingredients and clinical synergy
      const evidenceRes = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Busque na literatura científica recente de nutrição (PubMed, Cochrane, SBD, ABESO, Tabela TACO/TBCA) recomendações de ingredientes funcionais, combinações nutricionais e biodisponibilidade para criar uma receita clínica com este foco:
- Foco clínico: ${goalPrompt.trim()}
- Refeição: ${category}
- Restrições obrigatórias: ${restrictions || 'Nenhuma'}
- Alvo calórico aproximado por porção: ${targetCalories} kcal

Retorne em poucos tópicos os compostos bioativos, proporção ideal de macronutrientes e justificativa científica.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const evidenceSummary = evidenceRes.text || '';
      const { sources, searchQueries } = extractGroundingMetadata(evidenceRes);

      // Step 2: Structured clinical recipe JSON
      const recipeRes = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Crie uma receita culinária brasileira saborosa, prática e clinicamente precisa com base nas evidências científicas abaixo.

EVIDÊNCIAS CIENTÍFICAS RECUPERADAS:
${evidenceSummary}

PARÂMETROS:
- Foco solicitado: ${goalPrompt.trim()}
- Categoria (use exatamente uma destas chaves): cafe_da_manha | almoco | jantar | lanche | ceia | sobremesa_fit (preferência: ${category})
- Restrições obrigatórias: ${restrictions || 'Nenhuma'}
- Calorias alvo por porção: cerca de ${targetCalories} kcal

Garanta coerência matemática dos macronutrientes (kcal ≈ 4*P + 4*C + 9*G) e escreva em Português do Brasil.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              description: { type: Type.STRING },
              prepTimeMin: { type: Type.INTEGER },
              servings: { type: Type.INTEGER },
              portionLabel: { type: Type.STRING },
              calories: { type: Type.NUMBER },
              proteinG: { type: Type.NUMBER },
              carbsG: { type: Type.NUMBER },
              fatG: { type: Type.NUMBER },
              fiberG: { type: Type.NUMBER },
              dietaryTags: { type: Type.ARRAY, items: { type: Type.STRING } },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
              instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
              clinicalTip: { type: Type.STRING },
              scientificRationale: { type: Type.STRING },
            },
            required: [
              'title',
              'category',
              'description',
              'prepTimeMin',
              'servings',
              'portionLabel',
              'calories',
              'proteinG',
              'carbsG',
              'fatG',
              'fiberG',
              'dietaryTags',
              'ingredients',
              'instructions',
              'clinicalTip',
              'scientificRationale',
            ],
          },
        },
      });

      const parsed = JSON.parse((recipeRes.text || '{}').trim());
      res.json({
        recipe: parsed,
        sources,
        searchQueries,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 5. Active AI Consultation Endpoint — Persona: Nutricionista Dimitra Bratu
  const CONSULTATION_MODE_INSTRUCTIONS: Record<string, string> = {
    consulta:
      'Modo atual: CONSULTA CLÍNICA & TIRA-DÚVIDAS. Acolha o paciente com empatia e postura de especialista. Explique a fisiologia e nutrição de forma clara e acessível, dê recomendações práticas com medidas caseiras brasileiras e fundamente orientações técnicas em evidências científicas atuais.',
    anamnese:
      'Modo atual: ANAMNESE NUTRICIONAL GUIADA. Conduza uma entrevista clínica acolhedora e estruturada como em uma primeira consulta no consultório da Dra. Dimitra Bratu. Em cada turno, valide o que o paciente compartilhou e faça apenas 2 a 3 perguntas objetivas por vez (cobrindo rotina de horários, alimentação atual, sono, funcionamento intestinal, hidratação, treinos, restrições/exames e objetivos). Quando já tiver dados suficientes (após 3–4 trocas), entregue uma síntese clínica personalizada com prioridades práticas.',
    plano_substituicoes:
      'Modo atual: PLANO ALIMENTAR & SUBSTITUIÇÕES EQUIVALENTES. Ajude com trocas inteligentes de alimentos mantendo equivalência calórica e de macronutrientes, sugestões para comer fora, fome noturna, pré/pós-treino e adaptação à rotina. Sempre que houver plano ativo ou receitas cadastradas no contexto, utilize-os explicitamente.',
    suplementacao:
      'Modo atual: SUPLEMENTAÇÃO BASEADA EM EVIDÊNCIAS. Esclareça dúvidas sobre suplementos (creatina, whey/proteínas vegetais, ômega-3, magnésio, vitamina D, ferro, probióticos, cafeína, eletrólitos) consultando posicionamentos atuais da ISSN, ESPEN, SBD e PubMed. Informe grau de evidência, faixa usual de dosagem, melhor horário de uso e contraindicações/cuidados.',
  };

  app.post('/api/nutrition-ai/dimitra-chat', async (req, res) => {
    try {
      const {
        messages = [],
        mode = 'consulta',
        patientContext,
        activePlan,
        availableRecipes = [],
        guestProfile,
      } = req.body || {};

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Envie uma mensagem para iniciar o atendimento.' });
        return;
      }

      const sanitizedHistory = messages
        .filter(
          (m: unknown): m is { role: 'user' | 'assistant'; content: string } =>
            Boolean(
              m &&
                typeof m === 'object' &&
                ('role' in m) &&
                ('content' in m) &&
                typeof (m as { content: unknown }).content === 'string' &&
                (m as { content: string }).content.trim().length > 0
            )
        )
        .slice(-20);

      if (sanitizedHistory.length === 0) {
        res.status(400).json({ error: 'Mensagem inválida.' });
        return;
      }

      const ai = getAiClient();
      const modeInstruction =
        CONSULTATION_MODE_INSTRUCTIONS[mode] || CONSULTATION_MODE_INSTRUCTIONS.consulta;

      let contextBlock = '';

      if (patientContext) {
        contextBlock += `\n\nPRONTUÁRIO DO PACIENTE EM ATENDIMENTO (personalize toda a consulta com base nestes dados reais):
- Nome: ${patientContext.fullName}
- Sexo/Idade: ${patientContext.sex}, ${patientContext.age} anos
- Antropometria: ${patientContext.weightKg} kg, ${patientContext.heightCm} cm (IMC ${patientContext.bmi})
- Nível de atividade física: ${patientContext.activityLabel}
- Objetivo principal: ${patientContext.goalLabel}
- Restrições e alergias (RESPEITE RIGOROSAMENTE 100%): ${patientContext.restrictions?.join(', ') || 'Nenhuma informada'}
- Metas diárias: ${patientContext.targetCalories} kcal | Proteína ${patientContext.targetProteinG}g | Carboidrato ${patientContext.targetCarbsG}g | Gordura ${patientContext.targetFatG}g | Água ${patientContext.waterTargetLiters} L/dia
- Anamnese registrada: ${patientContext.clinicalNotes || 'Sem observações adicionais'}`;
      } else if (guestProfile && (guestProfile.name || guestProfile.goal || guestProfile.restrictions)) {
        contextBlock += `\n\nPERFIL INFORMADO PELO PACIENTE NO ATENDIMENTO ONLINE:
- Nome: ${guestProfile.name || 'Não informado'}
- Objetivo principal: ${guestProfile.goal || 'Não informado'}
- Restrições/preferências: ${guestProfile.restrictions || 'Nenhuma informada'}`;
      }

      if (activePlan && Array.isArray(activePlan.meals) && activePlan.meals.length > 0) {
        const mealsSummary = activePlan.meals
          .map(
            (m: { time: string; name: string; items: Array<{ name: string; portion: string; calories: number; proteinG: number; carbsG: number; fatG: number }> }) =>
              `  • ${m.time} (${m.name}): ${
                m.items
                  .map(
                    (i) =>
                      `${i.name} — ${i.portion} (${i.calories}kcal, P:${i.proteinG}g, C:${i.carbsG}g, G:${i.fatG}g)`
                  )
                  .join('; ') || 'Sem itens'
              }`
          )
          .join('\n');
        contextBlock += `\n\nPLANO ALIMENTAR ATIVO PRESCRITO POR VOCÊ ("${activePlan.title}"):
- Estratégia: ${activePlan.objectiveSummary || 'Personalizada'}
- Orientações gerais: ${activePlan.generalGuidance || 'Sem observações'}
- Refeições:\n${mealsSummary}`;
      }

      if (Array.isArray(availableRecipes) && availableRecipes.length > 0) {
        const recipeSummary = availableRecipes
          .slice(0, 12)
          .map(
            (r: { title: string; portionLabel: string; calories: number; proteinG: number; carbsG: number; fatG: number; dietaryTags?: string[] }) =>
              `  • ${r.title} (${r.portionLabel} | ${r.calories}kcal, P:${r.proteinG}g, C:${r.carbsG}g, G:${r.fatG}g${
                r.dietaryTags?.length ? ` | ${r.dietaryTags.join(', ')}` : ''
              })`
          )
          .join('\n');
        contextBlock += `\n\nRECEITAS ASSINADAS DO SEU CONSULTÓRIO (indique quando fizer sentido para o paciente):\n${recipeSummary}`;
      }

      const systemInstruction = `Você é a **Nutricionista Dimitra Bratu**, especialista em Nutrição Clínica, Comportamental e Esportiva Baseada em Evidências, atendendo pacientes em Português do Brasil.

IDENTIDADE E TOM DE VOZ:
- Fale sempre em primeira pessoa como a própria Nutricionista Dimitra Bratu ("Na minha prática clínica...", "Vamos ajustar juntos...", "Eu recomendo...").
- Seja calorosa, acolhedora, elegante, didática, objetiva e profundamente técnica quando necessário — sem julgamentos e sem terrorismo nutricional.
- Use busca na web ativa (PubMed, Cochrane, ESPEN, ISSN, SBD, ABESO, OMS, SciELO, Tabela TACO/TBCA, Guia Alimentar para a População Brasileira) para fundamentar suas orientações com a ciência mais atual.
- Utilize medidas caseiras brasileiras acessíveis (colher de sopa, xícara, filé médio, gramas) e estruture respostas mais densas com subtítulos curtos (###) e listas objetivas para leitura confortável.
- Ética e segurança clínica: você não diagnostica doenças médicas nem altera prescrições de medicamentos. Se o paciente relatar sinais de alerta (dor aguda, desmaios, distúrbios graves, gestação de risco, ajustes de insulina ou medicação controlada), oriente com empatia a avaliação presencial conjunta com o médico e o acompanhamento individualizado.

${modeInstruction}${contextBlock}

FORMATO FINAL OBRIGATÓRIO:
Ao final da sua resposta, adicione exatamente o marcador abaixo seguido de 3 sugestões curtas de próximas perguntas ou respostas rápidas que o paciente poderia clicar para continuar o atendimento (cada uma em uma linha começando com "- ", máximo 75 caracteres cada):
---SUGESTOES---
- Sugestão 1
- Sugestão 2
- Sugestão 3`;

      const contents = sanitizedHistory.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content.trim().slice(0, 4000) }],
      }));

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
        },
      });

      const rawText = (response.text || '').trim();
      let reply = rawText;
      let suggestedFollowUps: string[] = [];

      const marker = '---SUGESTOES---';
      const markerIdx = rawText.indexOf(marker);
      if (markerIdx !== -1) {
        reply = rawText.slice(0, markerIdx).trim();
        const followUpBlock = rawText.slice(markerIdx + marker.length).trim();
        suggestedFollowUps = followUpBlock
          .split('\n')
          .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
          .filter((line) => line.length >= 4 && line.length <= 100)
          .slice(0, 3);
      }

      if (!reply) {
        reply =
          'Olá! Sou a Nutricionista Dimitra Bratu. Tive uma instabilidade momentânea ao formular sua orientação — pode repetir sua dúvida para que eu te ajude agora mesmo?';
      }

      const { sources, searchQueries } = extractGroundingMetadata(response);
      res.json({
        reply,
        sources,
        searchQueries,
        suggestedFollowUps,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 6. Evidence-Based Compounding Vitamins Generator (Farmácia de Manipulação)
  app.post('/api/nutrition-ai/generate-compounding', async (req, res) => {
    try {
      const {
        specialtyLabel,
        patientName,
        patientContext,
        clinicalCaseNotes = '',
        allergies = '',
        availableRecipes = [],
      } = req.body || {};

      if (!specialtyLabel || typeof specialtyLabel !== 'string') {
        res.status(400).json({ error: 'Selecione uma especialidade clínica.' });
        return;
      }

      const ai = getAiClient();

      const patientBlock = patientContext
        ? `Perfil do paciente: ${patientContext.sex}, ${patientContext.age} anos, ${patientContext.weightKg}kg, ${patientContext.heightCm}cm (IMC ${patientContext.bmi}), atividade ${patientContext.activityLabel}, objetivo ${patientContext.goalLabel}, restrições: ${patientContext.restrictions?.join(', ') || 'nenhuma'}, anamnese: ${patientContext.clinicalNotes || 'não informada'}.`
        : `Paciente: ${patientName || 'Assinante'}.`;

      // Step 1: Live search on nutrition science & Brazilian nutritionist supplementation limits (CFN 656/2020 & ANVISA IN 28)
      const evidenceRes = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Atuando em apoio científico à Nutricionista Dimitra Bratu no Brasil, pesquise em PubMed, Cochrane, ESPEN, ISSN, SBD e limites seguros de suplementação nutricional no Brasil (ANVISA IN 28 / CFN Resolução 656/2020) os melhores micronutrientes (vitaminas, minerais quelados, aminoácidos e bioativos permitidos a nutricionistas) e formas de maior biodisponibilidade para uma formulação magistral de farmácia de manipulação:

- Especialidade clínica escolhida: ${specialtyLabel}
- ${patientBlock}
- Notas da videochamada / queixa principal: ${clinicalCaseNotes || 'Otimização nutricional e saúde preventiva'}
- Alergias e restrições obrigatórias: ${allergies || 'Nenhuma informada'}

Retorne em tópicos objetivos os ativos mais recomendados, suas faixas de dose seguras dentro da atuação do nutricionista, sinergias de absorção e precauções clínicas.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const evidenceSummary = evidenceRes.text || '';
      const { sources, searchQueries } = extractGroundingMetadata(evidenceRes);

      const recipesListText =
        Array.isArray(availableRecipes) && availableRecipes.length > 0
          ? availableRecipes
              .slice(0, 10)
              .map((r: { title: string; portionLabel: string }) => `- ${r.title} (${r.portionLabel})`)
              .join('\n')
          : 'Sem receitas cadastradas ainda.';

      // Step 2: Structured compounding formula JSON ready for Farmácia de Manipulação
      const formulaRes = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Com base nas evidências científicas atualizadas abaixo, monte uma prescrição magistral individualizada de **vitaminas e minerais manipulados** assinada pela Nutricionista Dimitra Bratu para ser aviada em **Farmácia de Manipulação** no Brasil.

EVIDÊNCIAS RECUPERADAS:
${evidenceSummary}

CASO CLÍNICO:
- Paciente: ${patientName || 'Paciente Assinante'}
- Especialidade: ${specialtyLabel}
- ${patientBlock}
- Relato da videochamada / sintomas: ${clinicalCaseNotes || 'Tratamento nutricional individualizado'}
- Alergias/restrições (exclua rigorosamente dos ativos e excipientes): ${allergies || 'Nenhuma'}

RECEITAS DA BIBLIOTECA DA DRA. DIMITRA (priorize citar receitas compatíveis para potencializar o tratamento nutricional):
${recipesListText}

REGRAS OBRIGATÓRIAS:
1. Inclua apenas vitaminas, minerais quelados, aminoácidos ou compostos bioativos permitidos para prescrição nutricional no Brasil (sem medicamentos controlados ou hormônios).
2. Inclua entre 4 e 7 ativos sinérgicos em doses seguras, realistas e biodisponíveis (ex.: Magnésio Bisglicinato 200 mg, Vitamina D3 2000 UI, Zinco Quelado 15 mg, Metilcobalamina 500 mcg).
3. Informe forma farmacêutica clara (ex.: "Cápsulas vegetais gastro-resistentes" ou "Sachê solúvel sabor neutro"), número de doses (ex.: 60), duração em dias (ex.: 60), posologia exata com horário ideal, observações técnicas de excipiente para o farmacêutico manipulador e 2 a 3 receitas terapêuticas recomendadas para acompanhar o tratamento.
4. Escreva 100% em Português do Brasil.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              formulaTitle: { type: Type.STRING },
              pharmaceuticalForm: { type: Type.STRING },
              totalDoses: { type: Type.INTEGER },
              durationDays: { type: Type.INTEGER },
              posology: { type: Type.STRING },
              pharmacyNotes: { type: Type.STRING },
              clinicalRationale: { type: Type.STRING },
              precautions: { type: Type.STRING },
              actives: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    dosage: { type: Type.STRING },
                    unit: { type: Type.STRING },
                    purpose: { type: Type.STRING },
                  },
                  required: ['name', 'dosage', 'unit', 'purpose'],
                },
              },
              recommendedRecipes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'formulaTitle',
              'pharmaceuticalForm',
              'totalDoses',
              'durationDays',
              'posology',
              'pharmacyNotes',
              'clinicalRationale',
              'precautions',
              'actives',
              'recommendedRecipes',
            ],
          },
        },
      });

      const parsed = JSON.parse((formulaRes.text || '{}').trim());
      res.json({
        formula: parsed,
        sources,
        searchQueries,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Mount Vite middleware in dev or serve built dist/ in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Verbena Nutrição server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
