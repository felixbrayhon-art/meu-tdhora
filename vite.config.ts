import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleFreeLLMAPIRequest } from './api/freellmapi';
import { handleAIRequest } from './api/ai';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, '');
    // FreeLLMAPI credentials stay in the server process (api/freellmapi.ts); the browser only gets a flag.
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


    // Modo offline: injeta no service worker a lista dos arquivos gerados pelo build.
    const offlineManifest: Plugin = {
      name: 'offline-manifest',
      apply: 'build',
      closeBundle() {
        const dist = path.resolve(__dirname, 'dist');
        const swPath = path.join(dist, 'sw.js');
        if (!fs.existsSync(swPath)) return;
        const files: string[] = [];
        const walk = (dir: string) => {
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (/\.(js|css|woff2?)$/.test(e.name)) files.push('/' + path.relative(dist, full).split(path.sep).join('/'));
          }
        };
        if (fs.existsSync(path.join(dist, 'assets'))) walk(path.join(dist, 'assets'));
        const build = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
        const sw = fs.readFileSync(swPath, 'utf8').replace('__PRECACHE__', JSON.stringify(files)).replace('__BUILD__', build);
        fs.writeFileSync(swPath, sw);
      },
    };

    return {
      root: __dirname,
      server: {
        port: 3000,
        host: '127.0.0.1',
      },
      plugins: [react(), tailwindcss(), freellmapiDevProxy, aiDevProxy, offlineManifest],
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
        'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || env.GEMINI_API_KEY),
        'process.env.API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
        'process.env.FREELLMAPI_ENABLED': JSON.stringify(Boolean(freellmapiBaseUrl && freellmapiApiKey && freellmapiAllowedUids.trim())),
        'process.env.OPENROUTER_ENABLED': JSON.stringify(Boolean(openrouterKey)),
        'process.env.GROQ_ENABLED': JSON.stringify(Boolean(groqKey)),
        __BUILD_STAMP__: JSON.stringify(new Date().toISOString()),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // O motor do FineNotes (vendor/finenotes) importa "obsidian"; no navegador isso é a camada de compatibilidade abaixo.
          obsidian: path.resolve(__dirname, 'vendor/finenotes-shim/obsidian.ts'),
        }
      }
    };
});
