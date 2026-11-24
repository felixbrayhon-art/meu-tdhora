import { describe, expect, it } from 'vitest';
import { configDoMascote, limpar } from '../services/mascote';

describe('opções do estúdio do mascote', () => {
  it.each(['trancas', 'ondulado', 'coques'] as const)('recupera o penteado %s', (estilo) => {
    const salvo = limpar({ modo: 'criado', estilo, cabelo: '#735129' });
    expect(configDoMascote(undefined, salvo)).toMatchObject({ estilo, cabelo: '#735129' });
  });
  it.each(['polo', 'jaqueta', 'jardineira', 'golaAlta'] as const)('recupera a roupa %s e sua cor', (camisa) => {
    const salvo = limpar({ modo: 'criado', camisa, corDetalhe: '#ac9350' });
    expect(configDoMascote(undefined, salvo)).toMatchObject({ detalheRoupa: camisa, corDetalheRoupa: '#ac9350' });
  });
  it.each(['touca', 'boina', 'fivePanel'] as const)('aplica %s ao mascote criado e ao pronto', (chapeu) => {
    for (const modo of ['criado', 'pronto'] as const) {
      const salvo = limpar({ modo, base: 'medica', chapeu, corChapeu: '#123456' });
      expect(configDoMascote('medica', salvo)?.[chapeu]).toBe('#123456');
    }
  });
  it.each(['celular', 'garrafa', 'pincel'] as const)('recupera o adereço %s', (dir) => {
    expect(configDoMascote(undefined, limpar({ modo: 'criado', dir }))?.dir).toBe(dir);
  });
  it.each(['camiseta', 'listrada', 'social', 'regata', 'moletom', 'jaleco', 'terno', 'colete', 'toga', 'polo', 'jaqueta', 'jardineira', 'golaAlta', 'sem'] as const)('preserva a roupa %s e os detalhes ao recuperar as escolhas', (camisa) => {
    const salvo = limpar({ modo: 'criado', camisa, calca: 'bermuda', calcado: 'tenis', corCamisa: '#123456', corCalca: '#987654', corCalcado: '#345678' });
    expect(configDoMascote(undefined, salvo)).toMatchObject({ roupaEstudio: camisa, parteBaixoEstudio: 'bermuda', calcadoEstudio: 'tenis', torso: '#123456', pernas: '#987654', sapato: '#345678' });
  });
  it.each(['redondo', 'aviador', 'gatinho'] as const)('recupera os óculos %s e sua armação', (oculos) => {
    const salvo = limpar({ modo: 'criado', oculos, corOculos: '#ab5423' });
    expect(configDoMascote(undefined, salvo)).toMatchObject({ oculosEstudio: oculos, oculos: '#ab5423' });
  });
  it.each(['tenis', 'tenisCanoAlto', 'tenisEsportivo', 'tenisCasual'] as const)('recupera o tênis %s e as cores', (calcado) => {
    const salvo = limpar({ modo: 'criado', calcado, corCalcado: '#315a77', corDetalheCalcado: '#f1a264' });
    expect(configDoMascote(undefined, salvo)).toMatchObject({ calcadoEstudio: calcado, sapato: '#315a77', detalheCalcadoEstudio: '#f1a264' });
  });
  it('recusa cores inválidas e continua aceitando cores livres válidas', () => {
    expect(limpar({ modo: 'criado', corCamisa: 'url(malicioso)' }).corCamisa).toBeUndefined();
    expect(limpar({ modo: 'criado', corCamisa: '#123abc' }).corCamisa).toBe('#123abc');
  });
});
