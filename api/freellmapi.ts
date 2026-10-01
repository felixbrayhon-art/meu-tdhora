import type { IncomingMessage, ServerResponse } from 'node:http';
import firebaseConfig from '../firebase-applet-config.json';

type ApiRequest = IncomingMessage & { body?: unknown };

const MAX_BODY_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 45_000;

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
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const verifyFirebaseToken = async (idToken: string): Promise<string | null> => {
  const apiKey = process.env.FIREBASE_API_KEY || firebaseConfig.apiKey;
  const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(lookupUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) return null;
  const data = await response.json() as { users?: Array<{ localId?: string }> };
  return data.users?.[0]?.localId || null;
};

const getFreeLLMAPIEndpoint = (): URL | null => {
  const configuredUrl = process.env.FREELLMAPI_BASE_URL?.trim();
  if (!configuredUrl) return null;

  const baseUrl = new URL(configuredUrl);
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname);
  if (baseUrl.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && isLoopback && baseUrl.protocol === 'http:')) {
    throw new Error('FREELLMAPI_BASE_URL precisa usar HTTPS em produção.');
  }

  baseUrl.search = '';
  baseUrl.hash = '';
  const basePath = baseUrl.pathname.replace(/\/+$/, '');
  baseUrl.pathname = `${basePath}${basePath.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
  return baseUrl;
};

const normalizeRequest = (input: unknown): Record<string, unknown> | null => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const body = input as Record<string, any>;
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 100) return null;

  const messages = body.messages.map((message: any) => {
    if (!message || !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return null;
    return { role: message.role, content: message.content };
  });
  if (messages.some((message: unknown) => message === null)) return null;

  const normalized: Record<string, unknown> = {
    model: process.env.FREELLMAPI_MODEL?.trim() || 'auto',
    messages,
  };

  if (typeof body.temperature === 'number' && Number.isFinite(body.temperature)) {
    normalized.temperature = Math.max(0, Math.min(2, body.temperature));
  }
  if (typeof body.max_tokens === 'number' && Number.isFinite(body.max_tokens)) {
    normalized.max_tokens = Math.max(1, Math.min(24_000, Math.floor(body.max_tokens)));
  }
  if (body.response_format && typeof body.response_format === 'object' &&
      ['json_schema', 'json_object'].includes(body.response_format.type)) {
    normalized.response_format = body.response_format;
  }

  return normalized;
};

export const handleFreeLLMAPIRequest = async (request: ApiRequest, response: ServerResponse) => {
  if (request.method === 'GET') {
    let enabled = false;
    try {
      const endpoint = getFreeLLMAPIEndpoint();
      const apiKey = process.env.FREELLMAPI_API_KEY?.trim();
      const allowedUids = (process.env.FREELLMAPI_ALLOWED_UIDS || '').split(',').map((uid) => uid.trim()).filter(Boolean);
      enabled = !!endpoint && !!apiKey && allowedUids.length > 0;
    } catch {
      enabled = false;
    }
    response.setHeader('Cache-Control', 'no-store');
    return sendJson(response, 200, { enabled });
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Método não permitido.' });
  }

  const apiKey = process.env.FREELLMAPI_API_KEY?.trim();
  const allowedUids = (process.env.FREELLMAPI_ALLOWED_UIDS || '').split(',').map((uid) => uid.trim()).filter(Boolean);
  let endpoint: URL | null;
  try {
    endpoint = getFreeLLMAPIEndpoint();
  } catch (error) {
    console.error('[FreeLLMAPI] Configuração inválida:', error instanceof Error ? error.message : 'erro');
    return sendJson(response, 503, { error: 'A configuração do FreeLLMAPI está inválida.' });
  }
  if (!endpoint || !apiKey || allowedUids.length === 0) {
    return sendJson(response, 503, { error: 'O FreeLLMAPI ainda não foi configurado no servidor.' });
  }

  const idToken = getAuthorizationToken(request);
  if (!idToken) return sendJson(response, 401, { error: 'Entre na sua conta para usar este provedor de IA.' });

  try {
    const uid = await verifyFirebaseToken(idToken);
    if (!uid) {
      return sendJson(response, 401, { error: 'Sua sessão expirou. Entre novamente para continuar.' });
    }
    if (!allowedUids.includes(uid)) {
      return sendJson(response, 403, { error: 'Este provedor adicional não está habilitado para esta conta.' });
    }
  } catch (error) {
    console.error('[FreeLLMAPI] Não foi possível validar a sessão Firebase.');
    return sendJson(response, 503, { error: 'Não foi possível validar sua sessão agora.' });
  }

  let rawBody: unknown;
  try {
    rawBody = await readBody(request);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE';
    return sendJson(response, tooLarge ? 413 : 400, { error: tooLarge ? 'A solicitação excede o limite permitido.' : 'Não foi possível ler a solicitação.' });
  }

  if (Buffer.byteLength(JSON.stringify(rawBody) || '', 'utf8') > MAX_BODY_BYTES) {
    return sendJson(response, 413, { error: 'A solicitação excede o limite permitido.' });
  }

  const body = normalizeRequest(rawBody);
  if (!body) return sendJson(response, 400, { error: 'A solicitação de conversa está inválida.' });

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const responseText = await upstream.text();
    response.statusCode = upstream.status;
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    const routedVia = upstream.headers.get('x-routed-via');
    if (routedVia) response.setHeader('X-Routed-Via', routedVia);
    return response.end(responseText);
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    console.warn(`[FreeLLMAPI] Falha ao encaminhar solicitação${timedOut ? ' (timeout)' : ''}.`);
    return sendJson(response, timedOut ? 504 : 502, { error: timedOut ? 'O FreeLLMAPI demorou demais para responder.' : 'Não foi possível conectar ao FreeLLMAPI.' });
  }
};

export default handleFreeLLMAPIRequest;
