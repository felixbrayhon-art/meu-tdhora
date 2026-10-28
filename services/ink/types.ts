// Modelo de dados do caderno de anotações à mão (motor de tinta). Coordenadas em "pontos de página" (1 pt ≈ 1/72 pol).

export type PenKind = 'pen' | 'fineliner' | 'fountain' | 'calligraphy' | 'pencil' | 'highlighter' | 'crayon' | 'watercolour';

/** Traço: lista plana [x0, y0, p0, x1, y1, p1, ...] com a pressão p em 0..1. */
export interface InkStroke {
  id: string;
  kind: PenKind;
  color: string;
  /** Espessura base em pontos de página. */
  width: number;
  /** 0..1 (o marca-texto já embute a própria transparência ao desenhar). */
  opacity: number;
  points: number[];
  /** Verdadeiro para linhas retas e formas (sem suavização nem variação de pressão). */
  straight?: boolean;
}

export type PaperTemplate =
  | 'blank' | 'lined' | 'lined-wide' | 'grid' | 'grid-large' | 'dots' | 'cornell' | 'music'
  | 'storyboard' | 'planner-weekly' | 'planner-daily' | 'todo' | 'isometric' | 'graph' | 'handwriting';
export type PaperColor = 'white' | 'cream' | 'yellow' | 'green' | 'blue' | 'pink' | 'grey' | 'dark' | 'black';
export type PageSize = 'letter' | 'a4' | 'a5' | 'wide' | 'whiteboard';

export interface InkPage {
  id: string;
  template: PaperTemplate;
  paper: PaperColor;
  size: PageSize;
  strokes: InkStroke[];
  /** Fundo importado (PDF ou imagem), guardado à parte no IndexedDB; ver services/ink/store.ts. */
  background?: { kind: 'pdf' | 'image'; ref: string; page?: number; width: number; height: number };
}

export interface InkNotebook {
  id: string;
  pages: InkPage[];
  updatedAt: number;
}

export interface Pt { x: number; y: number }
