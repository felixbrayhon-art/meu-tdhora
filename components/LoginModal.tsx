import React, { useEffect, useState } from 'react';
import FishLogo from './FishLogo';
import { BookOpen, Cloud, X } from './icons';

interface LoginModalProps {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onGoogleLogin: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, isLoading, error, onClose, onGoogleLogin }) => {
  const [tilt, setTilt] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
    setTilt(vertical * -2.5);
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center overflow-y-auto bg-[#211d18]/70 p-4 backdrop-blur-md animate-in fade-in duration-200 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) onClose();
      }}
      >
      <div className="relative my-auto w-full max-w-[980px] [perspective:1600px]">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-title"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setTilt(0)}
          style={{ transform: `rotateX(${tilt}deg)` }}
          className="relative w-full overflow-hidden rounded-[38px] border-[8px] border-[#473c33] bg-[#473c33] p-1.5 shadow-[0_40px_100px_rgba(20,16,12,0.5),0_8px_0_#ddceb0,0_16px_0_#f5eddf] transition-transform duration-200 ease-out dark:border-[#514638] dark:bg-[#514638] dark:shadow-[0_40px_100px_rgba(0,0,0,0.55),0_8px_0_#514638,0_16px_0_#292a23] motion-reduce:transition-none"
        >
          <div className="relative grid overflow-hidden rounded-[30px] border border-[#d9cdb8] bg-[#fffaf0] dark:border-[#655b48] dark:bg-[#292a23] md:grid-cols-[0.92fr_1.08fr]">
            <aside className="relative flex min-h-[410px] flex-col justify-between overflow-hidden bg-[#f1e9d9] p-8 text-[#473c33] sm:p-10 dark:bg-[#34342b] dark:text-[#f2efd2] md:min-h-[570px] md:shadow-[inset_-18px_0_20px_-14px_rgba(71,60,51,0.24)] md:dark:shadow-[inset_-18px_0_20px_-14px_rgba(0,0,0,0.5)] lg:p-12">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-80 dark:opacity-60"
                style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(201, 119, 62, 0.2) 32px)' }}
              />
              <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-7 w-px bg-[#e96f34]/55 dark:bg-[#f3a06c]/35" />

              <div className="relative z-10 pl-2">
                <FishLogo className="origin-left scale-[0.78]" days={0} darkBg />
              </div>

              <div className="relative z-10 py-10 pl-2">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#c9773e]/20 bg-white/55 px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-[#a65c2f] dark:border-[#fec868]/20 dark:bg-white/[0.06] dark:text-[#fed386]">
                  <Cloud className="h-3.5 w-3.5" />
                  Seu foco, sincronizado
                </div>
                <h2
                  className="max-w-sm font-logo uppercase leading-[1.02] tracking-tight text-[#473c33] dark:text-[#f2efd2]"
                  style={{ fontSize: 'clamp(2.25rem, 4.1vw, 3rem)' }}
                >
                  <span className="block">Seu cardume</span>
                  <span className="block"><span className="text-[#e96f34] dark:text-[#fec868]">sempre</span> com</span>
                  <span className="block">você.</span>
                </h2>
                <p className="mt-5 max-w-sm text-sm font-medium leading-6 text-[#725e4a] dark:text-[#d1c7b3]">
                  Conecte sua conta para levar cadernos, revisões e progresso para outros dispositivos.
                </p>
              </div>

              <div className="relative z-10 flex items-center justify-between gap-3 border-t border-[#473c33]/15 pl-2 pt-5 text-[10px] font-bold leading-5 text-[#725e4a] dark:border-white/10 dark:text-[#c8c5a9]">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e96f34]/10 text-[#e96f34] dark:bg-[#fec868]/10 dark:text-[#fec868]">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <span>Entrar é opcional. Você pode continuar usando o app neste dispositivo.</span>
                </div>
                <span className="hidden shrink-0 text-[9px] font-black tracking-widest opacity-60 sm:block">01 / 02</span>
              </div>
            </aside>

            <div className="relative flex min-h-[460px] flex-col justify-center overflow-hidden bg-[#fffaf0] px-6 py-12 sm:px-10 md:px-11 md:shadow-[inset_18px_0_20px_-14px_rgba(71,60,51,0.22)] md:dark:shadow-[inset_18px_0_22px_-14px_rgba(0,0,0,0.55)] lg:px-14 dark:bg-[#292a23]">
              <div aria-hidden="true" className="pointer-events-none absolute right-0 top-24 z-10 h-14 w-3 rounded-l-md bg-[#e96f34] shadow-[inset_2px_0_3px_rgba(71,60,51,0.2),0_3px_8px_rgba(71,60,51,0.16)] dark:bg-[#e96f34]" />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-65 dark:opacity-40"
                style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(201, 119, 62, 0.13) 32px)' }}
              />
              <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-[#473c33]/10 dark:bg-white/10 md:block" />

              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                aria-label="Fechar login"
                className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-xl border border-[#e9e0d4] bg-white/90 text-[#8f8375] transition hover:bg-[#f4ebdd] hover:text-[#473c33] disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#35362e] dark:text-[#c8c5a9] dark:hover:bg-[#414239] dark:hover:text-[#f2efd2] sm:right-5 sm:top-5"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative z-10 mx-auto w-full max-w-md">
                <div className="mb-8 inline-flex items-center gap-2 border-b-2 border-[#e96f34]/35 pb-2 pr-8">
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#c9773e] dark:text-[#f3a06c]">Sua conta ToDAHORA</span>
                  <span className="text-[9px] font-black tracking-widest text-[#a79c8e] dark:text-[#aaa891]">02 / 02</span>
                </div>

                <div className="mb-8">
                  <h1 id="login-title" className="font-logo text-[32px] uppercase leading-none tracking-tight text-[#473c33] dark:text-[#f2efd2] sm:text-[38px]">
                    Entre no seu ritmo.
                  </h1>
                  <p className="mt-4 max-w-md text-sm font-medium leading-6 text-[#8f8375] dark:text-[#c8c5a9]">
                    Use sua conta Google para sincronizar seu progresso e continuar de onde parou.
                  </p>
                </div>

                {error && (
                  <div role="alert" className="mb-5 rounded-2xl border border-[#df9278] bg-[#fff1ec] px-4 py-3 text-sm font-semibold leading-5 text-[#713a2e] dark:border-[#b96b50] dark:bg-[#3d302a] dark:text-[#f1c5b4]">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={onGoogleLogin}
                  disabled={isLoading}
                  className="group flex min-h-[58px] w-full items-center justify-center gap-3 rounded-2xl bg-[#e96f34] px-5 py-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(233,111,52,0.22)] transition hover:-translate-y-0.5 hover:bg-[#d95f29] hover:shadow-[0_16px_28px_rgba(233,111,52,0.28)] active:translate-y-0 disabled:cursor-wait disabled:opacity-70 dark:bg-[#e96f34] dark:hover:bg-[#f07b40]"
                >
                  {isLoading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[16px] font-black leading-none text-[#4285f4]">G</span>
                  )}
                  {isLoading ? 'Conectando com o Google…' : 'Continuar com Google'}
                </button>

                <div className="my-6 flex items-center gap-3" aria-hidden="true">
                  <div className="h-px flex-1 bg-[#e9e0d4] dark:bg-white/[0.1]" />
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#a79c8e] dark:text-[#aaa891]">ou</span>
                  <div className="h-px flex-1 bg-[#e9e0d4] dark:bg-white/[0.1]" />
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="w-full rounded-2xl border border-[#e9e0d4] bg-white/80 px-5 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-[#725442] transition hover:border-[#e2c99e] hover:bg-[#fff8ec] disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#35362e] dark:text-[#f2efd2] dark:hover:border-[#e96f34]/40 dark:hover:bg-[#414239]"
                >
                  Continuar sem entrar
                </button>

                <p className="mt-5 text-center text-[10px] font-medium leading-5 text-[#a79c8e] dark:text-[#aaa891]">
                  Seus dados locais continuam disponíveis neste navegador.
                </p>
              </div>
            </div>
          </div>

          <div aria-hidden="true" className="pointer-events-none absolute right-2 bottom-7 top-7 z-30 hidden w-1.5 rounded-r-full bg-[repeating-linear-gradient(to_bottom,#f4e6cf_0px,#f4e6cf_3px,#d5c6ac_4px,#d5c6ac_5px)] shadow-[3px_0_5px_rgba(20,16,12,0.24)] dark:bg-[repeating-linear-gradient(to_bottom,#716957_0px,#716957_3px,#4e493d_4px,#4e493d_5px)] md:block" />

          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[46%] z-20 hidden w-12 -translate-x-1/2 bg-gradient-to-r from-[#473c33]/8 via-[#473c33]/42 to-[#fffaf0]/90 shadow-[0_0_20px_rgba(71,60,51,0.28)] dark:from-[#f2efd2]/15 dark:via-black/75 dark:to-[#f2efd2]/35 md:block">
            <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#473c33]/45 shadow-[0_0_8px_rgba(71,60,51,0.34)] dark:bg-black/80 dark:shadow-[0_0_9px_rgba(0,0,0,0.65)]" />
            <div className="absolute inset-y-8 left-[calc(50%-4px)] w-px bg-white/80 dark:bg-[#f2efd2]/35" />
            <div className="absolute inset-y-8 left-[calc(50%+3px)] w-px bg-[#473c33]/20 dark:bg-black/35" />
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginModal;
