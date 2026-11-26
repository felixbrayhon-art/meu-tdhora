import { describe, expect, it } from 'vitest';
import { configDoMascote, limpar, trocarCamisa } from '../services/mascote';

describe('opções do estúdio do mascote', () => {
  it.each(['trancas', 'ondulado', 'coques', 'espetado', 'topete', 'raspado', 'dreads', 'chiquinhas'] as const)('recupera o penteado %s', (estilo) => {
    const salvo = limpar({ modo: 'criado', estilo, cabelo: '#735129' });
    expect(configDoMascote(undefined, salvo)).toMatchObject({ estilo, cabelo: '#735129' });
  });
  it.each(['polo', 'jaqueta', 'jardineira', 'golaAlta', 'xadrez', 'futebol', 'farda', 'cardiga'] as const)('recupera a roupa %s e sua cor', (camisa) => {
    const salvo = limpar({ modo: 'criado', camisa, corDetalhe: '#ac9350' });
    expect(configDoMascote(undefined, salvo)).toMatchObject({ detalheRoupa: camisa, corDetalheRoupa: '#ac9350' });
  });
  it.each(['touca', 'boina', 'fivePanel', 'viseira', 'palha', 'bandana'] as const)('aplica %s ao mascote criado e ao pronto', (chapeu) => {
    for (const modo of ['criado', 'pronto'] as const) {
      const salvo = limpar({ modo, base: 'medica', chapeu, corChapeu: '#123456' });
      expect(configDoMascote('medica', salvo)?.[chapeu]).toBe('#123456');
    }
  });
  it.each(['celular', 'garrafa', 'pincel'] as const)('recupera o adereço %s', (dir) => {
    expect(configDoMascote(undefined, limpar({ modo: 'criado', dir }))?.dir).toBe(dir);
  });
  it.each(['camiseta', 'listrada', 'social', 'regata', 'moletom', 'jaleco', 'terno', 'colete', 'toga', 'polo', 'jaqueta', 'jardineira', 'golaAlta', 'xadrez', 'futebol', 'farda', 'cardiga', 'sem'] as const)('preserva a roupa %s e os detalhes ao recuperar as escolhas', (camisa) => {
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
  it('o chinelo deixa o pé descoberto e guarda a cor da tira', () => {
    const salvo = limpar({ modo: 'criado', calcado: 'chinelo', corDetalheCalcado: '#e2b36a' });
    expect(configDoMascote(undefined, salvo)).toMatchObject({ calcadoEstudio: 'chinelo', detalheCalcadoEstudio: '#e2b36a' });
  });
  it('aplica a cor do detalhe à gola social sem criar uma faixa sobre a camisa', () => {
    const config = configDoMascote(undefined, limpar({ modo: 'criado', camisa: 'social', corCamisa: '#315a77', corDetalhe: '#f1a264' }));
    expect(config).toMatchObject({ roupaEstudio: 'social', torso: '#315a77', corDetalheRoupa: '#f1a264' });
    expect(config?.faixa).toBeUndefined();
  });
  it('recusa cores inválidas e continua aceitando cores livres válidas', () => {
    expect(limpar({ modo: 'criado', corCamisa: 'url(malicioso)' }).corCamisa).toBeUndefined();
    expect(limpar({ modo: 'criado', corCamisa: '#123abc' }).corCamisa).toBe('#123abc');
  });
});

describe('novos detalhes personalizados', () => {
  it.each(['boneTras', 'faixaCabeca', 'bandana', 'lacoCabeca'] as const)('guarda o acessório de cabeça %s e a cor', (chapeu) => {
    const salvo = limpar({ modo: 'criado', chapeu, corChapeu: '#aabbcc' });
    expect(configDoMascote(undefined, salvo)?.[chapeu]).toBe('#aabbcc');
  });
  it.each(['estampada', 'jaquetaCapuz', 'vestido', 'esportiva'] as const)('guarda a roupa %s com suas cores', (camisa) => {
    const salvo = limpar({ modo: 'criado', camisa, corCamisa: '#224466', corDetalhe: '#ddbb88' });
    expect(configDoMascote(undefined, salvo)).toMatchObject({ roupaEstudio: camisa, torso: '#224466', corDetalheRoupa: '#ddbb88' });
  });
  it('guarda os detalhes de rosto e a sobrancelha escolhida', () => {
    const salvo = limpar({ modo: 'criado', sardas: true, covinhas: true, aparelho: true, sobrancelha: 'arqueada' });
    expect(configDoMascote(undefined, salvo)).toMatchObject({ sardas: true, covinhas: true, aparelho: true, sobrancelhaEstudio: 'arqueada' });
  });
  it.each(['coleira', 'bandana', 'placa'] as const)('recupera o acessório %s para animal criado e pronto', (acessorioAnimal) => {
    for (const escolha of [{ modo: 'criado', especie: 'capivara', nome: 'Lua' }, { modo: 'pronto', base: 'gato-jaqueta' }]) {
      const salvo = limpar({ ...escolha, acessorioAnimal, corAcessorioAnimal: '#c97a33' });
      expect(configDoMascote(undefined, salvo)).toMatchObject({ acessorioAnimal, corAcessorioAnimal: '#c97a33' });
    }
  });
});

describe('traje medieval', () => {
  it('recupera a armadura, o elmo e as cores escolhidas', () => {
    const salvo = limpar({ modo: 'criado', camisa: 'armadura', chapeu: 'elmoMedieval', calcado: 'bota', corCamisa: '#a0a8ac', corChapeu: '#9aa1a6', corDetalhe: '#963c3c' });
    expect(configDoMascote(undefined, salvo)).toMatchObject({ roupaEstudio: 'armadura', elmoMedieval: '#9aa1a6', torso: '#a0a8ac', corDetalheRoupa: '#963c3c', calcadoEstudio: 'bota' });
  });
  it('permite substituir o elmo e preserva as cores de um personagem pronto', () => {
    const salvo = limpar({ modo: 'pronto', base: 'medica', chapeu: 'elmoMedieval', corChapeu: '#a0a8ac' });
    expect(configDoMascote('medica', salvo)?.elmoMedieval).toBe('#a0a8ac');
    const semElmo = limpar({ modo: 'criado', camisa: 'armadura', chapeu: 'nenhum' });
    expect(configDoMascote(undefined, semElmo)?.elmoMedieval).toBeUndefined();
  });
});

describe('troca do conjunto medieval', () => {
  it('restaura as escolhas anteriores ao sair da armadura, inclusive depois de salvar', () => {
    const anterior = { modo: 'criado' as const, camisa: 'polo' as const, chapeu: 'bone' as const, calcado: 'tenis' as const, corCamisa: '#123456', corChapeu: '#334455', corCalcado: '#667788', corDetalhe: '#abcdef' };
    const equipado = limpar(JSON.parse(JSON.stringify({ ...anterior, ...trocarCamisa(anterior, 'armadura') })));
    const resultado = { ...equipado, ...trocarCamisa(equipado, 'social') };
    expect(resultado).toMatchObject({ ...anterior, camisa: 'social' });
    expect(resultado.antesArmadura).toBeUndefined();
    expect(configDoMascote(undefined, resultado)?.elmoMedieval).toBeUndefined();
  });
  it('preserva peças e cores trocadas manualmente durante o uso da armadura', () => {
    const anterior = { modo: 'criado' as const, camisa: 'camiseta' as const };
    const equipado = { ...anterior, ...trocarCamisa(anterior, 'armadura'), chapeu: 'boina' as const, calcado: 'tenisCasual' as const, corCamisa: '#112233' };
    const resultado = { ...equipado, ...trocarCamisa(equipado, 'camiseta') };
    expect(resultado).toMatchObject({ chapeu: 'boina', calcado: 'tenisCasual', corCamisa: '#112233' });
  });
  it('limpa o conjunto automático em mascotes antigos sem histórico', () => {
    const equipado = limpar({ modo: 'criado', camisa: 'armadura', chapeu: 'elmoMedieval', calcado: 'bota', corCamisa: '#a0a8ac', corChapeu: '#a0a8ac', corCalcado: '#7b858c', corDetalhe: '#963c3c' });
    const resultado = { ...equipado, ...trocarCamisa(equipado, 'camiseta') };
    expect(resultado.chapeu).toBeUndefined();
    expect(resultado.calcado).toBeUndefined();
    expect(resultado.corCamisa).toBeUndefined();
    expect(configDoMascote(undefined, resultado)?.elmoMedieval).toBeUndefined();
  });
  it('não substitui um elmo escolhido separadamente sem armadura', () => {
    const escolhido = { modo: 'criado' as const, camisa: 'polo' as const, chapeu: 'elmoMedieval' as const };
    expect({ ...escolhido, ...trocarCamisa(escolhido, 'camiseta') }.chapeu).toBe('elmoMedieval');
  });
});
