import { describe, expect, it } from "vitest";
import { ENDLESS_SIZE, contentCenter, isEndless, isInfiniteDoc, newInfiniteDocument } from "../../src/model/endless";
import { DocumentEncoder, decodeDocument } from "../../src/model/serialize";
import { DEFAULT_NOTEBOOK_CHOICES, buildNewDocument } from "../../src/model/new-notebook";

describe("tela infinita", () => {
  it("o documento novo é uma página única, enorme e marcada", () => {
    const doc = newInfiniteDocument("Resumo");
    expect(doc.single).toBe(true);
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0].geometry).toEqual({ width: ENDLESS_SIZE, height: ENDLESS_SIZE });
    expect(isEndless(doc.pages[0])).toBe(true);
    expect(isInfiniteDoc(doc)).toBe(true);
  });

  it("caderno comum e página única comum não são tela infinita", () => {
    const caderno = buildNewDocument({ ...DEFAULT_NOTEBOOK_CHOICES, ruling: "ruled-narrow", cover: "none", type: "notebook" }, "x");
    const unica = buildNewDocument({ ...DEFAULT_NOTEBOOK_CHOICES, type: "single" }, "x");
    expect(isInfiniteDoc(caderno)).toBe(false);
    expect(isInfiniteDoc(unica)).toBe(false);
    expect(isEndless(caderno.pages[0])).toBe(false);
  });

  it("a marca e o tamanho sobrevivem a gravar e abrir; papel comum continua sem a marca", () => {
    const lido = decodeDocument(new DocumentEncoder().encode(newInfiniteDocument("Resumo")));
    expect(isInfiniteDoc(lido)).toBe(true);
    expect(lido.pages[0].geometry.width).toBe(ENDLESS_SIZE);
    const comum = decodeDocument(new DocumentEncoder().encode(buildNewDocument({ ...DEFAULT_NOTEBOOK_CHOICES, type: "single" }, "x")));
    expect(JSON.stringify(comum.pages[0].backdrop)).not.toContain("endless");
  });

  it("contentCenter: meio da página quando vazia, meio do que foi escrito quando há tinta", () => {
    const doc = newInfiniteDocument("Resumo");
    const page = doc.pages[0];
    expect(contentCenter(page)).toEqual({ x: ENDLESS_SIZE / 2, y: ENDLESS_SIZE / 2 });
    page.strokes.push({ id: "a", color: "#000", size: 2, tool: "pen", pts: [100, 200, 0.5, 300, 400, 0.5] } as never);
    page.strokes.push({ id: "b", color: "#000", size: 2, tool: "pen", pts: [900, 800, 0.5] } as never);
    expect(contentCenter(page)).toEqual({ x: 500, y: 500 });
  });
});
