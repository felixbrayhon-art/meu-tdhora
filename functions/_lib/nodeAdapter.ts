import { EventEmitter } from 'node:events';
import { Buffer } from 'node:buffer';
import process from 'node:process';

// Runs the Node-style API handlers in api/ (written for Vercel's req/res) on Cloudflare
// Pages Functions, so both hosts share one implementation of each endpoint.

type NodeHandler = (request: any, response: any) => unknown;

interface PagesContext {
  request: Request;
  env: Record<string, unknown>;
}

class AdaptedRequest extends EventEmitter {
  method: string;
  url: string;
  headers: Record<string, string>;
  socket: { remoteAddress?: string };
  private raw: Uint8Array;

  constructor(request: Request, raw: Uint8Array) {
    super();
    const url = new URL(request.url);
    this.method = request.method;
    this.url = url.pathname + url.search;
    this.headers = {};
    request.headers.forEach((value, key) => { this.headers[key.toLowerCase()] = value; });
    this.headers.host ??= url.host;
    const ip = request.headers.get('cf-connecting-ip') || undefined;
    if (ip && !this.headers['x-forwarded-for']) this.headers['x-forwarded-for'] = ip;
    this.socket = { remoteAddress: ip };
    this.raw = raw;
  }

  async *[Symbol.asyncIterator]() {
    if (this.raw.byteLength) yield Buffer.from(this.raw);
  }
}

class AdaptedResponse extends EventEmitter {
  statusCode = 200;
  writableEnded = false;
  destroyed = false;
  private headers = new Headers();
  private resolve!: (response: Response) => void;
  readonly done = new Promise<Response>((resolve) => { this.resolve = resolve; });

  setHeader(name: string, value: string | number | string[]) {
    this.headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
  }

  end(body?: string) {
    if (this.writableEnded) return;
    this.writableEnded = true;
    this.resolve(new Response(body ?? null, { status: this.statusCode, headers: this.headers }));
    this.emit('finish');
  }
}

export const runNodeHandler = async (handler: NodeHandler, context: PagesContext): Promise<Response> => {
  // Secrets and settings from the Cloudflare dashboard become process.env, as on Vercel.
  for (const [key, value] of Object.entries(context.env)) {
    if (typeof value === 'string') process.env[key] = value;
  }
  const raw = ['GET', 'HEAD'].includes(context.request.method)
    ? new Uint8Array()
    : new Uint8Array(await context.request.arrayBuffer());
  const request = new AdaptedRequest(context.request, raw);
  const response = new AdaptedResponse();
  try {
    await handler(request, response);
  } catch (error) {
    console.error('[pages-function] handler error', error);
    if (!response.writableEnded) {
      response.statusCode = 500;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: 'Erro interno.' }));
    }
  }
  if (!response.writableEnded) response.end();
  return response.done;
};
