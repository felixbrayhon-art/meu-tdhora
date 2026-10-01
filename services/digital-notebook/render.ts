import type { InkElement, NotePage } from './model';

export function drawElement(ctx: CanvasRenderingContext2D, element: InkElement) {
  const first = element.points[0];
  const last = element.points[element.points.length - 1];
  if (!first || !last) return;
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = element.color;
  ctx.lineWidth = element.width;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.globalAlpha = element.tool === 'highlighter' ? 0.3 : 1;
  ctx.beginPath();
  if (element.tool === 'text') {
    const size = Math.max(16, element.width * 5);
    ctx.font = `${size}px sans-serif`;
    ctx.textBaseline = 'top';
    (element.text || '').split('\n').forEach((line, index) => ctx.fillText(line, first.x, first.y + index * size * 1.3));
  } else if (element.tool === 'rectangle') {
    ctx.strokeRect(first.x, first.y, last.x - first.x, last.y - first.y);
  } else if (element.tool === 'ellipse') {
    ctx.ellipse((first.x + last.x) / 2, (first.y + last.y) / 2, Math.abs(last.x - first.x) / 2, Math.abs(last.y - first.y) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (element.tool === 'pen') {
    // A filled dot preserves taps; rounded segments reflect stylus pressure.
    ctx.arc(first.x, first.y, element.width * (0.35 + first.pressure) / 2, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 1; i < element.points.length; i++) {
      const previous = element.points[i - 1];
      const point = element.points[i];
      ctx.beginPath();
      ctx.lineWidth = element.width * (0.35 + (point.pressure + previous.pressure) / 2);
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  } else if (element.points.length === 1) {
    ctx.arc(first.x, first.y, element.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(first.x, first.y);
    if (element.tool === 'line') ctx.lineTo(last.x, last.y);
    else element.points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPaper(ctx: CanvasRenderingContext2D, page: NotePage) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, page.width, page.height);
  if (page.paper === 'plain') return;
  ctx.strokeStyle = '#dce6f1';
  ctx.fillStyle = '#b8cadd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const step = 28;
  if (page.paper === 'dots') {
    for (let x = step; x < page.width; x += step) for (let y = step; y < page.height; y += step) {
      ctx.moveTo(x + 1.3, y); ctx.arc(x, y, 1.3, 0, Math.PI * 2);
    }
    ctx.fill();
    return;
  }
  for (let y = step; y < page.height; y += step) { ctx.moveTo(0, y); ctx.lineTo(page.width, y); }
  if (page.paper === 'grid') for (let x = step; x < page.width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, page.height); }
  ctx.stroke();
  if (page.paper === 'ruled') {
    ctx.strokeStyle = '#f4cbd3'; ctx.beginPath(); ctx.moveTo(56, 0); ctx.lineTo(56, page.height); ctx.stroke();
  }
}

export function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
    image.src = source;
  });
}

export async function renderPage(page: NotePage, scale = 1.5): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(page.width * scale);
  canvas.height = Math.round(page.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu criar a página.');
  ctx.scale(scale, scale);
  drawPaper(ctx, page);
  if (page.background) ctx.drawImage(await loadImage(page.background), 0, 0, page.width, page.height);
  page.elements.forEach(element => drawElement(ctx, element));
  return canvas;
}
