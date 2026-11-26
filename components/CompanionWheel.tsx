import React from 'react';
import { IconProps } from './icons';

// Menu em roda: as funções do companheiro viram setores de um anel em volta dele,
// em vez de uma lista empilhada num canto. Cada setor é desenhado uma vez só e o
// mesmo traçado serve de recorte para um <button> de verdade por cima — assim o
// alvo do clique tem a forma da peça, e foco, teclado e leitor de tela continuam
// sendo os do HTML, sem recriar nada disso à mão em cima de SVG.

export interface ItemRoda {
  id: string;
  /** O nome da função. Não aparece escrito na peça: vai no title e no rótulo
   *  acessível, que é o que o leitor de tela e o toque demorado dizem. */
  rotulo: string;
  icone: React.ComponentType<IconProps>;
  cor: string;
  texto: string;
  /** O que está acontecendo nesta função agora: o canal tocando, o tempo que
   *  falta. Vai numa segunda linha, menor, só quando há o que dizer. */
  detalhe?: string;
  /** Desenha como opção escolhida de um grupo (muda o papel ARIA). */
  marcado?: boolean;
  acao: () => void;
}

const RAIO_INTERNO = 106;
const RAIO_EXTERNO = 172;
const CANTO = 18;
const FOLGA = 5; // graus de respiro entre uma peça e a seguinte
const LADO = RAIO_EXTERNO * 2;

const rad = (g: number) => (g * Math.PI) / 180;
const ponto = (r: number, a: number) => [RAIO_EXTERNO + r * Math.cos(a), RAIO_EXTERNO + r * Math.sin(a)];

/**
 * Traçado de um setor de anel com os quatro cantos arredondados. Cada canto é um
 * arco de raio `k` tangente à circunferência e à aresta radial ao mesmo tempo:
 * o centro dele fica a `r∓k` da origem, deslocado de `asin(k/(r∓k))` em ângulo.
 */
const setor = (g0: number, g1: number): string => {
  const a0 = rad(g0);
  const a1 = rad(g1);
  const k = Math.min(CANTO, (RAIO_EXTERNO - RAIO_INTERNO) / 2 - 1, ((a1 - a0) * RAIO_INTERNO) / 2.4);
  const fi = Math.asin(k / (RAIO_EXTERNO - k));
  const psi = Math.asin(k / (RAIO_INTERNO + k));
  const le = Math.sqrt((RAIO_EXTERNO - k) ** 2 - k ** 2);
  const li = Math.sqrt((RAIO_INTERNO + k) ** 2 - k ** 2);
  const P = (r: number, a: number) => ponto(r, a).map((v) => v.toFixed(2)).join(',');
  // Os quatro cantos são convexos e o contorno é percorrido no sentido horário,
  // então todos usam sweep 1; só o arco interno volta (sweep 0).
  return [
    `M ${P(RAIO_EXTERNO, a0 + fi)}`,
    `A ${RAIO_EXTERNO} ${RAIO_EXTERNO} 0 ${a1 - a0 - 2 * fi > Math.PI ? 1 : 0} 1 ${P(RAIO_EXTERNO, a1 - fi)}`,
    `A ${k} ${k} 0 0 1 ${P(le, a1)}`,
    `L ${P(li, a1)}`,
    `A ${k} ${k} 0 0 1 ${P(RAIO_INTERNO, a1 - psi)}`,
    `A ${RAIO_INTERNO} ${RAIO_INTERNO} 0 ${a1 - a0 - 2 * psi > Math.PI ? 1 : 0} 0 ${P(RAIO_INTERNO, a0 + psi)}`,
    `A ${k} ${k} 0 0 1 ${P(li, a0)}`,
    `L ${P(le, a0)}`,
    `A ${k} ${k} 0 0 1 ${P(RAIO_EXTERNO, a0 + fi)}`,
    'Z',
  ].join(' ');
};

interface CompanionWheelProps {
  itens: ItemRoda[];
  rotulo: string;
}

const CompanionWheel: React.FC<CompanionWheelProps> = ({ itens, rotulo }) => {
  // Qual peça está sob o ponteiro ou com o foco. O desenho sozinho não diz o
  // nome da função, e o `title` do navegador demora e não existe no toque:
  // esta tarja aparece embaixo do anel assim que a peça é apontada.
  const [apontada, setApontada] = React.useState<string | null>(null);
  const nomeApontado = itens.find((i) => i.id === apontada)?.rotulo;
  // Todas as peças do mesmo tamanho. A principal era dupla, e uma peça com o
  // dobro da largura das outras fazia o anel parecer torto em vez de hierárquico
  // — a primazia dela se diz pela cor e pelo lugar (topo), que bastam.
  const fatia = 360 / itens.length;
  // A primeira peça nasce centrada no topo, e a leitura segue no sentido horário.
  let cursor = -90 - fatia / 2;

  const pecas = itens.map((item) => {
    const g0 = cursor;
    const g1 = cursor + fatia;
    cursor = g1;
    const meio = rad((g0 + g1) / 2);
    const [cxr, cyr] = ponto((RAIO_INTERNO + RAIO_EXTERNO) / 2, meio);
    return { item, d: setor(g0 + FOLGA / 2, g1 - FOLGA / 2), cx: cxr, cy: cyr };
  });

  return (
    <div
      role="menu"
      aria-label={rotulo}
      // shrink-0: o invólucro que centraliza a roda tem a largura do boneco, e
      // sem isso o flex espremia os 344px para 103 e jogava o anel para o lado.
      className="pointer-events-auto relative shrink-0 animate-in fade-in duration-200"
      style={{ width: LADO, height: LADO }}
    >
      {pecas.map(({ item, d, cx, cy }) => (
        /* Cada peça é um <button> recortado com a forma do setor, e o desenho
           mora dentro dele. Assim o anel de foco — que o recorte apagaria —
           vira um contorno no próprio traçado, sem estado paralelo em React. */
        <button
          key={item.id}
          role={item.marcado === undefined ? 'menuitem' : 'menuitemradio'}
          aria-checked={item.marcado === undefined ? undefined : item.marcado}
          onClick={item.acao}
          onMouseEnter={() => setApontada(item.id)}
          onMouseLeave={() => setApontada((atual) => (atual === item.id ? null : atual))}
          onFocus={() => setApontada(item.id)}
          onBlur={() => setApontada((atual) => (atual === item.id ? null : atual))}
          aria-label={item.rotulo}
          title={item.rotulo}
          className="group absolute inset-0 outline-none transition-[filter] duration-150 hover:brightness-[0.93] active:brightness-90"
          style={{ clipPath: `path('${d}')` }}
        >
          <svg width={LADO} height={LADO} viewBox={`0 0 ${LADO} ${LADO}`} aria-hidden="true" className="absolute inset-0">
            <path d={d} fill={item.cor} strokeWidth={9} className="stroke-transparent group-focus-visible:stroke-[#2a1f18]" />
          </svg>
          <span
            className="absolute flex w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
            style={{ left: cx, top: cy, color: item.texto }}
          >
            {/* Desenho no lugar da palavra: sete rótulos escritos em volta de um
                anel de 344px brigavam pela curva, e os de duas palavras tinham
                de quebrar para não serem comidos pela borda. O nome continua
                existindo no title e no aria-label. */}
            <item.icone size={22} aria-hidden="true" />
            {item.detalhe && (
              /* O estado fica na peça: sem isso "Som" e "Cronômetro" só mudavam
                 de cor, e a roda não dizia o que estava tocando nem quanto
                 faltava — era preciso abrir cada painel para descobrir. */
              <span className="block text-[9px] font-bold leading-[1.1] opacity-80">{item.detalhe}</span>
            )}
          </span>
        </button>
      ))}
      {nomeApontado && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 -translate-y-3 whitespace-nowrap rounded-full bg-[#2a1f18] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#f7f1e6] shadow-lg"
        >
          {nomeApontado}
        </span>
      )}
    </div>
  );
};

export default CompanionWheel;
