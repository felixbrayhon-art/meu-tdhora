/**
 * Tela infinita (ToDaHORA addition; not in FineNotes 1.5.0): a note whose one
 * page is a huge dotted canvas that fills the screen and pans any way. The
 * page is flagged `endless` and the document is a single page. Everything
 * else (notebooks, PDFs, fixed pages) never meets this code.
 */

import { type InkDocument, type Page, POINT_STRIDE } from "./document";
import { DEFAULT_NOTEBOOK_CHOICES, buildNewDocument } from "./new-notebook";

/** Page px per side: about twenty screens each way from the centre, far past a full summary. */
export const ENDLESS_SIZE = 20000;
/** The layout width that gives 100% zoom, as for a normal sheet. */
export const ENDLESS_FIT_WIDTH = 1024;
/** How far the view may zoom out, relative to 100%. */
export const ENDLESS_MIN_ZOOM = 0.15;

export function isEndless(page: Page): boolean {
  return page.backdrop.kind !== "pdf" && page.backdrop.endless === true;
}

/** An infinite canvas note: one single page, flagged `endless`. */
export function isInfiniteDoc(doc: InkDocument): boolean {
  return doc.single === true && doc.pages.length === 1 && isEndless(doc.pages[0]);
}

/** A new, empty infinite canvas. */
export function newInfiniteDocument(title: string): InkDocument {
  const doc = buildNewDocument({ ...DEFAULT_NOTEBOOK_CHOICES, type: "single", ruling: "dotted", cover: "none" }, title);
  const page = doc.pages[0];
  page.geometry = { width: ENDLESS_SIZE, height: ENDLESS_SIZE };
  page.backdrop = { kind: "dotted", endless: true };
  return doc;
}

/** Where to open the canvas: the middle of what is written, or the middle of the page when empty. */
export function contentCenter(page: Page): { x: number; y: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of page.strokes) {
    for (let i = 0; i + 1 < stroke.pts.length; i += POINT_STRIDE) {
      const x = stroke.pts[i];
      const y = stroke.pts[i + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  for (const box of page.textBoxes) {
    minX = Math.min(minX, box.x);
    maxX = Math.max(maxX, box.x + box.w);
    minY = Math.min(minY, box.y);
    maxY = Math.max(maxY, box.y + (box.h ?? 40));
  }
  for (const image of page.images) {
    minX = Math.min(minX, image.x);
    maxX = Math.max(maxX, image.x + image.w);
    minY = Math.min(minY, image.y);
    maxY = Math.max(maxY, image.y + image.h);
  }
  if (!Number.isFinite(minX)) return { x: page.geometry.width / 2, y: page.geometry.height / 2 };
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}
