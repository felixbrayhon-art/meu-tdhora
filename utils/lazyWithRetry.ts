import { lazy, ComponentType, LazyExoticComponent } from 'react';

export const isChunkLoadError = (error: unknown): boolean => {
  const text = `${(error as { name?: string })?.name ?? ''} ${(error as { message?: string })?.message ?? String(error ?? '')}`;
  return /dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk|error loading dynamically/i.test(text);
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Como React.lazy, mas tenta carregar o módulo uma segunda vez antes de desistir. */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (firstError) {
      if (!isChunkLoadError(firstError)) throw firstError;
      await wait(800);
      return factory();
    }
  });
}
