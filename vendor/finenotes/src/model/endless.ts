/**
 * Tela infinita (ToDaHORA addition; not in FineNotes 1.5.0): a page flagged
 * `endless` grows downward, a screen ahead of where it is being read and
 * written, up to {@link ENDLESS_MAX_HEIGHT}. Pure: no DOM. A page that is not
 * flagged is never touched, so fixed-size notebooks work exactly as before.
 */

import { type Page, POINT_STRIDE } from "./document";

/** Tallest an endless page grows, page px (about fifteen sheets); PDF export and tiles stay sane. */
export const ENDLESS_MAX_HEIGHT = 16000;
/** Heights are rounded up to this step, so growing does not happen on every scroll tick. */
export const ENDLESS_STEP = 500;

export function isEndless(page: Page): boolean {
  return page.backdrop.kind !== "pdf" && page.backdrop.endless === true;
}

/** The height an endless page should have to cover `needed`: never shorter than now, never past the cap. */
export function endlessHeight(current: number, needed: number): number {
  if (!(needed > current) || current >= ENDLESS_MAX_HEIGHT) return current;
  return Math.min(ENDLESS_MAX_HEIGHT, Math.ceil(needed / ENDLESS_STEP) * ENDLESS_STEP);
}

/** The lowest edge of anything on the page (ink, text boxes, pictures), page px. */
export function contentBottom(page: Page): number {
  let bottom = 0;
  for (const stroke of page.strokes) {
    for (let i = 1; i < stroke.pts.length; i += POINT_STRIDE) {
      const y = stroke.pts[i] + stroke.size;
      if (y > bottom) bottom = y;
    }
  }
  for (const box of page.textBoxes) bottom = Math.max(bottom, box.y + (box.h ?? 40));
  for (const image of page.images) bottom = Math.max(bottom, image.y + image.h);
  return bottom;
}
