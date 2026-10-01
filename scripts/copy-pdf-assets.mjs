import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Serve PDF fonts, CMaps and decoders locally in development and production.
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
  const destination = new URL(`../public/pdfjs/${directory}`, import.meta.url);
  mkdirSync(destination, { recursive: true });
  cpSync(fileURLToPath(new URL(`../node_modules/pdfjs-dist/${directory}`, import.meta.url)), fileURLToPath(destination), { recursive: true });
}
