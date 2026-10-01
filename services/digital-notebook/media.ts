import { createPage, type DigitalNotebook, type NotePage } from './model';
import { loadImage, renderPage } from './render';

export const MAX_PAGES = 60;
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

export async function importDocument(file: File, remainingPages: number, progress: (message: string) => void): Promise<NotePage[]> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('Escolha um arquivo de até 25 MB.');
  if (remainingPages < 1) throw new Error(`Cada caderno pode ter até ${MAX_PAGES} páginas. Crie outro caderno para continuar.`);
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const pdfjs = await import('pdfjs-dist');
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const assets = `${import.meta.env.BASE_URL}pdfjs/`;
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: `${assets}cmaps/`, cMapPacked: true,
      standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`,
    });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > remainingPages) throw new Error(`Este PDF tem ${pdf.numPages} páginas. Há espaço para ${remainingPages} neste caderno; divida o PDF ou crie outro caderno.`);
      const pages: NotePage[] = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        progress(`Importando página ${number} de ${pdf.numPages}…`);
        const pdfPage = await pdf.getPage(number);
        const natural = pdfPage.getViewport({ scale: 1 });
        const scale = 1123 / Math.max(natural.width, natural.height);
        const view = pdfPage.getViewport({ scale: scale * 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(view.width);
        canvas.height = Math.ceil(view.height);
        await pdfPage.render({ canvas, viewport: view }).promise;
        pages.push({ ...createPage('plain'), width: natural.width * scale, height: natural.height * scale,
          background: canvas.toDataURL('image/png'), sourceName: `${file.name} · ${number}` });
        canvas.width = canvas.height = 0;
        pdfPage.cleanup();
      }
      return pages;
    } catch (error) {
      if (error instanceof Error && error.name === 'PasswordException') throw new Error('Este PDF tem senha. Importe uma cópia desbloqueada.');
      throw error;
    } finally {
      await task.destroy();
    }
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Escolha um PDF ou uma imagem PNG, JPG ou WebP.');
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, 1685 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível importar a imagem.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pageScale = 1123 / Math.max(canvas.width, canvas.height);
    return [{ ...createPage('plain'), width: canvas.width * pageScale, height: canvas.height * pageScale,
      background: canvas.toDataURL('image/png'), sourceName: file.name }];
  } finally { URL.revokeObjectURL(url); }
}

function filename(title: string) { return (title.trim() || 'caderno').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 100); }
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function exportPdf(notebook: DigitalNotebook, progress: (message: string) => void) {
  const { jsPDF } = await import('jspdf');
  const first = notebook.pages[0];
  const pdf = new jsPDF({ unit: 'pt', format: [first.width, first.height], orientation: first.width > first.height ? 'landscape' : 'portrait', compress: true });
  for (let i = 0; i < notebook.pages.length; i++) {
    progress(`Exportando página ${i + 1} de ${notebook.pages.length}…`);
    const page = notebook.pages[i];
    if (i > 0) pdf.addPage([page.width, page.height], page.width > page.height ? 'landscape' : 'portrait');
    const canvas = await renderPage(page);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, page.width, page.height);
    canvas.width = canvas.height = 0;
  }
  downloadBlob(pdf.output('blob'), `${filename(notebook.title)}.pdf`);
}

export function exportBackup(notebook: DigitalNotebook) {
  // Account identifiers are deliberately excluded from portable files.
  const { owner, ...content } = notebook;
  downloadBlob(new Blob([JSON.stringify({ format: 'tdhora-notebook', version: 1, notebook: content })], { type: 'application/json' }), `${filename(notebook.title)}.tdnote`);
}

export async function importBackup(file: File, owner: string): Promise<DigitalNotebook> {
  if (file.size > 100 * 1024 * 1024) throw new Error('O backup deve ter até 100 MB.');
  const data = JSON.parse(await file.text());
  const note = data?.notebook;
  const finite = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max;
  const invalid = () => { throw new Error('Este arquivo não é um backup válido do Caderno Digital.'); };
  if (data?.format !== 'tdhora-notebook' || data.version !== 1 || !note || typeof note.title !== 'string' || !Array.isArray(note.pages) || !note.pages.length || note.pages.length > MAX_PAGES) invalid();
  const pages = note.pages.map((page: NotePage) => {
    if (!page || !finite(page.width, 2000) || page.width < 1 || !finite(page.height, 2000) || page.height < 1 ||
      !['plain', 'ruled', 'grid', 'dots'].includes(page.paper) || !Array.isArray(page.elements) || page.elements.length > 50000 ||
      (page.background !== undefined && (typeof page.background !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(page.background)))) invalid();
    const elements = page.elements.map(element => {
      if (!element || !['pen', 'highlighter', 'line', 'rectangle', 'ellipse', 'text'].includes(element.tool) ||
        typeof element.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(element.color) || !finite(element.width, 100) || element.width <= 0 ||
        !Array.isArray(element.points) || !element.points.length || element.points.length > 100000 ||
        element.points.some(p => !p || !finite(p.x, 10000) || !finite(p.y, 10000) || !finite(p.pressure, 1) || p.pressure < 0) ||
        (element.text !== undefined && (typeof element.text !== 'string' || element.text.length > 10000))) invalid();
      return { id: crypto.randomUUID(), tool: element.tool, color: element.color, width: element.width, points: element.points.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })), ...(element.text !== undefined ? { text: element.text } : {}) };
    });
    return { id: crypto.randomUUID(), width: page.width, height: page.height, paper: page.paper, elements,
      ...(page.background ? { background: page.background } : {}), ...(typeof page.sourceName === 'string' ? { sourceName: page.sourceName.slice(0, 300) } : {}) };
  });
  return { id: crypto.randomUUID(), owner, title: note.title.slice(0, 120), createdAt: Date.now(), updatedAt: Date.now(), pages };
}
