
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { StudyProfile, EditalConfig, StudySubject, DaySchedule, QuizQuestion } from "../types";

const getApiKey = () => {
  // @ts-ignore - Vite handles import.meta.env and process might not exist
  const key = (import.meta as any).env?.VITE_GEMINI_API_KEY || 
              (import.meta as any).env?.GEMINI_API_KEY || 
              (typeof process !== 'undefined' ? process.env.VITE_GEMINI_API_KEY : undefined) ||
              (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined) ||
              (typeof process !== 'undefined' ? process.env.API_KEY : undefined);
              
  if (!key || key === 'undefined' || key === 'null') {
    console.warn("Gemini API Key não encontrada. Certifique-se de configurar VITE_GEMINI_API_KEY no seu ambiente (Vercel/Local).");
    return '';
  }
  return key;
};

const ai = new GoogleGenAI({ 
  apiKey: getApiKey()
});

const DEFAULT_MODEL = 'gemini-3-flash-preview';

// Custom error class for API issues
export class AIError extends Error {
  constructor(public message: string, public status?: number, public code?: string) {
    super(message);
    this.name = 'AIError';
  }
}

const handleAIError = (error: any) => {
  console.error("AI Error details:", JSON.stringify(error));
  
  if (error === 429 || error === "429") {
    throw new AIError("Limite de Cota do Google Gemini atingido. O Google limita o uso gratuito por minuto e por dia. Aguarde 1 a 2 minutos e tente novamente.", 429, 'RESOURCE_EXHAUSTED');
  }
  
  const errorMessage = error?.message || error?.error?.message || "";
  const errorStatus = error?.status || error?.error?.code || (error?.name === 'ApiError' ? error?.status : 0);
  
  const isQuotaError = 
    errorStatus === 429 || 
    errorStatus === "429" ||
    errorMessage.includes('429') || 
    errorMessage.includes('RESOURCE_EXHAUSTED') || 
    error?.error?.status === 'RESOURCE_EXHAUSTED' ||
    (error?.name === 'ApiError' && error?.status === 429);
  
  if (isQuotaError) {
    throw new AIError("Limite de Cota do Google Gemini atingido. O Google limita o uso gratuito por minuto e por dia. Isso geralmente acontece após muitas gerações seguidas. Aguarde 1 a 2 minutos e tente novamente.", 429, 'RESOURCE_EXHAUSTED');
  }

  const isHighDemand = 
    errorStatus === 503 || 
    errorStatus === "503" || 
    errorMessage.includes('503') || 
    errorMessage.includes('high demand') || 
    errorMessage.includes('UNAVAILABLE');

  if (isHighDemand) {
    throw new AIError("O servidor da IA está com alta demanda no momento (Erro 503). O aplicativo tentou processar automaticamente, mas o tráfego do Google continua intenso. Por favor, aguarde 10 segundos e tente novamente.", 503, 'UNAVAILABLE');
  }
  
  if (errorMessage.includes('API key not valid') || errorMessage.toLowerCase().includes('api key') || errorMessage.includes('key')) {
    throw new AIError("Chave de API do Gemini inválida ou ausente. No Vercel, vá em Settings > Environment Variables, adicione VITE_GEMINI_API_KEY e faça um novo Deploy para aplicar.", 401, 'INVALID_API_KEY');
  }

  throw new AIError(errorMessage || "Erro desconhecido ao processar IA. Verifique sua conexão ou a chave de API.");
};

// Helper for calling AI with automatic retries for transient errors (503/500)
const generateContentWithRetry = async (params: any, maxRetries = 3) => {
  let delay = 2000;
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || error?.error?.message || "";
      const errorStatus = error?.status || error?.error?.code || 0;
      
      const isTransient = 
        errorStatus === 503 || errorStatus === "503" || 
        errorStatus === 500 || errorStatus === "500" ||
        errorMessage.includes('503') || errorMessage.includes('500') ||
        errorMessage.includes('high demand') || errorMessage.includes('UNAVAILABLE');

      if (isTransient && i < maxRetries - 1) {
        console.warn(`IA com alta demanda (Tentativa ${i + 1}/${maxRetries}). Tentando novamente em ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

// Utility to get current date/time context for AI
const getTimeContext = () => {
  const now = new Date();
  return `Contexto Temporal Atual: hoje é ${now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Horário: ${now.toLocaleTimeString('pt-BR')}.`;
};

export const generateStudyContent = async (topic: string, technique: string, numQuestions: number, profile: StudyProfile = 'VESTIBULAR') => {
  const profileContext = profile === 'CONCURSO' 
    ? "Foco em editais públicos, doutrina pesada, jurisprudência recente e lei seca. Linguagem técnica e formal."
    : "Foco em ENEM e grandes vestibulares. Relacione com atualidades, use linguagem didática e interdisciplinar.";

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      Gere um DOSSIÊ COMPLETO de estudo sobre "${topic}". Especialmente, gere exatamente ${numQuestions} questões no quiz.
      ${profileContext} 
      
      REQUISITOS DE CONTEÚDO:
      1. executiveSummary: Deve ser longo (mínimo 4 parágrafos), detalhado e estruturado.
      2. deepDive: Uma análise técnica profunda sobre o ponto mais complexo do tema.
      3. explorationMenu: 3 a 4 tópicos específicos relacionados a este tema para o usuário escolher explorar depois.
      4. quiz: Em cada questão, use a seguinte ESTRUTURA OBRIGATÓRIA no "explanation" (use Markdown Ricamente):
         Seja EXAUSTIVO e TÉCNICO. Não seja breve. A explicação DEVE ser uma mini-aula profunda.
         - **CONCEITO**: Definição, natureza jurídica, distinções primárias e evolução do tema.
         - **BASE LEGAL**: Citações de leis, artigos, incisos, súmulas ou teorias vigentes com embasamento técnico.
         - **CLASSIFICAÇÃO, ELEMENTOS E ESPÉCIE**: Categorias detalhadas e componentes estruturais minuciosos.
         - **REQUISITOS**: Requisitos essenciais para a validade ou ocorrência do tema.
         - **PEGADINHAS DA FGV (ATENÇÃO!)**: Pontos de ambiguidade que bancas de elite usam para enganar candidatos.
         - **RESUMO PARA A PROVA**: Tópicos chave densos para fixação estratégica.
         - **ANÁLISE TÉCNICA DAS ALTERNATIVAS**: Por que a alternativa correta é válida e por que as demais incorretas falharam tecnicamente.

      5. memoryHint (DICA DE MEMORIZAÇÃO): Deve ser de ALTO IMPACTO para usuários com TDAH/ADHD.
         - Ensine uma forma DEFINITIVA de não errar mais essa questão.
         - Forneça uma explicação técnica tão esclarecedora que resolva qualquer ambiguidade teórica de forma profunda.
         - Use mnemônicos potentes, gatilhos visuais, analogias de alto nível ou rimas táticas.
      
      6. flashcards: Gere cards que facilitem a memorização ativa.
         - A "answer" deve ser direta, mas pode incluir um pequeno mnemônico entre parênteses para temas complexos.
      
      Não use emojis excessivos. Use formatação em negrito para termos-chave. Profundidade 10/10. Foco total em aprovação de elite.
      
      ESTRUTURA JSON:
      {
        "executiveSummary": "string",
        "deepDive": "string",
        "comparison": {
          "leftConcept": "string",
          "rightConcept": "string",
          "leftData": { "desc": "string", "example": "string" },
          "rightData": { "desc": "string", "example": "string" }
        },
        "explorationMenu": [{"topic": "string", "description": "string"}],
        "quiz": [{"question": "string", "options": ["string"], "correctAnswer": number, "explanation": "string", "memoryHint": "string"}],
        "flashcards": [{"question": "string", "answer": "string"}]
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            deepDive: { type: Type.STRING },
            comparison: {
              type: Type.OBJECT,
              properties: {
                leftConcept: { type: Type.STRING },
                rightConcept: { type: Type.STRING },
                leftData: {
                  type: Type.OBJECT,
                  properties: { desc: { type: Type.STRING }, example: { type: Type.STRING } },
                  required: ["desc", "example"]
                },
                rightData: {
                  type: Type.OBJECT,
                  properties: { desc: { type: Type.STRING }, example: { type: Type.STRING } },
                  required: ["desc", "example"]
                }
              },
              required: ["leftConcept", "rightConcept", "leftData", "rightData"]
            },
            explorationMenu: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { 
                  topic: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["topic", "description"]
              }
            },
            quiz: {
              type: Type.ARRAY,
              minItems: numQuestions,
              maxItems: numQuestions,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  memoryHint: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "explanation", "memoryHint"]
              }
            },
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { question: { type: Type.STRING }, answer: { type: Type.STRING }, explanation: { type: Type.STRING } },
                required: ["question", "answer", "explanation"]
              }
            }
          },
          required: ["executiveSummary", "deepDive", "comparison", "explorationMenu", "quiz", "flashcards"]
        }
      }
    });
  
    return JSON.parse(response.text);
  } catch (error) {
    return handleAIError(error);
  }
};

export const generateExamQuestions = async (topic: string, numQuestions: number, profile: StudyProfile = 'VESTIBULAR', banca?: string) => {
  const profileStyle = profile === 'CONCURSO'
    ? "estilo Concursos Públicos de alto nível (FCC/CESPE/FGV), complexas, baseadas em doutrina, jurisprudência e lei seca."
    : "estilo ENEM/FUVEST, baseadas em interpretação, contextualização e conceitos fundamentais.";

  const bancaInstruction = banca ? ` A banca examinadora solicitada é a "${banca}". Siga rigorosamente o padrão de cobrança, a linguagem e os temas recorrentes dessa banca específica.` : "";

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()} 
      Gere um simulado de exatamente ${numQuestions} questões ${profileStyle} sobre "${topic}".${bancaInstruction} As questões devem ser de múltipla escolha (A a E). 
      Não use emojis. Não use formatação de texto com asteriscos.
      
      ESTRUTURA OBRIGATÓRIA DA EXPLICAÇÃO ("explanation") (Use Markdown Ricamente):
      Seja EXAUSTIVO e TÉCNICO. Não use explicações curtas. A explicação DEVE ser uma mini-aula profunda.
      ### Conceito
      Definição, natureza jurídica, distinções primárias e contexto histórico/teórico.
      
      ### Base Legal
      Citações de leis, artigos, incisos, súmulas ou teorias científicas vigentes com explicação do texto legal.
      
      ### Classificação, elementos e Espécie
      Categorias detalhadas e componentes estruturais minuciosos.
      
      ### Requisitos
      Requisitos essenciais para a validade ou ocorrência do tema.
      
      ### Pegadinhas da FGV (Atenção!)
      Destaque as armadilhas semânticas onde as bancas costumam enganar o candidato.
      
      ### Resumo para a Prova
      Tópicos curtos mas densos para revisão estratégica.
      
      ### Análise Técnica das Alternativas
      Por que a alternativa correta é válida e por que as demais incorretas falharam tecnicamente (analisadas individualmente).
 
      A Dica de Memorização ("memoryHint") DEVE ser de ALTO IMPACTO:
      - Foque em usuários com TDAH/ADHD.
      - Ensine uma forma DEFINITIVA e profunda de não errar.
      - Use gatilhos visuais, mnemônicos absurdos ou histórias que ancorem o conhecimento na memória de longo prazo.
      
      Não use emojis excessivos. Abuse da formatação Markdown (negrito, bullet points, quebras de linha duplas) para deixar a leitura fácil e arejada. Profundidade 10/10. Objetivo: Aprovação de Elite.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              minItems: numQuestions,
              maxItems: numQuestions,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 5, maxItems: 5 },
                  correctAnswer: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  memoryHint: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "explanation", "memoryHint"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return handleAIError(error);
  }
};

export const identifyQuestionCount = async (text: string) => {
  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: `Analise cuidadosamente o texto abaixo e conte quantas questões de múltipla escolha (com alternativas A, B, C...) existem nele. 
      Ignore blocos de explicação, comentários ou gabaritos que venham após as questões; conte apenas os enunciados das perguntas.
      Retorne APENAS um número inteiro representando o total de questões.
      
      Texto:
      """
      ${text.substring(0, 15000)}
      """`
    });
    const count = parseInt(response.text?.trim().replace(/[^0-9]/g, '') || "0");
    return isNaN(count) ? 0 : count;
  } catch (error) {
    return 0;
  }
};

export const parsePastedQuestions = async (pastedText: string, profile: StudyProfile = 'VESTIBULAR', batchInfo?: { current: number, total: number }, pastedGabarito?: string) => {
  const profileStyle = profile === 'CONCURSO'
    ? "estilo Concursos Públicos de alto nível"
    : "estilo ENEM/FUVEST";

  const startNum = batchInfo ? (batchInfo.current - 1) * 10 + 1 : 1;
  const endNum = batchInfo ? batchInfo.current * 10 : 100;

  const batchPrompt = batchInfo 
    ? `\nFOCO: EXTRAIA EXATAMENTE AS QUESTÕES QUE SÃO AS DE NÚMERO ${startNum} ATÉ ${endNum} NO TEXTO ORIGINAL. 
       Se o texto não tiver numeração explícita, extraia o bloco correspondente à posição ${batchInfo.current} de ${batchInfo.total} do conteúdo total.
       Não extraia questões que você já extraiu em blocos anteriores.`
    : "";

  const gabaritoPrompt = pastedGabarito 
    ? `\nO USUÁRIO FORNECEU UM GABARITO ADICIONAL PARA ESTAS QUESTÕES:
       """
       ${pastedGabarito}
       """
       USE ESTE GABARITO PARA IDENTIFICAR O 'correctAnswer' DE CADA QUESTÃO CORRESPONDENTE COM PRECISÃO MÁXIMA.`
    : "";

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      Você é um extrator de questões de ALTA PRECISÃO. O usuário colou um texto longo. 
      Sua missão é extrair as questões solicitadas e transformá-las em JSON. ${batchPrompt}${gabaritoPrompt}
      
      IDENTIFICAÇÃO DE RESPOSTAS E EXPLICAÇÕES (CRÍTICO - PRIORIDADE MÁXIMA AO TEXTO):
      - O usuário frequentemente cola a resposta e a explicação logo abaixo de cada questão para guiar a IA. 
      - BUSQUE ATENTAMENTE por padrões como: "Gabarito: A", "Resposta: B", "Alternativa correta: C", "[A]", "(B)", ou se uma alternativa estiver marcada com asteriscos, ou até mesmo apenas uma letra isolada logo após as alternativas que indique a resposta.
      - BUSQUE também por "Explicação:", "Comentário:", "Justificativa:", "Fundamentação:" ou blocos de texto explicativos que venham imediatamente após o gabarito ou as alternativas.
      - **REGRA DE OURO**: Se o texto colado indicar uma resposta ou explicação, você DEVE usá-las obrigatoriamente. Sua função aqui é de EXTRAÇÃO fiel e precisa, não de criação (a menos que a informação falte).
      - Se a resposta no texto for "A", o 'correctAnswer' DEVE ser 0. Se for "B", 1, e assim por diante.
      
      ESTRUTURA DE CADA QUESTÃO NO JSON:
      - question: Enunciado integral e limpo da questão.
      - options: Array com exatamente 5 alternativas. Se o original tiver menos, complete com alternativas plausíveis.
      - correctAnswer: Index 0-4 (0=A, 1=B, etc). USE O GABARITO DO TEXTO SE DISPONÍVEL.
      - explanation: A EXPLICAÇÃO FORNECIDA NO TEXTO (se disponível no texto colado logo após a questão ou no fim da lista). Se o texto original não tiver comentário, gere você mesmo uma explicação técnica e estruturada rica em markdown.
      - memoryHint: Gatilho mental TDAH (mnemônico ou analogia visual) para nunca mais esquecer o conceito.

      TEXTO PARA ANALISAR:
      """
      ${pastedText}
      """`,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 16000,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 5, maxItems: 5 },
                  correctAnswer: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  memoryHint: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "explanation", "memoryHint"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new AIError("Resposta vazia da IA.");
  } catch (error: any) {
    return handleAIError(error);
  }
};

export const chatWithFish = async (message: string, history: { role: string, parts: { text: string }[] }[], profile: StudyProfile = 'VESTIBULAR') => {
  const profileTone = profile === 'CONCURSO'
    ? "O usuário está estudando para concursos. Use referências a editais e carreira pública quando apropriado."
    : "O usuário está estudando para vestibulares/ENEM. Use referências a universidade e futuro acadêmico quando apropriado.";

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: `${getTimeContext()} Você é o 'Peixe de Estudo' do app TDAH ORA. Sua missão é ser um companheiro de estudos amigável, incentivador e direto para estudantes com TDAH. ${profileTone} Regras: 1. Explique conceitos complexos de forma visual e simples (usando analogias). 2. Seja conciso; evite blocos gigantes de texto. 3. NÃO use emojis em hipótese alguma. 4. NÃO use asteriscos (*** ou **) para formatar o texto. 5. Se o usuário disser que esqueceu algo, explique em 3 pontos rápidos. 6. Ajude com revisões relâmpago. 7. Mantenha o tom de 'estamos juntos nessa'.`,
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
      }
    });
    return response.text + " "; // Minor change to make it unique
  } catch (error) {
    return handleAIError(error);
  }
};

export const analyzeEvocation = async (text: string, profile: StudyProfile = 'VESTIBULAR') => {
  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      Analise o seguinte texto de evocação ativa de um estudante (TDAH):
      "${text}"
      
      TAREFAS:
      1. Identifique os pontos principais que o estudante lembrou.
      2. Identifique possíveis erros conceituais ou confusões.
      3. Dê um feedback encorajador e direto.
      4. Liste 2 pontos cruciais que ficaram de fora (se houver).
      
      Não use emojis. Use linguagem clara e direta.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pointsIdentified: { type: Type.ARRAY, items: { type: Type.STRING } },
            errorsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
            missedPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            feedback: { type: Type.STRING }
          },
          required: ["pointsIdentified", "errorsFound", "missedPoints", "feedback"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return handleAIError(error);
  }
};

export const generateQuestionsFromAnalysis = async (analysis: any, profile: StudyProfile = 'VESTIBULAR') => {
  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      Com base nesta análise de evocação de um estudante (TDAH):
      Pontos que lembrou: ${analysis.pointsIdentified.join(', ')}
      Erros cometidos: ${analysis.errorsFound.join(', ')}
      Pontos esquecidos: ${analysis.missedPoints.join(', ')}
      
      Perfil do Estudante: ${profile}
      
      TAREFA:
      Gere 5 questões de múltipla escolha (A, B, C, D, E) focadas PRINCIPALMENTE nos erros cometidos e pontos esquecidos (identificados acima).
      Se o estudante não cometeu erros, gere questões sobre os pontos que ele esqueceu ou sobre o tema geral.
      
      ESTRUTURA OBRIGATÓRIA DA EXPLICAÇÃO ("explanation") (Use Markdown Ricamente):
      Seja EXAUSTIVO e TÉCNICO. Não seja breve. Desconstrua cada erro do estudante e de cada alternativa individualmente.
      - **CONCEITO E DEFINIÇÃO**: Natureza jurídica, distinções e fundamentos teóricos profundos.
      - **BASE LEGAL/CIENTÍFICA ATUAL**: Citações exatas e explicações da norma/teoria.
      - **POR QUE A LETRA ESTÁ CORRETA?** e **POR QUE AS OUTRAS ESTÃO ERRADAS?** (Analise cada uma individualmente).
      - **REQUISITOS/ELEMENTOS**: O que deve existir (use marcadores de forma detalhada).
      - **CLASSIFICAÇÕES/ESPÉCIES** (analise as categorias minuciosamente).
      - **PEGADINHA DE PROVA:** Destaque o ponto exato onde houve a falha de interpretação anterior.
      - **RESUMO PRA PROVA** e **DICA FINAL** (pontos de elite para não esquecer).
      - VISUAL: Negrito em termos-chave.
      
      A Dica de Memorização ("memoryHint") DEVE ser um gatilho mental de impacto massivo. Ensine o usuário uma forma DEFINITIVA de não errar mais essa questão. Forneça uma explicação esclarecedora combinada com mnemônicos ou recursos imaginativos potentes para que ele nunca mais esqueça o motivo pelo qual errou.
      
      Abuse da formatação Markdown (negrito, bullet points, quebras de linha duplas) para deixar a leitura fácil e arejada. Profundidade 10/10. Foco total em recuperação acelerada e domínio do tema.
      
      Retorne no formato JSON rigoroso.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.NUMBER },
              explanation: { type: Type.STRING },
              memoryHint: { type: Type.STRING }
            },
            required: ["id", "question", "options", "correctAnswer", "explanation", "memoryHint"]
          }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return handleAIError(error);
  }
};

export const extractTopicsFromEdital = async (subjectName: string, rawContent: string) => {
  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: `Extraia APENAS os tópicos de estudo para a disciplina "${subjectName}" do texto abaixo. 
      Ignore burocracias, regras de prova ou datas. 
      Retorne apenas uma lista de temas didáticos (ex: 'Conjuntos Numerativos').
      Máximo 15 tópicos curtos.
      Texto: "${rawContent}"
      
      Retorne em JSON: { "topics": ["string"] }`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topics: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["topics"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return handleAIError(error);
  }
};

export const generateMicroThemeValidation = async (topic: string, profile: StudyProfile = 'VESTIBULAR') => {
  const profileStyle = profile === 'CONCURSO'
    ? "Foco em lei seca, doutrina e jurisprudência nível concurso."
    : "Foco em conceitos fundamentais do ENEM/Vestibular.";

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      Gere uma VALIDAÇÃO DE MICRO-TEMA sobre "${topic}". 
      ${profileStyle}
      
      REQUISITOS:
      - 3 Questões breves e inéditas.
      - Foco na essência do conceito (micro-tema).
      - Múltipla escolha (A a D).
      - Linguagem direta para cérebro TDAH.
      
      ESTRUTURA OBRIGATÓRIA DA EXPLICAÇÃO ("explanation") (Use Markdown Ricamente):
      Seja EXAUSTIVO e TÉCNICO. Não seja breve. Desconstrua cada alternativa individualmente.
      - **CONCEITO E DEFINIÇÃO**: O que é, natureza jurídica e fundamentos.
      - **BASE LEGAL/CIENTÍFICA ATUAL**: Citações e explicações técnicas.
      - **POR QUE A LETRA ESTÁ CORRETA?** e **POR QUE AS OUTRAS ESTÃO ERRADAS?** (Analise cada uma separadamente).
      - **REQUISITOS/ELEMENTOS**: Noções essenciais detalhadas.
      - **CLASSIFICAÇÕES/ESPÉCIES** (analise as categorias minuciosamente).
      - **PEGADINHA DE PROVA**: Onde a banca tenta ludibriar o candidato.
      - **RESUMO RÁPIDO** e **DICA FINAL**: Pontos de elite para não esquecer.
      - VISUAL: Negrito em conceitos-chave.
      
      A Dica de Memorização ("memoryHint") DEVE ser um ensinamento de ALTO IMPACTO que esclarece o assunto de forma definitiva e profunda. Mostre um atalho mental ou uma explicação tão original que impedirá o usuário de errar questões semelhantes no futuro.
      
      Abuse da formatação Markdown (negrito, bullet points, quebras de linha duplas) para deixar a leitura fácil e arejada. Profundidade 10/10.
      
      Retorne em JSON:`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  memoryHint: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "explanation", "memoryHint"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return handleAIError(error);
  }
};

export const explainStuckTopic = async (topic: string, profile: StudyProfile = 'VESTIBULAR') => {
  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      O estudante está travado no tópico "${topic}" (errou 3 vezes). 
      Perfil: ${profile}.
      
      TAREFA:
      Explique este tema de uma forma COMPLETAMENTE NOVA e RADICALMENTE SIMPLES.
      - Use uma analogia inusitada.
      - Use bullet points.
      - Destaque o "Ponto de Confusão Comum" (onde as pessoas costumam errar).
      - Linguagem visual.
      
      Retorne em JSON:`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            newExplanation: { type: Type.STRING },
            analogy: { type: Type.STRING },
            commonMistake: { type: Type.STRING }
          },
          required: ["newExplanation", "analogy", "commonMistake"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return handleAIError(error);
  }
};

export const optimizeStudyPlan = async (
  edital: EditalConfig,
  currentSubjects: StudySubject[],
  profile: StudyProfile = 'VESTIBULAR'
) => {
  const subjectsPrompt = edital.subjects.map(s => `- ${s.name} (ID: ${s.id}, Peso atual: ${currentSubjects.find(cs => cs.editalSubjectId === s.id)?.weight || 1})`).join('\n');
  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      Você é um estrategista de estudos para ${profile}.
      
      ENTRADA:
      - Data da Prova: ${edital.examDate}
      - Carga Horária Diária: ${edital.dailyHours} horas
      - Matérias do Edital:
      ${subjectsPrompt}
  
      TAREFA:
      Gere um plano de estudos otimizado. 
      1. Ajuste o peso ideal (1-5) para cada matéria vinculando ao ID do edital.
      2. Gere um cronograma (DaySchedule) para os próximos 15 dias, distribuindo as horas diárias entre as matérias.
      3. Para cada sessão de estudo, sugira 1 ou 2 tópicos específicos do edital (baseado nos topics[] de cada matéria) que o usuário deve focar naquela sessão.
      4. Dê um conselho estratégico curto.
  
      RESTRIÇÕES:
      - O total de minutos por dia deve respeitar ${edital.dailyHours * 60} min.
      - O cronograma deve ser uma lista de objetos com 'date' (YYYY-MM-DD) e 'sessions' (lista de {subjectId, subjectName, minutes, topics}).
      - Os topics em cada session devem vir da lista de tópicos reais da matéria no edital.
      
      Retorne em JSON:`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subjects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  editalSubjectId: { type: Type.STRING },
                  weight: { type: Type.NUMBER },
                  targetMinutes: { type: Type.NUMBER }
                },
                required: ["editalSubjectId", "weight", "targetMinutes"]
              }
            },
            proposedSchedule: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  sessions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        subjectId: { type: Type.STRING },
                        subjectName: { type: Type.STRING },
                        minutes: { type: Type.NUMBER },
                        topics: { type: Type.ARRAY, items: { type: Type.STRING } }
                      },
                      required: ["subjectId", "subjectName", "minutes", "topics"]
                    }
                  }
                },
                required: ["date", "sessions"]
              }
            },
            advice: { type: Type.STRING }
          },
          required: ["subjects", "proposedSchedule", "advice"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return handleAIError(error);
  }
};

export const identifyAndProgramRecovery = async (topic: string, missedQuestions: QuizQuestion[], profile: StudyProfile = 'VESTIBULAR') => {
  const questionsData = missedQuestions.map(q => ({
    question: q.question,
    userAnswer: q.options[q.userAnswer ?? -1] || 'Não respondida',
    correctAnswer: q.options[q.correctAnswer],
    explanation: q.explanation
  }));

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      O estudante está com dificuldade severa no tópico "${topic}". 
      Abaixo estão as questões que ele errou recentemente:
      ${JSON.stringify(questionsData)}
      
      Perfil: ${profile}.
      
      TAREFA:
      1. DIAGNÓSTICO: Identifique o padrão de erro.
      2. PLANO DE RECUPERAÇÃO: Sugira 3 passos imediatos.
      3. QUESTÕES DE CONTRAGOLPE: Gere 3 novas questões focadas nos pontos de falha.
      4. FLASHCARDS DE RESGATE: Gere 3 flashcards.
      
      ESTRUTURA OBRIGATÓRIA DA EXPLICAÇÃO ("explanation") nas questões (Use Markdown Ricamente):
      Separe rigorosamente cada tópico com DUAS quebras de linha (parágrafos distintos) e use listas com marcadores sempre que enumerar itens. A explicação DEVE ter um espaçamento excelente e ser muito limpa visualmente.
      - **CONCEITO E DEFINIÇÃO**: Natureza jurídica e distinções.
      - **BASE LEGAL ATUAL**.
      - **POR QUE A LETRA ESTÁ CORRETA?** e **POR QUE AS OUTRAS ESTÃO ERRADAS?**
      - **REQUISITOS/ELEMENTOS** essenciais (use marcadores/bullet points).
      - **CLASSIFICAÇÕES/ESPÉCIES** (use marcadores).
      - **PEGADINHA DE PROVA:** Onde a banca costuma atacar.
      - **RESUMO PRA PROVA** e **DICA FINAL** (use marcadores).
      - VISUAL: Negrito em termos-chave.
      
      A Dica de Memorização ("memoryHint") nas questões DEVE ser uma explicação de alta intensidade que ensine uma forma definitiva de NÃO ERRAR mais. Mostre ao cérebro do usuário o caminho mais lógico (ou absurdo) para que o conhecimento fique preso para sempre na memória. Use mnemônicos, gatilhos visuais, rimas ou histórias inesquecíveis.
      
      Abuse da formatação Markdown (negrito, bullet points, quebras de linha duplas) para deixar a leitura fácil e arejada.
      
      Retorne em JSON rigoroso. Profundidade 8/10. Objetivo: Erro Zero.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diagnosis: { type: Type.STRING },
            recoverySteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            recoveryQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  memoryHint: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "explanation", "memoryHint"]
              }
            },
            recoveryFlashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING }
                },
                required: ["question", "answer"]
              }
            }
          },
          required: ["diagnosis", "recoverySteps", "recoveryQuestions", "recoveryFlashcards"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return handleAIError(error);
  }
};

export const getProactiveAdvice = async (stats: any, edital: EditalConfig, profile: StudyProfile = 'VESTIBULAR') => {
  const context = {
    stats,
    editalHeat: edital.subjects.map(s => ({ name: s.name, heat: s.heat || 0 })),
    activeProfile: profile,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await generateContentWithRetry({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      Você é o Mentor Peixe, o guia TDAH do estudante.
      Seja breve, encorajador e estratégico.
      Dados do estudante: ${JSON.stringify(context)}
      
      TAREFA:
      1. GREETING: Uma saudação curta baseada no horário atual.
      2. INSIGHT: Um comentário sobre o progresso (ex: "Sua barra de matemática está esfriando!" ou "Você está voando hoje!").
      3. TASK: Uma sugestão de 1 tarefa imediata.
      
      Retorne em JSON: { "greeting": string, "insight": string, "task": string, "taskView": string }
      Opções de taskView: HUB, TIMER, FLASHCARDS, MATERIALS, TDH_QUESTOES, AI_DIRECT, SMART_REVISION.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            greeting: { type: Type.STRING },
            insight: { type: Type.STRING },
            task: { type: Type.STRING },
            taskView: { type: Type.STRING }
          },
          required: ["greeting", "insight", "task", "taskView"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return handleAIError(error);
  }
};

export const getDailyBibleMotivation = async (): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      Gere uma passagem curta e motivacional da Bíblia totalmente focada para um estudante com TDAH (foco, superação, ansiedade, perseverança).
      A linguagem deve ser inspiradora e focada no esforço, na superação e na esperança.
      Adicione uma reflexão rápida e pessoal de máximo 30 palavras para o estudante focar no dia de hoje.
      O formato deve ser: "Passagem (Capítulo:Versículo) - Reflexão curta."
      NÃO use emojis. NÃO use formatação com asteriscos.`,
    });
    return response.text?.trim() || "Tudo posso naquele que me fortalece. - Reflexão: Confie no seu processo e mantenha a calma.";
  } catch (error) {
    console.error("Erro ao buscar motivação:", error);
    return "Tudo posso naquele que me fortalece. - Reflexão: Confie no seu processo e mantenha a calma.";
  }
};

export const generateStudyCycle = async (edital: EditalConfig, totalCycleHours: number) => {
  const context = {
    subjects: edital.subjects.map(s => ({ 
      id: s.id, 
      name: s.name, 
      heat: s.heat, 
      topicsCount: s.topics.length 
    })),
    totalCycleHours
  };

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      Você é um Engenheiro de Aprendizagem Especialista em Ciclos de Estudo para TDAH.
      Sua tarefa é criar um CICLO DE ESTUDO OTIMIZADO baseado nos dados do edital abaixo.
      
      DADOS:
      ${JSON.stringify(context)}
      
      DIRETRIZES TDAH:
      1. Intercale matérias de naturezas diferentes (ex: Exatas -> Humanas).
      2. Sessões devem ter entre 45 e 120 minutos.
      3. Dê mais tempo para matérias com "heat" baixo (esfriando) ou muitos tópicos.
      4. O ciclo deve ser uma lista sequencial de passos que o aluno seguirá repetidamente.
      
      Retorne em JSON:
      {
        "steps": [
          { "subjectId": "string", "subjectName": "string", "durationMinutes": number }
        ]
      }`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  subjectId: { type: Type.STRING },
                  subjectName: { type: Type.STRING },
                  durationMinutes: { type: Type.NUMBER }
                },
                required: ["subjectId", "subjectName", "durationMinutes"]
              }
            }
          },
          required: ["steps"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return handleAIError(error);
  }
};

export const generateGuidedLesson = async (subject: string, topic: string, profile: StudyProfile = 'VESTIBULAR') => {
  const profileContext = profile === 'CONCURSO' 
    ? "Foco em editais públicos, doutrina e lei seca. Linguagem técnica mas narrativa."
    : "Foco em ENEM e grandes vestibulares. Linguagem didática e interdisciplinar.";

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      Gere uma AULA GUIADA (Narrativa Contínua) sobre o tema "${topic}" da matéria "${subject}".
      ${profileContext}
      
      OBJETIVO: Conduzir o aluno em um fluxo de aprendizado imersivo para TDAH, sem exigir interação constante, mas mantendo o cérebro ativo através de uma narrativa.
      
      ESTRUTURA DA RESPOSTA (Sequência de Passos):
      1. OPENING: Começa direto, engajando o aluno com uma pergunta ou fato curioso. Sem botões.
      2. OVERVIEW: Um mapa mental rápido do que será visto.
      3. NARRATIVE: Desenvolve o tema através de uma história ou exemplo prático ("Imagina que...").
      4. CONCEPT: Insere explicações técnicas dentro da narrativa.
      5. QUESTION_PAUSE: Faz uma pergunta mental para ativar o recall ativo (ex: "Agora pense: o que acontece se...?"). A resposta NÃO deve estar neste bloco, mas no seguinte.
      6. REINFORCEMENT: Responde a pergunta anterior e reforça o ponto chave.
      7. ANALOGY: Usa uma associação forte (ex: VAR no futebol, receita de bolo).
      8. CLOSING_APPLICATION: Mostra como esse tema cai na prova.
      
      IMPORTANTE:
      - Divida em blocos pequenos e impactantes.
      - O fluxo deve ser lógico: História -> Conceito -> Pergunta -> Resposta -> Associação.
      - Não use emojis.
      - Gere também 3 questões de fixação para o final.
      
      Retorne em JSON rigoroso.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            topic: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  content: { type: Type.STRING },
                  pauseAfterMilliseconds: { type: Type.NUMBER }
                },
                required: ["type", "content"]
              }
            },
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  memoryHint: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "explanation", "memoryHint"]
              }
            }
          },
          required: ["id", "topic", "steps", "quiz"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return handleAIError(error);
  }
};
