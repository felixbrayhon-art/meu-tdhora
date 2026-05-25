export interface MedicinaPeriod {
  nome: string;
  materias: {
    nome: string;
    tipo: string;
    icon: string;
    ementa: string;
  }[];
}

export const MEDICINA_CURRICULUM: { [key: number]: MedicinaPeriod } = {
  1: {
    nome: "Bases da Medicina",
    materias: [
      { nome: "Atenção Primária em Saúde I", tipo: "Saúde Coletiva", icon: "ti-heart-handshake", ementa: "Princípios e diretrizes do SUS; Redes de Atenção à Saúde; Acolhimento e territorialização na Atenção Primária." },
      { nome: "Humanidades I – Antropologia", tipo: "Humanidades", icon: "ti-users", ementa: "Antropologia médica; Determinantes sociais da saúde; Relação médico-paciente e diversidade cultural." },
      { nome: "Biologia Celular", tipo: "Ciências Básicas", icon: "ti-microscope", ementa: "Estrutura celular e de organelas; Membrana plasmática; Divisão celular e genética molecular básica." },
      { nome: "Bioquímica", tipo: "Ciências Básicas", icon: "ti-flask", ementa: "Estrutura de macromoléculas; Metabolismo de carboidratos, lipídios e proteínas; Enzimologia clínica." },
      { nome: "Fisiologia I", tipo: "Ciências Básicas", icon: "ti-activity", ementa: "Fisiologia celular; Potenciais de ação e sinapses; Fisiologia do sistema renal e muscular." },
      { nome: "Anatomia I", tipo: "Morfologia", icon: "ti-body-scan", ementa: "Introdução ao estudo anatômico; Sistema esquelético, articular e muscular; Terminologia anatômica." },
      { nome: "Histologia I", tipo: "Morfologia", icon: "ti-vaccine", ementa: "Histologia dos tecidos fundamentais: epitelial, conjuntivo, muscular e adiposo." },
      { nome: "Semiologia I", tipo: "Clínica", icon: "ti-stethoscope", ementa: "História clínica (Anamnese); Comunicação clínica; Exame físico geral e sinais vitais." },
      { nome: "Projeto de Intervenção na Comunidade I", tipo: "Extensão", icon: "ti-building-community", ementa: "Diagnóstico comunitário e levantamento de necessidades de saúde da população local." },
      { nome: "Metodologia da Pesquisa", tipo: "Pesquisa", icon: "ti-search", ementa: "Fundamentos do método científico; Elaboração de projetos de pesquisa; Pesquisa em bases bibliográficas." },
    ]
  },
  2: {
    nome: "Sistemas do Corpo",
    materias: [
      { nome: "Atenção Primária em Saúde II", tipo: "Saúde Coletiva", icon: "ti-heart-handshake", ementa: "Estratégia Saúde da Família; Visita domiciliar; Planejamento de ações na UBS." },
      { nome: "Humanidades II – Medicina e Meio Ambiente", tipo: "Humanidades", icon: "ti-leaf", ementa: "Saúde ambiental; Saneamento básico; Impacto ecológico no perfil epidemiológico." },
      { nome: "Fisiologia II", tipo: "Ciências Básicas", icon: "ti-activity", ementa: "Fisiologia cardiovascular, respiratória, digestória e endócrina." },
      { nome: "Anatomia II", tipo: "Morfologia", icon: "ti-body-scan", ementa: "Anatomia funcional dos sistemas cardiovascular, respiratório, digestório e urinário." },
      { nome: "Histologia II", tipo: "Morfologia", icon: "ti-vaccine", ementa: "Estudo histológico dos sistemas circulatório, respiratório, digestório e urinário." },
      { nome: "Semiologia II", tipo: "Clínica", icon: "ti-stethoscope", ementa: "Exame clínico avançado: semiologia cardiovascular, respiratória e abdominal." },
      { nome: "Imunologia", tipo: "Ciências Básicas", icon: "ti-shield", ementa: "Sistema imune inato e adaptativo; Resposta imune humoral e celular; Imunopatologias." },
      { nome: "Genética", tipo: "Ciências Básicas", icon: "ti-dna", ementa: "Herança mendeliana e não mendeliana; Diagnósticos e patologias genéticas comuns." },
      { nome: "Projeto de Intervenção na Comunidade II", tipo: "Extensão", icon: "ti-building-community", ementa: "Desenvolvimento de planos de ação comunitária em equipes de saúde." },
      { nome: "Bioestatística", tipo: "Pesquisa", icon: "ti-chart-bar", ementa: "Distribuições estatísticas; Testes de hipóteses; Aplicação estatística em estudos médicos." },
    ]
  },
  3: {
    nome: "Patologia e Farmaco",
    materias: [
      { nome: "Atenção Primária em Saúde III", tipo: "Saúde Coletiva", icon: "ti-heart-handshake", ementa: "Indicadores de saúde coletiva; Organização de campanhas vacinais; Educação em saúde." },
      { nome: "Humanidades III – Relações étnico-raciais", tipo: "Humanidades", icon: "ti-users", ementa: "Igualdade racial na saúde; Populações vulneráveis; Políticas de inclusão." },
      { nome: "Farmacologia I", tipo: "Farmacologia", icon: "ti-pill", ementa: "Farmacocinetica e farmacodinamica gerais; Farmacologia do sistema nervoso autônomo." },
      { nome: "Educação e Pesquisa em Saúde 3A", tipo: "Pesquisa", icon: "ti-book", ementa: "Interpretação crítica de artigos científicos; Metodologias quantitativas e qualitativas." },
      { nome: "Patologia", tipo: "Ciências Básicas", icon: "ti-microscope", ementa: "Adaptação, lesão e morte celular; Inflamação aguda e crônica; Neoplasias gerais." },
      { nome: "Fisiologia III", tipo: "Ciências Básicas", icon: "ti-activity", ementa: "Fisiologia do sistema nervoso central e autônomo; Integração fisiológica multicêntrica." },
      { nome: "Anatomia III", tipo: "Morfologia", icon: "ti-body-scan", ementa: "Neuroanatomia detalhada; Anatomia do sistema sensorial e tegumentar." },
      { nome: "Histologia III", tipo: "Morfologia", icon: "ti-vaccine", ementa: "Histologia do tecido nervoso, órgãos dos sentidos e parede celular de suporte." },
      { nome: "Semiologia III", tipo: "Clínica", icon: "ti-stethoscope", ementa: "Exame físico neurológico; Semiologia musculoesquelética; Semiologia endócrina." },
      { nome: "Projeto de Intervenção na Comunidade III", tipo: "Extensão", icon: "ti-building-community", ementa: "Execução Prática da primeira fase de intervenção local." },
      { nome: "Saúde Baseada em Evidências", tipo: "Pesquisa", icon: "ti-chart-line", ementa: "Elaboração de revisões sistemáticas; Busca por melhores evidências clínicas de tratamento." },
    ]
  },
  4: {
    nome: "Micro e Parasito",
    materias: [
      { nome: "Atenção Primária em Saúde IV", tipo: "Saúde Coletiva", icon: "ti-heart-handshake", ementa: "Gestão clínica na Atenção Primária; Planejamento estratégico situacional." },
      { nome: "Humanidades IV – Direitos Humanos e Ética", tipo: "Humanidades", icon: "ti-scale", ementa: "Bioética geral e clínica; Direitos humanos no contexto da saúde; Código de ética médica." },
      { nome: "Farmacologia II", tipo: "Farmacologia", icon: "ti-pill", ementa: "Farmacologia sistêmica: antimicrobianos, antinflamatórios e fármacos cardiovasculares." },
      { nome: "Patologia Clínica", tipo: "Clínica", icon: "ti-microscope", ementa: "Interpretação diagnóstica de exames laboratoriais de sangue, urina e fluidos corpóreos." },
      { nome: "Microbiologia", tipo: "Ciências Básicas", icon: "ti-virus", ementa: "Bacteriologia, virologia e micologia médicas; Mecanismos de patogênese microbiana." },
      { nome: "Parasitologia", tipo: "Ciências Básicas", icon: "ti-bug", ementa: "Protozoários, helmintos e ectoparasitas de importância médica em epidemiologia nacional." },
      { nome: "Semiologia IV", tipo: "Clínica", icon: "ti-stethoscope", ementa: "Semiologia pediátrica, ginecológica e geriátrica elementar; Consolidação da conduta médica." },
      { nome: "Projeto de Intervenção na Comunidade IV", tipo: "Extensão", icon: "ti-building-community", ementa: "Avaliação quantitativa dos resultados da intervenção comunitária territorial." },
    ]
  },
  5: {
    nome: "Clínica Médica I",
    materias: [
      { nome: "Atenção Primária em Saúde V", tipo: "Saúde Coletiva", icon: "ti-heart-handshake", ementa: "Abordagem familiar e comunitária centrada na pessoa. Visão biopsicossocial do paciente." },
      { nome: "Cardiologia", tipo: "Especialidade", icon: "ti-heart", ementa: "Insuficiência cardíaca; Doença coronariana; Hipertensão arterial; Valvopatias; Arritmias." },
      { nome: "Eletrocardiograma", tipo: "Especialidade", icon: "ti-activity", ementa: "Método e laudo de ECG; Sobrecargas, bloqueios de condução, infarto e arritmias no ECG." },
      { nome: "Nefrologia", tipo: "Especialidade", icon: "ti-droplet", ementa: "Insuficiência renal aguda e crônica; Glomerulonefrites; Distúrbios hidroeletrolíticos e metabólicos." },
      { nome: "Endocrinologia", tipo: "Especialidade", icon: "ti-chart-line", ementa: "Diabetes Mellitus; Dislipidemias; Doenças da tireoide e adrenais; Obesidade." },
      { nome: "Nutrologia", tipo: "Especialidade", icon: "ti-apple", ementa: "Necessidades nutricionais nas diferentes etapas da vida; Terapia enteral e parenteral; Deficiências." },
      { nome: "Gastroenterologia", tipo: "Especialidade", icon: "ti-stethoscope", ementa: "Doença cloridopéptica; Disfagia; Síndromes disabsortivas; Hepatopatias e pancreatite." },
      { nome: "Propedêutica I", tipo: "Clínica", icon: "ti-clipboard-list", ementa: "Raciocínio diagnóstico integrado em clínica médica; Casos clínicos reais com simulações." },
      { nome: "Projeto de Intervenção na Comunidade V", tipo: "Extensão", icon: "ti-building-community", ementa: "Foco no desenvolvimento de tecnologias leves na saúde de grupos especiais." },
    ]
  },
  6: {
    nome: "Cirurgia e Emergência",
    materias: [
      { nome: "Atenção Primária em Saúde VI", tipo: "Saúde Coletiva", icon: "ti-heart-handshake", ementa: "Gerenciamento de serviços básicos de saúde; Liderança comunitária e SUS." },
      { nome: "Diagnóstico por Imagem", tipo: "Especialidade", icon: "ti-scan", ementa: "Princípios de Radiologia, Ultrassonografia, Tomografia Computadorizada e Ressonância Magnética." },
      { nome: "Cirurgia Geral", tipo: "Cirurgia", icon: "ti-scalpel", ementa: "Pós-operatório e distúrbios de cicatrização; Abdome agudo obstrutivo, inflamatório, perfurativo." },
      { nome: "Cirurgia Especializada", tipo: "Cirurgia", icon: "ti-scalpel", ementa: "Urologia, Cirurgia Plástica e Cirurgia Vascular fundamentais para clínica geral." },
      { nome: "Ortopedia", tipo: "Especialidade", icon: "ti-bone", ementa: "Traumatologia geral, fraturas e luxações; Doenças crônicas degenerativas ósteo-articulares." },
      { nome: "Técnica Operatória", tipo: "Cirurgia", icon: "ti-tools", ementa: "Assepsia e antissepsia, instrumentação, paramentação, techniques de suturas e nós cirúrgicos." },
      { nome: "Medicina de Emergência", tipo: "Emergência", icon: "ti-ambulance", ementa: "Parada cardiorrespiratória (reanimação básica e avançada), choque, anafilaxia, trauma grave (vias aéreas)." },
      { nome: "Pneumologia", tipo: "Especialidade", icon: "ti-lungs", ementa: "Asma brônquica; Doença pulmonar obstrutiva crônica; Infecções respiratórias comunitárias." },
      { nome: "Otorrinolaringologia", tipo: "Especialidade", icon: "ti-ear", ementa: "Doenças infecciosas e inflamatórias das vias aéreas superiores, rinites, otites e sinusites." },
      { nome: "Propedêutica II", tipo: "Clínica", icon: "ti-clipboard-list", ementa: "Acompanhamento prático cirúrgico simulado e resolução de agravos agudos." },
      { nome: "Projeto de Intervenção na Comunidade VI", tipo: "Extensão", icon: "ti-building-community", ementa: "Metodologias ativas aplicadas à capacitação em vigilância e saúde epidemiológica." },
    ]
  },
  7: {
    nome: "Especialidades",
    materias: [
      { nome: "Atenção Primária em Saúde VII", tipo: "Saúde Coletiva", icon: "ti-heart-handshake", ementa: "Tratamento multiprofissional e integrado na APS." },
      { nome: "Saúde Mental na prática Médica", tipo: "Especialidade", icon: "ti-brain", ementa: "Reconhecimento de psicopatologia clínica na Atenção Básica; Prescrição psicotrópica racional." },
      { nome: "Neurologia", tipo: "Especialidade", icon: "ti-brain", ementa: "Acidente Vascular Cerebral (AVC); Cefaleias; Epilepsias; Demências e Parkinson." },
      { nome: "Geriatria", tipo: "Especialidade", icon: "ti-old", ementa: "Processo fisiológico do envelhecimento; Síndromes geriátricas (GIGs); Polifarmácia e fragilidade." },
      { nome: "Oftalmologia", tipo: "Especialidade", icon: "ti-eye", ementa: "Olho vermelho infeccioso; Glaucoma; Descolamento de retina; Distúrbios visuais na triagem clínica." },
      { nome: "Cuidados Paliativos", tipo: "Especialidade", icon: "ti-heart", ementa: "Abordagem e princípios paliativos; Controle álgico avançado; Diretivas antecipadas de vontade." },
      { nome: "Oncologia e Hematologia", tipo: "Especialidade", icon: "ti-microscope", ementa: "Princípios do tratamento oncológico; Diagnóstico de anemias, leucemias e linfomas comuns." },
      { nome: "Infectologia", tipo: "Especialidade", icon: "ti-virus", ementa: "Doenças infectocontagiosas tropicais, HIV/AIDS, tuberculose, micoses profundas e assepsia integral." },
      { nome: "Reumatologia", tipo: "Especialidade", icon: "ti-bone", ementa: "Artrite reumatoide, Gota, Lúpus Eritematoso Sistêmico, Fibromialgia e Espondiloartropatias." },
      { nome: "Propedêutica III", tipo: "Clínica", icon: "ti-clipboard-list", ementa: "Raciocínio clínico nas especialidades ambulatoriais e consolidação da conduta técnica." },
      { nome: "Projeto de Intervenção na Comunidade VII", tipo: "Extensão", icon: "ti-building-community", ementa: "Atividades integradas com a comunidade sobre prevenção ao câncer e infecções." },
      { nome: "Metodologia da Pesquisa Aplicada", tipo: "Pesquisa", icon: "ti-search", ementa: "Uso avançado de evidências no delineamento de TCC e publicação de artigos de valor científico." },
    ]
  },
  8: {
    nome: "Saúde da Família",
    materias: [
      { nome: "Atenção Primária em Saúde VIII", tipo: "Saúde Coletiva", icon: "ti-heart-handshake", ementa: "Consolidação e estágio supervisionado na APS médica integradora." },
      { nome: "Saúde da Criança", tipo: "Especialidade", icon: "ti-baby-carriage", ementa: "Patologias agudas na pediatria (diarreia, IVAS, otite, asma); Urgências pediátricas básicas." },
      { nome: "Puericultura", tipo: "Especialidade", icon: "ti-baby-carriage", ementa: "Marcos do crescimento e desenvolvimento infantil; Aleitamento materno; Vacinação." },
      { nome: "Dermatologia", tipo: "Especialidade", icon: "ti-sun", ementa: "Micoses cutâneas, dermatites, psoríase, acne, eczemas e triagem epidemiológica de câncer de pele." },
      { nome: "Alergia e Imunologia", tipo: "Especialidade", icon: "ti-shield", ementa: "Urticárias e angioedema; Testes de sensibilidade; Alergia alimentar." },
      { nome: "Saúde da Mulher", tipo: "Especialidade", icon: "ti-gender-female", ementa: "Ginecologia geral clínica: corrimentos, sangramento uterino anormal, anticoncepção." },
      { nome: "Saúde da Gestante", tipo: "Especialidade", icon: "ti-gender-female", ementa: "Pré-natal qualificado e rotinas do exame obstétrico de rastreamento de risco." },
      { nome: "Pré-Internato", tipo: "Internato", icon: "ti-building-hospital", ementa: "Simulação de plantões integrados, triagem e conduta em prontos-socorros com casos críticos reais." },
      { nome: "Gestão em Saúde", tipo: "Gestão", icon: "ti-chart-bar", ementa: "Administração hospitalar, fluxos de regulação e gestão em serviços de saúde públicos." },
      { nome: "Projeto de Intervenção na Comunidade VIII", tipo: "Extensão", icon: "ti-building-community", ementa: "Apresentação e encerramento do Projeto integrador de saúde da família e extensão." },
      { nome: "Trabalho de Conclusão de Curso", tipo: "Pesquisa", icon: "ti-file-certificate", ementa: "Defesa formal e apresentação do TCC acadêmico médico estruturado." },
    ]
  },
  9: {
    nome: "Internato I",
    materias: [
      { nome: "Medicina de Família e Comunidade I", tipo: "Internato", icon: "ti-building-hospital", ementa: "Estágio prático intensivo em UBS: atendimento focado, pré-natal, infantil e geriátrico." },
      { nome: "Clínica Médica", tipo: "Internato", icon: "ti-stethoscope", ementa: "Enfermarias clínicas de atenção terciária: prescrição, evolução de pacientes sob supervisão." },
    ]
  },
  10: {
    nome: "Internato II",
    materias: [
      { nome: "Ginecologia e Obstetrícia", tipo: "Internato", icon: "ti-gender-female", ementa: "Prática em centro obstétrico, acompanhamento pré e pós parto e cirurgias ginecológicas básicas." },
      { nome: "Pediatria", tipo: "Internato", icon: "ti-baby-carriage", ementa: "Prática em pronto socorro infantil e enfermarias pediátricas clínicas supervisionadas." },
      { nome: "Componente Optativo I", tipo: "Optativo", icon: "ti-star", ementa: "Estágio prático opcional em especialidades clínicas de escolha do estudante." },
    ]
  },
  11: {
    nome: "Internato III",
    materias: [
      { nome: "Cirurgia", tipo: "Internato", icon: "ti-scalpel", ementa: "Prática em centro cirúrgico: auxílio em procedimentos, pré-operatório, urgências cirúrgicas no PS." },
      { nome: "Medicina de Emergência", tipo: "Internato", icon: "ti-ambulance", ementa: "Atuação em unidades de terapia semi-intensiva e pronto-socorro geral de alta complexidade." },
      { nome: "Componente Optativo II", tipo: "Optativo", icon: "ti-star", ementa: "Estágio prático avançado em grandes hospitais gerais credenciados." },
    ]
  },
  12: {
    nome: "Internato IV",
    materias: [
      { nome: "Medicina de Família e Comunidade II", tipo: "Internato", icon: "ti-building-hospital", ementa: "Estágio prático final de consolidação na Atenção Básica e saúde comunitária médica." },
      { nome: "Saúde Mental", tipo: "Internato", icon: "ti-brain", ementa: "Acompanhamento prático em CAPS e ambulatórios psiquiátricos com plantões integrados." },
      { nome: "UTI e Estágio Optativo", tipo: "Internato", icon: "ti-heart-rate-monitor", ementa: "Atuação intensiva supervisionada em UTI Adulto, Pediátrica ou Neonatal e considerações de transição de carreira." },
    ]
  }
};
