
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { applySourceGuard } from './topicSource';
import { gatherSources, sourcesPromptBlock } from './lessonSources';
import { buildVerifiedQuestions } from './questionQuality';
import { StudyProfile, EditalConfig, StudySubject, DaySchedule, QuizQuestion, ExplanationStyle, IllustratedLesson } from "../types";
import { auth } from "../src/lib/firebase";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || ''
});

const DEFAULT_MODEL = 'gemini-3.8-flash'; // GA flash model: best balance of quality/cost for rich content generation
const LITE_MODEL = 'gemini-3.5-flash-lite'; // Cheapest/fastest: trivial, low-latency calls (counting, short greetings)
const PRO_MODEL = 'gemini-3.1-pro-preview'; // Highest precision for extraction tasks

// Custom error class for API issues
export class AIError extends Error {
  constructor(public message: string, public status?: number, public code?: string) {
    super(message);
    this.name = 'AIError';
  }
}

const handleAIError = (error: any) => {
  console.error("AI Error raw:", error);
  
  // Extract error info from different formats the SDK might throw
  const errorObj = error?.error || error;
  const errorMessage = errorObj?.message || error?.message || String(error);
  const errorStatus = errorObj?.code || errorObj?.status || error?.status || 0;

  if (String(errorMessage).startsWith('FreeLLMAPI:')) {
    throw new AIError(String(errorMessage), errorStatus || undefined, 'FREELLMAPI_ERROR');
  }
  
  if (errorStatus === 429 || String(errorStatus) === '429' || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
    throw new AIError("Limite de Cota do Google Gemini atingido. O Google limita o uso gratuito. Aguarde 1 a 2 minutos e tente novamente.", 429, 'RESOURCE_EXHAUSTED');
  }

  if (errorStatus === 503 || String(errorStatus) === '503' || errorMessage.includes('503') || errorMessage.includes('high demand') || errorMessage.includes('UNAVAILABLE')) {
    throw new AIError("O servidor da IA está com alta demanda (Erro 503). O aplicativo tentou processar automaticamente, mas o tráfego do Google continua intenso. Por favor, aguarde alguns segundos e tente novamente.", 503, 'UNAVAILABLE');
  }
  
  if (errorMessage.toLowerCase().includes('api key') || errorMessage.includes('key')) {
    throw new AIError("Chave de API do Gemini inválida ou ausente. Verifique suas configurações de ambiente.", 401, 'INVALID_API_KEY');
  }

  throw new AIError(errorMessage || "Erro inesperado ao chamar a API do Gemini. Verifique sua conexão.");
};

// Heuristic for "this string field was cut off mid-sentence" — catches a
// dangling comma/no-terminator ending and an unmatched quote (e.g. a model
// that starts "Exemplos: '" and never gets to close it). Not perfect, but
// cheap and catches the truncation shapes actually seen from free models.
const looksTruncated = (s: string): boolean => {
  const t = (s || '').trim();
  if (t.length < 60) return true;
  if (!/[.!?…”’"')]$/.test(t)) return true;
  const singleQuotes = (t.match(/'/g) || []).length;
  const doubleQuotes = (t.match(/"/g) || []).length;
  if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) return true;
  return false;
};

const safeAIJsonParse = (text: string) => {
  if (!text) throw new AIError("A IA retornou uma resposta vazia.");
  
  try {
    // Attempt standard parse
    return JSON.parse(text);
  } catch (e) {
    console.warn("Standard JSON parse failed, trying extraction:", e);
    
    // If it fails, try to extract from code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (e2) {
        console.error("JSON parse failed even after extraction:", e2);
      }
    }
    
    // Last ditch: remove any non-json leading/trailing chars
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    
    let start = -1;
    let end = -1;
    
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = lastBrace;
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = lastBracket;
    }

    if (start !== -1 && end !== -1 && end > start) {
      const cleaned = text.substring(start, end + 1);
      try {
        return JSON.parse(cleaned);
      } catch (e3) {
         console.error("Deep cleanup JSON parse failed:", e3);
      }
    }
    
    throw new AIError("A IA não retornou um formato de dados válido (JSON corrompido). Tente gerar novamente.");
  }
};

// Keep Gemini retries short so network, provider, or malformed-response
// failures advance quickly to the next AI provider.
const generateContentWithRetry = async (params: any, maxRetries = 2) => {
  // Providers ranked ahead of Gemini are tried in order; if all of them fail
  // the Gemini loop below runs and the callers' fallbacks cover what remains.
  let lastProviderError: unknown;
  for (const providerId of getProviderOrder()) {
    if (providerId === 'gemini') break;
    if (!isProviderConfigured(providerId)) continue;
    try {
      if (providerId === 'groq') return await generateGroqContent(params);
      if (providerId === 'openrouter') return await generateOpenRouterContent(params);
      return await generateFreeLLMAPIContent(params);
    } catch (error) {
      lastProviderError = error;
      console.warn(`[ai] ${providerId} indisponível; tentando o próximo provedor:`, error);
    }
  }

  // Gemini is optional: without its key there is nothing to retry, so report the last provider error right away.
  if (!process.env.GEMINI_API_KEY) {
    throw lastProviderError ?? new Error('Nenhum provedor de IA está configurado neste app.');
  }

  let delay = 2000;
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;

      const errorObj = error?.error || error;
      const errorMessage = errorObj?.message || error?.message || "";
      const errorStatus = String(errorObj?.code || errorObj?.status || error?.status || "");

      const isTransient =
        errorStatus === "503" ||
        errorStatus === "500" ||
        errorStatus === "429" ||
        errorMessage.includes('503') ||
        errorMessage.includes('500') ||
        errorMessage.includes('429') ||
        errorMessage.includes('high demand') ||
        errorMessage.includes('UNAVAILABLE') ||
        errorMessage.includes('RESOURCE_EXHAUSTED');

      if (isTransient && i < maxRetries - 1) {
        const isQuota = errorStatus === "429" || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
        // Exponential backoff with jitter
        const jitter = Math.random() * 1000;
        const retryDelay = OPENROUTER_ENABLED ? (1500 + jitter) : ((isQuota ? 15000 : delay) + jitter);

        console.warn(`IA ocupada ou limite atingido (Tentativa ${i + 1}/${maxRetries}). Tentando novamente em ${Math.round(retryDelay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        delay *= 2;
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

// --- OpenRouter fallback ---
// Only kicks in when the Gemini key above is rate-limited (429), the Google
// backend is overloaded (503), or the key itself is invalid/missing. Never
// used when Gemini succeeds. Tries free OpenRouter models in order until one
// answers — each model's free tier is its own shared, rate-limited pool
// (confirmed live: at any given moment some of the 6 below are 429/503 while
// others answer fine), so the list is intentionally longer than 1-2 entries.
// thinkingmachines/inkling(-small) and the coding-only models (poolside,
// cohere/north-mini-code) are excluded: the former 403s outside an agentic
// harness, the latter are coding-specialized and add no value here.
// Provider keys are no longer in the browser bundle: Groq and OpenRouter go through /api/ai (server-side).
// These flags only tell the client whether the server has the provider configured.
const OPENROUTER_ENABLED = Boolean(process.env.OPENROUTER_ENABLED);
const OPENROUTER_FALLBACK_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'qwen/qwen3.8-27b:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
];
// A free model's own backend can hang well past a normal request (confirmed
// live: one of these timed out at 30s+ with nothing wrong on our end) — cap
// each attempt so a single stuck model can't stall the whole chain.
const OPENROUTER_PER_MODEL_TIMEOUT_MS = 20000;
// Trying models strictly one-at-a-time means a single stuck model (confirmed
// live: nemotron-3-super hung the full 20s twice in a row) delays every
// model behind it. Racing a few at once — first success wins — fixes that:
// a hung model just loses the race instead of blocking it. Batched rather
// than all 6 at once, to avoid hammering the whole free pool per call.
const OPENROUTER_RACE_BATCH_SIZE = 3;

// Groq runs its own LPU hardware rather than aggregating third-party free
// endpoints like OpenRouter's ":free" pool does, so it doesn't share that
// pool's "all 6 congested at once" failure mode — tried first, ahead of
// OpenRouter, for exactly that reason. gpt-oss-120b is the primary (best
// quality); gpt-oss-20b is the backup (faster, separate daily quota, in case
// the primary's is already spent). Confirmed against this account's actual
// /openai/v1/models listing — Groq's catalog changes over time, so re-check
// that endpoint if either model ever 404s with "does not exist".
const GROQ_ENABLED = Boolean(process.env.GROQ_ENABLED);

// Groq and OpenRouter calls go through our own server (/api/ai) so the provider keys never reach the browser.
// FreeLLMAPI needs a signed-in user; Groq/OpenRouter also work for visitors (the server rate-limits them).
const canUseAIProxy = (): boolean => import.meta.env.DEV || !!auth?.currentUser;

const aiProxyFetch = async (provider: 'groq' | 'openrouter', init: { body: string; signal?: AbortSignal }): Promise<Response> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await auth?.currentUser?.getIdToken().catch(() => null);
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`/api/ai?provider=${provider}`, { method: 'POST', headers, body: init.body, signal: init.signal });
};

const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
const GROQ_TIMEOUT_MS = 20000;
const FREELLMAPI_TIMEOUT_MS = 56000;
// FreeLLMAPI is reached through our own server (/api/freellmapi): the gateway URL and key stay in server
// environment variables. The browser only gets a flag saying whether the server has it configured.
const FREELLMAPI_ENABLED = Boolean(process.env.FREELLMAPI_ENABLED);
// Every failed AI generation should try the next configured provider, including
// network/timeout errors and malformed or incomplete model output.
const shouldTryProviderFallbacks = (error: any): boolean =>
  error?.name !== 'AbortError' && error?.name !== 'CanceledError';

const requestFreeLLMAPI = async (body: Record<string, unknown>): Promise<any> => {
  if (!FREELLMAPI_ENABLED) throw new Error('FreeLLMAPI não foi configurado neste app.');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await auth?.currentUser?.getIdToken().catch(() => null);
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (!import.meta.env.DEV) throw new Error('Entre na sua conta Google para usar o FreeLLMAPI.');
  // The server picks the model, checks that this account is allowed and holds the gateway key.
  const response = await fetch('/api/freellmapi', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FREELLMAPI_TIMEOUT_MS),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : `HTTP ${response.status}`;
    throw new Error(`FreeLLMAPI: ${message}`);
  }
  return { ...data, routedVia: response.headers.get('x-routed-via') || undefined };
};

const readFreeLLMAPIText = (data: any): string => {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map((part) => typeof part?.text === 'string' ? part.text : '').join('').trim();
  return '';
};

const callFreeLLMAPIJson = async (
  systemInstruction: string | undefined,
  userPrompt: string,
  schema: any,
  schemaName: string,
  validate?: (parsed: any) => boolean,
): Promise<any> => {
  const jsonPrompt = `${userPrompt}\n\nFormato de saída obrigatório: retorne somente um objeto JSON válido, sem Markdown ou texto antes/depois. Siga este schema e os nomes de campos exatamente (${schemaName}):\n${JSON.stringify(schema)}`;
  const data = await requestFreeLLMAPI({
    messages: [
      ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
      { role: 'user', content: jsonPrompt },
    ],
    // Groq's OpenAI-compatible JSON Schema mode rejects otherwise valid
    // outputs for this model. JSON object mode keeps the response parseable;
    // the schema is included explicitly in the prompt and validated locally.
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 24000,
  });
  const text = readFreeLLMAPIText(data);
  if (!text) throw new Error('FreeLLMAPI retornou uma resposta vazia.');
  const parsed = safeAIJsonParse(text);
  if (validate && !validate(parsed)) throw new Error('FreeLLMAPI retornou conteúdo incompleto.');
  console.warn(`[fallback] Gemini indisponível; FreeLLMAPI respondeu${data.routedVia ? ` via ${data.routedVia}` : ''}.`);
  return parsed;
};

const callFreeLLMAPIText = async (
  systemInstruction: string | undefined,
  messages: { role: string, content: string }[],
  temperature = 0.6,
): Promise<string> => {
  const data = await requestFreeLLMAPI({
    messages: [...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []), ...messages],
    temperature,
    max_tokens: 8000,
  });
  const text = readFreeLLMAPIText(data);
  if (!text) throw new Error('FreeLLMAPI retornou uma resposta vazia.');
  console.warn(`[fallback] Gemini indisponível; FreeLLMAPI respondeu${data.routedVia ? ` via ${data.routedVia}` : ''}.`);
  return text;
};

// Runs `attempt(model)` for OPENROUTER_FALLBACK_MODELS in batches of
// OPENROUTER_RACE_BATCH_SIZE, racing each batch with Promise.any so the
// first model to succeed wins immediately instead of waiting on a stuck one.
// Only moves to the next batch if every model in the current one fails.
const raceOpenRouterModels = async <T,>(attempt: (model: string) => Promise<T>): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < OPENROUTER_FALLBACK_MODELS.length; i += OPENROUTER_RACE_BATCH_SIZE) {
    const batch = OPENROUTER_FALLBACK_MODELS.slice(i, i + OPENROUTER_RACE_BATCH_SIZE);
    try {
      return await Promise.any(batch.map(attempt));
    } catch (aggregateError: any) {
      lastError = aggregateError?.errors?.[aggregateError.errors.length - 1] ?? aggregateError;
    }
  }
  throw lastError || new Error('Fallback OpenRouter indisponível.');
};

// Converts a Gemini-style responseSchema (Type.OBJECT/STRING/ARRAY/...) into
// plain JSON Schema, so every function's existing schema object can be
// reused as-is for the OpenRouter fallback instead of hand-duplicated.
const toJsonSchema = (googleSchema: any): any => {
  if (!googleSchema || typeof googleSchema !== 'object') return googleSchema;
  const { type, properties, items, ...rest } = googleSchema;
  const out: any = { ...rest };
  if (type) out.type = String(type).toLowerCase();
  if (properties) out.properties = Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, toJsonSchema(v)]));
  if (items) out.items = toJsonSchema(items);
  return out;
};

type AIProviderId = 'groq' | 'openrouter' | 'freellmapi' | 'gemini';

// Default priority: Groq (fast, own hardware) → OpenRouter → FreeLLMAPI → Gemini.
const DEFAULT_PROVIDER_ORDER: AIProviderId[] = ['groq', 'openrouter', 'freellmapi', 'gemini'];

const getPreferredAIProvider = (): AIProviderId | 'auto' => {
  try {
    const stats = JSON.parse(localStorage.getItem('focus_stats') || '{}');
    const provider = stats?.aiProvider;
    return provider === 'groq' || provider === 'openrouter' || provider === 'freellmapi' || provider === 'gemini' ? provider : 'auto';
  } catch {
    return 'auto';
  }
};

// The chosen provider goes first; the rest keep the default order.
const getProviderOrder = (): AIProviderId[] => {
  const preferred = getPreferredAIProvider();
  return preferred === 'auto'
    ? DEFAULT_PROVIDER_ORDER
    : [preferred, ...DEFAULT_PROVIDER_ORDER.filter((id) => id !== preferred)];
};

const isProviderConfigured = (id: AIProviderId): boolean => {
  if (id === 'groq') return GROQ_ENABLED;
  if (id === 'openrouter') return OPENROUTER_ENABLED;
  if (id === 'freellmapi') return FREELLMAPI_ENABLED && canUseAIProxy();
  return true;
};

const contentToMessages = (contents: any): { role: string; content: string }[] => {
  if (typeof contents === 'string') return [{ role: 'user', content: contents }];
  if (!Array.isArray(contents)) return [];
  return contents.map((item: any) => {
    const role = item?.role === 'model' || item?.role === 'assistant' ? 'assistant' : 'user';
    const parts = Array.isArray(item?.parts) ? item.parts : [];
    const content = typeof item === 'string'
      ? item
      : typeof item?.content === 'string'
        ? item.content
        : parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('\n');
    return { role, content };
  }).filter((message) => message.content.trim());
};

async function generateFreeLLMAPIContent(params: any): Promise<{ text: string }> {
  const config = params?.config || {};
  const systemInstruction = typeof config.systemInstruction === 'string' ? config.systemInstruction : undefined;
  const messages: { role: string; content: string }[] = [
    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
    ...contentToMessages(params?.contents),
  ];
  if (messages.length === 0) throw new Error('A solicitação não contém texto compatível com o FreeLLMAPI.');

  const schema = config.responseSchema ? toJsonSchema(config.responseSchema) : undefined;
  const wantsJson = config.responseMimeType === 'application/json';
  if (wantsJson && schema) {
    const schemaInstruction = `\n\nResponda somente com um objeto JSON válido, sem Markdown nem texto adicional. Siga este schema e preserve exatamente os nomes dos campos:\n${JSON.stringify(schema)}`;
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    if (lastUserMessage) lastUserMessage.content += schemaInstruction;
  }
  // The FreeLLMAPI router's OpenAI-compatible JSON Schema mode can reject valid
  // outputs from some routed models. JSON object mode is more broadly supported;
  // the requested schema is included in the prompt and parsed by the app.
  const responseFormat = wantsJson ? { type: 'json_object' } : undefined;
  const requestedTokens = Number(config.maxOutputTokens);
  const data = await requestFreeLLMAPI({
    messages,
    ...(responseFormat ? { response_format: responseFormat } : {}),
    temperature: typeof config.temperature === 'number' ? config.temperature : 0.5,
    max_tokens: Number.isFinite(requestedTokens) ? Math.min(Math.max(requestedTokens, 256), 24000) : 8000,
  });
  const text = readFreeLLMAPIText(data);
  if (!text) throw new Error('FreeLLMAPI retornou uma resposta vazia.');
  console.info(`[ai] Resposta gerada pelo FreeLLMAPI${data.routedVia ? ` via ${data.routedVia}` : ''}.`);
  return { text };
}

async function generateGroqContent(params: any): Promise<{ text: string }> {
  const config = params?.config || {};
  const systemInstruction = typeof config.systemInstruction === 'string' ? config.systemInstruction : undefined;
  const messages = [
    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
    ...contentToMessages(params?.contents),
  ];
  if (messages.length === 0) throw new Error('A solicitação não contém texto compatível com o Groq.');

  const schema = config.responseSchema ? toJsonSchema(config.responseSchema) : undefined;
  const responseFormat = config.responseMimeType === 'application/json' && schema
    ? { type: 'json_schema', json_schema: { name: 'todahora_response', schema, strict: false } }
    : undefined;
  const requestedTokens = Number(config.maxOutputTokens);
  let lastError: any;
  for (const model of GROQ_MODELS) {
    try {
      const text = await callGroqModel(model, {
        messages,
        ...(responseFormat ? { response_format: responseFormat } : {}),
        temperature: typeof config.temperature === 'number' ? config.temperature : 0.5,
        max_tokens: Number.isFinite(requestedTokens) ? Math.min(Math.max(requestedTokens, 256), 24000) : 8000,
      });
      console.info(`[ai] Resposta gerada pelo Groq (${model}).`);
      return { text };
    } catch (e: any) {
      lastError = e;
    }
  }
  throw lastError || new Error('Groq indisponível.');
}

async function generateOpenRouterContent(params: any): Promise<{ text: string }> {
  const config = params?.config || {};
  const systemInstruction = typeof config.systemInstruction === 'string' ? config.systemInstruction : undefined;
  const messages = [
    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
    ...contentToMessages(params?.contents),
  ];
  if (messages.length === 0) throw new Error('A solicitação não contém texto compatível com o OpenRouter.');

  const schema = config.responseSchema ? toJsonSchema(config.responseSchema) : undefined;
  const responseFormat = config.responseMimeType === 'application/json' && schema
    ? { type: 'json_schema', json_schema: { name: 'todahora_response', strict: true, schema } }
    : undefined;
  const requestedTokens = Number(config.maxOutputTokens);
  return raceOpenRouterModels(async (model) => {
    const res = await aiProxyFetch('openrouter', {
      body: JSON.stringify({
        model,
        messages,
        ...(responseFormat ? { response_format: responseFormat } : {}),
        reasoning: { enabled: false },
        temperature: typeof config.temperature === 'number' ? config.temperature : 0.5,
        max_tokens: Number.isFinite(requestedTokens) ? Math.min(Math.max(requestedTokens, 256), 24000) : 8000,
      }),
      signal: AbortSignal.timeout(OPENROUTER_PER_MODEL_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`OpenRouter (${model}) HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error(`OpenRouter (${model}) retornou vazio`);
    console.info(`[ai] Resposta gerada pelo OpenRouter (${model}).`);
    return { text };
  });
}

const callOpenRouterJson = async (systemInstruction: string | undefined, userPrompt: string, schema: any, schemaName: string, validate?: (parsed: any) => boolean): Promise<any> => {
  return raceOpenRouterModels(async (model) => {
    try {
      const res = await aiProxyFetch('openrouter', {
        body: JSON.stringify({
          model,
          messages: [
            ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
          reasoning: { enabled: false }, // skip hidden reasoning trace: not needed for extraction/generation, and avoids it eating the completion budget on large payloads
          temperature: 0.3,
          max_tokens: 24000, // parsePastedQuestions can extract many questions in one batch; keep headroom close to Gemini's own 25000 cap for the same call
        }),
        signal: AbortSignal.timeout(OPENROUTER_PER_MODEL_TIMEOUT_MS),
      });
      if (!res.ok) { console.warn(`[fallback] ${model} falhou: HTTP ${res.status}`); throw new Error(`OpenRouter (${model}) HTTP ${res.status}`); }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) { console.warn(`[fallback] ${model} retornou conteúdo vazio.`); throw new Error(`OpenRouter (${model}) retornou vazio`); }
      const parsed = safeAIJsonParse(text);
      // Small free models routinely emit syntactically-valid JSON that's
      // semantically cut off (a field stops mid-sentence) instead of erroring
      // out — treat that the same as a failed model so Promise.any moves on
      // to another one in the batch rather than handing the user broken text.
      if (validate && !validate(parsed)) {
        console.warn(`[fallback] ${model} retornou conteúdo incompleto/cortado.`);
        throw new Error(`OpenRouter (${model}) retornou conteúdo incompleto`);
      }
      console.warn(`[fallback] Gemini indisponível, resposta gerada via OpenRouter (${model}).`);
      return parsed;
    } catch (e: any) {
      if (!(e instanceof Error && e.message.startsWith('OpenRouter ('))) {
        console.warn(`[fallback] ${model} falhou: ${e?.name || ''} ${e?.message || e}`);
      }
      throw e;
    }
  });
};

const callOpenRouterText = async (systemInstruction: string | undefined, messages: { role: string, content: string }[], temperature = 0.6): Promise<string> => {
  return raceOpenRouterModels(async (model) => {
    try {
      const res = await aiProxyFetch('openrouter', {
        body: JSON.stringify({
          model,
          messages: [...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []), ...messages],
          reasoning: { enabled: false },
          temperature,
          max_tokens: 8000,
        }),
        signal: AbortSignal.timeout(OPENROUTER_PER_MODEL_TIMEOUT_MS),
      });
      if (!res.ok) { console.warn(`[fallback] ${model} falhou: HTTP ${res.status}`); throw new Error(`OpenRouter (${model}) HTTP ${res.status}`); }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) { console.warn(`[fallback] ${model} retornou conteúdo vazio.`); throw new Error(`OpenRouter (${model}) retornou vazio`); }
      console.warn(`[fallback] Gemini indisponível, resposta gerada via OpenRouter (${model}).`);
      return text;
    } catch (e: any) {
      if (!(e instanceof Error && e.message.startsWith('OpenRouter ('))) {
        console.warn(`[fallback] ${model} falhou: ${e?.name || ''} ${e?.message || e}`);
      }
      throw e;
    }
  });
};

// Groq-specific fallback: only 2 candidate models (vs. OpenRouter's batched
// race across 6), tried sequentially rather than raced — Groq's own hardware
// is reliable enough that racing for latency isn't the priority here; the
// backup model exists purely so a spent daily quota on the primary doesn't
// take the whole Groq attempt down with it.
const callGroqModel = async (model: string, body: Record<string, any>): Promise<string> => {
  const res = await aiProxyFetch('groq', {
    body: JSON.stringify({ model, ...body }),
    signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
  });
  if (!res.ok) { console.warn(`[groq] ${model} falhou: HTTP ${res.status}`); throw new Error(`Groq (${model}) HTTP ${res.status}`); }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) { console.warn(`[groq] ${model} retornou conteúdo vazio.`); throw new Error(`Groq (${model}) retornou vazio`); }
  return text;
};

const callGroqJson = async (systemInstruction: string | undefined, userPrompt: string, schema: any, schemaName: string, validate?: (parsed: any) => boolean): Promise<any> => {
  let lastError: any;
  for (const model of GROQ_MODELS) {
    try {
      const text = await callGroqModel(model, {
        messages: [
          ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
          { role: 'user', content: userPrompt },
        ],
        // strict:true on Groq additionally demands every optional field be
        // folded into `required` (OpenAI's structured-outputs rule) across
        // all 17 existing schemas — not worth rewriting all of them just for
        // constrained decoding when strict:false still gets solid schema
        // adherence from a 120b model on a reliable, uncongested host.
        response_format: { type: 'json_schema', json_schema: { name: schemaName, schema, strict: false } },
        temperature: 0.3,
        max_tokens: 24000,
      });
      const parsed = safeAIJsonParse(text);
      if (validate && !validate(parsed)) {
        console.warn(`[groq] ${model} retornou conteúdo incompleto/cortado.`);
        throw new Error(`Groq (${model}) retornou conteúdo incompleto`);
      }
      console.warn(`[fallback] Gemini indisponível, resposta gerada via Groq (${model}).`);
      return parsed;
    } catch (e: any) {
      if (!(e instanceof Error && e.message.startsWith('Groq ('))) {
        console.warn(`[groq] ${model} falhou: ${e?.name || ''} ${e?.message || e}`);
      }
      lastError = e;
    }
  }
  throw lastError || new Error('Groq indisponível.');
};

const callGroqText = async (systemInstruction: string | undefined, messages: { role: string, content: string }[], temperature = 0.6): Promise<string> => {
  let lastError: any;
  for (const model of GROQ_MODELS) {
    try {
      const text = await callGroqModel(model, {
        messages: [...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []), ...messages],
        temperature,
        max_tokens: 8000,
      });
      console.warn(`[fallback] Gemini indisponível, resposta gerada via Groq (${model}).`);
      return text;
    } catch (e: any) {
      if (!(e instanceof Error && e.message.startsWith('Groq ('))) {
        console.warn(`[groq] ${model} falhou: ${e?.name || ''} ${e?.message || e}`);
      }
      lastError = e;
    }
  }
  throw lastError || new Error('Groq indisponível.');
};

// Used when Gemini failed (or returned unusable output): every configured
// provider except Gemini is tried in priority order (chosen one first, then
// Groq → OpenRouter → FreeLLMAPI).
const tryJsonFallbacks = async (systemInstruction: string | undefined, userPrompt: string, schema: any, schemaName: string, validate?: (parsed: any) => boolean): Promise<any> => {
  let lastError: any;
  for (const providerId of getProviderOrder()) {
    if (providerId === 'gemini' || !isProviderConfigured(providerId)) continue;
    try {
      if (providerId === 'groq') return await callGroqJson(systemInstruction, userPrompt, schema, schemaName, validate);
      if (providerId === 'openrouter') return await callOpenRouterJson(systemInstruction, userPrompt, schema, schemaName, validate);
      return await callFreeLLMAPIJson(systemInstruction, userPrompt, schema, schemaName, validate);
    } catch (e) {
      lastError = e;
      console.warn(`[fallback] ${providerId} falhou, tentando o próximo provedor:`, e);
    }
  }
  throw lastError || new Error('Nenhum fallback de IA disponível.');
};

const tryTextFallbacks = async (systemInstruction: string | undefined, messages: { role: string, content: string }[], temperature = 0.6): Promise<string> => {
  let lastError: any;
  for (const providerId of getProviderOrder()) {
    if (providerId === 'gemini' || !isProviderConfigured(providerId)) continue;
    try {
      if (providerId === 'groq') return await callGroqText(systemInstruction, messages, temperature);
      if (providerId === 'openrouter') return await callOpenRouterText(systemInstruction, messages, temperature);
      return await callFreeLLMAPIText(systemInstruction, messages, temperature);
    } catch (e) {
      lastError = e;
      console.warn(`[fallback] ${providerId} falhou, tentando o próximo provedor:`, e);
    }
  }
  throw lastError || new Error('Nenhum fallback de IA disponível.');
};

// Utility to get current date/time context for AI
const getTimeContext = () => {
  const now = new Date();
  return `Contexto Temporal Atual: hoje é ${now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Horário: ${now.toLocaleTimeString('pt-BR')}.`;
};

const requestStudyContent = async (topic: string, technique: string, numQuestions: number, profile: StudyProfile, explanationStyle: ExplanationStyle) => {
  const profileContext = profile === 'CONCURSO' 
    ? "Foco em editais públicos e lei seca. Linguagem técnica."
    : profile === 'FACULDADE'
    ? "Foco em disciplinas acadêmicas e ensino superior/graduação, conceitos complexos explicados com profundidade científica e rigor acadêmico."
    : "Foco em ENEM e grandes vestibulares. Linguagem didática.";

  const studyContentPrompt = `${getTimeContext()}
      Gere um simulado de estudo sobre "${topic}". Especialmente, gere exatamente ${numQuestions} questões no quiz.
      ${profileContext}
      Técnica de Estudo: ${technique}.

      INSTRUÇÕES PARA O MAPEAMENTO DA LÓGICA DAS QUESTÕES: ${explanationStyle}

      REQUISITOS (SEJA ULTRA-CONCISO PARA VELOCIDADE):
      1. executiveSummary: Uma síntese estruturada do tema.
      2. deepDive: Uma análise técnica sobre o ponto central do tema.
      3. explorationMenu: 3 tópicos específicos para o usuário escolher explorar depois.
      4. quiz: Em cada questão, no campo "explanation", siga o estilo acima.

      5. memoryHint (BIZU DE MEMÓRIA): Gatilho de IMPACTO MÁXIMO para TDAH.
         - Use mnemônicos inesquecíveis ou analogias visuais absurdas.
         - Dê uma regra de bolso definitiva para o usuário nunca mais hesitar.
         - Foque em clareza absoluta e simplicidade radical na decodificação do tema.

      6. flashcards: Gere cards que facilitem a memorização ativa.
         - A "answer" deve ser direta, mas pode incluir um pequeno mnemônico entre parênteses para temas complexos.

      Não use emojis excessivos. Use formatação em negrito para termos-chave. Use cabeçalhos Markdown (###) para organizar as seções da explicação. Profundidade 10/10. Foco total em aprovação de elite.

      ESTRUTURA JSON:
      {
        "executiveSummary": "string",
        "deepDive": "string",
        "comparison": {
          "leftConcept": "string",
          "rightConcept": "string",
          "leftData": { "desc": "string", "example": "string" },
          "rightData": { "desc": "string", "example": "string" }
        },
        "explorationMenu": [{"topic": "string", "description": "string"}],
        "quiz": [{"question": "string", "options": ["string"], "correctAnswer": number, "explanation": "string", "memoryHint": "string"}],
        "flashcards": [{"question": "string", "answer": "string"}]
      }`;

  const studyContentSchema = {
    type: Type.OBJECT,
    properties: {
      executiveSummary: { type: Type.STRING },
      deepDive: { type: Type.STRING },
      comparison: {
        type: Type.OBJECT,
        properties: {
          leftConcept: { type: Type.STRING },
          rightConcept: { type: Type.STRING },
          leftData: {
            type: Type.OBJECT,
            properties: { desc: { type: Type.STRING }, example: { type: Type.STRING } },
            required: ["desc", "example"]
          },
          rightData: {
            type: Type.OBJECT,
            properties: { desc: { type: Type.STRING }, example: { type: Type.STRING } },
            required: ["desc", "example"]
          }
        },
        required: ["leftConcept", "rightConcept", "leftData", "rightData"]
      },
      explorationMenu: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["topic", "description"]
        }
      },
      quiz: {
        type: Type.ARRAY,
        minItems: numQuestions,
        maxItems: numQuestions,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
            memoryHint: { type: Type.STRING }
          },
          required: ["question", "options", "correctAnswer", "explanation", "memoryHint"]
        }
      },
      flashcards: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { question: { type: Type.STRING }, answer: { type: Type.STRING }, explanation: { type: Type.STRING } },
          required: ["question", "answer", "explanation"]
        }
      }
    },
    required: ["executiveSummary", "deepDive", "comparison", "explorationMenu", "quiz", "flashcards"]
  };

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: studyContentPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: studyContentSchema
      }
    });

    const text = response.text;
    if (text) {
      return safeAIJsonParse(text);
    }
    throw new AIError("Resposta vazia da IA.");
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        return await tryJsonFallbacks(undefined, studyContentPrompt, toJsonSchema(studyContentSchema), 'study_content');
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em generateStudyContent:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};

const requestExamQuestions = async (topic: string, numQuestions: number, profile: StudyProfile, banca: string | undefined, explanationStyle: ExplanationStyle, questionProfileStyle: string, extraInstructions: string) => {
  const profileStyle = profile === 'CONCURSO'
    ? "estilo Concursos Públicos de alto nível (FCC/CESPE/FGV), complexas, baseadas em doutrina, jurisprudência e lei seca."
    : profile === 'FACULDADE'
    ? "estilo Provas Universitárias / Ensino Superior, com foco em raciocínio crítico acadêmico, teorias científicas e aplicação prática de conceitos de graduação."
    : "estilo ENEM/FUVEST, baseadas em interpretação, contextualização e conceitos fundamentais.";

  const profileInstruction = questionProfileStyle ? `\nPERFIL ADICIONAL DAS QUESTÕES: ${questionProfileStyle}` : "";
  const bancaInstruction = banca ? ` A banca examinadora solicitada é a "${banca}". Siga rigorosamente o padrão de cobrança, a linguagem e os temas recorrentes dessa banca específica.` : "";

  const examQuestionsPrompt = `${getTimeContext()}
      Gere um simulado de exatamente ${numQuestions} questões ${profileStyle} sobre "${topic}".${bancaInstruction} As questões devem ser de múltipla escolha (A a E).
      ${profileInstruction}
      Não use emojis. Seja extremamente objetivo e rápido na resposta.
      ${extraInstructions}

      INSTRUÇÃO PARA O MAPEAMENTO DA LÓGICA DAS QUESTÕES ("explanation"):
      ${explanationStyle}

      O Mapeamento deve seguir o estilo acima de forma objetiva e clara.

      A Dica de Memorização ("memoryHint") DEVE ser um "Bizu de Elite" para TDAH:
      - Use gatilhos visuais, mnemônicos absurdos ou analogias impactantes.
      - Ensine uma regra de ouro definitiva para nunca mais esquecer ou confundir este tema.`;

  const examQuestionsJsonSchema = {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        minItems: numQuestions,
        maxItems: numQuestions,
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 },
            correctAnswer: { type: 'integer' },
            explanation: { type: 'string' },
            memoryHint: { type: 'string' },
          },
          required: ['question', 'options', 'correctAnswer', 'explanation', 'memoryHint'],
        },
      },
    },
    required: ['questions'],
  };

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: examQuestionsPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              minItems: numQuestions,
              maxItems: numQuestions,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 5, maxItems: 5 },
                  correctAnswer: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  memoryHint: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "explanation", "memoryHint"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });
    return safeAIJsonParse(response.text);
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        return await tryJsonFallbacks(undefined, examQuestionsPrompt, examQuestionsJsonSchema, 'exam_questions');
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em generateExamQuestions:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};


// The free provider tiers cap tokens per minute, and verifying questions needs several calls in a row. When a call
// is refused for rate limit, wait for the window to reopen and try again instead of giving up on the verification.
const isRateLimitError = (error: any): boolean =>
  error?.status === 429 || /\b429\b|rate[ _-]?limit|RESOURCE_EXHAUSTED|Limite de Cota/i.test(String(error?.message ?? error));

const withRateLimitRetry = async <T,>(task: () => Promise<T>, attempts = 3, waitMs = 20000): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= attempts || !isRateLimitError(error)) throw error;
      console.warn(`[ai] limite de uso atingido; nova tentativa em ${Math.round(waitMs / 1000)} s (${attempt}/${attempts - 1}).`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
};

// Public entry point: grounds questions in reference text, checks the answer with reversed choices, reviews every
// explanation claim, and regenerates rejected questions. Unverified output is never released.
const judgeJson = async (prompt: string, schema: any, name: string): Promise<any> => {
  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: prompt,
      // Small output budget: the judge only returns a short verdict per question, and a large max_tokens
      // makes Groq's free tier reject the request for exceeding its per-minute limit.
      config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0, maxOutputTokens: 2500 },
    });
    return safeAIJsonParse(response.text);
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) return tryJsonFallbacks(undefined, prompt, toJsonSchema(schema), name);
    throw error;
  }
};


// "Estudar com IA": the lesson stays available if quiz validation fails, but unverified quiz items are removed.
export const generateStudyContent = async (topic: string, technique: string, numQuestions: number, profile: StudyProfile = 'VESTIBULAR', explanationStyle: ExplanationStyle = 'Explique de forma técnica e objetiva com mapeamento lógico passo a passo.') => {
  const content = await requestStudyContent(topic, technique, numQuestions, profile, explanationStyle);
  if (!Array.isArray(content?.quiz) || content.quiz.length === 0) return content;
  try {
    const lengths = content.quiz.map((q: any) => (Array.isArray(q?.options) ? q.options.length : 0));
    const optionCount = [4, 5].sort((x, y) => lengths.filter((n: number) => n === y).length - lengths.filter((n: number) => n === x).length)[0];
    let useOriginal = true;
    const { questions, report } = await buildVerifiedQuestions({
      topic,
      count: numQuestions,
      optionCount,
      Type,
      judge: (prompt, schema, name) => withRateLimitRetry(() => judgeJson(prompt, schema, name)),
      generate: async (count, extra) => {
        if (useOriginal) { useOriginal = false; return content.quiz; }
        return withRateLimitRetry(() => requestExamQuestions(topic, count, profile, undefined, explanationStyle, '', extra));
      },
    });
    console.info('[quiz] auditoria:', report);
    return questions.length > 0
      ? { ...content, quiz: questions, quizVerificationNotice: undefined }
      : {
          ...content,
          quiz: [],
          quizVerificationNotice: report.sources.length === 0
            ? 'As questões foram omitidas porque não encontrei uma fonte confiável para conferir esse assunto. Tente especificar melhor o tema.'
            : 'As questões foram omitidas porque o gabarito e a explicação não passaram pela conferência. Tente novamente ou escolha outro tema.',
        };
  } catch (error) {
    console.warn('[quiz] verificação indisponível; questões não exibidas.', error);
    return {
      ...content,
      quiz: [],
      quizVerificationNotice: 'As questões foram omitidas porque não foi possível conferir o gabarito e a explicação. Tente novamente em instantes.',
    };
  }
};

export const generateExamQuestions = async (topic: string, numQuestions: number, profile: StudyProfile = 'VESTIBULAR', banca?: string, explanationStyle: ExplanationStyle = 'Seja técnico e objetivo na explicação.', questionProfileStyle: string = '') => {
  try {
    const { questions, report } = await buildVerifiedQuestions({
      topic,
      count: numQuestions,
      Type,
      judge: (prompt, schema, name) => withRateLimitRetry(() => judgeJson(prompt, schema, name)),
      generate: (count, extra) => withRateLimitRetry(() => requestExamQuestions(topic, count, profile, banca, explanationStyle, questionProfileStyle, extra)),
    });
    console.info('[questoes] auditoria:', report);
    if (questions.length === 0) {
      const message = report.sources.length === 0
        ? 'Não encontrei uma fonte confiável para verificar esse assunto. Especifique melhor o tema ou tente novamente.'
        : report.judgeAvailable
          ? 'As questões geradas não passaram pela conferência de resposta e explicação. Tente outro recorte do assunto.'
          : 'Não foi possível concluir a conferência independente agora. Nenhuma questão foi liberada; tente novamente em instantes.';
      throw new AIError(message);
    }
    return { questions };
  } catch (error) {
    return handleAIError(error);
  }
};

export const identifyQuestionCount = async (text: string) => {
  const countPrompt = `Analise cuidadosamente o texto abaixo e conte quantas questões de múltipla escolha (com alternativas A, B, C...) existem nele.
      Ignore blocos de explicação, comentários ou gabaritos que venham após as questões; conte apenas os enunciados das perguntas.
      Retorne APENAS um número inteiro representando o total de questões.

      Texto:
      """
      ${text.substring(0, 50000)}
      """`;
  try {
    const response = await generateContentWithRetry({
      model: LITE_MODEL,
      contents: countPrompt
    });
    const count = parseInt(response.text?.trim().replace(/[^0-9]/g, '') || "0");
    return isNaN(count) ? 0 : count;
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        const fallbackText = await tryTextFallbacks(undefined, [{ role: 'user', content: countPrompt }], 0.1);
        const count = parseInt(fallbackText?.trim().replace(/[^0-9]/g, '') || "0");
        return isNaN(count) ? 0 : count;
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em identifyQuestionCount:', fallbackError);
      }
    }
    return 0;
  }
};

export const parsePastedQuestions = async (pastedText: string, profile: StudyProfile = 'VESTIBULAR', batchInfo?: { current: number, total: number }, pastedGabarito?: string, explanationStyle: ExplanationStyle = 'Seja técnico e objetivo na explicação.', questionProfileStyle: string = '') => {
  const profileStyle = profile === 'CONCURSO'
    ? "estilo Concursos Públicos de alto nível"
    : profile === 'FACULDADE'
    ? "estilo Provas Universitárias acadêmicas"
    : "estilo ENEM/FUVEST";

  const batchPrompt = batchInfo 
    ? `\nLOTE ATUAL: Processando parte ${batchInfo.current} de ${batchInfo.total} do documento. Extraia as questões contidas NESTE TEXTO ESPECÍFICO.`
    : "";

  const gabaritoPrompt = pastedGabarito 
    ? `\nO USUÁRIO FORNECEU UM GABARITO ADICIONAL PARA ESTAS QUESTÕES:
       """
       ${pastedGabarito}
       """
       USE ESTE GABARITO PARA IDENTIFICAR O 'correctAnswer' DE CADA QUESTÃO CORRESPONDENTE COM PRECISÃO MÁXIMA.`
    : "";

  const parsePastedPrompt = `${getTimeContext()}
      Você é um extrator de questões de ALTA PRECISÃO. O usuário colou um texto longo.
      Sua missão é extrair as questões solicitadas e transformá-las em JSON. ${batchPrompt}${gabaritoPrompt}

      REGRAS DE OURO DE PRODUÇÃO:
      - NÃO adicione nenhum preâmbulo, texto introdutório ou conclusão fora do JSON (ex: NÃO diga "Aqui está o JSON..." ou "Processamento concluído").
      - Retorne EXCLUSIVAMENTE o bloco de código JSON.
      - NÃO inclua rótulos redundantes dentro dos campos do JSON (ex: NÃO comece o 'question' com "QUESTÃO:" ou "Enunciado:"). O texto deve ser o conteúdo puro.

      IDENTIFICAÇÃO DE RESPOSTAS E EXPLICAÇÕES (CRÍTICO - PRIORIDADE MÁXIMA AO TEXTO):
      - O usuário frequentemente cola a resposta e a explicação logo abaixo de cada questão para guiar a IA.
      - BUSQUE ATENTAMENTE por padrões como: "Gabarito: A", "Resposta: B", "Alternativa correta: C", "[A]", "(B)", ou se uma alternativa estiver marcada com asteriscos, ou até mesmo apenas uma letra isolada logo após as alternativas que indique a resposta.
      - BUSQUE também por "Explicação:", "Comentário:", "Justificativa:", "Fundamentação:" ou blocos de texto explicativos que venham imediatamente após o gabarito ou as alternativas.
      - **REGRA DE OURO**: Se o texto colado indicar uma resposta ou explicação, você DEVE usá-las obrigatoriamente. Sua função aqui é de EXTRAÇÃO fiel e precisa, não de criação (a menos que a informação falte).
      - Se a resposta no texto for "A", o 'correctAnswer' DEVE ser 0. Se for "B", 1, e assim por diante.

      ESTRUTURA DE CADA QUESTÃO NO JSON:
      - question: Enunciado integral e limpo da questão.
      - options: Array com exatamente 5 alternativas. Se o original tiver menos, complete com alternativas plausíveis.
      - correctAnswer: Index 0-4 (0=A, 1=B, etc). USE O GABARITO DO TEXTO SE DISPONÍVEL.
      - explanation: A EXPLICAÇÃO FORNECIDA NO TEXTO (se disponível no texto colado logo após a questão ou no fim da lista). Se o texto original não tiver comentário, use a seguinte instrução para gerar você mesmo uma explicação técnica e estruturada rica em markdown:
      ${explanationStyle}

      - memoryHint: Gatilho mental TDAH (mnemônico ou analogia visual) para nunca mais esquecer o conceito.

      PERFIL ADICIONAL DAS QUESTÕES:
      ${questionProfileStyle}

      TEXTO PARA ANALISAR:
      """
      ${pastedText}
      """`;

  const parsePastedJsonSchema = {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 },
            correctAnswer: { type: 'integer' },
            explanation: { type: 'string' },
            memoryHint: { type: 'string' },
          },
          required: ['question', 'options', 'correctAnswer', 'explanation', 'memoryHint'],
        },
      },
    },
    required: ['questions'],
  };

  try {
    const response = await generateContentWithRetry({
      model: PRO_MODEL, // Use Pro model for extraction tasks to improve precision and capacity
      contents: parsePastedPrompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 25000,
        temperature: 0.1,
        topP: 0.95,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 5, maxItems: 5 },
                  correctAnswer: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  memoryHint: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "explanation", "memoryHint"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    const text = response.text;
    if (text) {
      return safeAIJsonParse(text);
    }
    throw new AIError("Resposta vazia da IA.");
  } catch (error: any) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        return await tryJsonFallbacks(undefined, parsePastedPrompt, parsePastedJsonSchema, 'parsed_questions');
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em parsePastedQuestions:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};

export const chatWithFish = async (message: string, history: { role: string, parts: { text: string }[] }[], profile: StudyProfile = 'VESTIBULAR') => {
  const profileTone = profile === 'CONCURSO'
    ? "O usuário está estudando para concursos. Use referências a editais e carreira pública quando apropriado."
    : profile === 'FACULDADE'
    ? "O usuário está estudando para a faculdade/graduação escolar de nível superior. Use referências a provas de faculdade, artigos acadêmicos, TCC e rigor científico quando apropriado."
    : "O usuário está estudando para vestibulares/ENEM. Use referências a universidade e futuro acadêmico quando apropriado.";

  const fishSystemInstruction = `${getTimeContext()} Você é o 'Peixe de Estudo' do app TDAH ORA. Sua missão é ser um companheiro de estudos amigável, incentivador e direto para estudantes com TDAH. ${profileTone} Regras: 1. Explique conceitos complexos de forma visual e simples (usando analogias). 2. Seja conciso; evite blocos gigantes de texto. 3. NÃO use emojis em hipótese alguma. 4. NÃO use asteriscos (*** ou **) para formatar o texto. 5. Se o usuário disser que esqueceu algo, explique em 3 pontos rápidos. 6. Ajude com revisões relâmpago. 7. Mantenha o tom de 'estamos juntos nessa'.`;

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: fishSystemInstruction,
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
      }
    });
    return response.text + " "; // Minor change to make it unique
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        const openRouterHistory = history.map(h => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.parts.map(p => p.text).join('\n'),
        }));
        return await tryTextFallbacks(fishSystemInstruction, [...openRouterHistory, { role: 'user', content: message }], 0.7);
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em chatWithFish:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};

export const analyzeEvocation = async (text: string, profile: StudyProfile = 'VESTIBULAR') => {
  const evocationPrompt = `${getTimeContext()}
      Analise o seguinte texto de evocação ativa de um estudante (TDAH):
      "${text}"

      TAREFAS:
      1. Identifique os pontos principais que o estudante lembrou.
      2. Identifique possíveis erros conceituais ou confusões.
      3. Dê um feedback encorajador e direto.
      4. Liste 2 pontos cruciais que ficaram de fora (se houver).

      Não use emojis. Use linguagem clara e direta.`;

  const evocationSchema = {
    type: Type.OBJECT,
    properties: {
      pointsIdentified: { type: Type.ARRAY, items: { type: Type.STRING } },
      errorsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
      missedPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
      feedback: { type: Type.STRING }
    },
    required: ["pointsIdentified", "errorsFound", "missedPoints", "feedback"]
  };

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: evocationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: evocationSchema
      }
    });
    return safeAIJsonParse(response.text);
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        return await tryJsonFallbacks(undefined, evocationPrompt, toJsonSchema(evocationSchema), 'evocation_analysis');
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em analyzeEvocation:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};

export const generateQuestionsFromAnalysis = async (analysis: any, profile: StudyProfile = 'VESTIBULAR') => {
  const analysisPrompt = `${getTimeContext()}
      Com base nesta análise de evocação de um estudante (TDAH):
      Pontos que lembrou: ${analysis.pointsIdentified.join(', ')}
      Erros cometidos: ${analysis.errorsFound.join(', ')}
      Pontos esquecidos: ${analysis.missedPoints.join(', ')}

      Perfil do Estudante: ${profile === 'CONCURSO' ? 'Concurso' : profile === 'FACULDADE' ? 'Universitário/Faculdade' : 'Vestibular/ENEM'}

      TAREFA:
      Gere 5 questões de múltipla escolha (A, B, C, D, E) focadas PRINCIPALMENTE nos erros cometidos e pontos esquecidos (identificados acima).
      Se o estudante não cometeu erros, gere questões sobre os pontos que ele esqueceu ou sobre o tema geral.

      ESTRUTURA OBRIGATÓRIA DA EXPLICAÇÃO ("explanation") (Use Markdown Ricamente):
      Seja EXAUSTIVO e TÉCNICO. Não seja breve. Desconstrua cada erro do estudante e de cada alternativa individualmente.
      - **CONCEITO E DEFINIÇÃO**: Natureza jurídica, distinções e fundamentos teóricos profundos.
      - **BASE LEGAL/CIENTÍFICA ATUAL**: Citações exatas e explicações da norma/teoria.
      - **POR QUE A LETRA ESTÁ CORRETA?** e **POR QUE AS OUTRAS ESTÃO ERRADAS?** (Analise cada uma individualmente).
      - **REQUISITOS/ELEMENTOS**: O que deve existir (use marcadores de forma detalhada).
      - **CLASSIFICAÇÕES/ESPÉCIES** (analise as categorias minuciosamente).
      - **PEGADINHA DE PROVA:** Destaque o ponto exato onde houve a falha de interpretação anterior.
      - **RESUMO PRA PROVA** e **DICA FINAL** (pontos de elite para não esquecer).
      - VISUAL: Negrito em termos-chave.

      A Dica de Memorização ("memoryHint") DEVE ser um gatilho mental de impacto massivo. Ensine o usuário uma forma DEFINITIVA de não errar mais essa questão. Forneça uma explicação esclarecedora combinada com mnemônicos ou recursos imaginativos potentes para que ele nunca mais esqueça o motivo pelo qual errou.

      Abuse da formatação Markdown (negrito, bullet points, quebras de linha duplas) para deixar a leitura fácil e arejada. Profundidade 10/10. Foco total em recuperação acelerada e domínio do tema.

      Retorne no formato JSON rigoroso: um objeto { "questions": [...] }, cada item com question, options (5 alternativas), correctAnswer (índice 0-4), explanation, memoryHint.`;

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: analysisPrompt,
    });
    if (response.text) {
      return safeAIJsonParse(response.text);
    }
    throw new AIError("Resposta vazia da IA.");
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        const fallbackSchema = {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  options: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 },
                  correctAnswer: { type: 'integer' },
                  explanation: { type: 'string' },
                  memoryHint: { type: 'string' },
                },
                required: ['question', 'options', 'correctAnswer', 'explanation', 'memoryHint'],
              },
            },
          },
          required: ['questions'],
        };
        const result = await tryJsonFallbacks(undefined, analysisPrompt, fallbackSchema, 'recovery_questions');
        return result.questions;
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em generateQuestionsFromAnalysis:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};

export const extractTopicsFromEdital = async (subjectName: string, rawContent: string) => {
  const editalTopicsPrompt = `Extraia APENAS os tópicos de estudo para a disciplina "${subjectName}" do texto abaixo.
      Ignore burocracias, regras de prova ou datas.
      Retorne apenas uma lista de temas didáticos (ex: 'Conjuntos Numerativos').
      Máximo 15 tópicos curtos.
      Texto: "${rawContent}"

      Retorne em JSON: { "topics": ["string"] }`;

  const editalTopicsSchema = {
    type: Type.OBJECT,
    properties: {
      topics: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["topics"]
  };

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: editalTopicsPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: editalTopicsSchema
      }
    });
    return safeAIJsonParse(response.text);
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        return await tryJsonFallbacks(undefined, editalTopicsPrompt, toJsonSchema(editalTopicsSchema), 'edital_topics');
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em extractTopicsFromEdital:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};

const requestMicroThemeQuestions = async (topic: string, count: number, profile: StudyProfile, explanationStyle: ExplanationStyle, extraInstructions: string) => {
  const profileStyle = profile === 'CONCURSO'
    ? "Foco em lei seca, doutrina e jurisprudência nível concurso."
    : profile === 'FACULDADE'
    ? "Foco em pesquisas acadêmicas, teorias complexas e termos específicos de nível superior universitário."
    : "Foco em conceitos fundamentais do ENEM/Vestibular.";

  const microThemePrompt = `${getTimeContext()}
      Gere uma SESSÃO DE REVISÃO ESPAÇADA POR QUESTÕES (RECALL ATIVO) sobre o tópico "${topic}".
      ${profileStyle}

      REQUISITOS:
      - ${count} Questões inéditas, de alta qualidade para testar se o aluno realmente fixou o tópico na memória de longo prazo.
      - Múltipla escolha (A a D).
      - Linguagem direta e estimulante para o cérebro atípico (TDAH).

      INSTRUÇÕES PARA O MAPEAMENTO DA LÓGICA DAS QUESTÕES: ${explanationStyle}
      - No campo "explanation", explique detalhadamente por que a alternativa correta é a certa e por que as outras são incorretas, de forma didática e técnica.

      A Dica de Memorização ("memoryHint") DEVE ser um ensinamento de ALTO IMPACTO (Bizu de Elite TDAH) que esclarece o assunto de forma definitiva e profunda. Mostre um atalho mental ou uma analogia marcante que impeça o usuário de errar questões semelhantes no futuro.

      Abuse da formatação Markdown (negrito, bullet points, quebras de linha duplas) para deixar a leitura fácil e rápida. Profundidade 10/10.

      ${extraInstructions}

      Retorne em JSON:`;

  const microThemeSchema = {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        minItems: count,
        maxItems: count,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
            memoryHint: { type: Type.STRING }
          },
          required: ["question", "options", "correctAnswer", "explanation", "memoryHint"]
        }
      }
    },
    required: ["questions"]
  };

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: microThemePrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: microThemeSchema
      }
    });
    return safeAIJsonParse(response.text);
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        return await tryJsonFallbacks(undefined, microThemePrompt, toJsonSchema(microThemeSchema), 'micro_theme_validation');
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em generateMicroThemeValidation:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};

export const generateMicroThemeValidation = async (topic: string, profile: StudyProfile = 'VESTIBULAR', explanationStyle: ExplanationStyle = 'Seja técnico e objetivo na explicação.') => {
  try {
    const { questions, report } = await buildVerifiedQuestions({
      topic,
      count: 3,
      optionCount: 4,
      Type,
      judge: (prompt, schema, name) => withRateLimitRetry(() => judgeJson(prompt, schema, name)),
      generate: (count, extra) => withRateLimitRetry(() => requestMicroThemeQuestions(topic, count, profile, explanationStyle, extra)),
    });
    console.info('[revisao] auditoria:', report);
    if (questions.length === 0) {
      throw new AIError('Não consegui montar uma revisão confiável sobre esse assunto agora. Tente de novo em instantes.');
    }
    return { questions };
  } catch (error) {
    return handleAIError(error);
  }
};

export const explainStuckTopic = async (topic: string, profile: StudyProfile = 'VESTIBULAR') => {
  const stuckTopicPrompt = `${getTimeContext()}
      O estudante está travado no tópico "${topic}" (errou 3 vezes).
      Perfil: ${profile}.

      TAREFA:
      Explique este tema de uma forma COMPLETAMENTE NOVA e RADICALMENTE SIMPLES.
      - Use uma analogia inusitada.
      - Use bullet points.
      - Destaque o "Ponto de Confusão Comum" (onde as pessoas costumam errar).
      - Linguagem visual.

      Retorne em JSON:`;

  const stuckTopicSchema = {
    type: Type.OBJECT,
    properties: {
      newExplanation: { type: Type.STRING },
      analogy: { type: Type.STRING },
      commonMistake: { type: Type.STRING }
    },
    required: ["newExplanation", "analogy", "commonMistake"]
  };

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: stuckTopicPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: stuckTopicSchema
      }
    });
    return safeAIJsonParse(response.text);
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        return await tryJsonFallbacks(undefined, stuckTopicPrompt, toJsonSchema(stuckTopicSchema), 'stuck_topic_explanation');
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em explainStuckTopic:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};

export const optimizeStudyPlan = async (
  edital: EditalConfig,
  currentSubjects: StudySubject[],
  profile: StudyProfile = 'VESTIBULAR'
) => {
  const subjectsPrompt = edital.subjects.map(s => `- ${s.name} (ID: ${s.id}, Peso atual: ${currentSubjects.find(cs => cs.editalSubjectId === s.id)?.weight || 1})`).join('\n');
  const profileLabel = profile === 'CONCURSO' 
    ? 'Concursos de Elite' 
    : profile === 'FACULDADE' 
    ? 'Provas de Faculdade e Ensino Superior' 
    : 'Vestibular e ENEM';

  const studyPlanPrompt = `${getTimeContext()}
      Você é um estrategista de estudos para ${profileLabel}.

      ENTRADA:
      - Data da Prova: ${edital.examDate}
      - Carga Horária Diária: ${edital.dailyHours} horas
      - Matérias do Edital:
      ${subjectsPrompt}

      TAREFA:
      Gere um plano de estudos otimizado.
      1. Ajuste o peso ideal (1-5) para cada matéria vinculando ao ID do edital.
      2. Gere um cronograma (DaySchedule) para os próximos 15 dias, distribuindo as horas diárias entre as matérias.
      3. Para cada sessão de estudo, sugira 1 ou 2 tópicos específicos do edital (baseado nos topics[] de cada matéria) que o usuário deve focar naquela sessão.
      4. Dê um conselho estratégico curto.

      RESTRIÇÕES:
      - O total de minutos por dia deve respeitar ${edital.dailyHours * 60} min.
      - O cronograma deve ser uma lista de objetos com 'date' (YYYY-MM-DD) e 'sessions' (lista de {subjectId, subjectName, minutes, topics}).
      - Os topics em cada session devem vir da lista de tópicos reais da matéria no edital.

      Retorne em JSON:`;

  const studyPlanSchema = {
    type: Type.OBJECT,
    properties: {
      subjects: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            editalSubjectId: { type: Type.STRING },
            weight: { type: Type.NUMBER },
            targetMinutes: { type: Type.NUMBER }
          },
          required: ["editalSubjectId", "weight", "targetMinutes"]
        }
      },
      proposedSchedule: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            sessions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  subjectId: { type: Type.STRING },
                  subjectName: { type: Type.STRING },
                  minutes: { type: Type.NUMBER },
                  topics: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["subjectId", "subjectName", "minutes", "topics"]
              }
            }
          },
          required: ["date", "sessions"]
        }
      },
      advice: { type: Type.STRING }
    },
    required: ["subjects", "proposedSchedule", "advice"]
  };

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: studyPlanPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: studyPlanSchema
      }
    });
    return safeAIJsonParse(response.text);
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        return await tryJsonFallbacks(undefined, studyPlanPrompt, toJsonSchema(studyPlanSchema), 'study_plan');
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em optimizeStudyPlan:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};

export const identifyAndProgramRecovery = async (topic: string, missedQuestions: QuizQuestion[], profile: StudyProfile = 'VESTIBULAR', explanationStyle: ExplanationStyle = 'Seja técnico e objetivo na explicação.') => {
  const questionsData = missedQuestions.map(q => ({
    question: q.question,
    userAnswer: q.options[q.userAnswer ?? -1] || 'Não respondida',
    correctAnswer: q.options[q.correctAnswer],
    explanation: q.explanation
  }));

  const recoveryPrompt = `${getTimeContext()}
      O estudante está com dificuldade severa no tópico "${topic}".
      Abaixo estão as questões que ele errou recentemente:
      ${JSON.stringify(questionsData)}

      Perfil: ${profile}.

      TAREFA:
      1. DIAGNÓSTICO: Identifique o padrão de erro.
      2. PLANO DE RECUPERAÇÃO: Sugira 3 passos imediatos.
      3. QUESTÕES DE CONTRAGOLPE: Gere 3 novas questões focadas nos pontos de falha. Use RIGOROSAMENTE a seguinte instrução para o campo "explanation": ${explanationStyle}
      4. FLASHCARDS DE RESGATE: Gere 3 flashcards.

      A Dica de Memorização ("memoryHint") nas questões DEVE ser uma explicação de alta intensidade que ensine uma forma definitiva de NÃO ERRAR mais. Mostre ao cérebro do usuário o caminho mais lógico (ou absurdo) para que o conhecimento fique preso para sempre na memória. Use mnemônicos, gatilhos visuais, rimas ou histórias inesquecíveis.

      Abuse da formatação Markdown (negrito, bullet points, quebras de linha duplas) para deixar a leitura fácil e arejada.

      Retorne em JSON rigoroso. Profundidade 8/10. Objetivo: Erro Zero.`;

  const recoverySchema = {
    type: Type.OBJECT,
    properties: {
      diagnosis: { type: Type.STRING },
      recoverySteps: { type: Type.ARRAY, items: { type: Type.STRING } },
      recoveryQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
            memoryHint: { type: Type.STRING }
          },
          required: ["question", "options", "correctAnswer", "explanation", "memoryHint"]
        }
      },
      recoveryFlashcards: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            answer: { type: Type.STRING }
          },
          required: ["question", "answer"]
        }
      }
    },
    required: ["diagnosis", "recoverySteps", "recoveryQuestions", "recoveryFlashcards"]
  };

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: recoveryPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: recoverySchema
      }
    });
    return safeAIJsonParse(response.text);
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        return await tryJsonFallbacks(undefined, recoveryPrompt, toJsonSchema(recoverySchema), 'recovery_plan');
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em identifyAndProgramRecovery:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};

export const getProactiveAdvice = async (stats: any, edital: EditalConfig, profile: StudyProfile = 'VESTIBULAR') => {
  const context = {
    stats,
    editalHeat: edital.subjects.map(s => ({ name: s.name, heat: s.heat || 0 })),
    activeProfile: profile,
    timestamp: new Date().toISOString()
  };

  const proactiveAdvicePrompt = `${getTimeContext()}
      Você é o Mentor Peixe, o guia TDAH do estudante.
      Seja breve, encorajador e estratégico.
      Dados do estudante: ${JSON.stringify(context)}

      TAREFA:
      1. GREETING: Uma saudação curta baseada no horário atual.
      2. INSIGHT: Um comentário sobre o progresso (ex: "Sua barra de matemática está esfriando!" ou "Você está voando hoje!").
      3. TASK: Uma sugestão de 1 tarefa imediata.

      Retorne em JSON: { "greeting": string, "insight": string, "task": string, "taskView": string }
      Opções de taskView: HUB, TIMER, FLASHCARDS, MATERIALS, TDH_QUESTOES, AI_DIRECT, SMART_REVISION.`;

  const proactiveAdviceSchema = {
    type: Type.OBJECT,
    properties: {
      greeting: { type: Type.STRING },
      insight: { type: Type.STRING },
      task: { type: Type.STRING },
      taskView: { type: Type.STRING }
    },
    required: ["greeting", "insight", "task", "taskView"]
  };

  try {
    const response = await generateContentWithRetry({
      model: LITE_MODEL,
      contents: proactiveAdvicePrompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: proactiveAdviceSchema
      }
    });
    return safeAIJsonParse(response.text);
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        return await tryJsonFallbacks(undefined, proactiveAdvicePrompt, toJsonSchema(proactiveAdviceSchema), 'proactive_advice');
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em getProactiveAdvice:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};

export const getDailyBibleMotivation = async (): Promise<string> => {
  const DEFAULT_MOTIVATION = "Tudo posso naquele que me fortalece. - Reflexão: Confie no seu processo e mantenha a calma.";
  const bibleMotivationPrompt = `${getTimeContext()}
      Gere uma passagem curta e motivacional da Bíblia totalmente focada para um estudante com TDAH (foco, superação, ansiedade, perseverança).
      A linguagem deve ser inspiradora e focada no esforço, na superação e na esperança.
      Adicione uma reflexão rápida e pessoal de máximo 30 palavras para o estudante focar no dia de hoje.
      O formato deve ser: "Passagem (Capítulo:Versículo) - Reflexão curta."
      NÃO use emojis. NÃO use formatação com asteriscos.`;

  try {
    const response = await generateContentWithRetry({
      model: LITE_MODEL,
      contents: [
        { role: 'user', parts: [{ text: bibleMotivationPrompt }] }
      ],
    });
    return response.text?.trim() || DEFAULT_MOTIVATION;
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        const fallbackText = await tryTextFallbacks(undefined, [{ role: 'user', content: bibleMotivationPrompt }], 0.7);
        return fallbackText?.trim() || DEFAULT_MOTIVATION;
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em getDailyBibleMotivation:', fallbackError);
      }
    }
    console.error("Erro ao buscar motivação:", error);
    return DEFAULT_MOTIVATION;
  }
};

export const generateStudyCycle = async (edital: EditalConfig, totalCycleHours: number) => {
  const context = {
    subjects: edital.subjects.map(s => ({ 
      id: s.id, 
      name: s.name, 
      heat: s.heat, 
      topicsCount: s.topics.length 
    })),
    totalCycleHours
  };

  const studyCyclePrompt = `${getTimeContext()}
      Você é um Engenheiro de Aprendizagem Especialista em Ciclos de Estudo para TDAH.
      Sua tarefa é criar um CICLO DE ESTUDO OTIMIZADO baseado nos dados do edital abaixo.

      DADOS:
      ${JSON.stringify(context)}

      DIRETRIZES TDAH:
      1. Intercale matérias de naturezas diferentes (ex: Exatas -> Humanas).
      2. Sessões devem ter entre 45 e 120 minutos.
      3. Dê mais tempo para matérias com "heat" baixo (esfriando) ou muitos tópicos.
      4. O ciclo deve ser uma lista sequencial de passos que o aluno seguirá repetidamente.

      Retorne em JSON:
      {
        "steps": [
          { "subjectId": "string", "subjectName": "string", "durationMinutes": number }
        ]
      }`;

  const studyCycleSchema = {
    type: Type.OBJECT,
    properties: {
      steps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            subjectId: { type: Type.STRING },
            subjectName: { type: Type.STRING },
            durationMinutes: { type: Type.NUMBER }
          },
          required: ["subjectId", "subjectName", "durationMinutes"]
        }
      }
    },
    required: ["steps"]
  };

  try {
    const response = await generateContentWithRetry({
      model: LITE_MODEL,
      contents: studyCyclePrompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: studyCycleSchema
      }
    });
    return safeAIJsonParse(response.text);
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        return await tryJsonFallbacks(undefined, studyCyclePrompt, toJsonSchema(studyCycleSchema), 'study_cycle');
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em generateStudyCycle:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};

export const generateGuidedLesson = async (subject: string, topic: string, profile: StudyProfile = 'VESTIBULAR', explanationStyle: ExplanationStyle = 'Seja técnico e objetivo na explicação.') => {
  const profileContext = profile === 'CONCURSO' 
    ? "Foco em editais públicos, doutrina e lei seca. Linguagem técnica mas narrativa."
    : profile === 'FACULDADE'
    ? "Foco em disciplinas de nível superior/graduação acadêmica. Linguagem estruturada, reflexiva e cientificamente aprofundada."
    : "Foco em ENEM e grandes vestibulares. Linguagem didática e interdisciplinar.";

  const guidedLessonPrompt = `${getTimeContext()}
      Gere uma AULA GUIADA (Narrativa Contínua) sobre o tema "${topic}" da matéria "${subject}".
      ${profileContext}

      OBJETIVO: Conduzir o aluno em um fluxo de aprendizado imersivo para TDAH, sem exigir interação constante, mas mantendo o cérebro ativo através de uma narrativa.

      ESTRUTURA DA RESPOSTA (Sequência de Passos):
      1. OPENING: Começa direto, engajando o aluno com uma pergunta ou fato curioso. Sem botões.
      2. OVERVIEW: Um mapa mental rápido do que será visto.
      3. NARRATIVE: Desenvolve o tema através de uma história ou exemplo prático ("Imagina que...").
      4. CONCEPT: Insere explicações técnicas dentro da narrativa.
      5. QUESTION_PAUSE: Faz uma pergunta mental para ativar o recall ativo (ex: "Agora pense: o que acontece se...?"). A resposta NÃO deve estar neste bloco, mas no seguinte.
      6. REINFORCEMENT: Responde a pergunta anterior e reforça o ponto chave.
      7. ANALOGY: Usa uma associação forte (ex: VAR no futebol, receita de bolo).
      8. CLOSING_APPLICATION: Mostra como esse tema cai na prova.

      IMPORTANTE:
      - Divida em blocos pequenos e impactantes.
      - O fluxo deve ser lógico: História -> Conceito -> Pergunta -> Resposta -> Associação.
      - Em cada passo, inclua "keyPoints": de 1 a 3 trechos curtos copiados literalmente do próprio "content", escolhendo definições, regras, relações de causa e efeito ou conclusões essenciais. Não reescreva os trechos; se não houver um destaque útil, retorne um array vazio.
      - Não use emojis.

      Retorne em JSON rigoroso.`;

  const guidedLessonJsonSchema = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      topic: { type: 'string' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            content: { type: 'string' },
            keyPoints: { type: 'array', items: { type: 'string' } },
            pauseAfterMilliseconds: { type: 'number' },
          },
          required: ['type', 'content'],
        },
      },
    },
    required: ['id', 'topic', 'steps'],
  };

  // Guards against both known truncation shapes: Gemini stopping mid-JSON
  // once it hits its output cap, and a free OpenRouter model ending a step's
  // "content" mid-sentence despite valid JSON syntax (see looksTruncated).
  const validateGuidedLesson = (parsed: any): boolean => {
    const steps = parsed?.steps;
    if (!Array.isArray(steps) || steps.length < 6) return false;
    return steps.every((step: any) => typeof step?.content === 'string' && !looksTruncated(step.content));
  };

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: guidedLessonPrompt,
      config: {
        responseMimeType: "application/json",
        // 8 rich narrative steps routinely run longer than this SDK's default
        // output cap, which was silently truncating the JSON mid-generation —
        // safeAIJsonParse's salvage logic then returned a lesson with its
        // last step (or its "content" text) cut off instead of failing loudly.
        maxOutputTokens: 25000,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            topic: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  content: { type: Type.STRING },
                  keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  pauseAfterMilliseconds: { type: Type.NUMBER }
                },
                required: ["type", "content"]
              }
            }
          },
          required: ["id", "topic", "steps"]
        }
      }
    });
    const parsed = safeAIJsonParse(response.text);
    if (!validateGuidedLesson(parsed)) {
      throw new Error('GUIDED_LESSON_TRUNCATED');
    }
    return parsed;
  } catch (error: any) {
    const isTruncation = error?.message === 'GUIDED_LESSON_TRUNCATED';
    if (isTruncation || shouldTryProviderFallbacks(error)) {
      if (isTruncation) console.warn('[guided_lesson] Resposta do Gemini veio cortada, tentando fallback.');
      try {
        return await tryJsonFallbacks(undefined, guidedLessonPrompt, guidedLessonJsonSchema, 'guided_lesson', validateGuidedLesson);
      } catch (fallbackError) {
        console.error('Os fallbacks de IA também falharam em generateGuidedLesson:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    if (isTruncation) throw new AIError('A IA gerou uma aula incompleta. Tente novamente.');
    return handleAIError(error);
  }
};

// Local AI (Ollama). Only used when the app runs on this machine's
// localhost (dev), where the daemon at :11434 is reachable from the browser.
const OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_PREFERRED_MODELS = ['qwen3:4b-instruct-2507-q4_K_M', 'qwen3:4b'];
const OLLAMA_TIMEOUT_MS = 600000;

const findOllamaModel = async (): Promise<string | null> => {
  if (typeof window === 'undefined' || !['localhost', '127.0.0.1'].includes(window.location.hostname)) return null;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const names: string[] = ((await res.json())?.models ?? []).map((m: any) => m?.name).filter(Boolean);
    return OLLAMA_PREFERRED_MODELS.find((m) => names.includes(m)) ?? null;
  } catch {
    return null;
  }
};

const callOllamaJson = async (model: string, prompt: string, schema: any, validate: (parsed: any) => boolean): Promise<any> => {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      keep_alive: '10m',
      format: schema,
      messages: [{ role: 'user', content: prompt }],
      options: { temperature: 0.3, num_ctx: 8192, num_predict: 4500 },
    }),
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const text = (await res.json())?.message?.content;
  if (!text) throw new Error('Ollama retornou vazio');
  const parsed = safeAIJsonParse(text);
  if (!validate(parsed)) throw new Error('Ollama retornou conteúdo incompleto');
  console.info(`[living_lesson] Aula gerada pela IA local (${model}).`);
  return parsed;
};

export const generateLivingLesson = async (subject: string, topic: string, profile: StudyProfile = 'VESTIBULAR', explanationStyle: ExplanationStyle = 'Seja técnico e objetivo na explicação.') => {
  const sources = await gatherSources(subject, topic);
  const sourceBlock = sourcesPromptBlock(sources);
  const profileContext = profile === 'CONCURSO'
    ? "Foco em editais públicos, doutrina e lei seca. Linguagem técnica e objetiva."
    : profile === 'FACULDADE'
    ? "Foco em disciplinas de nível superior. Linguagem estruturada e cientificamente aprofundada."
    : "Foco em ENEM e grandes vestibulares. Linguagem didática e interdisciplinar.";

  const livingLessonPrompt = `${getTimeContext()}
      PEDIDO DO ALUNO (obrigatório, não mude): MATÉRIA = "${subject}"; ASSUNTO = "${topic}".
      Gere uma AULA VIVA exatamente sobre o ASSUNTO "${topic}" dentro da MATÉRIA "${subject}" (use o significado do assunto próprio dessa matéria), no formato de página ilustrada de livro/enciclopédia, dividida em exatamente 3 PÁGINAS. Nunca troque de assunto, nem trate de um tema vizinho.
      ${profileContext}
      Estilo de explicação pedido pelo aluno: ${explanationStyle}

      REGRAS GERAIS:
      - Todo o texto deve ser ORIGINAL, escrito por você em português do Brasil. Nunca copie trechos de livros ou materiais protegidos.
      - Cada parágrafo deve ter de 3 a 4 frases completas e informativas (nada de parágrafos de uma frase), com linguagem simples, pensados para quem tem TDAH.
      - Em datas use o formato brasileiro por extenso (ex.: "14 de julho de 1789" ou apenas o ano). Os "labels" do quadro "timeline" devem ser curtos (ano ou data curta).
      - Não use emojis. Não invente fatos, datas, leis, artigos ou autores: se não tiver certeza de um dado, não o inclua. Prefira MENOS itens (mínimo 3 por quadro) com dados corretos a mais itens com dados duvidosos. Nunca numere os itens dentro do texto (a numeração é automática).
      - "section" é o nome do capítulo ou área maior a que o tema pertence (ex.: "O Realismo no Brasil").
      - "seeAlso" lista de 3 a 5 temas relacionados da própria matéria.

      PÁGINA 1 (visão geral):
      - "lead": 2 a 3 frases que resumem o tema e despertam interesse.
      - "quote": por padrão, uma frase curta e original, escrita por você, com a ideia central do tema, com "author" igual a "Ideia central". Só use uma citação de terceiros se for literal, famosa, e você tiver certeza absoluta da obra e do autor (ex.: um verso ou trecho clássico em Literatura); nesse caso "author" no formato "Autor, Obra". Nunca atribua lemas, slogans ou frases a documentos, leis ou pessoas se não tiver certeza da fonte.
      - "boxes": exatamente 1 quadro do tipo "table" com 4 linhas (label curto + explicação de 1 frase), título curto.
      - "sections": 2 seções com "heading" curto e 2 parágrafos cada.

      PÁGINA 2 (aprofundamento):
      - "boxes": 1 quadro "steps" com 4 a 5 etapas (processo, sequência ou raciocínio do tema) e 1 quadro "timeline" com 4 a 5 marcos em ordem (datas reais; se o tema não tiver datas, use etapas ou conceitos em ordem lógica no campo label, curtos).
      - "sections": 1 seção com 2 parágrafos.
      - "profile": inclua APENAS se houver uma PESSOA central ao tema (autor, cientista, personagem histórica real) — nunca para leis, documentos, eventos ou conceitos. Campos: name (nome da pessoa), role (função em poucas palavras), bio de até 3 frases, works com 3 a 5 itens year+title (obras ou feitos reais e datados dessa pessoa). Se não houver uma pessoa central, omita "profile" por completo.

      PÁGINA 3 (revisão):
      - "boxes": 1 quadro "table" com título "Para fixar" e 4 linhas com os pontos essenciais.
      - "sections": 1 seção "Como cai em prova" com 2 parágrafos práticos para o perfil do aluno.

      Em páginas sem "lead" ou "quote", omita esses campos.
      ${sourceBlock}
      Retorne em JSON rigoroso.`;

  const boxGoogleSchema = {
    type: Type.OBJECT,
    properties: {
      kind: { type: Type.STRING },
      title: { type: Type.STRING },
      items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, text: { type: Type.STRING } }, required: ['label', 'text'] } },
    },
    required: ['kind', 'title', 'items'],
  };
  const livingLessonGoogleSchema = {
    type: Type.OBJECT,
    properties: {
      subject: { type: Type.STRING },
      topic: { type: Type.STRING },
      section: { type: Type.STRING },
      seeAlso: { type: Type.ARRAY, items: { type: Type.STRING } },
      pages: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            lead: { type: Type.STRING },
            quote: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, author: { type: Type.STRING } }, required: ['text', 'author'] },
            boxes: { type: Type.ARRAY, items: boxGoogleSchema },
            sections: {
              type: Type.ARRAY,
              items: { type: Type.OBJECT, properties: { heading: { type: Type.STRING }, paragraphs: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['heading', 'paragraphs'] },
            },
            profile: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                role: { type: Type.STRING },
                bio: { type: Type.STRING },
                works: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { year: { type: Type.STRING }, title: { type: Type.STRING } }, required: ['year', 'title'] } },
              },
              required: ['name', 'role', 'bio', 'works'],
            },
          },
          required: ['boxes', 'sections'],
        },
      },
    },
    required: ['subject', 'topic', 'section', 'seeAlso', 'pages'],
  };

  const validateLivingLesson = (parsed: any): boolean => {
    const fail = (reason: string) => {
      console.warn(`[living_lesson] resposta recusada: ${reason}`);
      return false;
    };
    const pages = parsed?.pages;
    if (!Array.isArray(pages) || pages.length < 2) return fail('menos de 2 páginas');
    if (!Array.isArray(parsed?.seeAlso)) return fail('sem seeAlso');
    const wanted = String(topic).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const haystack = JSON.stringify(pages).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (wanted.length > 0 && wanted.filter((w) => haystack.includes(w)).length < Math.ceil(wanted.length / 2)) return fail('fora do assunto pedido');
    for (const [i, page] of pages.entries()) {
      if (!Array.isArray(page?.sections) || page.sections.length === 0) return fail(`página ${i + 1} sem seções`);
      for (const sec of page.sections) {
        if (typeof sec?.heading !== 'string' || !Array.isArray(sec?.paragraphs) || sec.paragraphs.length === 0) return fail(`seção inválida na página ${i + 1}`);
        for (const para of sec.paragraphs) {
          if (typeof para !== 'string') return fail('parágrafo não é texto');
          if (para.length < 60) return fail(`parágrafo curto demais (${para.length} caracteres)`);
          if (looksTruncated(para)) return fail('parágrafo cortado no meio');
        }
      }
      if (!Array.isArray(page?.boxes)) return fail(`página ${i + 1} sem boxes`);
      for (const box of page.boxes) {
        if (!['table', 'steps', 'timeline'].includes(box?.kind) || !Array.isArray(box?.items) || box.items.length === 0) return fail(`quadro inválido na página ${i + 1}`);
        if (!box.items.every((it: any) => typeof it?.label === 'string' && typeof it?.text === 'string')) return fail('item de quadro sem label/text');
      }
    }
    return true;
  };

  const generateOnline = async (): Promise<IllustratedLesson> => {
    try {
      const response = await generateContentWithRetry({
        model: DEFAULT_MODEL,
        contents: livingLessonPrompt,
        config: { responseMimeType: 'application/json', maxOutputTokens: 25000, responseSchema: livingLessonGoogleSchema },
      });
      const parsed = safeAIJsonParse(response.text);
      if (!validateLivingLesson(parsed)) throw new Error('LIVING_LESSON_INVALID');
      return applySourceGuard({ ...parsed, subject, topic }, sources);
    } catch (error: any) {
      const isInvalid = error?.message === 'LIVING_LESSON_INVALID';
      if (isInvalid || shouldTryProviderFallbacks(error)) {
        try {
          const fallbackLesson = await tryJsonFallbacks(undefined, livingLessonPrompt, toJsonSchema(livingLessonGoogleSchema), 'living_lesson', validateLivingLesson);
          return applySourceGuard({ ...fallbackLesson, subject, topic }, sources);
        } catch (fallbackError) {
          console.error('Os fallbacks de IA também falharam em generateLivingLesson:', fallbackError);
          return handleAIError(fallbackError);
        }
      }
      return handleAIError(error);
    }
  };

  try {
    return await generateOnline();
  } catch (onlineError) {
    // Last resort: the local model, only when the app runs on this machine.
    const localModel = await findOllamaModel();
    if (!localModel) throw onlineError;
    try {
      const compactPrompt = `${livingLessonPrompt.replace(sourceBlock, sourcesPromptBlock(sources, 0.4))}
      MODO COMPACTO: parágrafos de 2 a 3 frases; quadros com no máximo 4 itens; no máximo 2 seções por página; não repita informações entre páginas.`;
      const local = await callOllamaJson(localModel, compactPrompt, toJsonSchema(livingLessonGoogleSchema), validateLivingLesson);
      console.warn(`[living_lesson] Provedores online falharam; aula gerada pela IA local (${localModel}).`);
      return applySourceGuard({ ...local, subject, topic }, sources);
    } catch (localError) {
      console.warn('[living_lesson] IA local também falhou:', localError);
      throw onlineError;
    }
  }
};

export const getQuickExplanation = async (topic: string, context?: string, profile: StudyProfile = 'VESTIBULAR') => {
  const systemInstruction = `Você é um tutor especializado em TDAH altamente didático e focado em reter atenção.
Seu objetivo é explicar o fragmento de texto ou o assunto fornecido de forma direta, clara, usando metáforas visuais, bullet points e o mínimo de enrolação possível.`;
  const quickExplanationPrompt = `Assunto: ${topic}\n\nContexto Adicional: ${context || 'Nenhum'}\n\nPor favor, explique isso de forma concisa e direta para um estudante com foco no perfil ${profile}. Use formatação Markdown.`;

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: quickExplanationPrompt,
      config: {
        systemInstruction,
        temperature: 0.5,
      }
    });
    return response.text || "Sem resposta da IA.";
  } catch (error) {
    if (shouldTryProviderFallbacks(error)) {
      try {
        return await tryTextFallbacks(systemInstruction, [{ role: 'user', content: quickExplanationPrompt }], 0.5);
      } catch (fallbackError) {
        console.error('Fallback OpenRouter também falhou em getQuickExplanation:', fallbackError);
        return handleAIError(fallbackError);
      }
    }
    return handleAIError(error);
  }
};
