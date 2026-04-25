
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { StudyProfile, EditalConfig, StudySubject, DaySchedule, QuizQuestion } from "../types";

const getApiKey = () => {
  // @ts-ignore - Vite handles import.meta.env and process might not exist
  const key = (import.meta as any).env?.VITE_GEMINI_API_KEY || 
              (import.meta as any).env?.GEMINI_API_KEY || 
              (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
              
  if (!key || key === 'undefined') {
    console.warn("Gemini API Key não encontrada. Certifique-se de configurar VITE_GEMINI_API_KEY no seu ambiente (Vercel/Local).");
  }
  return key || '';
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
  console.error("AI Error details:", error);
  
  if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
    throw new AIError("Limite de uso da IA atingido. O Google limita o uso gratuito da IA por minuto/dia. Aguarde um momento e tente novamente.", 429, 'RESOURCE_EXHAUSTED');
  }
  
  if (error?.message?.includes('API key not valid') || error?.message?.toLowerCase().includes('api key') || error?.message?.includes('key')) {
    throw new AIError("Chave de API do Gemini inválida ou ausente. Se você estiver na Vercel, certifique-se de configurar a variável de ambiente VITE_GEMINI_API_KEY (Settings > Environment Variables) e faça um novo Deploy.", 401, 'INVALID_API_KEY');
  }

  throw new AIError(error?.message || "Erro desconhecido ao processar IA. Verifique sua conexão ou a chave de API.");
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
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      Gere um DOSSIÊ COMPLETO de estudo sobre "${topic}". Especialmente, gere exatamente ${numQuestions} questões no quiz.
      ${profileContext} 
      
      REQUISITOS DE CONTEÚDO:
      1. executiveSummary: Deve ser longo (mínimo 4 parágrafos), detalhado e estruturado.
      2. deepDive: Uma análise técnica profunda sobre o ponto mais complexo do tema.
      3. explorationMenu: 3 a 4 tópicos específicos relacionados a este tema para o usuário escolher explorar depois.
      4. quiz: Em cada questão, use a seguinte ESTRUTURA OBRIGATÓRIA no "commentary" (use Markdown para títulos e listas):
         - **CONCEITO E DEFINIÇÃO**: Explique o que é, natureza jurídica e distinções primárias.
         - **REQUISITOS/ELEMENTOS**: Descreva os componentes essenciais.
         - **CLASSIFICAÇÕES/ESPÉCIES**: Divida o tema em categorias claras e liste tipos existentes.
         - **BASE LEGAL ATUAL**: Forneça o embasamento jurídico vigente.
         - **POR QUE A LETRA ESTÁ CORRETA?**: Explicação detalhada da alternativa certa.
         - **POR QUE AS OUTRAS ESTÃO ERRADAS?**: Razão pela qual cada incorreta falhou.
         - **PEGADINHA DE PROVA**: Destaque pontos onde as bancas costumam enganar o candidato.
         - **RESUMO PRA PROVA**: Tópicos rápidos para revisão.
         - **DICA FINAL**: Conselho estratégico para este ponto específico.

      5. memoryHint (DICA DE MEMORIZAÇÃO): Deve ser de ALTO IMPACTO para usuários com TDAH/ADHD.
         - Ensine o usuário uma forma DEFINITIVA de não errar mais essa questão.
         - Forneça uma explicação chocante e esclarecedora que fará com que o cérebro nunca mais esqueça o conceito.
         - Você pode usar mnemônicos criativos, gatilhos visuais, analogias absurdas e rimas.
         - O foco é a fixação e ancoragem profunda do conceito na memória de longo prazo.
      
      6. flashcards: Gere cards que facilitem a memorização ativa.
         - A "answer" deve ser direta, mas pode incluir um pequeno mnemônico entre parênteses para temas complexos.
      
      Não use emojis excessivos. Use formatação em negrito para termos-chave. Profundidade 8/10. Foco total em aprovação.
      
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
        "quiz": [{"question": "string", "options": ["string"], "correctAnswer": number, "commentary": "string", "memoryHint": "string"}],
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
                  commentary: { type: Type.STRING },
                  memoryHint: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "commentary", "memoryHint"]
              }
            },
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } },
                required: ["question", "answer"]
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
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()} 
      Gere um simulado de exatamente ${numQuestions} questões ${profileStyle} sobre "${topic}".${bancaInstruction} As questões devem ser de múltipla escolha (A a E). 
      Não use emojis. Não use formatação de texto com asteriscos.
      
      ESTRUTURA OBRIGATÓRIA DA EXPLICAÇÃO ("commentary") (Use Markdown Ricamente):
      Separe rigorosamente cada tópico com DUAS quebras de linha (parágrafos distintos) e use listas com marcadores sempre que enumerar itens. A explicação DEVE ter um espaçamento excelente e ser muito limpa visualmente.
      - **CONCEITO E DEFINIÇÃO**: O que é, natureza jurídica e distinções primárias.
      - **BASE LEGAL ATUAL**: Citações de leis, artigos ou súmulas vigentes.
      - **POR QUE A LETRA ESTÁ CORRETA?**: Demonstração técnica da alternativa certa.
      - **POR QUE AS OUTRAS ESTÃO ERRADAS?**: Desconstrução individual das alternativas incorretas.
      - **REQUISITOS/ELEMENTOS**: Descreva os componentes essenciais (use marcadores/bullet points).
      - **CLASSIFICAÇÕES/ESPÉCIES**: Divida em categorias e liste os tipos (use marcadores).
      - **PEGADINHA DE PROVA**: Destaque o ponto onde as bancas costumam enganar o candidato.
      - **RESUMO PRA PROVA**: Tópicos curtos para revisão rápida (use marcadores).
      - **DICA FINAL**: Um conselho estratégico sobre o tema.

      A Dica de Memorização ("memoryHint") DEVE ser de ALTO IMPACTO:
      - Foque em usuários com TDAH/ADHD.
      - Ensine o usuário uma forma DEFINITIVA de não errar mais essa questão.
      - Forneça uma explicação inovadora e esclarecedora para nunca mais esquecer o conceito central abordado.
      - Use gatilhos visuais, analogias absurdas, mnemônicos bizarros ou histórias que ancorem o conhecimento na memória de longo prazo.
      
      Não use emojis excessivos. Abuse da formatação Markdown (negrito, bullet points, quebras de linha duplas) para deixar a leitura fácil e arejada. Profundidade 8/10. Objetivo: Aprovação.`,
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
                  commentary: { type: Type.STRING },
                  memoryHint: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "commentary", "memoryHint"]
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

export const chatWithFish = async (message: string, history: { role: string, parts: { text: string }[] }[], profile: StudyProfile = 'VESTIBULAR') => {
  const profileTone = profile === 'CONCURSO'
    ? "O usuário está estudando para concursos. Use referências a editais e carreira pública quando apropriado."
    : "O usuário está estudando para vestibulares/ENEM. Use referências a universidade e futuro acadêmico quando apropriado.";

  try {
    const response = await ai.models.generateContent({
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
    const response = await ai.models.generateContent({
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
    const response = await ai.models.generateContent({
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
      
      ESTRUTURA OBRIGATÓRIA DA EXPLICAÇÃO ("commentary") (Use Markdown Ricamente):
      Separe rigorosamente cada tópico com DUAS quebras de linha (parágrafos distintos) e use listas com marcadores sempre que enumerar itens. A explicação DEVE ter um espaçamento excelente e ser muito limpa visualmente.
      - **CONCEITO E DEFINIÇÃO**: O que é e natureza jurídica.
      - **BASE LEGAL ATUAL**: Lei/Artigo/Súmula.
      - **POR QUE A LETRA ESTÁ CORRETA?** e **POR QUE AS OUTRAS ESTÃO ERRADAS?**
      - **REQUISITOS/ELEMENTOS**: O que deve existir (use marcadores/bullet points).
      - **CLASSIFICAÇÕES/ESPÉCIES** (use marcadores).
      - **PEGADINHA DE PROVA:** Destaque o ponto onde houve o erro anterior.
      - **RESUMO PRA PROVA** e **DICA FINAL** (use marcadores).
      - VISUAL: Negrito em termos-chave.
      
      A Dica de Memorização ("memoryHint") DEVE ser um gatilho mental de alto impacto. Ensine o usuário uma forma DEFINITIVA de não errar mais essa questão. Forneça uma explicação esclarecedora combinada com mnemônicos ou recursos imaginativos para que ele nunca mais esqueça o motivo pelo qual errou.
      
      Abuse da formatação Markdown (negrito, bullet points, quebras de linha duplas) para deixar a leitura fácil e arejada. Profundidade 8/10. Foco total em recuperação acelerada.
      
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
              commentary: { type: Type.STRING },
              memoryHint: { type: Type.STRING }
            },
            required: ["id", "question", "options", "correctAnswer", "commentary", "memoryHint"]
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
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      Sua missão é atuar como um Extrator de Conteúdo Programático Inteligente. 
      Analise o texto bruto do edital para a disciplina "${subjectName}" abaixo e extraia apenas os tópicos que o aluno realmente precisa estudar.
      
      TEXTO DO EDITAL:
      "${rawContent}"
      
      DIRETRIZES:
      1. Ignore das, locais, nomes de fiscais, regras de inscrição ou burocracias. 
      2. Liste apenas temas didáticos (ex: 'Equações de 2º Grau', 'Direito Administrativo', etc).
      3. Seja conciso: máximo 15 tópicos.
      4. Se o texto for confuso, tente identificar os nomes das matérias principais.
      
      Retorne no formato JSON rigoroso.`,
      config: {
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
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `${getTimeContext()}
      Gere uma VALIDAÇÃO DE MICRO-TEMA sobre "${topic}". 
      ${profileStyle}
      
      REQUISITOS:
      - 3 Questões breves e inéditas.
      - Foco na essência do conceito (micro-tema).
      - Múltipla escolha (A a D).
      - Linguagem direta para cérebro TDAH.
      
      ESTRUTURA OBRIGATÓRIA DA EXPLICAÇÃO ("commentary") (Use Markdown Ricamente):
      Separe rigorosamente cada tópico com DUAS quebras de linha (parágrafos distintos) e use listas com marcadores sempre que enumerar itens. A explicação DEVE ter um espaçamento excelente e ser muito limpa visualmente.
      - **CONCEITO E DEFINIÇÃO**: O que é.
      - **BASE LEGAL ATUAL**.
      - **POR QUE A LETRA ESTÁ CORRETA?** e **POR QUE AS OUTRAS ESTÃO ERRADAS?**
      - **REQUISITOS/ELEMENTOS**: Noções essenciais (use marcadores/bullet points).
      - **CLASSIFICAÇÕES/ESPÉCIES** (use marcadores).
      - **PEGADINHA DE PROVA**: Onde a banca tenta enganar.
      - **RESUMO PRA PROVA** e **DICA FINAL** (use marcadores).
      - VISUAL: Negrito em conceitos-chave.
      
      A Dica de Memorização ("memoryHint") DEVE ser um ensinamento de ALTO IMPACTO que esclarece o assunto de forma definitiva. Mostre um atalho mental ou uma explicação tão original que impedirá o usuário de errar questões semelhantes no futuro (use metáforas bizarros, mnemônicos ou rimas para ajudar na ancoragem).
      
      Abuse da formatação Markdown (negrito, bullet points, quebras de linha duplas) para deixar a leitura fácil e arejada.
      
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
                  commentary: { type: Type.STRING },
                  memoryHint: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "commentary", "memoryHint"]
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
    const response = await ai.models.generateContent({
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
    const response = await ai.models.generateContent({
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
    commentary: q.commentary
  }));

  try {
    const response = await ai.models.generateContent({
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
      
      ESTRUTURA OBRIGATÓRIA DA EXPLICAÇÃO ("commentary") nas questões (Use Markdown Ricamente):
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
                  commentary: { type: Type.STRING },
                  memoryHint: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "commentary", "memoryHint"]
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
    const response = await ai.models.generateContent({
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
