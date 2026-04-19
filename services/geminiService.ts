
import { GoogleGenAI, Type } from "@google/genai";
import { StudyProfile, EditalConfig, StudySubject, DaySchedule } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateStudyContent = async (topic: string, technique: string, numQuestions: number, profile: StudyProfile = 'VESTIBULAR') => {
  const profileContext = profile === 'CONCURSO' 
    ? "Foco em editais públicos, doutrina pesada, jurisprudência recente e lei seca. Linguagem técnica e formal."
    : "Foco em ENEM e grandes vestibulares. Relacione com atualidades, use linguagem didática e interdisciplinar.";

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Gere um DOSSIÊ COMPLETO de estudo sobre "${topic}". 
    ${profileContext} 
    
    REQUISITOS DE CONTEÚDO:
    1. executiveSummary: Deve ser longo (mínimo 4 parágrafos), detalhado e estruturado.
    2. deepDive: Uma análise técnica profunda sobre o ponto mais complexo do tema.
    3. explorationMenu: 3 a 4 tópicos específicos relacionados a este tema para o usuário escolher explorar depois.
    
    Não use emojis. Não use formatação com asteriscos.
    
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
      "quiz": [{"question": "string", "options": ["string"], "correctAnswer": number, "commentary": "string"}],
      "flashcards": [{"question": "string", "answer": "string"}]
    }`,
    config: {
      thinkingConfig: { thinkingBudget: 0 },
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
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.INTEGER },
                commentary: { type: Type.STRING }
              },
              required: ["question", "options", "correctAnswer", "commentary"]
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
};

export const generateExamQuestions = async (topic: string, numQuestions: number, profile: StudyProfile = 'VESTIBULAR') => {
  const profileStyle = profile === 'CONCURSO'
    ? "estilo Concursos Públicos de alto nível (FCC/CESPE/FGV), complexas, baseadas em doutrina, jurisprudência e lei seca."
    : "estilo ENEM/FUVEST, baseadas em interpretação, contextualização e conceitos fundamentais.";

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Gere um simulado de questões ${profileStyle} sobre "${topic}". As questões devem ser de múltipla escolha (A a E). 
    Não use emojis. Não use formatação de texto com asteriscos.
    Inclua obrigatoriamente um "commentary" detalhado explicando por que a alternativa correta é a certa e por que as outras estão erradas.`,
    config: {
      thinkingConfig: { thinkingBudget: 0 },
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
                options: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 5, maxItems: 5 },
                correctAnswer: { type: Type.INTEGER },
                commentary: { type: Type.STRING }
              },
              required: ["question", "options", "correctAnswer", "commentary"]
            }
          }
        },
        required: ["questions"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const chatWithFish = async (message: string, history: { role: string, parts: { text: string }[] }[], profile: StudyProfile = 'VESTIBULAR') => {
  const profileTone = profile === 'CONCURSO'
    ? "O usuário está estudando para concursos. Use referências a editais e carreira pública quando apropriado."
    : "O usuário está estudando para vestibulares/ENEM. Use referências a universidade e futuro acadêmico quando apropriado.";

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      ...history,
      { role: 'user', parts: [{ text: message }] }
    ],
    config: {
      systemInstruction: `Você é o 'Peixe de Estudo' do app TDAH ORA. Sua missão é ser um companheiro de estudos amigável, incentivador e direto para estudantes com TDAH. ${profileTone} Regras: 1. Explique conceitos complexos de forma visual e simples (usando analogias). 2. Seja conciso; evite blocos gigantes de texto. 3. NÃO use emojis em hipótese alguma. 4. NÃO use asteriscos (*** ou **) para formatar o texto. 5. Se o usuário disser que esqueceu algo, explique em 3 pontos rápidos. 6. Ajude com revisões relâmpago. 7. Mantenha o tom de 'estamos juntos nessa'.`,
      temperature: 0.7,
      topP: 0.95,
      topK: 64,
    }
  });
  return response.text + " "; // Minor change to make it unique
};

export const analyzeEvocation = async (text: string, profile: StudyProfile = 'VESTIBULAR') => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analise o seguinte texto de evocação ativa de um estudante (TDAH):
    "${text}"
    
    TAREFAS:
    1. Identifique os pontos principais que o estudante lembrou.
    2. Identifique possíveis erros conceituais ou confusões.
    3. Dê um feedback encorajador e direto.
    4. Liste 2 pontos cruciais que ficaram de fora (se houver).
    
    Não use emojis. Use linguagem clara e direta.`,
    config: {
      thinkingConfig: { thinkingBudget: 0 },
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
};

export const generateQuestionsFromAnalysis = async (analysis: any, profile: StudyProfile = 'VESTIBULAR') => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Com base nesta análise de evocação de um estudante (TDAH):
    Pontos que lembrou: ${analysis.pointsIdentified.join(', ')}
    Erros cometidos: ${analysis.errorsFound.join(', ')}
    Pontos esquecidos: ${analysis.missedPoints.join(', ')}
    
    Perfil do Estudante: ${profile}
    
    TAREFA:
    Gere 5 questões de múltipla escolha (A, B, C, D, E) focadas PRINCIPALMENTE nos erros cometidos e pontos esquecidos (identificados acima).
    Se o estudante não cometeu erros, gere questões sobre os pontos que ele esqueceu ou sobre o tema geral.
    Inclua um comentário curto explicando a resposta correta para cada questão.
    
    Retorne no formato JSON rigoroso.`,
    config: {
      thinkingConfig: { thinkingBudget: 0 },
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
            commentary: { type: Type.STRING }
          },
          required: ["id", "question", "options", "correctAnswer", "commentary"]
        }
      }
    }
  });
  return JSON.parse(response.text);
};

export const extractTopicsFromEdital = async (subjectName: string, rawContent: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Extraia os tópicos e subtópicos estudáveis do seguinte conteúdo programático da disciplina "${subjectName}":
    
    "${rawContent}"
    
    TAREFA:
    Organize em uma lista de strings curta e direta (máximo 15 tópicos).
    Remova formalidades e burocracias do edital. Mantenha apenas os temas de estudo.
    
    Retorne no formato JSON rigoroso.`,
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
};

export const generateMicroThemeValidation = async (topic: string, profile: StudyProfile = 'VESTIBULAR') => {
  const profileStyle = profile === 'CONCURSO'
    ? "Foco em lei seca, doutrina e jurisprudência nível concurso."
    : "Foco em conceitos fundamentais do ENEM/Vestibular.";

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Gere uma VALIDAÇÃO DE MICRO-TEMA sobre "${topic}". 
    ${profileStyle}
    
    REQUISITOS:
    - 3 Questões breves e inéditas.
    - Foco na essência do conceito (micro-tema).
    - Múltipla escolha (A a D).
    - Linguagem direta para cérebro TDAH.
    
    Retorne em JSON:`,
    config: {
      thinkingConfig: { thinkingBudget: 0 },
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
                commentary: { type: Type.STRING }
              },
              required: ["question", "options", "correctAnswer", "commentary"]
            }
          }
        },
        required: ["questions"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const explainStuckTopic = async (topic: string, profile: StudyProfile = 'VESTIBULAR') => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `O estudante está travado no tópico "${topic}" (errou 3 vezes). 
    Perfil: ${profile}.
    
    TAREFA:
    Explique este tema de uma forma COMPLETAMENTE NOVA e RADICALMENTE SIMPLES.
    - Use uma analogia inusitada.
    - Use bullet points.
    - Destaque o "Ponto de Confusão Comum" (onde as pessoas costumam errar).
    - Linguagem visual.
    
    Retorne em JSON:`,
    config: {
      thinkingConfig: { thinkingBudget: 0 },
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
};

export const optimizeStudyPlan = async (
  edital: EditalConfig,
  currentSubjects: StudySubject[],
  profile: StudyProfile = 'VESTIBULAR'
) => {
  const subjectsPrompt = edital.subjects.map(s => `- ${s.name} (ID: ${s.id}, Peso atual: ${currentSubjects.find(cs => cs.editalSubjectId === s.id)?.weight || 1})`).join('\n');
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Você é um estrategista de estudos para ${profile}.
    
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
};
