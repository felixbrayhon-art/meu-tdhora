import { describe, expect, it } from 'vitest';
import { limpar, configDoMascote } from '../services/mascote';

describe('animais brasileiros no estúdio', () => {
  it.each(['capivara', 'onca', 'arara'] as const)('restaura e monta %s com as escolhas do usuário', (especie) => {
    const mascote = limpar({ modo: 'criado', nome: 'Sol', especie, pele: '#a87550', corCamisa: '#e96f34', dir: 'livro', animacao: 'estudando' });
    const cfg = configDoMascote(undefined, mascote);
    expect(mascote.especie).toBe(especie);
    expect(cfg?.bicho?.especie).toBe(especie);
    expect(cfg?.skin).toBe('#a87550');
    expect(cfg?.dir).toBe('livro');
    expect(mascote.animacao).toBe('estudando');
  });
  it.each(['cachorro', 'gato', 'raposa', 'guaxinim', 'urso', 'coelho', 'rato'] as const)('preserva a espécie %s ao recuperar o mascote', (especie) => {
    const mascote = limpar({ modo: 'criado', especie, pele: '#a87550' });
    expect(configDoMascote(undefined, mascote)?.bicho?.especie).toBe(especie);
  });
  it('dá ao guaxinim orelha redonda e o rabo de cinco anéis alternados', () => {
    const cfg = configDoMascote(undefined, limpar({ modo: 'criado', especie: 'guaxinim', pele: '#bdb3a8' }));
    expect(cfg?.bicho?.orelhaTipo).toBe('redonda');
    expect(cfg?.bicho?.mascara).toBeTruthy();
    const rabo = cfg?.bicho?.rabo || [];
    expect(rabo).toHaveLength(5);
    // Claro, escuro, claro, escuro, ponta: dois anéis seguidos nunca repetem.
    expect(rabo.filter((cor, i) => i > 0 && cor === rabo[i - 1])).toHaveLength(0);
  });
  it('não adiciona cauda longa à capivara', () => {
    expect(configDoMascote(undefined, { modo: 'criado', especie: 'capivara' })?.bicho?.rabo).toEqual([]);
  });
});
