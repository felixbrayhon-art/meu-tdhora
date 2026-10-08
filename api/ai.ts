import type { IncomingMessage, ServerResponse } from 'node:http';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

// Server-side gateway for Groq and OpenRouter. The provider keys live only in
// server environment variables (GROQ_API_KEY, OPENROUTER_API_KEY — never with a
// VITE_ prefix) so they are not shipped in the public JavaScript. Callers must
// be signed in, or be a visitor using the app from its own origin within a rate limit;
// on a local dev machine (non-production, loopback host) both checks are skipped.

type ApiRequest = IncomingMessage & { body?: unknown };
type Provider = 'groq' | 'openrouter';

const MAX_BODY_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 55_000;
// Some Vercel API-route type environments expose the one-argument fetch overload.
// Keep the standard RequestInit call explicit so local and Vercel checks agree.
const fetchWithOptions = globalThis.fetch as unknown as (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const PROVIDERS: Record<Provider, { url: string; envKey: string; allowModel: (model: string) => boolean }> = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
    allowModel: (model) => ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'].includes(model),
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    envKey: 'OPENROUTER_API_KEY',
    // Free models only, so a caller can never pick a paid model on the owner's account.
    allowModel: (model) => /^[\w.-]+\/[\w.:-]+:free$/.test(model) && model.length <= 80,
  },
};

const sendJson = (response: ServerResponse, status: number, body: Record<string, unknown>) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
};

const readBody = async (request: ApiRequest): Promise<unknown> => {
  if (request.body !== undefined) return request.body;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(buffer);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : null;
};

const getAuthorizationToken = (request: ApiRequest): string | null => {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return null;
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
};

const verifyFirebaseToken = async (idToken: string): Promise<string | null> => {
  const apiKey = process.env.FIREBASE_API_KEY || firebaseConfig.apiKey;
  const response = await fetchWithOptions(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const data = await response.json() as { users?: Array<{ localId?: string }> };
  return data.users?.[0]?.localId || null;
};

const isLocalDev = (request: ApiRequest): boolean => {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) return false;
  const host = String(request.headers.host || '').split(':')[0];
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
};


// Best-effort guardrails for visitors. A serverless instance keeps this in memory, so it is a speed bump
// rather than a hard quota: signed-in users are the fully protected path.
const GUEST_WINDOW_MS = 10 * 60 * 1000;
const GUEST_MAX_REQUESTS = 60;
const guestHits = new Map<string, { count: number; resetAt: number }>();

const clientIp = (request: ApiRequest): string => {
  const forwarded = request.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || request.socket?.remoteAddress || 'unknown';
};

const allowGuest = (request: ApiRequest): boolean => {
  const now = Date.now();
  if (guestHits.size > 5000) for (const [key, hit] of guestHits) if (hit.resetAt < now) guestHits.delete(key);
  const key = clientIp(request);
  const hit = guestHits.get(key);
  if (!hit || hit.resetAt < now) {
    guestHits.set(key, { count: 1, resetAt: now + GUEST_WINDOW_MS });
    return true;
  }
  hit.count += 1;
  return hit.count <= GUEST_MAX_REQUESTS;
};

// Browsers always send Origin on a cross-site or same-site POST; it must match the host serving the app.
const isSameOrigin = (request: ApiRequest): boolean => {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (typeof origin !== 'string' || typeof host !== 'string') return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

const providerFromUrl = (request: ApiRequest): Provider | null => {
  try {
    const value = new URL(request.url || '', 'http://localhost').searchParams.get('provider');
    return value === 'groq' || value === 'openrouter' ? value : null;
  } catch {
    return null;
  }
};

const isConfigured = (provider: Provider): boolean => !!process.env[PROVIDERS[provider].envKey]?.trim();

const normalizeRequest = (provider: Provider, input: unknown): Record<string, unknown> | null => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const body = input as Record<string, any>;
  if (typeof body.model !== 'string' || !PROVIDERS[provider].allowModel(body.model)) return null;
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 100) return null;

  const messages = body.messages.map((message: any) => {
    if (!message || !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return null;
    return { role: message.role, content: message.content };
  });
  if (messages.some((message: unknown) => message === null)) return null;

  const normalized: Record<string, unknown> = { model: body.model, messages };
  if (typeof body.temperature === 'number' && Number.isFinite(body.temperature)) {
    normalized.temperature = Math.max(0, Math.min(2, body.temperature));
  }
  const requestedCompletionTokens = body.max_completion_tokens ?? body.max_tokens;
  if (typeof requestedCompletionTokens === 'number' && Number.isFinite(requestedCompletionTokens)) {
    const maxCompletionTokens = Math.max(1, Math.min(24_000, Math.floor(requestedCompletionTokens)));
    if (provider === 'groq') normalized.max_completion_tokens = maxCompletionTokens;
    else normalized.max_tokens = maxCompletionTokens;
  }
  if (body.response_format && typeof body.response_format === 'object' &&
      ['json_schema', 'json_object'].includes(body.response_format.type)) {
    normalized.response_format = body.response_format;
  }
  if (provider === 'openrouter' && body.reasoning && typeof body.reasoning === 'object' && typeof body.reasoning.enabled === 'boolean') {
    normalized.reasoning = { enabled: body.reasoning.enabled };
  }
  if (provider === 'groq' && ['low', 'medium', 'high'].includes(body.reasoning_effort)) {
    normalized.reasoning_effort = body.reasoning_effort;
  }
  if (provider === 'groq' && typeof body.include_reasoning === 'boolean') {
    normalized.include_reasoning = body.include_reasoning;
  }
  return normalized;
};

export const handleAIRequest = async (request: ApiRequest, response: ServerResponse) => {
  if (request.method === 'GET') {
    // Which providers are set up on the server (no secrets, just booleans).
    return sendJson(response, 200, { groq: isConfigured('groq'), openrouter: isConfigured('openrouter') });
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return sendJson(response, 405, { error: 'Método não permitido.' });
  }

  const provider = providerFromUrl(request);
  if (!provider) return sendJson(response, 400, { error: 'Provedor inválido.' });
  const apiKey = process.env[PROVIDERS[provider].envKey]?.trim();
  if (!apiKey) return sendJson(response, 503, { error: 'Este provedor de IA ainda não foi configurado no servidor.' });

  if (!isLocalDev(request)) {
    const idToken = getAuthorizationToken(request);
    if (idToken) {
      // Signed-in users: the Firebase token must be valid.
      try {
        if (!(await verifyFirebaseToken(idToken))) {
          return sendJson(response, 401, { error: 'Sua sessão expirou. Entre novamente para continuar.' });
        }
      } catch {
        return sendJson(response, 503, { error: 'Não foi possível validar sua sessão agora.' });
      }
    } else {
      // Visitors (no login) can still use the app, as before, but only from the app itself and within a rate limit.
      if (!isSameOrigin(request)) return sendJson(response, 403, { error: 'Origem não permitida.' });
      if (!allowGuest(request)) {
        response.setHeader('Retry-After', String(Math.ceil(GUEST_WINDOW_MS / 1000)));
        return sendJson(response, 429, { error: 'Muitos pedidos em pouco tempo. Tente de novo em alguns minutos.' });
      }
    }
  }

  let rawBody: unknown;
  try {
    rawBody = await readBody(request);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE';
    return sendJson(response, tooLarge ? 413 : 400, { error: tooLarge ? 'A solicitação excede o limite permitido.' : 'Não foi possível ler a solicitação.' });
  }
  const body = normalizeRequest(provider, rawBody);
  if (!body) return sendJson(response, 400, { error: 'A solicitação está inválida.' });

  const upstreamController = new AbortController();
  const abortForDisconnect = () => {
    if (!response.writableEnded && !upstreamController.signal.aborted) {
      upstreamController.abort(new DOMException('Cliente desconectado.', 'AbortError'));
    }
  };
  const timeout = setTimeout(() => {
    if (!upstreamController.signal.aborted) {
      upstreamController.abort(new DOMException('Tempo limite do provedor excedido.', 'TimeoutError'));
    }
  }, REQUEST_TIMEOUT_MS);
  const onResponseClose = () => { if (!response.writableEnded) abortForDisconnect(); };
  request.once('aborted', abortForDisconnect);
  response.once('close', onResponseClose);

  try {
    const upstream = await fetchWithOptions(PROVIDERS[provider].url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: upstreamController.signal,
    });
    const responseText = await upstream.text();
    response.statusCode = upstream.status;
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    return response.end(responseText);
  } catch (error) {
    const timedOut = upstreamController.signal.reason?.name === 'TimeoutError' || (error instanceof Error && error.name === 'TimeoutError');
    if (response.destroyed || response.writableEnded || upstreamController.signal.reason?.name === 'AbortError') return;
    console.warn(`[ai:${provider}] Falha ao encaminhar solicitação${timedOut ? ' (timeout)' : ''}.`);
    return sendJson(response, timedOut ? 504 : 502, { error: timedOut ? 'O provedor demorou demais para responder.' : 'Não foi possível conectar ao provedor.' });
  } finally {
    clearTimeout(timeout);
    request.removeListener('aborted', abortForDisconnect);
    response.removeListener('close', onResponseClose);
  }
};

export default handleAIRequest;
