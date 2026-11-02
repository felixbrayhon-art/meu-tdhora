import { describe, expect, it } from "vitest";
import { ENDLESS_MAX_HEIGHT, ENDLESS_STEP, contentBottom, endlessHeight, isEndless } from "../../src/model/endless";
import { SetPageEndless } from "../../src/model/page-commands";
import { DocumentEncoder, decodeDocument } from "../../src/model/serialize";
import { DEFAULT_NOTEBOOK_CHOICES, buildNewDocument } from "../../src/model/new-notebook";

const novoDoc = () => buildNewDocument({ ...DEFAULT_NOTEBOOK_CHOICES, ruling: "ruled-narrow", cover: "none", type: "notebook" }, "Teste");

describe("tela infinita", () => {
  it("endlessHeight nunca encolhe, arredonda para cima e respeita o limite", () => {
    expect(endlessHeight(1000, 900)).toBe(1000);
    expect(endlessHeight(1000, 1001)).toBe(1500);
    expect(endlessHeight(1000, 1500)).toBe(1500);
    expect(endlessHeight(1000, 1500.5)).toBe(2000);
    expect(endlessHeight(15900, 99999)).toBe(ENDLESS_MAX_HEIGHT);
    expect(endlessHeight(ENDLESS_MAX_HEIGHT, 99999)).toBe(ENDLESS_MAX_HEIGHT);
    expect(ENDLESS_MAX_HEIGHT % ENDLESS_STEP).toBe(0);
  });

  it("página comum não é tela infinita; SetPageEndless liga, desliga e desfaz", () => {
    const doc = novoDoc();
    const page = doc.pages[0];
    expect(isEndless(page)).toBe(false);
    const on = new SetPageEndless(page, true);
    on.apply(doc);
    expect(isEndless(page)).toBe(true);
    expect(page.backdrop.kind).toBe("ruled-narrow");
    on.invert(doc);
    expect(isEndless(page)).toBe(false);
    const off = new SetPageEndless(page, false);
    off.apply(doc);
    expect(isEndless(page)).toBe(false);
  });

  it("a marca sobrevive a gravar e abrir; página comum continua sem ela", () => {
    const doc = novoDoc();
    new SetPageEndless(doc.pages[0], true).apply(doc);
    const lido = decodeDocument(new DocumentEncoder().encode(doc));
    expect(isEndless(lido.pages[0])).toBe(true);
    const comum = novoDoc();
    const lido2 = decodeDocument(new DocumentEncoder().encode(comum));
    expect(isEndless(lido2.pages[0])).toBe(false);
    expect(JSON.stringify(lido2.pages[0].backdrop)).not.toContain("endless");
  });

  it("contentBottom olha traços, caixas de texto e imagens", () => {
    const doc = novoDoc();
    const page = doc.pages[0];
    expect(contentBottom(page)).toBe(0);
    page.strokes.push({ id: "s", color: "#000", size: 2, tool: "pen", pts: [10, 100, 0.5, 20, 300, 0.5] } as never);
    expect(contentBottom(page)).toBe(302);
    page.images.push({ id: "i", path: "a.png", x: 0, y: 500, w: 10, h: 200 } as never);
    expect(contentBottom(page)).toBe(700);
  });
});
