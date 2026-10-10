// Classifies a commented question into a discipline by keyword score (no AI), so the app can filter by discipline
// before matching the subject. Strong legal references weigh 3, ordinary terms 1; the statement and options count
// double, the professor's comment once. Below MIN_SCORE the question is left as 'Outras'.
const D = {
  'Língua Portuguesa': [
    ['crase', 3], ['concordância', 3], ['regência', 3], ['pontuação', 3], ['vírgula', 2], ['oração', 2], ['subordinada', 3], ['coordenada', 3],
    ['advérbio', 3], ['pronome', 3], ['substantivo', 3], ['adjetivo', 3], ['sujeito', 1], ['predicado', 3], ['norma culta', 3], ['ortografia', 3],
    ['acentuação', 3], ['sintaxe', 3], ['semântic', 3], ['coesão', 3], ['coerência', 3], ['figura de linguagem', 3], ['segundo o texto', 3], ['de acordo com o texto', 2],
    ['no trecho', 2], ['no período', 2], ['sinônimo', 3], ['sentido da palavra', 3], ['interpretação de texto', 3], ['conjunção', 3], ['preposição', 3], ['verbo', 1],
    ['colocação pronominal', 3], ['voz passiva', 3], ['gênero textual', 3], ['intertextualidade', 3], ['denotação', 3], ['conotação', 3], ['paráfrase', 3], ['termo da oração', 3],
  ],
  'Raciocínio Lógico': [
    ['proposição', 3], ['proposições', 3], ['tabela-verdade', 3], ['tabela verdade', 3], ['negação lógica', 3], ['silogismo', 3], ['diagrama de venn', 3], ['probabilidade', 2],
    ['análise combinatória', 3], ['combinação', 1], ['permutação', 3], ['porcentagem', 2], ['regra de três', 3], ['razão', 1], ['proporção', 2], ['conectivo', 3], ['equivalência lógica', 3],
    ['contrapositiva', 3], ['sequência lógica', 3], ['média aritmética', 2], ['conjunto', 1], ['verdadeir', 1], ['falsa', 1], ['lógica', 1], ['probabilidade', 2], ['inteiros', 1],
  ],
  'Informática': [
    ['excel', 3], ['microsoft word', 3], ['word', 1], ['planilha', 3], ['windows', 3], ['sistema operacional', 3], ['navegador', 3], ['correio eletrônico', 3], ['e-mail', 1], ['backup', 3],
    ['malware', 3], ['vírus', 2], ['firewall', 3], ['phishing', 3], ['libreoffice', 3], ['linux', 3], ['computação em nuvem', 3], ['nuvem', 2], ['pen drive', 3], ['criptografia', 3],
    ['protocolo', 1], ['internet', 2], ['intranet', 3], ['hardware', 3], ['software', 2], ['arquivo', 1], ['pasta', 1], ['powerpoint', 3], ['segurança da informação', 3], ['ransomware', 3], ['google chrome', 3],
  ],
  'Direito Constitucional': [
    ['constituição federal', 3], ['cf/88', 3], ['cf/1988', 3], ['poder constituinte', 3], ['direitos fundamentais', 3], ['remédio constitucional', 3], ['mandado de segurança', 3],
    ['mandado de injunção', 3], ['habeas data', 3], ['nacionalidade', 3], ['controle de constitucionalidade', 3], ['adi ', 2], ['supremo tribunal federal', 2], ['emenda constitucional', 3],
    ['poder legislativo', 2], ['congresso nacional', 3], ['direitos políticos', 3], ['federação', 2], ['ordem social', 3], ['direitos e garantias', 3], ['princípios fundamentais', 2],
    ['estado de defesa', 3], ['estado de sítio', 3], ['cláusula pétrea', 3], ['presidente da república', 2], ['tribunal de contas', 2], ['naturalização', 3], ['brasileiro nato', 3], ['segurança pública', 2],
  ],
  'Direito Administrativo': [
    ['ato administrativo', 3], ['atos administrativos', 3], ['poder de polícia', 3], ['licitação', 3], ['contrato administrativo', 3], ['servidor público', 2], ['improbidade', 3], ['processo administrativo', 3],
    ['agente público', 3], ['responsabilidade civil do estado', 3], ['bens públicos', 3], ['serviço público', 3], ['serviços públicos', 3], ['concessão', 2], ['autarquia', 3], ['administração direta', 3],
    ['administração indireta', 3], ['princípios da administração', 3], ['lei nº 8.112', 3], ['lei 8.112', 3], ['14.133', 3], ['8.666', 3], ['8.429', 3], ['lei nº 9.784', 3], ['poder hierárquico', 3],
    ['poder disciplinar', 3], ['poder regulamentar', 3], ['desapropriação', 3], ['intervenção do estado', 3], ['empresa pública', 2], ['sociedade de economia mista', 3], ['discricionári', 2], ['vinculad', 1], ['pregão', 3], ['servidor', 1],
  ],
  'Direito Penal': [
    ['crime', 1], ['legítima defesa', 3], ['dolo', 2], ['culpa', 1], ['tipicidade', 3], ['furto', 3], ['roubo', 3], ['homicídio', 3], ['código penal', 3], ['excludente de ilicitude', 3], ['excludente de', 2],
    ['prescrição da pretensão', 3], ['concurso de crimes', 3], ['erro de tipo', 3], ['peculato', 3], ['corrupção passiva', 3], ['corrupção ativa', 3], ['concussão', 3], ['estado de necessidade', 3], ['tentativa', 1],
    ['culpabilidade', 3], ['antijuridicidade', 3], ['pena privativa', 3], ['regime inicial', 3], ['lesão corporal', 3], ['estupro', 3], ['extorsão', 3], ['estelionato', 3], ['latrocínio', 3], ['art. 121', 3], ['art. 155', 3], ['art. 157', 3],
    ['teoria do crime', 3], ['crime impossível', 3], ['desistência voluntária', 3], ['arrependimento eficaz', 3], ['lei penal no tempo', 3], ['sursis', 3], ['pena de multa', 3], ['dosimetria', 3], ['coautoria', 3], ['inimputabilidade', 3],
  ],
  'Direito Processual Penal': [
    ['inquérito policial', 3], ['ação penal', 3], ['prisão preventiva', 3], ['flagrante', 3], ['código de processo penal', 3], ['cpp', 2], ['denúncia', 2], ['tribunal do júri', 3], ['habeas corpus', 2],
    ['interrogatório', 3], ['citação', 1], ['prisão temporária', 3], ['medidas cautelares', 3], ['busca e apreensão', 3], ['nulidade', 1], ['audiência de custódia', 3], ['competência', 1], ['queixa-crime', 3],
    ['denunciado', 2], ['sentença penal', 3], ['juiz das garantias', 3], ['delegado de polícia', 1], ['indiciamento', 3], ['relaxamento da prisão', 3], ['liberdade provisória', 3], ['ação penal privada', 3], ['pronúncia', 3],
  ],
  'Legislação Especial': [
    ['lei de drogas', 3], ['11.343', 3], ['estatuto do desarmamento', 3], ['10.826', 3], ['abuso de autoridade', 3], ['13.869', 3], ['maria da penha', 3], ['11.340', 3], ['tortura', 2], ['9.455', 3],
    ['crimes hediondos', 3], ['8.072', 3], ['organização criminosa', 3], ['12.850', 3], ['estatuto da criança', 3], ['8.069', 3], ['código de trânsito', 3], ['9.503', 3], ['lei complementar nº 3.400', 3], ['3.400/81', 3],
    ['estatuto dos policiais', 3], ['estatuto dos funcionários policiais', 3], ['lei 9.099', 3], ['juizados especiais', 3], ['interceptação telefônica', 3], ['9.296', 3], ['lavagem de dinheiro', 3], ['9.613', 3], ['racismo', 1], ['7.716', 3],
    ['estatuto do idoso', 3], ['estatuto da pessoa com deficiência', 3], ['lei nº 13.964', 3], ['pacote anticrime', 3], ['lei 12.037', 3], ['identificação criminal', 3],
  ],
  'Direitos Humanos': [
    ['direitos humanos', 3], ['declaração universal', 3], ['pacto de são josé', 3], ['convenção americana', 3], ['corte interamericana', 3], ['tratados internacionais de direitos', 3], ['dignidade da pessoa humana', 2], ['pidcp', 3], ['pacto internacional', 3],
  ],
  'Administração': [
    ['planejamento estratégico', 3], ['gestão de pessoas', 3], ['administração geral', 3], ['podc', 3], ['organograma', 3], ['cultura organizacional', 3], ['liderança', 3], ['motivação', 2], ['taylor', 3], ['fayol', 3], ['administração de materiais', 3], ['gestão de processos', 3], ['balanced scorecard', 3], ['estoque', 2],
  ],
  'Contabilidade e Finanças': [
    ['balanço patrimonial', 3], ['lei de responsabilidade fiscal', 3], ['lrf', 3], ['orçamento público', 3], ['ldo', 3], ['receita pública', 3], ['despesa pública', 3], ['empenho', 3], ['plano de contas', 3], ['demonstração', 2], ['ativo circulante', 3], ['depreciação', 3], ['partidas dobradas', 3],
  ],
  'Direito Civil': [
    ['código civil', 3], ['negócio jurídico', 3], ['pessoa natural', 3], ['capacidade civil', 3], ['usucapião', 3], ['obrigações', 2], ['contrato de', 1], ['responsabilidade civil', 2], ['direitos reais', 3], ['posse', 1], ['propriedade', 1], ['prescrição e decadência', 3], ['casamento', 2], ['sucessões', 3],
  ],
  'Direito Processual Civil': [
    ['código de processo civil', 3], ['cpc', 2], ['petição inicial', 3], ['contestação', 3], ['litisconsórcio', 3], ['tutela provisória', 3], ['sentença', 1], ['execução', 1], ['recurso de apelação', 3], ['agravo de instrumento', 3], ['coisa julgada', 3],
  ],
};
const norm = (s) => s.toLowerCase().normalize('NFC');
const count = (text, term) => { let n = 0, i = text.indexOf(term); while (i >= 0 && n < 4) { n++; i = text.indexOf(term, i + term.length); } return n; };

export const MIN_SCORE = 4;
export const classify = ({ enunciado, alternativas, comentario }) => {
  const head = norm(`${enunciado} ${Object.values(alternativas ?? {}).join(' ')}`);
  const tail = norm((comentario ?? '').slice(0, 700));
  let best = 'Outras', bestScore = 0, second = 0;
  for (const [name, terms] of Object.entries(D)) {
    let score = 0;
    for (const [term, w] of terms) score += w * (2 * Math.min(count(head, term), 2) + Math.min(count(tail, term), 2));
    if (score > bestScore) { second = bestScore; bestScore = score; best = name; } else if (score > second) second = score;
  }
  return bestScore >= MIN_SCORE && bestScore >= second * 1.3 ? best : 'Outras';
};
export const DISCIPLINAS = Object.keys(D);
