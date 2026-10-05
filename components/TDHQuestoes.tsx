import React, { useEffect, useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Scissors, Trash2, ChevronLeft, ChevronRight, Save, HelpCircle, FileText, CheckCircle2, RotateCcw, Brain, Copy, Maximize2, Minimize2, Flag, Bookmark, Share2, Shuffle, LogOut, Highlighter, PenLine, Eraser, Undo2, Image as ImageIcon, X, MessageSquarePlus, BookOpen, Database, ClipboardList } from './icons';
import { generateExamQuestions, parsePastedQuestions, identifyQuestionCount } from '../services/geminiService';
import { fetchEnemExams, fetchEnemQuestions, enemDisciplineLabel, EnemExamInfo } from '../services/enemService';
import { BankFacetOption, countBankQuestions, fetchBankQuestions, fetchExamQuestions, listBankAreasForSubject, listBankImportSubjects, listBankTopicsForSubject, listExamBoards, listExamInstitutions, listExamPositions, listExamYears } from '../services/questionBankService';
import { QuizQuestion, QuizFolder, StudyProfile, EditalConfig, ExplanationStyle } from '../types';
import LoadingFish from './LoadingFish';
import FilterDropdown from './FilterDropdown';
import SaveToFolderModal from './SaveToFolderModal';
import MarkdownContent from './MarkdownContent';
import VerificationBadge from './VerificationBadge';
import { RichTextEditor } from './RichTextEditor';

// Reindexes an array of per-question indices (e.g. flagged, questionScratched, questionHighlighted)
// after the question at `removedIdx` is deleted from the questions array.
const reindexListAfterDelete = (list: number[], removedIdx: number): number[] => list.filter((i) => i !== removedIdx).map((i) => (i > removedIdx ? i - 1 : i));

// Reindexes a Record<number, T> keyed by question index after the question at `removedIdx` is deleted.
const reindexRecordAfterDelete = <T,>(record: Record<number, T>, removedIdx: number): Record<number, T> => {
  const result: Record<number, T> = {};
  Object.entries(record).forEach(([key, value]) => {
    const idx = Number(key);
    if (idx === removedIdx) return;
    result[idx > removedIdx ? idx - 1 : idx] = value as T;
  });
  return result;
};

// Reindexes an array of per-question indices given a permutation, where newOrder[newIdx] = oldIdx.
const reindexListForPermutation = (list: number[], newOrder: number[]): number[] => {
  const oldToNew = new Map<number, number>();
  newOrder.forEach((oldIdx, newIdx) => oldToNew.set(oldIdx, newIdx));
  return list.map((i) => oldToNew.get(i)).filter((i): i is number => i !== undefined);
};

// Reindexes a Record<number, T> keyed by question index given a permutation, where newOrder[newIdx] = oldIdx.
const reindexRecordForPermutation = <T,>(record: Record<number, T>, newOrder: number[]): Record<number, T> => {
  const oldToNew = new Map<number, number>();
  newOrder.forEach((oldIdx, newIdx) => oldToNew.set(oldIdx, newIdx));
  const result: Record<number, T> = {};
  Object.entries(record).forEach(([key, value]) => {
    const newIdx = oldToNew.get(Number(key));
    if (newIdx !== undefined) result[newIdx] = value as T;
  });
  return result;
};

interface TDHQuestoesProps {
  onBack: () => void;
  folders: QuizFolder[];
  onSaveToNotebook: (folderId: string, notebookName: string, questions: QuizQuestion[], summary?: string, notebookColor?: string, folderColor?: string) => void;
  studyProfile: StudyProfile;
  prefill?: string | null;
  onConsumedPrefill?: () => void;
  strategicMode?: boolean;
  editalConfig?: EditalConfig;
  explanationStyle?: ExplanationStyle;
  questionProfileStyle?: string;
  fontSizeMultiplier: number;
  onBatchComplete?: (topic: string, subject: string, total: number, correct: number, questions?: QuizQuestion[]) => void;
  onTriggerGuidedLesson?: (subject: string, topic: string) => void;
  onQuestionSessionChange?: (active: boolean) => void;
  // TDH Questões só filtra/gera o lote de questões; a resposta/estudo acontece
  // em Meus Materiais (QuizPlayer). Quando presente, assim que `questions` fica
  // pronto mostramos o modal "Salvar em Caderno" (pasta + nome escolhidos
  // pelo aluno) e só então o pai é avisado, já com esse destino — a tela de
  // prática interna desta view não é mais usada.
  onQuestionsReady?: (topic: string, subject: string | undefined, questions: QuizQuestion[], folderId: string, notebookName: string, notebookColor?: string, folderColor?: string) => void;
}

const TDHQuestoes: React.FC<TDHQuestoesProps> = ({ onBack, onSaveToNotebook, folders, studyProfile, prefill, onConsumedPrefill, strategicMode, editalConfig, explanationStyle: initialStyle, questionProfileStyle: initialQuestionStyle, fontSizeMultiplier, onBatchComplete, onTriggerGuidedLesson, onQuestionSessionChange, onQuestionsReady }) => {
  const [topic, setTopic] = useState(prefill || '');
  const [inputMode, setInputMode] = useState<'AUTO' | 'PASTE' | 'MANUAL' | 'ENEM' | 'CONCURSO'>('AUTO');
  const [enemExams, setEnemExams] = useState<EnemExamInfo[]>([]);
  const [enemYear, setEnemYear] = useState<number | null>(null);
  const [enemDiscipline, setEnemDiscipline] = useState('');
  const [enemCount, setEnemCount] = useState(10);
  const [enemError, setEnemError] = useState<string | null>(null);
  const [bankSubjects, setBankSubjects] = useState<BankFacetOption[]>([]);
  const [bankSubject, setBankSubject] = useState('');
  const [bankTopics, setBankTopics] = useState<BankFacetOption[]>([]);
  const [bankTopicsTotal, setBankTopicsTotal] = useState(0);
  const [bankTopic, setBankTopic] = useState(''); // '' = qualquer assunto dentro da matéria
  const [bankAreas, setBankAreas] = useState<BankFacetOption[]>([]);
  const [bankArea, setBankArea] = useState(''); // '' = qualquer área dentro da matéria (ex: "Policial")
  const [bankCount, setBankCount] = useState(10);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankLoadingSubjects, setBankLoadingSubjects] = useState(false);
  const [bankLoadingTopics, setBankLoadingTopics] = useState(false);
  const [bankLoadingAreas, setBankLoadingAreas] = useState(false);
  const [bankMatchCount, setBankMatchCount] = useState(0);
  const [bankLoadingCount, setBankLoadingCount] = useState(false);
  // Segundo caminho de filtro dentro do CONCURSO, paralelo ao de matéria/
  // assunto acima: banca/órgão/cargo/ano, para provas oficiais
  // descobertas automaticamente (worker/exam_discovery) que não têm
  // matéria classificada por questão.
  const [bankFilterMode, setBankFilterMode] = useState<'MATERIA' | 'PROVA'>('MATERIA');
  const [examBoards, setExamBoards] = useState<BankFacetOption[]>([]);
  const [examBoard, setExamBoard] = useState('');
  const [examInstitutions, setExamInstitutions] = useState<BankFacetOption[]>([]);
  const [examInstitution, setExamInstitution] = useState('');
  const [examPositions, setExamPositions] = useState<BankFacetOption[]>([]);
  const [examPosition, setExamPosition] = useState('');
  const [examYears, setExamYears] = useState<BankFacetOption[]>([]);
  const [examYear, setExamYear] = useState('');
  const [examCount, setExamCount] = useState(10);
  const [examError, setExamError] = useState<string | null>(null);
  const [examLoadingBoards, setExamLoadingBoards] = useState(false);
  const [examLoadingInstitutions, setExamLoadingInstitutions] = useState(false);
  const [examLoadingPositions, setExamLoadingPositions] = useState(false);
  const [examLoadingYears, setExamLoadingYears] = useState(false);
  const [manualInputType, setManualInputType] = useState<'FULL' | 'QUICK'>('FULL');
  const createEmptyManualQuestion = () => ({
    id: Math.random().toString(36).substr(2, 9),
    question: '',
    options: ['', '', '', '', ''],
    correctAnswer: 0,
    explanation: '',
    topic: topic || 'Questões Manuais',
  });

  const [manualQuestionsList, setManualQuestionsList] = useState<QuizQuestion[]>([
    {
      id: Math.random().toString(36).substr(2, 9),
      question: '',
      options: ['', '', '', '', ''],
      correctAnswer: 0,
      explanation: '',
      topic: topic || 'Questões Manuais',
    },
  ]);
  const [pastedText, setPastedText] = useState('');
  const [pastedGabarito, setPastedGabarito] = useState('');
  const [batchStatus, setBatchStatus] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [banca, setBanca] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  useEffect(() => {
    onQuestionSessionChange?.(questions.length > 0);
  }, [questions.length, onQuestionSessionChange]);

  useEffect(() => () => onQuestionSessionChange?.(false), [onQuestionSessionChange]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [flagged, setFlagged] = useState<number[]>([]);
  const [questionScratched, setQuestionScratched] = useState<number[]>([]);
  const [questionHighlighted, setQuestionHighlighted] = useState<number[]>([]);
  const [undoStack, setUndoStack] = useState<Record<number, string[]>>({});
  const questionTextRef = useRef<HTMLDivElement>(null);
  const noteSectionRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const saveToUndo = (idx: number, content: string) => {
    setUndoStack((prev) => ({
      ...prev,
      [idx]: [...(prev[idx] || []), content].slice(-10),
    }));
  };

  const handleUndo = () => {
    const qHistory = undoStack[currentIdx] || [];
    if (qHistory.length === 0) return;

    const previousContent = qHistory[qHistory.length - 1];
    const newHistory = qHistory.slice(0, -1);

    setUndoStack((prev) => ({
      ...prev,
      [currentIdx]: newHistory,
    }));

    const newQuestions = [...questions];
    newQuestions[currentIdx].question = previousContent;
    setQuestions(newQuestions);

    if (questionTextRef.current) {
      questionTextRef.current.innerHTML = previousContent;
    }
  };

  const [tempSelectedOpt, setTempSelectedOpt] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [showCommentary, setShowCommentary] = useState(false);
  const [saved, setSaved] = useState(false);
  const [numQuestions, setNumQuestions] = useState(10);
  const [explanationStyle, setExplanationStyle] = useState<ExplanationStyle>(initialStyle || 'TECNICA');
  const [questionProfileStyle, setQuestionProfileStyle] = useState<string>(initialQuestionStyle || '');
  const [noteFontSize, setNoteFontSize] = useState(1.4);
  const [localFontSize, setLocalFontSize] = useState(fontSizeMultiplier || 1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveMode, setSaveMode] = useState<'ALL' | 'SINGLE'>('ALL');

  // Assim que o filtro/geração termina, abrimos o modal "Salvar em Caderno"
  // pra escolher pasta e nome — só ao confirmar é que o pai (App.tsx) recebe
  // o lote e navega pra Meus Materiais. Sem esse modal, cancelar não deixaria
  // outra forma de voltar ao filtro (a prática interna não existe mais aqui).
  const bankSaveModalShownRef = useRef(false);
  useEffect(() => {
    if (!questions.length) {
      bankSaveModalShownRef.current = false;
      return;
    }
    if (!onQuestionsReady || bankSaveModalShownRef.current) return;
    bankSaveModalShownRef.current = true;
    setSaveMode('ALL');
    setShowSaveModal(true);
  }, [questions, onQuestionsReady]);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [crossedOut, setCrossedOut] = useState<number[]>([]);
  const [userCommentaryInput, setUserCommentaryInput] = useState('');
  const [showNoteSection, setShowNoteSection] = useState(false);
  const [showImageArea, setShowImageArea] = useState(false);
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);

  React.useEffect(() => {
    if (questions[currentIdx]) {
      setUserCommentaryInput(questions[currentIdx].userCommentary || '');
    }
  }, [currentIdx, questions]);

  const handleSaveUserCommentary = (overrideValue?: string) => {
    if (!questions[currentIdx]) return;
    const valueToSave = overrideValue !== undefined ? overrideValue : userCommentaryInput;
    const newQuestions = [...questions];
    newQuestions[currentIdx] = {
      ...newQuestions[currentIdx],
      userCommentary: valueToSave,
    };
    setQuestions(newQuestions);
  };

  const copyQuestionToClipboard = (q: QuizQuestion) => {
    if (!q) return;
    const optionsText = (q.options || []).map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt}`).join('\n');

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = q.question;
    const cleanQuestion = tempDiv.innerText || tempDiv.textContent || q.question;

    let plainText = `${cleanQuestion}\n\n${optionsText}`;

    if (q.explanation) {
      const tempExp = document.createElement('div');
      tempExp.innerHTML = q.explanation;
      const cleanExp = tempExp.innerText || tempExp.textContent || q.explanation;
      plainText += `\n\nEXPLICAÇÃO:\n${cleanExp}`;
    }

    navigator.clipboard
      .writeText(plainText)
      .then(() => {
        setCopiedId(q.id);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch((err) => {
        console.error('Erro ao copiar:', err);
      });
  };

  const handleNext = () => {
    handleSaveUserCommentary();
    if (currentIdx < questions.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      const prevAnswer = userAnswers[nextIdx];
      setTempSelectedOpt(prevAnswer ?? null);
      setSelectedOpt(prevAnswer ?? null);
      setIsSubmitted(prevAnswer !== undefined);
      setShowCommentary(false);
      setCrossedOut([]);
    }
  };

  const handlePrev = () => {
    handleSaveUserCommentary();
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setCurrentIdx(prevIdx);
      const prevAnswer = userAnswers[prevIdx];
      setTempSelectedOpt(prevAnswer ?? null);
      setSelectedOpt(prevAnswer ?? null);
      setIsSubmitted(prevAnswer !== undefined);
      setShowCommentary(false);
      setCrossedOut([]);
    }
  };

  React.useEffect(() => {
    if (prefill) {
      handleGenerate(prefill);
      onConsumedPrefill?.();
    }
  }, [prefill]);

  const handleGenerate = async (targetTopic?: string) => {
    const finalTopic = targetTopic || (strategicMode ? (selectedTopic ? `${selectedSubject}: ${selectedTopic}` : '') : topic);
    if (!finalTopic.trim()) return;
    setLoading(true);
    setQuestions([]);
    setCurrentIdx(0);
    setShowCommentary(false);
    setSaved(false);
    setUserAnswers({});
    if (!targetTopic) setTopic(finalTopic);

    try {
      const result = await generateExamQuestions(finalTopic, numQuestions, studyProfile, banca, explanationStyle, questionProfileStyle);
      const formatted = result.questions.map((q: any) => ({
        ...q,
        id: Math.random().toString(36).substr(2, 9),
      }));
      setQuestions(formatted);
      setTempSelectedOpt(null);
      setIsSubmitted(false);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro desconhecido ao gerar simulado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (inputMode === 'ENEM' && enemExams.length === 0) {
      fetchEnemExams()
        .then((exams) => {
          setEnemExams(exams);
          if (exams.length > 0) {
            setEnemYear(exams[0].year);
            setEnemDiscipline(exams[0].disciplines[0]?.value ?? '');
          }
        })
        .catch((err) => setEnemError(err.message || 'Não foi possível carregar as provas do ENEM.'));
    }
    if (inputMode === 'CONCURSO' && bankSubjects.length === 0 && !bankLoadingSubjects) {
      setBankLoadingSubjects(true);
      listBankImportSubjects()
        .then((subjects) => {
          setBankSubjects(subjects);
          if (subjects.length > 0) setBankSubject(subjects[0].value);
        })
        .catch((err) => setBankError(err.message || 'Não foi possível carregar as matérias do nosso banco.'))
        .finally(() => setBankLoadingSubjects(false));
    }
  }, [inputMode]);

  // Matéria, área e assunto são 3 filtros INDEPENDENTES e opcionais entre si
  // — só a matéria é obrigatória (BUSCAR já funciona só com ela). Trocar de
  // matéria zera área/assunto (a seleção antiga pode nem existir na nova
  // matéria); mas trocar a área NUNCA mexe no assunto escolhido, e vice-versa
  // — cada efeito abaixo só reconsulta e atualiza a SUA própria lista de
  // opções (agora já filtrada pela outra escolha, quando houver), sem forçar
  // o aluno a preencher os três pra conseguir buscar algo.
  React.useEffect(() => {
    setBankTopic('');
    setBankArea('');
  }, [bankSubject]);

  React.useEffect(() => {
    if (!bankSubject) {
      setBankTopics([]);
      setBankTopicsTotal(0);
      return;
    }
    setBankLoadingTopics(true);
    listBankTopicsForSubject(bankSubject, bankArea || null)
      .then(({ total, topics }) => {
        setBankTopicsTotal(total);
        setBankTopics(topics);
      })
      .catch((err) => setBankError(err.message || 'Não foi possível carregar os assuntos dessa matéria.'))
      .finally(() => setBankLoadingTopics(false));
  }, [bankSubject, bankArea]);

  React.useEffect(() => {
    if (!bankSubject) {
      setBankAreas([]);
      return;
    }
    setBankLoadingAreas(true);
    listBankAreasForSubject(bankSubject, bankTopic || null)
      .then(setBankAreas)
      .catch((err) => setBankError(err.message || 'Não foi possível carregar as áreas dessa matéria.'))
      .finally(() => setBankLoadingAreas(false));
  }, [bankSubject, bankTopic]);

  // Quantas questões existem de fato pra essa combinação matéria/assunto/área
  // — usado pro aluno saber quantas ele consegue pedir/salvar, e pra travar
  // o slider nesse teto em vez de deixar pedir mais do que existe. Consulta
  // o Firestore direto porque assunto e área, quando combinados, podem se
  // sobrepor menos do que a soma das duas contagens isoladas sugere.
  React.useEffect(() => {
    if (!bankSubject) {
      setBankMatchCount(0);
      return;
    }
    setBankLoadingCount(true);
    countBankQuestions(bankSubject, bankTopic || null, bankArea || null)
      .then(setBankMatchCount)
      .catch((err) => setBankError(err.message || 'Não foi possível verificar a disponibilidade dessa seleção.'))
      .finally(() => setBankLoadingCount(false));
  }, [bankSubject, bankTopic, bankArea]);

  React.useEffect(() => {
    if (bankMatchCount > 0 && bankCount > bankMatchCount) {
      setBankCount(bankMatchCount);
    }
  }, [bankMatchCount]);

  // --- Cascata banca -> órgão (institution) -> cargo (position) -> ano ---
  React.useEffect(() => {
    if (inputMode === 'CONCURSO' && bankFilterMode === 'PROVA' && examBoards.length === 0 && !examLoadingBoards) {
      setExamLoadingBoards(true);
      listExamBoards()
        .then((boards) => {
          setExamBoards(boards);
          if (boards.length > 0) setExamBoard(boards[0].value);
        })
        .catch((err) => setExamError(err.message || 'Não foi possível carregar as bancas disponíveis.'))
        .finally(() => setExamLoadingBoards(false));
    }
  }, [inputMode, bankFilterMode]);

  React.useEffect(() => {
    if (!examBoard) {
      setExamInstitutions([]);
      setExamInstitution('');
      return;
    }
    setExamLoadingInstitutions(true);
    setExamInstitution('');
    listExamInstitutions(examBoard)
      .then(setExamInstitutions)
      .catch((err) => setExamError(err.message || 'Não foi possível carregar os órgãos dessa banca.'))
      .finally(() => setExamLoadingInstitutions(false));
  }, [examBoard]);

  React.useEffect(() => {
    if (!examBoard || !examInstitution) {
      setExamPositions([]);
      setExamPosition('');
      return;
    }
    setExamLoadingPositions(true);
    setExamPosition('');
    listExamPositions(examBoard, examInstitution)
      .then(setExamPositions)
      .catch((err) => setExamError(err.message || 'Não foi possível carregar os cargos desse órgão.'))
      .finally(() => setExamLoadingPositions(false));
  }, [examBoard, examInstitution]);

  React.useEffect(() => {
    if (!examBoard || !examInstitution || !examPosition) {
      setExamYears([]);
      setExamYear('');
      return;
    }
    setExamLoadingYears(true);
    setExamYear('');
    listExamYears(examBoard, examInstitution, examPosition)
      .then((years) => {
        setExamYears(years);
        if (years.length > 0) setExamYear(years[0].value);
      })
      .catch((err) => setExamError(err.message || 'Não foi possível carregar os anos dessa prova.'))
      .finally(() => setExamLoadingYears(false));
  }, [examBoard, examInstitution, examPosition]);

  const examAvailableCount = examYear ? (examYears.find((y) => y.value === examYear)?.count ?? 0) : 0;

  React.useEffect(() => {
    if (examAvailableCount > 0 && examCount > examAvailableCount) {
      setExamCount(examAvailableCount);
    }
  }, [examAvailableCount]);

  const handleFetchExamBank = async () => {
    if (!examBoard || !examInstitution || !examPosition || !examYear) return;
    setLoading(true);
    setExamError(null);
    setQuestions([]);
    setCurrentIdx(0);
    setShowCommentary(false);
    setSaved(false);
    setUserAnswers({});
    setTopic(`${examBoard} · ${examInstitution} · ${examPosition} · ${examYear}`);

    try {
      const formatted = await fetchExamQuestions(examBoard, examInstitution, examPosition, Number(examYear), examCount);
      setQuestions(formatted);
      setTempSelectedOpt(null);
      setIsSubmitted(false);
    } catch (error: any) {
      setExamError(error.message || 'Erro ao buscar questões do nosso banco.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchBank = async () => {
    if (!bankSubject) return;
    setLoading(true);
    setBankError(null);
    setQuestions([]);
    setCurrentIdx(0);
    setShowCommentary(false);
    setSaved(false);
    setUserAnswers({});
    setTopic([bankSubject, bankArea, bankTopic].filter(Boolean).join(' · '));

    try {
      const formatted = await fetchBankQuestions(bankSubject, bankTopic || null, bankArea || null, bankCount);
      setQuestions(formatted);
      setTempSelectedOpt(null);
      setIsSubmitted(false);
    } catch (error: any) {
      setBankError(error.message || 'Erro ao buscar questões do nosso banco.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchEnem = async () => {
    if (!enemYear || !enemDiscipline) return;
    setLoading(true);
    setEnemError(null);
    setQuestions([]);
    setCurrentIdx(0);
    setShowCommentary(false);
    setSaved(false);
    setUserAnswers({});
    setTopic(`ENEM ${enemYear} · ${enemDisciplineLabel(enemDiscipline)}`);

    try {
      const formatted = await fetchEnemQuestions(enemYear, enemDiscipline, enemCount);
      setQuestions(formatted);
      setTempSelectedOpt(null);
      setIsSubmitted(false);
    } catch (error: any) {
      setEnemError(error.message || 'Erro ao buscar questões do ENEM.');
    } finally {
      setLoading(false);
    }
  };

  const handleParsePasted = async () => {
    if (!pastedText.trim()) return;
    setLoading(true);
    setQuestions([]);
    setCurrentIdx(0);
    setShowCommentary(false);
    setSaved(false);
    setUserAnswers({});

    try {
      // Step 1: Split text into physical chunks to avoid context window issues and improve precision
      // We aim for larger chunks for Pro model (~40,000 characters)
      const chunkSize = 40000;
      const chunks: string[] = [];
      let remainingText = pastedText;

      while (remainingText.length > 0) {
        if (remainingText.length <= chunkSize) {
          chunks.push(remainingText);
          break;
        }

        let splitPoint = remainingText.lastIndexOf('\n\n', chunkSize);
        if (splitPoint === -1) splitPoint = remainingText.lastIndexOf('\n', chunkSize);
        if (splitPoint === -1) splitPoint = chunkSize;

        chunks.push(remainingText.substring(0, splitPoint));
        remainingText = remainingText.substring(splitPoint).trim();
      }

      const totalBatches = chunks.length;
      let allQuestions: any[] = [];

      // Step 2: Extract in blocks
      for (let i = 0; i < totalBatches; i++) {
        setBatchStatus({ current: i + 1, total: totalBatches });
        console.log(`Processando bloco ${i + 1} de ${totalBatches}...`);

        // Delay estratégico para não estourar a cota
        if (i > 0) {
          console.log(`Aguardando 1.5s para evitar bloqueio de cota...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        const result = await parsePastedQuestions(chunks[i], studyProfile, { current: i + 1, total: totalBatches }, pastedGabarito, explanationStyle, questionProfileStyle);

        if (result.questions && Array.isArray(result.questions)) {
          const formatted = result.questions.map((q: any) => ({
            ...q,
            id: Math.random().toString(36).substr(2, 9),
          }));
          allQuestions = [...allQuestions, ...formatted];
          console.log(`Bloco ${i + 1} concluído. Total de questões extraídas até agora: ${allQuestions.length}`);
          // Show progress incrementally
          setQuestions([...allQuestions]);
          setTempSelectedOpt(null);
          setIsSubmitted(false);
        } else {
          console.warn(`Bloco ${i + 1} retornou 0 questões.`);
        }
      }

      if (allQuestions.length === 0) throw new Error('Não conseguimos extrair nenhuma questão do texto.');

      setTopic('Questões do Texto Colado');
      setBatchStatus(null);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao processar texto. Verifique o formato e tente novamente.');
    } finally {
      setLoading(false);
      setBatchStatus(null);
    }
  };

  const handleAnswerSelection = (idx: number) => {
    if (isSubmitted) return;
    setTempSelectedOpt(idx);
    setCrossedOut((prev) => prev.filter((i) => i !== idx)); // Un-cross if selected
  };

  const handleSubmitAnswer = () => {
    if (tempSelectedOpt === null || isSubmitted) return;
    setSelectedOpt(tempSelectedOpt);
    setIsSubmitted(true);
    setUserAnswers((prev) => ({ ...prev, [currentIdx]: tempSelectedOpt }));
  };

  const handleDoubleClick = (idx: number) => {
    if (isSubmitted) return;
    if (tempSelectedOpt === idx) setTempSelectedOpt(null);
    setCrossedOut((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
  };

  const toggleFlag = () => {
    setFlagged((prev) => (prev.includes(currentIdx) ? prev.filter((i) => i !== currentIdx) : [...prev, currentIdx]));
  };

  const addManualQuestion = () => {
    setManualQuestionsList((prev) => [...prev, createEmptyManualQuestion()]);
  };

  const updateManualQuestion = (idx: number, field: string, value: any) => {
    setManualQuestionsList((prev) => {
      const newList = [...prev];
      newList[idx] = { ...newList[idx], [field]: value };
      return newList;
    });
  };

  const startManualSimulado = () => {
    const finalQuestions = manualQuestionsList.filter((q) => q.question.trim().length > 0);

    if (finalQuestions.length === 0) {
      alert('Preencha pelo menos uma questão.');
      return;
    }

    setQuestions(finalQuestions);
    setTopic(topic || 'Simulado Manual');
    setCurrentIdx(0);
    setTempSelectedOpt(null);
    setIsSubmitted(false);
  };

  const handleDeleteQuestion = () => {
    if (confirm('Tem certeza que deseja excluir esta questão? Ela será removida apenas desta sessão.')) {
      const deletedIdx = currentIdx;
      const newQuestions = questions.filter((_, idx) => idx !== deletedIdx);
      if (newQuestions.length === 0) {
        setQuestions([]);
        setUserAnswers({});
        setFlagged([]);
        setQuestionScratched([]);
        setQuestionHighlighted([]);
        setUndoStack({});
        return;
      }
      setQuestions(newQuestions);
      setUserAnswers((prev) => reindexRecordAfterDelete(prev, deletedIdx));
      setFlagged((prev) => reindexListAfterDelete(prev, deletedIdx));
      setQuestionScratched((prev) => reindexListAfterDelete(prev, deletedIdx));
      setQuestionHighlighted((prev) => reindexListAfterDelete(prev, deletedIdx));
      setUndoStack((prev) => reindexRecordAfterDelete(prev, deletedIdx));
      if (currentIdx >= newQuestions.length) {
        setCurrentIdx(newQuestions.length - 1);
      }
      setSelectedOpt(null);
      setShowCommentary(false);
      setCrossedOut([]);
    }
  };

  const handleFinish = () => {
    const total = questions.length;
    const correct = questions.filter((q, i) => userAnswers[i] === q.correctAnswer).length;
    onBatchComplete?.(
      topic,
      selectedSubject,
      total,
      correct,
      questions.map((q, i) => ({ ...q, userAnswer: userAnswers[i] })),
    );
    onBack();
  };

  const handleShuffle = () => {
    if (confirm('Deseja embaralhar as questões deste simulado?')) {
      // Fisher-Yates shuffle of indices: newOrder[newIdx] = oldIdx
      const newOrder = questions.map((_, idx) => idx);
      for (let i = newOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newOrder[i], newOrder[j]] = [newOrder[j], newOrder[i]];
      }
      const shuffled = newOrder.map((oldIdx) => questions[oldIdx]);
      setQuestions(shuffled);
      setUserAnswers((prev) => reindexRecordForPermutation(prev, newOrder));
      setFlagged((prev) => reindexListForPermutation(prev, newOrder));
      setQuestionScratched((prev) => reindexListForPermutation(prev, newOrder));
      setQuestionHighlighted((prev) => reindexListForPermutation(prev, newOrder));
      setUndoStack((prev) => reindexRecordForPermutation(prev, newOrder));
      setCurrentIdx(0);
      setTempSelectedOpt(null);
      setSelectedOpt(null);
      setIsSubmitted(false);
      setCrossedOut([]);
    }
  };

  const handleSelectiveMark = (type: 'strike' | 'highlight') => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
      if (type === 'strike') toggleQuestionScratch();
      else toggleQuestionHighlight();
      return;
    }

    const range = selection.getRangeAt(0);
    const container = questionTextRef.current;

    if (container && (container.contains(range.commonAncestorContainer) || container === range.commonAncestorContainer)) {
      const span = document.createElement('span');
      if (type === 'strike') {
        span.className = 'line-through decoration-red-500/30 decoration-2 text-slate-400 opacity-80';
      } else {
        span.className = 'bg-[#ffe6b9]/60 rounded-sm px-0.5 text-slate-900 border-b border-[#fedda1]';
      }

      try {
        saveToUndo(currentIdx, container.innerHTML);
        if (range.startContainer === range.endContainer) {
          range.surroundContents(span);
        } else {
          const content = range.extractContents();
          span.appendChild(content);
          range.insertNode(span);
        }
        const newQuestions = [...questions];
        newQuestions[currentIdx].question = container.innerHTML;
        setQuestions(newQuestions);
      } catch (e) {
        console.warn('Selection failed', e);
      }
      selection.removeAllRanges();
    }
  };

  const toggleQuestionScratch = () => {
    if (questionScratched.includes(currentIdx)) {
      setQuestionScratched(questionScratched.filter((i) => i !== currentIdx));
    } else {
      setQuestionScratched([...questionScratched, currentIdx]);
      setQuestionHighlighted(questionHighlighted.filter((i) => i !== currentIdx));
    }
  };

  const toggleQuestionHighlight = () => {
    if (questionHighlighted.includes(currentIdx)) {
      setQuestionHighlighted(questionHighlighted.filter((i) => i !== currentIdx));
    } else {
      setQuestionHighlighted([...questionHighlighted, currentIdx]);
      setQuestionScratched(questionScratched.filter((i) => i !== currentIdx));
    }
  };

  const handleAddExplanationImage = (imageUrl: string) => {
    if (!questions[currentIdx]) return;
    const newQuestions = [...questions];
    const currentImages = newQuestions[currentIdx].explanationImages || [];
    newQuestions[currentIdx] = {
      ...newQuestions[currentIdx],
      explanationImages: [...currentImages, imageUrl],
    };
    setQuestions(newQuestions);
  };

  const handleRemoveExplanationImage = (imgIdx: number) => {
    if (!questions[currentIdx]) return;
    const newQuestions = [...questions];
    const currentImages = [...(newQuestions[currentIdx].explanationImages || [])];
    currentImages.splice(imgIdx, 1);
    newQuestions[currentIdx] = {
      ...newQuestions[currentIdx],
      explanationImages: currentImages,
    };
    setQuestions(newQuestions);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        handleAddExplanationImage(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateImageSize = (imgIdx: number, size: string) => {
    if (!questions[currentIdx]) return;
    const newQuestions = [...questions];
    const currentSizes = [...(newQuestions[currentIdx].explanationImageSizes || [])];
    // Pad array if needed
    while (currentSizes.length <= imgIdx) currentSizes.push('md');
    currentSizes[imgIdx] = size;
    newQuestions[currentIdx] = {
      ...newQuestions[currentIdx],
      explanationImageSizes: currentSizes,
    };
    setQuestions(newQuestions);
  };

  const handleSaveSingleQuestion = () => {
    setSaveMode('SINGLE');
    setShowSaveModal(true);
  };

  const handleConfirmSave = (folderId: string, notebookName: string, notebookColor: string, folderColor: string) => {
    const questionsToSave = saveMode === 'SINGLE' ? [questions[currentIdx]] : questions;
    if (onQuestionsReady) {
      // Veio do filtro/geração do banco — o pai cuida de criar/atualizar o
      // caderno no destino escolhido e já navega pra Meus Materiais.
      onQuestionsReady(topic, selectedSubject || undefined, questionsToSave, folderId, notebookName, notebookColor, folderColor);
      setShowSaveModal(false);
      return;
    }
    onSaveToNotebook(folderId, notebookName, questionsToSave, undefined, notebookColor, folderColor);
    if (saveMode === 'ALL') setSaved(true);
    setShowSaveModal(false);
  };

  const currentQ = questions[currentIdx];

  if (loading) {
    return (
      <div className="relative min-h-[calc(100dvh-12rem)] rounded-[32px] bg-[#473c33] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-[50px] p-12 md:p-20 shadow-2xl flex flex-col items-center max-w-xl w-full">
          <LoadingFish message={batchStatus ? `Analisando parte ${batchStatus.current} de ${batchStatus.total}...` : 'Montando seu simulado...'} submessage={batchStatus ? 'Estamos analisando o texto em etapas para incluir todas as questões.' : `Preparando questões para ${studyProfile === 'CONCURSO' ? 'concursos' : studyProfile === 'FACULDADE' ? 'a faculdade' : 'o ENEM e vestibulares'}.`} />

          {batchStatus && (
            <div className="mt-8 w-full">
              <div className="flex justify-between mb-2">
                <span className="text-[#473c33] font-black text-[10px] tracking-widest uppercase">Análise de Conteúdo</span>
                <span className="text-[#473c33] font-black text-[10px]">{Math.round((batchStatus.current / batchStatus.total) * 100)}%</span>
              </div>
              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#fdad74] transition-all duration-1000 ease-out"
                  style={{
                    width: `${(batchStatus.current / batchStatus.total) * 100}%`,
                  }}
                ></div>
              </div>
              <p className="mt-6 text-center text-gray-400 font-bold text-[9px] uppercase tracking-[0.2em] leading-relaxed max-w-xs mx-auto">
                Estamos processando em lotes de segurança.
                <br />
                Isso evita erros de memória da IA e garante a extração de 100% das perguntas coladas.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${questions.length ? 'fixed inset-0 z-[200] overflow-y-auto' : 'relative w-full min-h-full rounded-[32px]'} bg-[#f8fafc] dark:bg-[#24251f] text-[#1e293b] dark:text-[#f2efd2] selection:bg-[#fec868]/30 font-sans`}>
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
        {!questions.length ? (
          <div className="py-2">
            <button onClick={onBack} className="min-h-[44px] mb-4 text-gray-500 font-black uppercase text-[10px] tracking-[0.25em] flex items-center gap-2 hover:text-[#473c33] transition-all group">
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              ABANDONAR SIMULADO
            </button>

            <div className="bg-white rounded-[32px] p-5 sm:p-8 md:p-10 border border-slate-200 dark:border-white/10 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 p-6 opacity-[0.035] pointer-events-none text-[#fec868]">
                <FileText className="w-28 h-28" />
              </div>

              <div className="relative z-10 max-w-4xl mx-auto">
                <div className="mb-7 flex items-center gap-4 text-left">
                  <div className="w-12 h-12 shrink-0 bg-[#fec868]/10 text-[#fec868] border border-[#fec868]/20 rounded-2xl flex items-center justify-center shadow-sm">
                    <Scissors className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{strategicMode ? 'Prática direcionada' : 'Geração e curadoria'}</p>
                    <h1 className="font-logo text-2xl sm:text-3xl leading-tight uppercase text-slate-800">
                      TDH<span className="text-[#fec868]">QUESTÕES</span>
                    </h1>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400">{strategicMode ? (studyProfile === 'FACULDADE' ? 'Alinhado à sua grade curricular' : 'Alinhado ao seu edital') : `Simulados ${studyProfile === 'CONCURSO' ? 'para concursos' : studyProfile === 'FACULDADE' ? 'universitários' : 'de vestibular'} com gabarito comentado`}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <section className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5 text-left dark:bg-[#303129]">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fec868]/15 text-[11px] font-black text-[#b65f2e] dark:text-[#f3a06c]">01</span>
                      <div>
                        <label htmlFor="quiz-topic" className="block text-sm font-black text-slate-700">Qual assunto você quer praticar?</label>
                        <p className="text-[11px] font-medium text-slate-400">Digite um tema ou recorte específico.</p>
                      </div>
                    </div>
                    <input id="quiz-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={studyProfile === 'CONCURSO' ? 'Ex.: Atos administrativos' : studyProfile === 'FACULDADE' ? 'Ex.: Cálculo I ou Patologia humana' : 'Ex.: Genética mendeliana'} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-[#fec868] focus:ring-2 focus:ring-[#fec868]/15 transition-all font-bold text-left text-slate-700 placeholder:text-slate-300" />
                  </section>

                  {!strategicMode && (
                    <section className="space-y-3 text-left">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fec868]/15 text-[11px] font-black text-[#b65f2e] dark:text-[#f3a06c]">02</span>
                        <div>
                          <h2 className="text-sm font-black text-slate-700">Como deseja montar as questões?</h2>
                          <p className="text-[11px] font-medium text-slate-400">Escolha uma forma para continuar.</p>
                        </div>
                      </div>
                      <div role="group" aria-label="Modo de criação das questões" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                        {([
                          { mode: 'AUTO', label: 'IA', Icon: Brain },
                          { mode: 'PASTE', label: 'Colar', Icon: FileText },
                          { mode: 'MANUAL', label: 'Manual', Icon: PenLine },
                          { mode: 'ENEM', label: 'ENEM', Icon: BookOpen },
                          { mode: 'CONCURSO', label: 'Concurso', Icon: ClipboardList },
                        ] as const).map(({ mode, label, Icon }) => (
                          <button key={mode} type="button" aria-pressed={inputMode === mode} onClick={() => setInputMode(mode)} className={`min-h-[68px] rounded-xl border px-3 py-2.5 flex flex-col items-center justify-center gap-1.5 font-black text-[10px] uppercase tracking-wider transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e96f34] ${inputMode === mode ? 'border-[#fec868] bg-[#fec868] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-[#fec868]/60 hover:text-slate-700 dark:border-white/10 dark:bg-[#35362e] dark:text-[#c8c5a9] dark:hover:text-[#f2efd2]'}`}>
                            <Icon className="h-4 w-4" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {inputMode === 'AUTO' ? (
                    <>
                      <section className="space-y-5 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5 text-left">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fec868]/15 text-[11px] font-black text-[#b65f2e] dark:text-[#f3a06c]">{strategicMode ? '02' : '03'}</span>
                          <div>
                            <h2 className="text-sm font-black text-slate-700">{strategicMode ? 'Defina o foco da prática' : 'Personalize sua bateria'}</h2>
                            <p className="text-[11px] font-medium text-slate-400">{strategicMode ? 'Selecione a matéria e o assunto.' : 'Ajuste banca, quantidade e estilo da explicação.'}</p>
                          </div>
                        </div>
                      {strategicMode && editalConfig ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3 text-left">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">{studyProfile === 'FACULDADE' ? 'Disciplina da Grade' : 'Matéria do Edital'}</label>
                            <select
                              value={selectedSubject}
                              onChange={(e) => {
                                setSelectedSubject(e.target.value);
                                setSelectedTopic('');
                              }}
                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-base focus:outline-none focus:border-[#fdad74] transition-all font-bold appearance-none cursor-pointer text-slate-700"
                            >
                              <option value="" className="bg-[#473c33]">
                                Selecionar Matéria...
                              </option>
                              {editalConfig.subjects.map((s, i) => (
                                <option key={i} value={s.name} className="bg-[#473c33]">
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-3 text-left">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Assunto Específico</label>
                            <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} disabled={!selectedSubject} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-base focus:outline-none focus:border-[#fdad74] transition-all font-bold appearance-none cursor-pointer disabled:opacity-20 text-slate-700">
                              <option value="" className="bg-[#473c33]">
                                Selecionar Assunto...
                              </option>
                              {editalConfig.subjects
                                .find((s) => s.name === selectedSubject)
                                ?.topics.map((t, i) => (
                                  <option key={i} value={t} className="bg-[#473c33]">
                                    {t}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-50 p-5 rounded-2xl text-left border border-slate-100 focus-within:border-[#fec868]/50 transition-all">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Banca examinadora</label>
                          <input value={banca} onChange={(e) => setBanca(e.target.value)} placeholder="Ex: FCC, FGV, CESPE..." className="w-full bg-transparent border-none text-lg focus:outline-none font-black text-slate-700 placeholder:text-slate-300" />
                        </div>
                        <div className="bg-slate-50 p-5 rounded-2xl text-left border border-slate-100">
                          <div className="flex justify-between items-center mb-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ">Qtd. Questões</label>
                            <span className="text-[#fec868] font-black text-xl tabular-nums">{numQuestions}</span>
                          </div>
                          <input type="range" min="1" max="50" value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-full accent-[#fec868] cursor-pointer" />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-5 rounded-2xl text-left border border-slate-100 mb-2 group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 text-center md:text-left group-hover:text-[#fec868] transition-colors">Estilo do mapeamento da lógica</label>
                        <div className="relative">
                          <textarea value={explanationStyle} onChange={(e) => setExplanationStyle(e.target.value)} placeholder="Ex: Use mnemônicos engraçados e explique de forma simples." className="w-full bg-white border-2 border-slate-100 focus:border-[#fec868] rounded-2xl p-4 text-sm font-medium text-slate-600 outline-none transition-all min-h-[78px] resize-none shadow-sm" />
                          <div className="absolute top-4 right-6 text-lg opacity-20">✍️</div>
                        </div>
                        <p className="text-[9px] font-bold text-slate-300 mt-4 text-center md:text-left">Dica: Quanto mais curto o comando, mais rápido a IA responde.</p>
                      </div>

                      <button onClick={() => handleGenerate()} className="w-full bg-[#fec868] text-white py-5 rounded-2xl font-black text-base hover:bg-[#ffb22a] transition-all shadow-xl shadow-[#fec868]/10 flex items-center justify-center gap-3 active:scale-95 group mt-3">
                        CONFIGURAR SIMULADO
                        <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                      </button>
                      </section>
                    </>
                  ) : inputMode === 'PASTE' ? (
                    <div className="space-y-6 text-left relative z-20 animate-in fade-in slide-in-from-bottom-4">
                      <div className="bg-[#fec868]/10 p-6 rounded-3xl border border-[#fec868]/15 mb-6 font-medium text-[#ffb22a] text-sm flex items-center gap-3">
                        <Brain className="w-5 h-5 flex-shrink-0" />
                        <span>A IA vai ler as questões, identificar a resposta certa (se não tiver gabarito) e criar a explicação detalhada para você!</span>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Cole as questões aqui</label>
                        <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)} placeholder="Cole aqui o texto de uma prova, pdf ou site contendo as questões e alternativas..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-[30px] p-8 text-lg focus:outline-none focus:border-[#fec868] transition-all font-medium text-slate-700 placeholder:text-slate-300 min-h-[300px] resize-y shadow-inner" />
                      </div>

                      <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center justify-between px-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Gabarito (Opcional)</label>
                        </div>
                        <textarea value={pastedGabarito} onChange={(e) => setPastedGabarito(e.target.value)} placeholder="Ex: 1-A, 2-C, 3-E... ou cole o gabarito oficial completo aqui." className="w-full bg-slate-50 border-2 border-slate-100 rounded-[30px] p-8 text-lg focus:outline-none focus:border-[#fec868] transition-all font-medium text-slate-700 placeholder:text-slate-300 min-h-[150px] resize-y shadow-inner" />
                      </div>

                      <button onClick={() => handleParsePasted()} disabled={!pastedText.trim()} className="w-full bg-[#fec868] text-white py-8 rounded-[40px] font-black text-xl hover:bg-[#ffb22a] transition-all shadow-xl shadow-[#fec868]/10 flex items-center justify-center gap-4 active:scale-95 group mt-8 disabled:opacity-20 disabled:cursor-not-allowed">
                        PROCESSAR QUESTÕES
                        <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                      </button>
                    </div>
                  ) : inputMode === 'ENEM' ? (
                    <div className="space-y-6 text-left relative z-20 animate-in fade-in slide-in-from-bottom-4">
                      <div className="bg-[#fec868]/10 p-6 rounded-3xl border border-[#fec868]/15 mb-2 font-medium text-[#ffb22a] text-sm flex items-center gap-3">
                        <BookOpen className="w-5 h-5 flex-shrink-0" />
                        <span>Questões oficiais de provas reais do ENEM, direto do banco público enem.dev.</span>
                      </div>

                      {enemError && <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-red-600 text-sm font-bold">{enemError}</div>}

                      {enemExams.length === 0 && !enemError ? (
                        <p className="text-slate-400 text-sm font-bold text-center py-8">Carregando provas disponíveis...</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3 text-left">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Ano da Prova</label>
                              <select
                                value={enemYear ?? ''}
                                onChange={(e) => {
                                  const year = Number(e.target.value);
                                  setEnemYear(year);
                                  const exam = enemExams.find((ex) => ex.year === year);
                                  setEnemDiscipline(exam?.disciplines[0]?.value ?? '');
                                }}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-5 text-lg focus:outline-none focus:border-[#fec868] transition-all font-bold appearance-none cursor-pointer text-slate-700"
                              >
                                {enemExams.map((ex) => (
                                  <option key={ex.year} value={ex.year}>
                                    {ex.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-3 text-left">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Matéria</label>
                              <select value={enemDiscipline} onChange={(e) => setEnemDiscipline(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-5 text-lg focus:outline-none focus:border-[#fec868] transition-all font-bold appearance-none cursor-pointer text-slate-700">
                                {enemExams
                                  .find((ex) => ex.year === enemYear)
                                  ?.disciplines.map((d) => (
                                    <option key={d.value} value={d.value}>
                                      {d.label}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-8 rounded-[35px] text-left border border-slate-100">
                            <div className="flex justify-between items-center mb-6">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ">Qtd. Questões</label>
                              <span className="text-[#fec868] font-black text-2xl tabular-nums">{enemCount}</span>
                            </div>
                            <input type="range" min="1" max="40" value={enemCount} onChange={(e) => setEnemCount(Number(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-full accent-[#fec868] cursor-pointer" />
                          </div>

                          <button onClick={handleFetchEnem} disabled={!enemYear || !enemDiscipline} className="w-full bg-[#fec868] text-white py-8 rounded-[40px] font-black text-xl hover:bg-[#ffb22a] transition-all shadow-xl shadow-[#fec868]/10 flex items-center justify-center gap-4 active:scale-95 group mt-8 disabled:opacity-20 disabled:cursor-not-allowed">
                            BUSCAR QUESTÕES DO ENEM
                            <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                          </button>
                        </>
                      )}
                    </div>
                  ) : inputMode === 'CONCURSO' ? (
                    <div className="space-y-6 text-left relative z-20 animate-in fade-in slide-in-from-bottom-4">
                      <div className="bg-[#fec868]/10 p-6 rounded-3xl border border-[#fec868]/15 mb-2 font-medium text-[#ffb22a] text-sm flex items-center gap-3">
                        <Database className="w-5 h-5 flex-shrink-0" />
                        <span>Questões do nosso próprio banco, extraídas e revisadas de provas reais de concursos.</span>
                      </div>

                      <div className="flex bg-slate-100 p-1 rounded-2xl w-fit border border-slate-200 shadow-inner">
                        <button onClick={() => setBankFilterMode('MATERIA')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${bankFilterMode === 'MATERIA' ? 'bg-white text-[#fec868] shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                          Por Matéria
                        </button>
                        <button onClick={() => setBankFilterMode('PROVA')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${bankFilterMode === 'PROVA' ? 'bg-white text-[#fec868] shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                          Por Prova Oficial
                        </button>
                      </div>

                      {bankFilterMode === 'PROVA' ? (
                        <>
                          {examError && <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-red-600 text-sm font-bold">{examError}</div>}

                          {examLoadingBoards ? (
                            <p className="text-slate-400 text-sm font-bold text-center py-8">Carregando bancas disponíveis...</p>
                          ) : examBoards.length === 0 ? (
                            !examError && <p className="text-slate-400 text-sm font-bold text-center py-8">Ainda não há provas oficiais aprovadas no nosso banco.</p>
                          ) : (
                            <>
                              <FilterDropdown label="Banca" placeholder="Selecionar banca..." value={examBoard} options={examBoards} onChange={setExamBoard} />

                              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <FilterDropdown label="Órgão" placeholder="Selecionar órgão..." value={examInstitution} options={examInstitutions} onChange={setExamInstitution} loading={examLoadingInstitutions} loadingLabel="Carregando órgãos..." />
                              </div>

                              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <FilterDropdown label="Cargo" placeholder="Selecionar cargo..." value={examPosition} options={examPositions} onChange={setExamPosition} loading={examLoadingPositions} loadingLabel="Carregando cargos..." />
                              </div>

                              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <FilterDropdown label="Ano" placeholder="Selecionar ano..." value={examYear} options={examYears} onChange={setExamYear} loading={examLoadingYears} loadingLabel="Carregando anos..." />
                              </div>

                              <div className="bg-slate-50 p-8 rounded-[35px] text-left border border-slate-100">
                                <div className="flex justify-between items-center mb-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ">Qtd. Questões</label>
                                  <span className="text-[#fec868] font-black text-2xl tabular-nums">{examCount}</span>
                                </div>
                                <p className="text-[11px] font-bold text-slate-400 mb-4">
                                  {examAvailableCount} questão
                                  {examAvailableCount === 1 ? '' : 'ões'} disponível
                                  {examAvailableCount === 1 ? '' : 'is'} nessa prova
                                </p>
                                <input type="range" min="1" max={Math.max(1, examAvailableCount)} value={examCount} onChange={(e) => setExamCount(Number(e.target.value))} disabled={examAvailableCount === 0} className="w-full h-1.5 bg-slate-200 rounded-full accent-[#fec868] cursor-pointer disabled:opacity-40" />
                              </div>

                              <button onClick={handleFetchExamBank} disabled={!examBoard || !examInstitution || !examPosition || !examYear || examAvailableCount === 0} className="w-full bg-[#fec868] text-white py-8 rounded-[40px] font-black text-xl hover:bg-[#ffb22a] transition-all shadow-xl shadow-[#fec868]/10 flex items-center justify-center gap-4 active:scale-95 group mt-8 disabled:opacity-20 disabled:cursor-not-allowed">
                                BUSCAR DO NOSSO BANCO
                                <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        bankError && <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-red-600 text-sm font-bold">{bankError}</div>
                      )}

                      {bankFilterMode === 'PROVA' ? null : bankLoadingSubjects ? (
                        <p className="text-slate-400 text-sm font-bold text-center py-8">Carregando matérias disponíveis...</p>
                      ) : bankSubjects.length === 0 ? (
                        !bankError && <p className="text-slate-400 text-sm font-bold text-center py-8">Ainda não há questões aprovadas no nosso banco.</p>
                      ) : (
                        <>
                          <div className="space-y-3 text-left">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Matéria</label>
                            <select value={bankSubject} onChange={(e) => setBankSubject(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-5 text-lg focus:outline-none focus:border-[#fec868] transition-all font-bold appearance-none cursor-pointer text-slate-700">
                              {bankSubjects.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.value} ({s.count})
                                </option>
                              ))}
                            </select>
                          </div>

                          {bankAreas.length > 0 && (
                            <div className="space-y-3 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Área</label>
                              <select value={bankArea} onChange={(e) => setBankArea(e.target.value)} disabled={bankLoadingAreas} className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-5 text-lg focus:outline-none focus:border-[#fec868] transition-all font-bold appearance-none cursor-pointer text-slate-700 disabled:opacity-40">
                                <option value="">{bankLoadingAreas ? 'Carregando áreas...' : `Todas as áreas (${bankTopicsTotal})`}</option>
                                {bankAreas.map((a) => (
                                  <option key={a.value} value={a.value}>
                                    {a.value} ({a.count})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="space-y-3 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Assunto</label>
                            <select value={bankTopic} onChange={(e) => setBankTopic(e.target.value)} disabled={bankLoadingTopics} className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-5 text-lg focus:outline-none focus:border-[#fec868] transition-all font-bold appearance-none cursor-pointer text-slate-700 disabled:opacity-40">
                              <option value="">{bankLoadingTopics ? 'Carregando assuntos...' : `Todos os assuntos (${bankTopicsTotal})`}</option>
                              {bankTopics.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.value} ({t.count})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="bg-slate-50 p-8 rounded-[35px] text-left border border-slate-100">
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ">Qtd. Questões</label>
                              <span className="text-[#fec868] font-black text-2xl tabular-nums">{bankCount}</span>
                            </div>
                            <p className="text-[11px] font-bold text-slate-400 mb-4">{bankLoadingCount ? 'Verificando disponibilidade...' : `${bankMatchCount} questão${bankMatchCount === 1 ? '' : 'ões'} disponível${bankMatchCount === 1 ? '' : 'is'} nessa seleção`}</p>
                            <input type="range" min="1" max={Math.max(1, bankMatchCount)} value={bankCount} onChange={(e) => setBankCount(Number(e.target.value))} disabled={bankMatchCount === 0} className="w-full h-1.5 bg-slate-200 rounded-full accent-[#fec868] cursor-pointer disabled:opacity-40" />
                          </div>

                          <button onClick={handleFetchBank} disabled={!bankSubject || bankMatchCount === 0} className="w-full bg-[#fec868] text-white py-8 rounded-[40px] font-black text-xl hover:bg-[#ffb22a] transition-all shadow-xl shadow-[#fec868]/10 flex items-center justify-center gap-4 active:scale-95 group mt-8 disabled:opacity-20 disabled:cursor-not-allowed">
                            BUSCAR DO NOSSO BANCO
                            <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-12 text-left relative z-20 animate-in fade-in slide-in-from-bottom-4">
                      <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mb-4 border border-slate-200 shadow-inner">
                        <button onClick={() => setManualInputType('FULL')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${manualInputType === 'FULL' ? 'bg-white text-[#fec868] shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                          Completo
                        </button>
                        <button onClick={() => setManualInputType('QUICK')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${manualInputType === 'QUICK' ? 'bg-white text-[#fec868] shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                          Modo Rápido
                        </button>
                      </div>

                      <div className="space-y-16">
                        {manualQuestionsList.map((mq, qIdx) => (
                          <div key={mq.id} className="bg-white p-8 md:p-12 rounded-[45px] border border-slate-100 shadow-sm relative group animate-in zoom-in-95 duration-300">
                            <div className="absolute -top-4 -left-4 w-12 h-12 bg-[#fec868] text-white rounded-2xl flex items-center justify-center font-black shadow-lg z-10">{qIdx + 1}</div>

                            {manualQuestionsList.length > 1 && (
                              <button onClick={() => setManualQuestionsList((prev) => prev.filter((_, i) => i !== qIdx))} className="absolute top-8 right-8 p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}

                            <div className="space-y-8">
                              <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{manualInputType === 'QUICK' ? 'Pergunta + Alternativas (Tudo aqui)' : 'Enunciado da Questão'}</label>
                                <div className="bg-slate-50 rounded-[30px] border-2 border-slate-100 focus-within:border-[#fec868] transition-all overflow-hidden shadow-inner">
                                  <RichTextEditor content={mq.question} onChange={(html) => updateManualQuestion(qIdx, 'question', html)} />
                                </div>
                              </div>

                              <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Gabarito</label>
                                {manualInputType === 'QUICK' ? (
                                  <div className="flex gap-4 items-center bg-slate-50 p-6 rounded-[30px] border border-slate-100 justify-between shadow-inner">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qual a letra correta?</span>
                                    <div className="flex gap-3">
                                      {[0, 1, 2, 3, 4].map((idx) => (
                                        <button key={idx} onClick={() => updateManualQuestion(qIdx, 'correctAnswer', idx)} className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center font-black transition-all active:scale-90 ${mq.correctAnswer === idx ? 'bg-[#fec868] border-[#fec868] text-white shadow-lg' : 'border-slate-200 text-slate-300 hover:border-slate-300 shadow-sm bg-white'}`}>
                                          {String.fromCharCode(65 + idx)}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {mq.options.map((opt, i) => (
                                      <div key={i} className="flex gap-4 items-center group/opt">
                                        <div onClick={() => updateManualQuestion(qIdx, 'correctAnswer', i)} className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center font-black transition-all cursor-pointer select-none ${mq.correctAnswer === i ? 'bg-[#abc270] border-[#abc270] text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-300 group-hover/opt:border-slate-200'}`}>
                                          {String.fromCharCode(65 + i)}
                                        </div>
                                        <input
                                          value={opt}
                                          onChange={(e) => {
                                            const newOptions = [...mq.options];
                                            newOptions[i] = e.target.value;
                                            updateManualQuestion(qIdx, 'options', newOptions);
                                          }}
                                          className="flex-1 bg-white border border-slate-100 rounded-2xl px-6 py-4 focus:outline-none focus:border-[#fec868] transition-all font-bold text-sm text-slate-700 shadow-sm"
                                          placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Explicação / Resolução (Opcional)</label>
                                <div className="bg-slate-50 rounded-[30px] border-2 border-slate-100 focus-within:border-[#fec868] transition-all overflow-hidden shadow-inner">
                                  <RichTextEditor content={mq.explanation} onChange={(html) => updateManualQuestion(qIdx, 'explanation', html)} />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col md:flex-row gap-6 pt-10 sticky bottom-0 bg-[#f8fafc]/90 backdrop-blur-md p-6 border-t border-slate-100 rounded-t-[40px] z-30">
                        <button onClick={addManualQuestion} className="flex-1 bg-white border-2 border-[#fec868]/15 text-[#fec868] py-6 rounded-[30px] font-black uppercase tracking-widest text-xs hover:bg-[#fec868]/10 active:scale-95 transition-all shadow-xl shadow-[#fec868]/5 flex items-center justify-center gap-3">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                          </svg>
                          ADICIONAR NOVA CAIXA
                        </button>
                        <button onClick={startManualSimulado} className="flex-[2] bg-[#473c33] text-white py-6 rounded-[30px] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
                          INICIAR SIMULADO ({manualQuestionsList.filter((q) => q.question.trim().length > 0).length} PRONTAS)
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : onQuestionsReady ? (
          <div className="relative min-h-[calc(100dvh-12rem)] rounded-[32px] bg-[#473c33] flex flex-col items-center justify-center p-6">
            <div className="bg-white rounded-[50px] p-12 md:p-20 shadow-2xl flex flex-col items-center max-w-xl w-full">
              <LoadingFish message="Questões filtradas!" submessage="Escolha em qual caderno salvar para abrir em Meus Materiais." />
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-8 pb-32">
            {/* Header Mini Imersivo */}
            <div className="flex flex-wrap gap-4 justify-between items-center bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm sticky top-0 z-30">
              <div className="flex-1 basis-64 min-w-0 flex items-center gap-3">
                <button
                  onClick={() => {
                    handleFinish();
                    setQuestions([]);
                  }}
                  aria-label="Encerrar simulado e voltar"
                  className="shrink-0 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all group active:scale-90"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-[#fec868]" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-[#fec868] animate-pulse"></span>
                    <h4 className="font-black text-sm tracking-widest uppercase text-slate-800 truncate" title={topic}>{topic}</h4>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    Questão {currentIdx + 1} de {questions.length} • EM ANDAMENTO
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 mr-4">
                  <button className="p-2.5 bg-slate-50 text-slate-400 hover:text-[#fec868] rounded-xl transition-all border border-slate-100">
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button onClick={handlePrev} disabled={currentIdx === 0} className="p-2.5 bg-slate-50 text-slate-400 hover:text-[#fec868] rounded-xl transition-all border border-slate-100 disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={handleNext} disabled={currentIdx === questions.length - 1} className="p-2.5 bg-slate-50 text-slate-400 hover:text-[#fec868] rounded-xl transition-all border border-slate-100 disabled:opacity-30">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    handleSaveUserCommentary();
                    setShowSaveModal(true);
                  }}
                  disabled={saved}
                  className={`px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all active:scale-90 shadow-sm ${saved ? 'bg-[#abc270] text-white' : 'bg-slate-50 text-slate-400 hover:text-[#fec868] border border-slate-100'}`}
                >
                  {saved ? 'CONSOLIDADO!' : 'SALVAR CADERNO'}
                  {!saved && <Save className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-[#272019] rounded-[40px] p-8 md:p-16 shadow-sm dark:shadow-none border border-slate-200/60 dark:border-white/[0.06] relative overflow-hidden transition-all hover:shadow-md dark:hover:shadow-none">
              <div className="mb-10 text-center md:text-left">
                <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full" style={{ background: 'rgba(253,167,105,0.2)', color: '#b0632a' }}>
                      {currentQ.topic || topic}
                    </span>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
                      Questão {currentIdx + 1}/{questions.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 shadow-inner mr-2 items-center">
                      <div className="flex items-center gap-2 px-3 border-r border-slate-200 mr-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Texto</span>
                        <input type="range" min="0.8" max="2.5" step="0.1" value={localFontSize} onChange={(e) => setLocalFontSize(parseFloat(e.target.value))} className="w-16 accent-[#fec868] h-1" title="Aumentar/Diminuir letra da questão" />
                      </div>
                      <button onClick={() => copyQuestionToClipboard(questions[currentIdx])} className={`p-2 rounded-lg transition-all active:scale-90 mr-1 ${copiedId === questions[currentIdx].id ? 'bg-[#abc270] text-white shadow-lg' : 'text-slate-300 hover:text-[#fec868]'}`} title="Copiar questão inteira">
                        {copiedId === questions[currentIdx].id ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleSelectiveMark('highlight')} className={`p-2 rounded-lg transition-all active:scale-90 ${questionHighlighted.includes(currentIdx) ? 'bg-[#fff0d5] text-[#fec868] shadow-sm border border-[#ffe6b9]' : 'text-slate-300 hover:text-[#fec868]'}`} title="Destacar texto. Se nada estiver selecionado, o destaque vale para o enunciado todo.">
                        <Highlighter className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleSelectiveMark('strike')} className={`p-2 rounded-lg transition-all active:scale-90 ${questionScratched.includes(currentIdx) ? 'bg-slate-200 text-slate-600 shadow-sm' : 'text-slate-300 hover:text-[#fec868]'}`} title="Riscar texto. Se nada estiver selecionado, a marcação vale para o enunciado todo.">
                        <PenLine className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setQuestionScratched(questionScratched.filter((i) => i !== currentIdx));
                          setQuestionHighlighted(questionHighlighted.filter((i) => i !== currentIdx));
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 transition-all active:scale-90"
                        title="Limpar Marcações"
                      >
                        <Eraser className="w-4 h-4" />
                      </button>
                      <button onClick={handleUndo} disabled={!(undoStack[currentIdx] && undoStack[currentIdx].length > 0)} className="p-2 text-slate-300 hover:text-[#fdad74] disabled:opacity-20 transition-all active:scale-90" title="Desfazer Marcação">
                        <Undo2 className="w-4 h-4" />
                      </button>
                    </div>

                    <button onClick={toggleFlag} className={`p-2.5 rounded-xl transition-all active:scale-95 flex-shrink-0 ${flagged.includes(currentIdx) ? 'bg-[#fec868] text-white shadow-lg' : 'bg-slate-50 text-slate-300 hover:text-[#fec868] hover:bg-[#fec868]/10'}`} title="Marcar para análise">
                      <Flag className={`w-4 h-4 ${flagged.includes(currentIdx) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>
                <style>{`
 .question-container.markdown-body { font-size: ${17 * localFontSize}px !important; }
 `}</style>
                <div
                  ref={questionTextRef}
                  className={`font-semibold leading-[1.6] tracking-tight markdown-body transition-all duration-500 question-container ${questionScratched.includes(currentIdx) ? 'text-slate-300 line-through grayscale blur-[0.5px] opacity-40 ' : questionHighlighted.includes(currentIdx) ? 'text-slate-800 bg-[#fff0d5]/50 p-6 rounded-2xl border-l-[6px] border-l-yellow-400' : 'text-slate-700'}`}
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(currentQ.question),
                  }}
                />
              </div>

              <div className={currentQ.options.every((o) => !o.trim()) ? 'flex flex-wrap justify-center gap-4 mb-10' : 'grid grid-cols-1 gap-4 mb-10'}>
                {currentQ.options.map((opt, idx) => {
                  const isCorrect = idx === currentQ.correctAnswer;
                  const isSelected = tempSelectedOpt === idx;
                  const isCrossedOut = crossedOut.includes(idx);
                  const isFinalSelected = selectedOpt === idx;
                  const isQuickMode = currentQ.options.every((o) => !o.trim());

                  let cardClass = 'bg-white dark:bg-[#211c15] border border-slate-100 dark:border-white/[0.08] hover:border-[#fec868]/25 dark:hover:border-[#d9772b]/40 hover:bg-slate-50/50 dark:hover:bg-[#272019] text-slate-600 dark:text-[#a89680] shadow-sm dark:shadow-none';
                  let circleClass = 'border-slate-100 dark:border-white/[0.1] text-slate-300 dark:text-[#7d6f5c] group-hover:border-[#fec868]/50 dark:group-hover:border-[#d9772b]/60 group-hover:text-[#fec868] dark:group-hover:text-[#d9772b]';
                  let textClass = 'text-slate-600 dark:text-[#a89680]';

                  if (isSelected && !isSubmitted) {
                    cardClass = 'border-2 border-[#fec868] dark:border-[#d9772b] bg-[#fec868]/10 dark:bg-[#d9772b]/15 text-slate-900 dark:text-[#f4ebdd] shadow-md dark:shadow-none ring-4 ring-[#fec868]/10 dark:ring-[#d9772b]/15';
                    circleClass = 'bg-[#fec868] dark:bg-[#d9772b] border-[#fec868] dark:border-[#d9772b] text-white';
                  }

                  if (isCrossedOut && !isSubmitted) {
                    cardClass = 'border-transparent bg-slate-50/50 dark:bg-white/5 opacity-40';
                    textClass = 'text-slate-300 dark:text-[#7d6f5c] line-through grayscale';
                  }

                  if (isSubmitted) {
                    if (isCorrect) {
                      cardClass = 'bg-[#f1f6e8] dark:bg-[#34392c] border-2 border-[#abc270]/70 dark:border-[#82965b] text-[#46523a] dark:text-[#e3edca]';
                      circleClass = 'bg-[#82995a] dark:bg-[#82995a] border-[#82995a] text-white';
                      textClass = 'text-[#46523a] dark:text-[#e3edca] font-bold';
                    } else if (isFinalSelected) {
                      cardClass = 'bg-[#fff1ec] dark:bg-[#3d302a] border-2 border-[#df9278] dark:border-[#b96b50] text-[#984b39] dark:text-[#f1c5b4]';
                      circleClass = 'bg-[#c96f53] dark:bg-[#c96f53] border-[#c96f53] text-white';
                      textClass = 'text-[#984b39] dark:text-[#f1c5b4] font-bold';
                    } else {
                      cardClass = 'bg-slate-50 border border-slate-100 text-slate-400 opacity-60 dark:bg-[#303129] dark:border-white/[0.06] dark:text-[#aaa891]';
                      circleClass = 'border-slate-200 text-slate-300 dark:border-white/[0.08] dark:text-[#aaa891]';
                      textClass = 'text-slate-400 dark:text-[#aaa891]';
                    }
                  }

                  return (
                    <div key={idx} className="relative group">
                      <div
                        onClick={() => handleAnswerSelection(idx)}
                        onDoubleClick={() => handleDoubleClick(idx)}
                        onKeyDown={(event) => {
                          if (!isSubmitted && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault();
                            handleAnswerSelection(idx);
                          }
                        }}
                        className={`${isQuickMode ? 'w-14 h-14 rounded-2xl flex items-center justify-center' : 'w-full text-left p-6 rounded-[25px] flex items-center gap-6'} font-bold transition-all duration-300 select-none cursor-pointer group active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e96f34] ${cardClass} relative overflow-hidden`}
                        role="button"
                        aria-label={`Alternativa ${String.fromCharCode(65 + idx)}: ${opt}`}
                        aria-pressed={isSelected}
                        aria-disabled={isSubmitted}
                        tabIndex={isSubmitted ? -1 : 0}
                      >
                        <div className={`flex items-center flex-1 ${isQuickMode ? 'justify-center' : 'gap-6'}`}>
                          <span className={`${isQuickMode ? 'w-10 h-10 rounded-xl' : 'w-12 h-12 rounded-full'} border flex items-center justify-center text-[12px] font-black flex-shrink-0 transition-all ${circleClass}`}>{String.fromCharCode(65 + idx)}</span>
                          {!isQuickMode && <span className={`text-[16px] leading-snug transition-colors flex-1 ${textClass}`}>{opt}</span>}
                          {isSubmitted && !isQuickMode && isCorrect && <span className="text-[9px] font-black uppercase tracking-widest flex-shrink-0 text-[#596b2a] dark:text-[#c4d99a]">Gabarito</span>}
                          {isSubmitted && !isQuickMode && isFinalSelected && !isCorrect && <span className="text-[9px] font-black uppercase tracking-widest flex-shrink-0 text-[#984b39] dark:text-[#f1a58b]">Sua resposta</span>}
                        </div>

                        {!isSubmitted && !isQuickMode && <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-[#fec868] dark:border-[#d9772b] bg-[#fec868] dark:bg-[#d9772b]' : 'border-slate-200 dark:border-white/[0.15]'}`}>{isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}</div>}
                        {isSubmitted && !isQuickMode && isCorrect && <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-[#596b2a] dark:text-[#c4d99a]" />}
                        {isSubmitted && !isQuickMode && isFinalSelected && !isCorrect && <X className="w-5 h-5 flex-shrink-0 text-[#984b39] dark:text-[#f1a58b]" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isSubmitted ? (
                <div>
                  <button onClick={handleSubmitAnswer} disabled={tempSelectedOpt === null} className="w-full bg-[#473c33] dark:bg-[#d9772b] hover:bg-[#5a4b3f] dark:hover:bg-[#c96a25] disabled:bg-slate-100 dark:disabled:bg-white/5 disabled:text-slate-300 dark:disabled:text-[#7d6f5c] disabled:cursor-not-allowed text-white font-black px-10 py-6 rounded-[35px] uppercase text-lg tracking-wider transition-all active:scale-95 shadow-xl dark:shadow-none">
                    CONFERIR RESPOSTA
                  </button>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
                  <div className={`p-8 rounded-[40px] mb-10 border ${selectedOpt === currentQ.correctAnswer ? 'bg-[#f1f6e8] dark:bg-[#34392c] border-[#abc270]/40 dark:border-[#82965b] shadow-sm dark:shadow-none' : 'bg-[#fff1ec] dark:bg-[#3d302a] border-[#df9278] dark:border-[#b96b50] shadow-sm dark:shadow-none'}`}>
                    <div className="flex items-center gap-6">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg dark:shadow-none ${selectedOpt === currentQ.correctAnswer ? 'bg-[#82995a]' : 'bg-[#c96f53]'}`}>{selectedOpt === currentQ.correctAnswer ? '✓' : '✗'}</div>
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-[0.4em] mb-1 ${selectedOpt === currentQ.correctAnswer ? 'text-[#596b2a] dark:text-[#c4d99a]' : 'text-[#984b39] dark:text-[#f1a58b]'}`}>{selectedOpt === currentQ.correctAnswer ? 'TARGET ACQUIRED' : 'ROUTE ERROR'}</p>
                        <p className={`text-[17px] font-bold ${selectedOpt === currentQ.correctAnswer ? 'text-[#46523a] dark:text-[#f2efd2]' : 'text-[#713a2e] dark:text-[#f1c5b4]'}`}>
                          Gabarito: <span className={selectedOpt === currentQ.correctAnswer ? 'text-[#596b2a] dark:text-[#d9e9b2]' : 'text-[#984b39] dark:text-[#f1a58b]'}>{String.fromCharCode(65 + currentQ.correctAnswer)}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#fec868]/10 dark:bg-[#fdfbf7] rounded-[40px] p-8 md:p-12 border-2 border-[#473c33]/10 dark:border-transparent shadow-inner dark:shadow-[0_-12px_40px_rgba(0,0,0,0.35)] leading-relaxed mb-10">
                    {showNoteSection && (
                      <div ref={noteSectionRef} className="bg-white border border-slate-100 p-6 md:p-8 rounded-[35px] mb-8 relative shadow-sm group hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#fec868]/10 text-[#fec868] rounded-xl flex items-center justify-center shadow-sm">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">SUA NOTA ESTRATÉGICA</h4>
                              <p className="text-[9px] font-bold text-[#fec868]/60 uppercase tracking-tight">Refine seu conhecimento aqui</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tamanho</span>
                            <input type="range" min="0.5" max="6" step="0.1" value={noteFontSize} onChange={(e) => setNoteFontSize(parseFloat(e.target.value))} className="w-24 accent-[#fec868]" />
                          </div>
                          <button onClick={() => setIsNoteExpanded(true)} className="flex items-center gap-2 px-4 py-2 bg-[#fec868]/10 text-[#fec868] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#fec868] hover:text-white transition-all active:scale-95 shadow-sm">
                            <Maximize2 className="w-3.5 h-3.5" />
                            ABRIR EDITOR
                          </button>
                        </div>

                        {userCommentaryInput ? (
                          <>
                            <style>{`
 .note-container.markdown-body { 
 font-size: ${22 * fontSizeMultiplier * noteFontSize}px !important; 
 line-height: 1.6 !important;
 color: #334155 !important;
 }
 .note-container.markdown-body p, 
 .note-container.markdown-body li, 
 .note-container.markdown-body div, 
 .note-container.markdown-body span,
 .note-container.markdown-body label,
 .note-container.markdown-body section,
 .note-container.markdown-body article { 
 font-size: 1em !important; 
 line-height: inherit !important;
 }
 .note-container.markdown-body h1 { font-size: 2.2em !important; font-weight: 800 !important; margin-bottom: 0.5em !important; }
 .note-container.markdown-body h2 { font-size: 1.8em !important; font-weight: 700 !important; margin-bottom: 0.5em !important; }
 .note-container.markdown-body h3 { font-size: 1.5em !important; font-weight: 600 !important; margin-bottom: 0.5em !important; }
 .note-container.markdown-body code { font-size: 0.85em !important; background: #f1f5f9 !important; padding: 0.2em 0.4em !important; border-radius: 4px !important; }
 .note-container.markdown-body ul, .note-container.markdown-body ol { padding-left: 1.5em !important; margin-bottom: 1em !important; }
 .note-container.markdown-body li { margin-bottom: 0.5em !important; }
 .note-container.markdown-body strong { font-weight: 700 !important; color: #1e293b !important; }
 `}</style>
                            <div
                              className="text-slate-600 font-medium space-y-4 markdown-body prose prose-slate max-w-none border-l-4 border-slate-100 pl-6 py-2 note-container"
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(userCommentaryInput),
                              }}
                            />
                          </>
                        ) : (
                          <div onClick={() => setIsNoteExpanded(true)} className="cursor-pointer py-10 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-300 hover:text-[#fec868] hover:border-[#fec868]/25 transition-all">
                            <Brain className="w-8 h-8 opacity-20" />
                            <p className="font-bold text-xs tracking-tight">Nenhuma anotação estratégica ainda. Clique para adicionar.</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mb-6 font-black text-[#fec868]">
                      <span className="w-8 h-8 bg-[#fec868]/10 rounded-lg flex items-center justify-center text-sm shadow-sm">A</span>
                      <h4 className="text-[10px] uppercase tracking-widest">MAPEAMENTO DA LÓGICA</h4>
                    </div>

                    {onTriggerGuidedLesson && (
                      <button onClick={() => onTriggerGuidedLesson(selectedSubject || 'Geral', currentQ.topic || topic)} className="w-full mb-8 bg-gradient-to-r from-[#fec868] to-[#ffb22a] text-white p-6 rounded-[30px] flex items-center justify-between group transition-all hover:scale-[1.01] hover:shadow-xl shadow-[#fec868]/20 active:scale-95">
                        <div className="flex items-center gap-4 text-left">
                          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                            <BookOpen className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Sentiu dificuldade?</p>
                            <h4 className="font-black text-sm uppercase ">ACIONAR AULA GUIADA SOBRE ESSE ASSUNTO</h4>
                          </div>
                        </div>
                        <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}

                    <VerificationBadge verification={currentQ.verification} />
                    <MarkdownContent content={currentQ.explanation} fontSizeMultiplier={fontSizeMultiplier} />

                    {/* Imagens Adicionais do Usuário */}
                    {currentQ.explanationImages && currentQ.explanationImages.length > 0 && (
                      <div className="flex flex-col gap-8 mt-10">
                        {currentQ.explanationImages.map((img, i) => {
                          const currentSize = currentQ.explanationImageSizes?.[i] || 'md';
                          const sizeClasses =
                            {
                              sm: 'max-w-[200px]',
                              md: 'max-w-md',
                              lg: 'max-w-2xl',
                              full: 'max-w-full',
                            }[currentSize as 'sm' | 'md' | 'lg' | 'full'] || 'max-w-md';

                          return (
                            <div key={i} className={`relative group rounded-[35px] overflow-hidden border-2 border-slate-100 shadow-sm transition-all hover:shadow-xl hover:border-[#fec868]/25 mx-auto ${sizeClasses}`}>
                              <img src={img} alt={`Complemento Visual ${i}`} className="w-full h-auto object-contain bg-white min-h-[100px]" />

                              {/* Overlay de Ações */}
                              <div className="absolute inset-x-0 bottom-0 bg-[#473c33]/60 backdrop-blur-sm p-4 translate-y-full group-hover:translate-y-0 transition-all flex items-center justify-between">
                                <div className="flex gap-2">
                                  {['sm', 'md', 'lg', 'full'].map((s) => (
                                    <button key={s} onClick={() => handleUpdateImageSize(i, s)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${currentSize === s ? 'bg-[#fec868] text-white shadow-lg' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                                      {s}
                                    </button>
                                  ))}
                                </div>
                                <button onClick={() => handleRemoveExplanationImage(i)} className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-xl transition-all active:scale-90">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Botão de Adição de Mídia */}
                    {showImageArea && (
                      <div className="mt-10 flex flex-col md:flex-row items-center justify-center gap-6">
                        <label className="flex items-center gap-3 px-10 py-5 bg-white border-2 border-dashed border-[#fec868]/15 hover:border-[#fec868]/35 text-[#fec868]/70 hover:text-[#fec868] rounded-[30px] cursor-pointer transition-all active:scale-95 shadow-sm group">
                          <ImageIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">ANEXAR COMPLEMENTO VISUAL</span>
                          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                        <button onClick={handleSaveSingleQuestion} className="flex items-center gap-3 px-10 py-5 bg-[#fec868] text-white rounded-[30px] transition-all active:scale-95 shadow-xl shadow-[#fec868]/20 hover:bg-[#ffb22a] group">
                          <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">SALVAR ESTA QUESTÃO</span>
                        </button>
                      </div>
                    )}
                    {(showImageArea || (currentQ.explanationImages && currentQ.explanationImages.length > 0)) && <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest text-center mt-4">Aumente sua retenção com imagens, mapas mentais ou prints.</p>}

                    {currentQ.memoryHint && (
                      <div className="bg-[#fec868] p-10 rounded-[45px] border border-[#fec868]/10 shadow-2xl relative overflow-hidden mt-12 group transition-all hover:">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                        <p className="text-[11px] font-black text-white uppercase tracking-[0.5em] mb-6 flex items-center gap-4">
                          <span className="text-2xl animate-bounce">⚡</span> DICA DE MEMÓRIA
                        </p>
                        <MarkdownContent content={currentQ.memoryHint} isDark fontSizeMultiplier={fontSizeMultiplier} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-10">
                    <button onClick={() => setIsSubmitted(false)} className="text-slate-400 hover:text-[#fec868] font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95">
                      <ChevronLeft className="w-4 h-4" /> REVISAR RESPOSTA
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-16 scale-110">
              <div className="flex items-center justify-center gap-3">
                <button onClick={handlePrev} disabled={currentIdx === 0} className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-[#fec868] rounded-xl shadow-sm transition-all disabled:opacity-20 active:scale-95">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={handleNext} disabled={currentIdx === questions.length - 1} className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-[#fec868] rounded-xl shadow-sm transition-all disabled:opacity-20 active:scale-95">
                  <ChevronRight className="w-6 h-6" />
                </button>
                <button onClick={handleShuffle} className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-[#fec868] rounded-xl shadow-sm transition-all active:scale-95">
                  <Shuffle className="w-6 h-6" />
                </button>
                <button
                  onClick={() => {
                    handleFinish();
                    setQuestions([]);
                  }}
                  className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-red-500 rounded-xl shadow-sm transition-all active:scale-95"
                >
                  <LogOut className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Progresso Inferior */}
      {questions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 z-[210] shadow-2xl">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
              <span>PROGRESSO ATUAL</span>
              <span className="text-[#fec868]">{Math.round(((currentIdx + 1) / questions.length) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#fec868] transition-all duration-700"
                style={{
                  width: `${((currentIdx + 1) / questions.length) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {isNoteExpanded && (
        <div className="fixed inset-0 z-[1000] bg-[#473c33]/90 backdrop-blur-md p-6 md:p-12 flex flex-col">
          <div className="flex items-center justify-between mb-8 max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#fec868] rounded-2xl flex items-center justify-center text-white shadow-xl">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight uppercase ">MODO EDIÇÃO</h2>
                <p className="text-white/40 text-[10px] font-black tracking-[0.3em] uppercase">Refine sua anotação estratégica</p>
              </div>
            </div>
            <button
              onClick={() => {
                handleSaveUserCommentary();
                setIsNoteExpanded(false);
              }}
              className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all active:scale-90"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 max-w-5xl mx-auto w-full bg-white rounded-[40px] p-8 md:p-12 shadow-2xl overflow-hidden">
            <RichTextEditor content={userCommentaryInput} onChange={setUserCommentaryInput} fontSize={22 * fontSizeMultiplier * noteFontSize} />
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => {
                handleSaveUserCommentary();
                setIsNoteExpanded(false);
              }}
              className="px-12 py-5 bg-[#fec868] text-white font-black uppercase text-[11px] tracking-widest rounded-full hover:bg-[#ffb22a] transition-all shadow-2xl active:scale-95"
            >
              CONCLUIR E SALVAR
            </button>
          </div>
        </div>
      )}

      {showSaveModal && (
        <SaveToFolderModal
          folders={folders}
          suggestedName={saveMode === 'SINGLE' ? currentQ.topic || topic : topic}
          onConfirm={handleConfirmSave}
          onClose={() => {
            setShowSaveModal(false);
            // Sem prática interna nesta view, cancelar aqui só faz sentido
            // voltando pro filtro — senão o aluno ficaria preso na tela de
            // "abrindo em Meus Materiais" sem nenhuma ação possível.
            if (onQuestionsReady) setQuestions([]);
          }}
        />
      )}

      {/* Floating Action Buttons Sidebar */}
      {questions.length > 0 && isSubmitted && (
        <div className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-[250] items-center">
          <div className="flex flex-col bg-white/100 backdrop-blur-xl p-2.5 rounded-full border border-slate-200 shadow-2xl gap-3">
            <button
              onClick={() => {
                setShowNoteSection(!showNoteSection);
                if (!showNoteSection) {
                  setTimeout(() => {
                    noteSectionRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                    });
                    setIsNoteExpanded(true);
                  }, 100);
                }
              }}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-90 transition-all group relative ${showNoteSection ? 'bg-[#fec868] text-white' : 'bg-white text-slate-600 border border-slate-100 hover:border-[#fec868]/25'}`}
              title="Alternar Nota Estratégica"
            >
              <MessageSquarePlus className="w-6 h-6" />
              <div className="absolute right-full mr-4 px-3 py-1.5 bg-[#473c33] text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap">{showNoteSection ? 'Ocultar Nota' : 'Nota Estratégica'}</div>
            </button>
            <button
              onClick={() => {
                setShowImageArea(!showImageArea);
                if (!showImageArea) {
                  setTimeout(() => {
                    imageInputRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                    });
                  }, 100);
                }
              }}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-90 transition-all group relative ${showImageArea ? 'bg-[#fec868] text-white border-transparent' : 'bg-white border border-slate-100 text-slate-600 hover:border-[#fec868]/25'}`}
              title="Alternar Anexo de Imagem"
            >
              <ImageIcon className="w-6 h-6" />
              <div className="absolute right-full mr-4 px-3 py-1.5 bg-[#473c33] text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap">{showImageArea ? 'Ocultar Imagem' : 'Anexar Imagem'}</div>
            </button>
            {onTriggerGuidedLesson && (
              <button onClick={() => onTriggerGuidedLesson(selectedSubject || 'Geral', currentQ.topic || topic)} className="w-14 h-14 bg-gradient-to-br from-[#fec868] to-[#fec868] text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-90 transition-all group relative border border-white/20" title="Aula Guiada sobre este assunto">
                <BookOpen className="w-6 h-6" />
                <div className="absolute right-full mr-4 px-3 py-1.5 bg-[#ac6e00] text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap">Aula Guiada</div>
              </button>
            )}
            <div className="w-full h-px bg-slate-100 my-1"></div>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 transition-all" title="Voltar ao Topo">
              <HelpCircle className="w-5 h-5 rotate-180" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TDHQuestoes;
