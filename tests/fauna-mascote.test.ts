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
  it('não adiciona cauda longa à capivara', () => {
    expect(configDoMascote(undefined, { modo: 'criado', especie: 'capivara' })?.bicho?.rabo).toEqual([]);
  });
});
