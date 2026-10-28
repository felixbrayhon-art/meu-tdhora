import React, { useRef, useState } from 'react';

// Atalho para o OwlLuna (github.com/owaisazmal/OwlLuna, MIT), app nativo de iPad em Swift: é o motor completo de escrita à mão,
// que não roda dentro de um app web. Aqui ficam o link de instalação (TestFlight público do projeto) e os atalhos `owlluna://`.
const TESTFLIGHT = 'https://testflight.apple.com/join/68jmH6R7';
const ACOES = [
  { href: 'owlluna://quicknote', label: 'Nota rápida' },
  { href: 'owlluna://continue', label: 'Continuar escrevendo' },
  { href: 'owlluna://today', label: 'Diário de hoje' },
];

const OwlLunaCard: React.FC = () => {
  const [naoAbriu, setNaoAbriu] = useState(false);
  const timer = useRef<number | null>(null);

  // Se o app está instalado, o iPad troca de app e a página fica oculta; se a página continua à vista, é provável que não esteja.
  const abrir = (href: string) => {
    setNaoAbriu(false);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { if (document.visibilityState === 'visible') setNaoAbriu(true); }, 1800);
    window.location.href = href;
  };

  return (
    <section aria-labelledby="owlluna-titulo" className="mb-6 rounded-2xl border border-[#eee6d6] bg-[#fdfbf7] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <h3 id="owlluna-titulo" className="font-logo text-xl text-[#473c33]">OwlLuna, o caderno completo para iPad</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#725442]">
            Escrita com Apple Pencil, PDFs, gravação de áudio, flashcards e sincronização pelo iCloud. É um app do iPad, gratuito e de código aberto: abre aqui por atalho.
          </p>
        </div>
        <a href={TESTFLIGHT} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-[#ddd2c2] bg-white px-4 py-2 text-sm font-bold text-[#473c33] hover:bg-[#f4ebdd]">
          Instalar no iPad (TestFlight)
        </a>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {ACOES.map((a) => (
          <button key={a.href} type="button" onClick={() => abrir(a.href)} className="min-h-11 rounded-xl bg-[#ff832a] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#ec6300]">
            {a.label}
          </button>
        ))}
      </div>
      {naoAbriu && (
        <p role="status" className="mt-3 rounded-xl bg-[#fff2dc] p-3 text-sm font-medium text-[#7a5200]">
          O OwlLuna não abriu. Ele só existe no iPad (iPadOS 18 ou mais novo). Se ainda não instalou, use "Instalar no iPad" e abra o link no próprio iPad.
        </p>
      )}
    </section>
  );
};

export default OwlLunaCard;
