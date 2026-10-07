import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Briefcase, GraduationCap, Sparkles } from './icons';
import FishLogo from './FishLogo';
import { StudyProfile } from '../types';

interface ProfileSelectionProps {
  initialName?: string;
  onNext: (name: string, profile: StudyProfile) => void;
  onBack?: () => void;
}

const profiles: Array<{
  id: StudyProfile;
  title: string;
  subtitle: string;
  detail: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  number: string;
}> = [
  {
    id: 'VESTIBULAR',
    title: 'Vestibular',
    subtitle: 'Quero conquistar minha vaga',
    detail: 'ENEM e processos seletivos',
    icon: GraduationCap,
    number: '01',
  },
  {
    id: 'CONCURSO',
    title: 'Concurso',
    subtitle: 'Estou me preparando para uma prova',
    detail: 'Concursos públicos e certificações',
    icon: Briefcase,
    number: '02',
  },
  {
    id: 'FACULDADE',
    title: 'Faculdade',
    subtitle: 'Quero organizar meus estudos',
    detail: 'Graduação e outras formações',
    icon: BookOpen,
    number: '03',
  },
];

const ProfileSelection: React.FC<ProfileSelectionProps> = ({ initialName, onNext, onBack }) => {
  const [name, setName] = useState(initialName ?? '');
  const [nameError, setNameError] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<StudyProfile | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pendingProfile) return;
    const timer = window.setTimeout(() => nameInputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [pendingProfile]);

  const handlePick = (profile: StudyProfile) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setPendingProfile(profile);
      return;
    }
    onNext(trimmed, profile);
  };

  const confirmName = () => {
    const trimmed = name.trim();
    if (!trimmed || !pendingProfile) {
      setNameError(true);
      return;
    }
    onNext(trimmed, pendingProfile);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    setTilt({ x: y * -1.2, y: x * 1.2 });
  };

  return (
    <div
      id="profile-selection-screen"
      className="fixed inset-0 z-[110] overflow-y-auto bg-[#f1e9d9] px-4 py-4 text-[#473c33] animate-in fade-in duration-500 dark:bg-[#211d18] dark:text-[#f2efd2] sm:px-6 sm:py-6"
    >
      <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-25" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(ellipse at 12% 12%, rgba(233,111,52,.12), transparent 32%), radial-gradient(ellipse at 90% 82%, rgba(254,200,104,.13), transparent 30%)' }} />

      <div className="relative mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[1120px] flex-col justify-center sm:min-h-[calc(100dvh-3rem)]">
        <div className="mb-3 flex items-center justify-between gap-3 px-1 sm:mb-4 sm:px-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="group inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-[10px] font-black uppercase tracking-[.16em] text-[#806f5d] transition hover:bg-white/55 hover:text-[#473c33] dark:text-[#c8c5a9] dark:hover:bg-white/[.06] dark:hover:text-[#f2efd2]"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              Voltar
            </button>
          ) : <span />}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c9773e]/15 bg-[#fffaf0]/75 px-3.5 py-2 shadow-sm dark:border-white/[.08] dark:bg-[#34342b]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e96f34] dark:bg-[#fec868]" />
            <span className="text-[9px] font-black uppercase tracking-[.18em] text-[#a65c2f] dark:text-[#fed386]">Passo 1 de 2</span>
          </div>
        </div>

        <div className="[perspective:2400px]">
          <section
            aria-labelledby="profile-title"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setTilt({ x: 0, y: 0 })}
            style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
            className="relative w-full rounded-[34px] border-[7px] border-[#473c33] bg-[#473c33] p-1.5 shadow-[0_28px_65px_rgba(50,38,25,.24),0_7px_0_#ddceb0,0_13px_0_#f8f1e4] transition-transform duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none dark:border-[#514638] dark:bg-[#514638] dark:shadow-[0_28px_65px_rgba(0,0,0,.52),0_7px_0_#514638,0_13px_0_#292a23]"
          >
            <div className="relative grid overflow-hidden rounded-[27px] border border-[#d9cdb8] bg-[#fffaf0] md:min-h-[620px] md:grid-cols-[.88fr_1.12fr] dark:border-[#655b48] dark:bg-[#292a23]">
              <aside className="profile-book-page-left relative flex min-h-[285px] flex-col justify-between overflow-hidden bg-[#f1e9d9] px-6 py-6 sm:min-h-[330px] sm:px-9 sm:py-8 md:min-h-[620px] md:px-10 md:py-9 dark:bg-[#34342b] md:shadow-[inset_-18px_0_20px_-14px_rgba(71,60,51,.24)] md:dark:shadow-[inset_-18px_0_20px_-14px_rgba(0,0,0,.5)]">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-75 dark:opacity-45" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(201,119,62,.18) 32px)' }} />
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-5 w-px bg-[#e96f34]/45 sm:left-7" />
                <div className="relative z-10 pl-2">
                  <FishLogo
                    className="origin-left scale-[0.82] sm:scale-[0.9]"
                    days={0}
                    darkBg={document.documentElement.classList.contains('dark')}
                  />
                </div>

                <div className="relative z-10 py-4 pl-2 md:py-8">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#c9773e]/20 bg-white/55 px-3.5 py-2 text-[9px] font-black uppercase tracking-[.18em] text-[#a65c2f] dark:border-[#fec868]/20 dark:bg-white/[.06] dark:text-[#fed386]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Vamos começar
                  </div>
                  <h1 id="profile-title" className="max-w-md font-logo text-[clamp(2rem,4vw,3.35rem)] uppercase leading-[.98] tracking-tight text-[#473c33] dark:text-[#f2efd2]">
                    Qual é o seu <span className="text-[#e96f34] dark:text-[#fec868]">objetivo?</span>
                  </h1>
                  <p className="mt-4 max-w-md text-sm font-semibold leading-6 text-[#725e4a] dark:text-[#d1c7b3] sm:text-base">
                    Escolha o perfil que mais combina com seus estudos.
                  </p>
                </div>

                <div className="relative z-10 hidden items-center justify-between gap-3 border-t border-[#473c33]/15 pl-2 pt-4 text-[10px] font-bold leading-5 text-[#725e4a] dark:border-white/10 dark:text-[#c8c5a9] sm:flex">
                  <span>Você pode ajustar seu objetivo depois no perfil.</span>
                  <span className="shrink-0 text-[9px] font-black tracking-widest opacity-60">01 / 02</span>
                </div>
              </aside>

              <div className="profile-book-page-right relative flex flex-col justify-center overflow-hidden bg-[#fffaf0] px-5 py-7 sm:px-9 sm:py-9 md:px-10 md:py-10 dark:bg-[#292a23] md:shadow-[inset_18px_0_20px_-14px_rgba(71,60,51,.22)] md:dark:shadow-[inset_18px_0_22px_-14px_rgba(0,0,0,.55)]">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-55 dark:opacity-35" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(201,119,62,.13) 32px)' }} />
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-[#473c33]/10 dark:bg-white/10 md:block" />
                <div aria-hidden="true" className="pointer-events-none absolute right-0 top-20 z-10 h-12 w-2.5 rounded-l-md bg-[#e96f34] shadow-[inset_2px_0_3px_rgba(71,60,51,.2),0_3px_8px_rgba(71,60,51,.16)] dark:bg-[#e96f34]" />

                <div className="relative z-10 mx-auto w-full max-w-[540px]">
                  <div className="mb-5 border-b-2 border-[#e96f34]/30 pb-3 pr-8 dark:border-[#fec868]/30">
                    <p className="text-[9px] font-black uppercase tracking-[.23em] text-[#c9773e] dark:text-[#f3a06c]">Seu caderno começa aqui</p>
                    <h2 className="mt-1 font-logo text-2xl uppercase leading-tight tracking-tight text-[#473c33] dark:text-[#f2efd2] sm:text-[28px]">Escolha seu perfil</h2>
                  </div>

                  <div className="space-y-3" role="group" aria-label="Perfis de estudo">
                    {profiles.map(({ id, title, subtitle, detail, icon: Icon, number }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handlePick(id)}
                        className="group flex min-h-[86px] w-full items-center gap-3 rounded-[20px] border border-[#e6dac8] bg-white/80 p-3 text-left shadow-[0_3px_0_rgba(71,60,51,.045)] transition hover:-translate-y-0.5 hover:border-[#e96f34]/55 hover:bg-[#fff7eb] hover:shadow-[0_9px_20px_rgba(71,60,51,.09)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/25 active:translate-y-0 sm:gap-4 sm:p-4 dark:border-white/[.1] dark:bg-[#35362e]/85 dark:hover:border-[#e96f34]/60 dark:hover:bg-[#3c3d33] dark:hover:shadow-[0_9px_20px_rgba(0,0,0,.18)]"
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff1dd] text-[#e96f34] shadow-sm transition group-hover:scale-105 dark:bg-[#e96f34]/15 dark:text-[#fec868] sm:h-[54px] sm:w-[54px]">
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="font-logo text-base font-semibold uppercase tracking-tight text-[#473c33] dark:text-[#f2efd2] sm:text-lg">{title}</span>
                            <span className="text-[8px] font-black tracking-[.16em] text-[#b4a894] dark:text-[#aaa891]">{number}</span>
                          </span>
                          <span className="mt-0.5 block text-xs font-bold leading-5 text-[#725e4a] dark:text-[#d1c7b3]">{subtitle}</span>
                          <span className="mt-1 block text-[9px] font-black uppercase tracking-[.12em] text-[#a79c8e] dark:text-[#aaa891]">{detail}</span>
                        </span>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#b6a892] transition group-hover:bg-[#e96f34] group-hover:text-white dark:text-[#aaa891] dark:group-hover:bg-[#e96f34]">
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </button>
                    ))}
                  </div>

                  <p className="mt-4 text-center text-[10px] font-semibold leading-5 text-[#a79c8e] dark:text-[#aaa891]">
                    A escolha ajusta sugestões e organização, sem limitar seus estudos.
                  </p>
                </div>
              </div>

            </div>

            <div aria-hidden="true" className="pointer-events-none absolute right-2 bottom-6 top-6 z-30 hidden w-1.5 rounded-r-full bg-[repeating-linear-gradient(to_bottom,#f4e6cf_0px,#f4e6cf_3px,#d5c6ac_4px,#d5c6ac_5px)] shadow-[3px_0_5px_rgba(20,16,12,.2)] dark:bg-[repeating-linear-gradient(to_bottom,#716957_0px,#716957_3px,#4e493d_4px,#4e493d_5px)] md:block" />
          </section>
        </div>
      </div>

      {pendingProfile && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#211d18]/65 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-name-title"
            className="relative w-full max-w-[440px] overflow-hidden rounded-[28px] border-[5px] border-[#473c33] bg-[#473c33] p-1 shadow-[0_28px_70px_rgba(0,0,0,.42),0_6px_0_#ddceb0] dark:border-[#514638] dark:bg-[#514638] dark:shadow-[0_28px_70px_rgba(0,0,0,.58),0_6px_0_#292a23]"
          >
            <div className="relative overflow-hidden rounded-[21px] border border-[#d9cdb8] bg-[#fffaf0] px-6 py-7 text-center sm:px-8 dark:border-[#655b48] dark:bg-[#292a23]">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-55 dark:opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(201,119,62,.15) 32px)' }} />
              <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-5 w-px bg-[#e96f34]/40" />
              <div className="relative z-10">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff1dd] text-[#e96f34] dark:bg-[#e96f34]/15 dark:text-[#fec868]">
                  <BookOpen className="h-5 w-5" />
                </div>
                <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#c9773e] dark:text-[#f3a06c]">Só falta uma coisa</p>
                <h2 id="profile-name-title" className="mt-1 font-logo text-2xl uppercase leading-tight text-[#473c33] dark:text-[#f2efd2]">Como podemos te chamar?</h2>
                <p className="mt-2 text-xs font-semibold text-[#8f8375] dark:text-[#c8c5a9]">Seu nome aparece no seu espaço de estudos.</p>
                <input
                  ref={nameInputRef}
                  value={name}
                  onChange={(event) => { setName(event.target.value); if (event.target.value.trim()) setNameError(false); }}
                  onKeyDown={(event) => { if (event.key === 'Enter') confirmName(); }}
                  placeholder="Digite seu apelido"
                  aria-label="Seu apelido"
                  aria-invalid={nameError}
                  className={`mt-5 w-full rounded-2xl border-2 bg-white/85 px-4 py-3.5 text-center text-sm font-bold text-[#473c33] outline-none transition placeholder:text-[#a79c8e]/80 focus:border-[#e96f34] focus:ring-4 focus:ring-[#e96f34]/10 dark:bg-[#35362e] dark:text-[#f2efd2] dark:placeholder:text-[#aaa891] ${nameError ? 'border-[#bd4b35]' : 'border-[#e6dac8] dark:border-white/[.1]'}`}
                />
                {nameError && <p role="alert" className="mt-2 text-[11px] font-bold text-[#a94432] dark:text-[#f3a06c]">Digite seu apelido antes de continuar.</p>}
                <div className="mt-5 flex gap-2.5">
                  <button type="button" onClick={() => setPendingProfile(null)} className="flex-1 rounded-2xl border border-[#e6dac8] bg-white/80 px-4 py-3 text-[10px] font-black uppercase tracking-[.14em] text-[#725442] transition hover:bg-[#f4ebdd] dark:border-white/[.1] dark:bg-[#35362e] dark:text-[#d1c7b3] dark:hover:bg-[#414239]">Voltar</button>
                  <button type="button" onClick={confirmName} className="flex-1 rounded-2xl bg-[#e96f34] px-4 py-3 text-[10px] font-black uppercase tracking-[.14em] text-white shadow-[0_8px_18px_rgba(233,111,52,.2)] transition hover:-translate-y-0.5 hover:bg-[#d95f29] active:translate-y-0 dark:hover:bg-[#f07b40]">Continuar</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default ProfileSelection;
