import { describe, it, expect } from "vitest";
import { DocumentEncoder, decodeDocument } from "../../src/model/serialize";
import { buildNewDocument } from "../../src/model/new-notebook";
import { DEFAULT_NOTEBOOK_CHOICES } from "../../src/model/new-notebook";

describe("DocumentEncoder.encodeAsync", () => {
  it("gera os mesmos bytes que encode e volta igual ao decodificar", async () => {
    const doc = buildNewDocument({ ...DEFAULT_NOTEBOOK_CHOICES, ruling: "ruled-narrow", cover: "none", type: "notebook" }, "Teste");
    doc.pages[0].strokes.push({ id: "s1", color: "#000000", size: 2, tool: "pen", pts: [10, 10, 0.5, 20, 20, 0.5, 30, 15, 0.6] } as never);
    const a = new DocumentEncoder().encode(doc);
    const b = await new DocumentEncoder().encodeAsync(doc);
    expect(b).toBe(a);
    expect(decodeDocument(b).pages[0].strokes.length).toBe(1);
    const enc = new DocumentEncoder();
    const first = await enc.encodeAsync(doc);
    const second = await enc.encodeAsync(doc);
    expect(second).toBe(first);
    expect(enc.reused).toBe(true);
  });
});
