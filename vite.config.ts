import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleFreeLLMAPIRequest } from './api/freellmapi';
import { handleAIRequest } from './api/ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, '');
    // Temporary browser-side FreeLLMAPI credentials. This intentionally exposes
    // the key in the built JavaScript until the gateway is moved to a hosted
    // server-side integration.
    const freellmapiBaseUrl = process.env.FREELLMAPI_BASE_URL || env.FREELLMAPI_BASE_URL || '';
    const freellmapiApiKey = process.env.FREELLMAPI_API_KEY || env.FREELLMAPI_API_KEY || '';
    const freellmapiAllowedUids = process.env.FREELLMAPI_ALLOWED_UIDS || env.FREELLMAPI_ALLOWED_UIDS || '';
    const freellmapiModel = process.env.FREELLMAPI_MODEL || env.FREELLMAPI_MODEL || 'auto';
    if (freellmapiBaseUrl) process.env.FREELLMAPI_BASE_URL = freellmapiBaseUrl;
    if (freellmapiApiKey) process.env.FREELLMAPI_API_KEY = freellmapiApiKey;
    if (freellmapiAllowedUids) process.env.FREELLMAPI_ALLOWED_UIDS = freellmapiAllowedUids;
    if (freellmapiModel) process.env.FREELLMAPI_MODEL = freellmapiModel;

    // Groq / OpenRouter keys stay in the server process (api/ai.ts). The browser only gets booleans.
    const groqKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || '';
    const openrouterKey = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || env.VITE_OPENROUTER_API_KEY || '';
    if (groqKey) process.env.GROQ_API_KEY = groqKey;
    if (openrouterKey) process.env.OPENROUTER_API_KEY = openrouterKey;

    const aiDevProxy: Plugin = {
      name: 'ai-dev-proxy',
      configureServer(server) {
        server.middlewares.use('/api/ai', (request, response, next) => {
          void handleAIRequest(request, response).catch(next);
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use('/api/ai', (request, response, next) => {
          void handleAIRequest(request, response).catch(next);
        });
      },
    };

    const freellmapiDevProxy: Plugin = {
      name: 'freellmapi-dev-proxy',
      configureServer(server) {
        server.middlewares.use('/api/freellmapi', (request, response, next) => {
          void handleFreeLLMAPIRequest(request, response).catch(next);
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use('/api/freellmapi', (request, response, next) => {
          void handleFreeLLMAPIRequest(request, response).catch(next);
        });
      },
    };

    return {
      root: __dirname,
      server: {
        port: 3000,
        host: '127.0.0.1',
      },
      plugins: [react(), tailwindcss(), freellmapiDevProxy, aiDevProxy],
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
        'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || env.GEMINI_API_KEY),
        'process.env.API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
        'process.env.OPENROUTER_ENABLED': JSON.stringify(Boolean(openrouterKey)),
        'process.env.GROQ_ENABLED': JSON.stringify(Boolean(groqKey)),
        __BUILD_STAMP__: JSON.stringify(new Date().toISOString()),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
