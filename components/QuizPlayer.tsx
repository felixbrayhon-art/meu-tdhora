import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Scissors, Trash2, ChevronLeft, ChevronRight, Brain, FileText, Maximize2, Minimize2, Move, Shuffle, LogOut, Highlighter, PenLine, Eraser, Undo2, Image as ImageIcon, X, MessageSquarePlus, HelpCircle, BookOpen, Copy, CheckCircle2 } from './icons';
import { QuizFolder, Notebook, QuizQuestion, ExplanationStyle } from '../types';
import MarkdownContent from './MarkdownContent';
import VerificationBadge from './VerificationBadge';
import { RichTextEditor } from './RichTextEditor';
import { MoveToNotebookModal } from './MoveToNotebookModal';
import { updateQuestionExplanation } from '../services/questionBankService';

interface QuizPlayerProps {
  folder: QuizFolder;
  notebook: Notebook;
  folders: QuizFolder[];
  onBack: () => void;
  onComplete: (score: number, total: number) => void;
  onUpdateQuestions?: (questions: QuizQuestion[]) => void;
  onMoveQuestion: (questionId: string, sourceFolderId: string, sourceNotebookId: string, targetFolderId: string, targetNotebookId: string) => void;
  onTriggerGuidedLesson?: (subject: string, topic: string) => void;
  initialFontSizeMultiplier?: number;
  // Admins can fix a bank question's explanation on the spot, right where
  // they noticed it was wrong — only for questions that actually came from
  // the shared bank (id prefixed "bank-" by questionBankService's
  // mapBankQuestion), since anything else has no Firestore doc to patch.
  isAdmin?: boolean;
}

// Same paper/ink tokens as the Aula Viva sheet (LivingLessonView), so the
// question player matches it in light and dark mode.
const QP_INK = 'text-[#473c33] dark:text-[#f2efd2]';
const QP_MUTED = 'text-[#725442] dark:text-[#c8c5a9]';
const QP_PAPER = 'bg-[#fdfbf7] dark:bg-[#24251f]';
const QP_CARD = 'bg-white dark:bg-[#2d2e27]';
const QP_RULE = 'border-[#e8dcc8] dark:border-white/10';
const QP_ICON_BTN = 'text-[#725442] dark:text-[#c8c5a9] hover:text-[#473c33] dark:hover:text-[#f2efd2] hover:bg-black/5 dark:hover:bg-white/10';
const QP_TOOL_BTN = 'text-[#725442] dark:text-[#c8c5a9] hover:text-[#a8431a] dark:hover:text-[#f2efd2]';
const QP_SECONDARY_BTN = `border text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 enabled:hover:border-[#e96f34] disabled:cursor-not-allowed disabled:opacity-40 ${QP_RULE} ${QP_CARD} ${QP_INK}`;
const QP_PRIMARY_BTN = 'bg-[#a8431a] text-white text-[10px] font-black uppercase tracking-wide transition-all enabled:hover:bg-[#bf4f1b] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40';

const QuizPlayer: React.FC<QuizPlayerProps> = ({ folder, notebook, folders, onBack, onComplete, onUpdateQuestions, onMoveQuestion, onTriggerGuidedLesson, initialFontSizeMultiplier = 1, isAdmin = false }) => {
  if (!notebook || !folder) {
    console.error('QuizPlayer: Lost context (notebook or folder is null)');
    onBack();
    return null;
  }

  const [questions, setQuestions] = useState<QuizQuestion[]>(notebook.questions);
  const initialQuestions = useRef([...notebook.questions]);
  // Resume where the student left off — the first question without a saved
  // userAnswer — instead of always restarting at question 1. Only runs once
  // per mount, matching how the rest of QuizPlayer's local state is seeded
  // from `notebook` at open time.
  const [currentIndex, setCurrentIndex] = useState(() => {
    const firstUnanswered = notebook.questions.findIndex((q) => q.userAnswer === undefined);
    return firstUnanswered === -1 ? 0 : firstUnanswered;
  });
  const [questionScratched, setQuestionScratched] = useState<string[]>([]);
  const [questionHighlighted, setQuestionHighlighted] = useState<string[]>([]);
  const [tempSelectedAnswer, setTempSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [crossedOut, setCrossedOut] = useState<number[]>([]);
  const [userCommentaryInput, setUserCommentaryInput] = useState('');
  const [showNoteSection, setShowNoteSection] = useState(false);
  const [showImageArea, setShowImageArea] = useState(false);
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [noteFontSize, setNoteFontSize] = useState(1.4);
  const [questionFontSize, setQuestionFontSize] = useState(initialFontSizeMultiplier);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Record<string, string[]>>({});
  const questionTextRef = useRef<HTMLDivElement>(null);
  const noteSectionRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const saveToUndo = (qId: string, content: string) => {
    setUndoStack((prev) => ({
      ...prev,
      [qId]: [...(prev[qId] || []), content].slice(-10), // Keep last 10 steps
    }));
  };

  const handleUndo = () => {
    const qHistory = undoStack[currentQ.id] || [];
    if (qHistory.length === 0) return;

    const previousContent = qHistory[qHistory.length - 1];
    const newHistory = qHistory.slice(0, -1);

    setUndoStack((prev) => ({
      ...prev,
      [currentQ.id]: newHistory,
    }));

    // Update state
    const qIdx = questions.findIndex((q) => q.id === currentQ.id);
    if (qIdx !== -1) {
      const newQuestions = [...questions];
      newQuestions[qIdx] = {
        ...newQuestions[qIdx],
        question: previousContent,
      };
      setQuestions(newQuestions);
      onUpdateQuestions?.(newQuestions);
    }
  };

  const handleSelectiveMark = (type: 'strike' | 'highlight') => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
      // Fallback to whole-question toggle if no selection
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
        saveToUndo(currentQ.id, container.innerHTML);
        if (range.startContainer === range.endContainer) {
          range.surroundContents(span);
        } else {
          // Complex selection spanning multiple nodes
          const content = range.extractContents();
          span.appendChild(content);
          range.insertNode(span);
        }

        // Persist to state
        const qIdx = questions.findIndex((q) => q.id === currentQ.id);
        if (qIdx !== -1) {
          const newQuestions = [...questions];
          newQuestions[qIdx] = {
            ...newQuestions[qIdx],
            question: container.innerHTML,
          };
          setQuestions(newQuestions);
          onUpdateQuestions?.(newQuestions);
        }
      } catch (e) {
        console.warn('Selection failed', e);
      }
      selection.removeAllRanges();
    }
  };

  const handleAddExplanationImage = (imageUrl: string) => {
    const qIdx = questions.findIndex((q) => q.id === currentQ.id);
    if (qIdx === -1) return;
    const newQuestions = [...questions];
    const currentImages = newQuestions[qIdx].explanationImages || [];
    newQuestions[qIdx] = {
      ...newQuestions[qIdx],
      explanationImages: [...currentImages, imageUrl],
    };
    setQuestions(newQuestions);
    onUpdateQuestions?.(newQuestions);
  };

  const handleRemoveExplanationImage = (imgIdx: number) => {
    const qIdx = questions.findIndex((q) => q.id === currentQ.id);
    if (qIdx === -1) return;
    const newQuestions = [...questions];
    const currentImages = [...(newQuestions[qIdx].explanationImages || [])];
    currentImages.splice(imgIdx, 1);
    newQuestions[qIdx] = {
      ...newQuestions[qIdx],
      explanationImages: currentImages,
    };
    setQuestions(newQuestions);
    onUpdateQuestions?.(newQuestions);
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

  const copyQuestionToClipboard = (q: QuizQuestion) => {
    if (!q) return;
    const optionsText = q.options.map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt}`).join('\n');

    // Suporte para converter HTML em texto limpo
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
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = plainText;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setCopiedId(q.id);
          setTimeout(() => setCopiedId(null), 2000);
        } catch (e) {
          console.error('Fallback copy failed', e);
        }
        document.body.removeChild(textArea);
      });
  };

  const currentQ = questions[currentIndex];
  // Source of truth is the persisted userAnswer on the question itself, not
  // local-only state — this is what makes an already-answered question show
  // as answered (right/wrong, which option) after leaving and reopening the
  // caderno, and lets "Zerar Caderno" be the only thing that clears it.
  const selectedAnswer = currentQ.userAnswer ?? null;
  const score = questions.filter((q) => typeof q.userAnswer === 'number' && q.userAnswer === q.correctAnswer).length;

  const handleUpdateImageSize = (imgIdx: number, size: string) => {
    const qIdx = questions.findIndex((q) => q.id === currentQ.id);
    if (qIdx === -1) return;
    const newQuestions = [...questions];
    const currentSizes = [...(newQuestions[qIdx].explanationImageSizes || [])];
    while (currentSizes.length <= imgIdx) currentSizes.push('md');
    currentSizes[imgIdx] = size;
    newQuestions[qIdx] = {
      ...newQuestions[qIdx],
      explanationImageSizes: currentSizes,
    };
    setQuestions(newQuestions);
    onUpdateQuestions?.(newQuestions);
  };

  const [editingExplanation, setEditingExplanation] = useState(false);
  const [explanationDraft, setExplanationDraft] = useState('');
  const [savingExplanation, setSavingExplanation] = useState(false);
  const [explanationSaveError, setExplanationSaveError] = useState<string | null>(null);

  React.useEffect(() => {
    setEditingExplanation(false);
    setExplanationSaveError(null);
  }, [currentIndex]);

  const canEditExplanation = isAdmin && currentQ.id.startsWith('bank-');

  const handleStartEditExplanation = () => {
    setExplanationDraft(currentQ.explanation);
    setExplanationSaveError(null);
    setEditingExplanation(true);
  };

  const handleSaveExplanation = async () => {
    const qIdx = questions.findIndex((q) => q.id === currentQ.id);
    if (qIdx === -1) return;
    setSavingExplanation(true);
    setExplanationSaveError(null);
    try {
      // currentQ.id is "bank-<firestoreDocId>" (see questionBankService's
      // mapBankQuestion) — strip the prefix to get the real doc to patch.
      await updateQuestionExplanation(currentQ.id.replace(/^bank-/, ''), explanationDraft);
      const newQuestions = [...questions];
      newQuestions[qIdx] = { ...newQuestions[qIdx], explanation: explanationDraft };
      setQuestions(newQuestions);
      onUpdateQuestions?.(newQuestions);
      setEditingExplanation(false);
    } catch (error: any) {
      setExplanationSaveError(error?.message || 'Não foi possível salvar a explicação.');
    } finally {
      setSavingExplanation(false);
    }
  };

  const toggleQuestionScratch = () => {
    if (questionScratched.includes(currentQ.id)) {
      setQuestionScratched(questionScratched.filter((id) => id !== currentQ.id));
    } else {
      setQuestionScratched([...questionScratched, currentQ.id]);
      setQuestionHighlighted(questionHighlighted.filter((id) => id !== currentQ.id));
    }
  };

  const toggleQuestionHighlight = () => {
    if (questionHighlighted.includes(currentQ.id)) {
      setQuestionHighlighted(questionHighlighted.filter((id) => id !== currentQ.id));
    } else {
      setQuestionHighlighted([...questionHighlighted, currentQ.id]);
      setQuestionScratched(questionScratched.filter((id) => id !== currentQ.id));
    }
  };

  React.useEffect(() => {
    setUserCommentaryInput(questions[currentIndex]?.userCommentary || '');
  }, [currentIndex, questions]);

  const handleSaveUserCommentary = (overrideValue?: string) => {
    const valueToSave = overrideValue !== undefined ? overrideValue : userCommentaryInput;
    const newQuestions = [...questions];
    newQuestions[currentIndex] = {
      ...newQuestions[currentIndex],
      userCommentary: valueToSave,
    };
    setQuestions(newQuestions);
    onUpdateQuestions?.(newQuestions);
  };

  const shuffleQuestions = () => {
    if (confirm('Deseja embaralhar as questões desta sessão?')) {
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setCurrentIndex(0);
      setTempSelectedAnswer(null);
      setCrossedOut([]);
    }
  };

  const handleSelect = (optionIndex: number) => {
    if (selectedAnswer !== null) return;
    setTempSelectedAnswer(optionIndex);
    setCrossedOut((prev) => prev.filter((i) => i !== optionIndex));
  };

  const handleConfirmAnswer = () => {
    if (tempSelectedAnswer === null || selectedAnswer !== null) return;

    const newQuestions = [...questions];
    newQuestions[currentIndex] = { ...newQuestions[currentIndex], userAnswer: tempSelectedAnswer };
    setQuestions(newQuestions);
    onUpdateQuestions?.(newQuestions);
    setTempSelectedAnswer(null);
  };

  // "Revisar resposta" only reopens the CURRENT question for a new answer —
  // unlike "Zerar Caderno" below, it never touches any other question.
  const handleReviewAnswer = () => {
    const { userAnswer, ...rest } = questions[currentIndex];
    const newQuestions = [...questions];
    newQuestions[currentIndex] = rest as QuizQuestion;
    setQuestions(newQuestions);
    onUpdateQuestions?.(newQuestions);
    setTempSelectedAnswer(null);
  };

  // Explicit, deliberate reset the student has to ask for — clears every
  // saved answer in this caderno so progress restarts at question 1. This is
  // the ONLY thing that should ever wipe userAnswer in bulk.
  const handleResetNotebook = () => {
    if (!confirm('Isso vai apagar TODAS as respostas salvas neste caderno e recomeçar do zero. Essa ação não pode ser desfeita. Continuar?')) return;
    const resetQuestions = questions.map((q) => {
      const { userAnswer, ...rest } = q;
      return rest as QuizQuestion;
    });
    setQuestions(resetQuestions);
    onUpdateQuestions?.(resetQuestions);
    setCurrentIndex(0);
    setTempSelectedAnswer(null);
    setCrossedOut([]);
  };

  const handleDoubleClick = (idx: number) => {
    if (selectedAnswer !== null) return;
    setCrossedOut((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
  };

  const handleDeleteQuestion = () => {
    if (confirm('Tem certeza que deseja excluir esta questão? Ela será removida apenas desta sessão.')) {
      const newQuestions = questions.filter((_, idx) => idx !== currentIndex);
      if (newQuestions.length === 0) {
        onBack();
        return;
      }
      setQuestions(newQuestions);
      if (currentIndex >= newQuestions.length) {
        setCurrentIndex(newQuestions.length - 1);
      }
      setTempSelectedAnswer(null);
      setCrossedOut([]);
    }
  };

  const nextQuestion = () => {
    handleSaveUserCommentary();

    // Restore original question content (removes selective markings) before moving
    const original = initialQuestions.current.find((q) => q.id === currentQ.id);
    if (original) {
      const newQuestions = [...questions];
      newQuestions[currentIndex] = {
        ...newQuestions[currentIndex],
        question: original.question,
      };
      setQuestions(newQuestions);
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setTempSelectedAnswer(null);
      setCrossedOut([]);
      setQuestionScratched([]);
      setQuestionHighlighted([]);
    } else {
      setShowResult(true);
    }
  };

  const prevQuestion = () => {
    handleSaveUserCommentary();

    // Restore original question content (removes selective markings) before moving
    const original = initialQuestions.current.find((q) => q.id === currentQ.id);
    if (original) {
      const newQuestions = [...questions];
      newQuestions[currentIndex] = {
        ...newQuestions[currentIndex],
        question: original.question,
      };
      setQuestions(newQuestions);
    }

    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setTempSelectedAnswer(null);
      setCrossedOut([]);
      setQuestionScratched([]);
      setQuestionHighlighted([]);
    }
  };

  if (showResult) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#473c33] flex flex-col items-center justify-center p-8 animate-in zoom-in-95 duration-500 overflow-y-auto">
        <div className="w-full max-w-xl text-center space-y-12">
          <div className="w-40 h-40 bg-[#fecc73]/10 border-4 border-[#fecc73]/20 rounded-full flex items-center justify-center mx-auto shadow-2xl relative">
            <div className="absolute inset-0 bg-[#fecc73]/10 rounded-full animate-ping opacity-20"></div>
            <span className="text-xl font-black text-[#fed386] ">RESULTS</span>
          </div>

          <div>
            <h2 className="text-5xl font-black mb-4 tracking-tighter text-white uppercase">
              Ciclo <span className="text-[#fecc73]">Concluído</span>
            </h2>
            <p className="text-slate-400 text-lg font-bold uppercase tracking-[0.2em] opacity-60">Consolidação de Conhecimento Finalizada</p>
          </div>

          <div className="bg-white/5 border border-white/10 p-10 rounded-[40px] flex justify-around backdrop-blur-3xl shadow-3xl">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Precisão</p>
              <p className="text-4xl font-black text-[#fecc73] leading-none">{Math.round((score / questions.length) * 100)}%</p>
            </div>
            <div className="w-px h-16 bg-white/10 self-center"></div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Acertos</p>
              <p className="text-4xl font-black text-white leading-none">
                {score}
                <span className="text-xl text-slate-500">/{questions.length}</span>
              </p>
            </div>
            <div className="w-px h-16 bg-white/10 self-center"></div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">XP Ganho</p>
              <p className="text-4xl font-black text-[#fdad74] leading-none">+{score * 50}</p>
            </div>
          </div>

          <button onClick={() => onComplete(score, questions.length)} className="w-full bg-white text-[#473c33] py-8 rounded-[30px] font-black text-xl hover:bg-[#fecc73] hover:text-white transition-all shadow-2xl active:scale-95 uppercase tracking-widest">
            SALVAR E CONTINUAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-[200] overflow-y-auto font-sans selection:bg-[#d8a53a]/30 ${QP_PAPER} ${QP_INK}`}>
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
        {/* HEADER: PROGRESS & TITLE */}
        <div className={`rounded-2xl border p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 mb-5 sticky top-2 z-50 shadow-sm ${QP_RULE} ${QP_CARD}`}>
          <div className="flex items-center gap-3 min-w-0 basis-56 flex-1">
            <button onClick={() => { handleSaveUserCommentary(); onBack(); }} className={`shrink-0 p-2 rounded-xl transition-all ${QP_ICON_BTN}`} aria-label="Sair do simulado" title="Sair do simulado">
              <LogOut className="w-4 h-4" />
            </button>
            <button onClick={handleResetNotebook} className={`shrink-0 p-2 rounded-xl transition-all ${QP_ICON_BTN}`} aria-label="Zerar caderno" title="Zerar caderno (apaga todas as respostas salvas)">
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className={`font-logo text-sm uppercase truncate ${QP_INK}`} title={notebook.name}>{notebook.name}</h1>
              <p className={`text-[10px] font-black uppercase tracking-widest leading-none mt-1 truncate ${QP_MUTED}`}>Sessão {folder.name}</p>
            </div>
          </div>

          <div className="flex-1 min-w-[180px] max-w-md flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-widest ${QP_MUTED}`}>Questão {currentIndex + 1} de {questions.length}</span>
              <span className="font-logo text-sm text-[#e96f34]">{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-[#efe6d6] dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#e96f34] transition-all duration-700 ease-out"
                style={{
                  width: `${((currentIndex + 1) / questions.length) * 100}%`,
                }}
              ></div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={prevQuestion} disabled={currentIndex === 0} className={`flex min-h-[40px] items-center gap-1.5 px-3 rounded-full ${QP_SECONDARY_BTN}`} aria-label="Questão anterior" title="Questão anterior">
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wide">Anterior</span>
              </button>
              <button onClick={nextQuestion} disabled={currentIndex === questions.length - 1} className={`flex min-h-[40px] items-center gap-1.5 px-3 rounded-full ${QP_PRIMARY_BTN}`} aria-label="Próxima questão" title="Próxima questão">
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wide">Próxima</span>
                <ChevronRight className="w-4 h-4" />
              </button>
          </div>
        </div>
        {/* QUIZ MAIN CARD */}
        <div className={`rounded-[28px] border p-4 sm:p-6 md:p-8 relative overflow-hidden mb-6 ${QP_RULE} ${QP_CARD}`}>
          <div className="mb-7">
            <div className="flex flex-wrap gap-3 items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-logo text-xs uppercase tracking-[0.2em] text-[#e96f34]">Questão {currentIndex + 1}</span>
                <span className={`text-xs font-bold ${QP_MUTED}`}>• Enunciado</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className={`flex p-1 rounded-xl border items-center ${QP_RULE} ${QP_PAPER}`}>
                  <div className={`flex items-center gap-2 px-3 border-r mr-2 ${QP_RULE}`}>
                    <span className={`text-[10px] font-black uppercase tracking-wide ${QP_MUTED}`}>Texto</span>
                    <input type="range" min="0.8" max="2.5" step="0.1" value={questionFontSize} onChange={(e) => setQuestionFontSize(parseFloat(e.target.value))} className="w-16 accent-[#e96f34] h-1" title="Aumentar/Diminuir letra da questão" />
                  </div>
                  <button onClick={() => copyQuestionToClipboard(currentQ)} className={`p-2 rounded-lg transition-all active:scale-90 mr-1 ${copiedId === currentQ.id ? 'bg-[#4c6324] text-white shadow-lg' : QP_TOOL_BTN}`} title="Copiar questão inteira" aria-label="Copiar questão inteira">
                    {copiedId === currentQ.id ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleSelectiveMark('highlight')} className={`p-2 rounded-lg transition-all active:scale-90 ${questionHighlighted.includes(currentQ.id) ? 'bg-[#fff0e5] text-[#a8431a] dark:bg-[#35362e] dark:text-[#d8a53a]' : QP_TOOL_BTN}`} title="Destacar texto. Se nada estiver selecionado, o destaque vale para o enunciado todo." aria-label="Destacar texto">
                    <Highlighter className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleSelectiveMark('strike')} className={`p-2 rounded-lg transition-all active:scale-90 ${questionScratched.includes(currentQ.id) ? 'bg-[#efe6d6] text-[#473c33] dark:bg-[#35362e] dark:text-[#f2efd2]' : QP_TOOL_BTN}`} title="Riscar texto. Se nada estiver selecionado, a marcação vale para o enunciado todo." aria-label="Riscar texto">
                    <PenLine className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setQuestionScratched(questionScratched.filter((id) => id !== currentQ.id));
                      setQuestionHighlighted(questionHighlighted.filter((id) => id !== currentQ.id));
                    }}
                    className={`p-2 rounded-lg transition-all active:scale-90 ${QP_TOOL_BTN}`}
                    title="Limpar marcações"
                    aria-label="Limpar marcações"
                  >
                    <Eraser className="w-4 h-4" />
                  </button>
                  <button onClick={handleUndo} disabled={!(undoStack[currentQ.id] && undoStack[currentQ.id].length > 0)} className={`p-2 rounded-lg transition-all active:scale-90 disabled:opacity-30 ${QP_TOOL_BTN}`} title="Desfazer marcação" aria-label="Desfazer marcação">
                    <Undo2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div
              aria-hidden="true"
              className="mb-5 h-3 opacity-60"
              style={{ backgroundImage: 'url("/sul-americano-triangulos.svg")', backgroundRepeat: 'repeat-x', backgroundSize: 'auto 100%' }}
            />
            <style>{`
 .quiz-question-text.markdown-body { 
 font-size: ${18 * questionFontSize}px !important; 
 line-height: 1.6 !important;
 }
 .quiz-question-text.markdown-body p, 
 .quiz-question-text.markdown-body li, 
 .quiz-question-text.markdown-body div, 
 .quiz-question-text.markdown-body span { 
 font-size: 1em !important;
 }
 `}</style>
            <div
              ref={questionTextRef}
              className={`quiz-question-text font-semibold leading-[1.6] tracking-tight markdown-body transition-all duration-500 p-5 sm:p-7 md:p-9 rounded-2xl relative z-10 ${questionScratched.includes(currentQ.id) ? `line-through opacity-40 border ${QP_RULE} ${QP_PAPER} ${QP_MUTED}` : questionHighlighted.includes(currentQ.id) ? `border border-l-[8px] border-l-[#d8a53a] bg-[#fff6e8] dark:bg-[#3a2f22] ${QP_RULE} ${QP_INK}` : `border ${QP_RULE} ${QP_PAPER} ${QP_INK}`}`}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(currentQ.question),
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 mb-6 pt-1">
            <span className={`mr-auto text-[10px] font-black uppercase tracking-widest ${QP_MUTED}`}>Ações da questão</span>
            <button onClick={() => setShowMoveModal(true)} className={`flex min-h-[40px] items-center gap-1.5 px-3 rounded-full text-[10px] font-black uppercase tracking-wide transition-all ${QP_ICON_BTN}`} title="Mover questão">
              <Move className="w-4 h-4" />
              <span className="hidden sm:inline">Mover</span>
            </button>
            <button onClick={handleDeleteQuestion} className={`flex min-h-[40px] items-center gap-1.5 px-3 rounded-full text-[10px] font-black uppercase tracking-wide transition-all ${QP_ICON_BTN}`} title="Excluir questão">
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Excluir</span>
            </button>
          </div>

          {/* We keep the options grid visible regardless of selectedAnswer being null or not */}
          <div className={`grid ${currentQ.options.every((o) => !o.trim()) ? 'grid-cols-5' : 'grid-cols-1'} gap-3 mb-7`}>
            {questions[currentIndex].options.map((opt, idx) => {
              const isConfirmed = selectedAnswer !== null;
              const isCorrectAnswer = idx === currentQ.correctAnswer;
              const isUserSelection = (isConfirmed ? selectedAnswer : tempSelectedAnswer) === idx;
              const isCrossedOut = crossedOut.includes(idx);
              const isQuickMode = currentQ.options.every((o) => !o.trim());

              let btnClass = `border ${QP_RULE} ${QP_CARD} ${QP_INK} hover:border-[#e96f34]`;
              let circleClass = 'border-transparent bg-[#fff0e5] text-[#e96f34] dark:bg-[#35362e]';

              if (isConfirmed) {
                if (isCorrectAnswer) {
                  // The correct answer is always highlighted in green after confirmation
                  btnClass = 'border-2 border-[#6f8a3a] border-l-[6px] bg-[#f1f6e8] text-[#46523a] dark:border-[#82965b] dark:bg-[#34392c] dark:text-[#f2efd2]';
                  circleClass = 'bg-[#4c6324] border-[#4c6324] text-white';
                } else if (isUserSelection) {
                  // User selected the wrong answer: highlight in red
                  btnClass = 'border-2 border-[#c96f53] border-l-[6px] bg-[#fff1ec] text-[#713a2e] dark:border-[#a8543f] dark:bg-[#3d2a24] dark:text-[#f1c5b4]';
                  circleClass = 'bg-[#9a3b26] border-[#9a3b26] text-white';
                } else {
                  // Other unselected, incorrect options
                  btnClass = `border ${QP_RULE} ${QP_CARD} ${QP_MUTED} opacity-70`;
                  circleClass = 'border-transparent bg-[#efe6d6] text-[#725442] dark:bg-[#35362e] dark:text-[#c8c5a9]';
                }
              } else if (isUserSelection) {
                // Pre-confirmation selection (blue)
                btnClass = `border-2 border-[#e96f34] border-l-[6px] ${QP_CARD} ${QP_INK} shadow-md`;
                circleClass = 'bg-[#a8431a] border-[#a8431a] text-white';
              }

              if (isCrossedOut && !isConfirmed) {
                btnClass = `border ${QP_RULE} ${QP_PAPER} ${QP_MUTED} line-through opacity-50`;
              }

              return (
                <div key={idx} className="relative group">
                  <button
                    type="button"
                    onClick={() => handleSelect(idx)}
                    onDoubleClick={() => handleDoubleClick(idx)}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !isConfirmed) {
                        event.preventDefault();
                        handleSelect(idx);
                      }
                    }}
                    className={`${isQuickMode ? 'w-14 h-14 rounded-2xl flex items-center justify-center' : 'w-full text-left p-4 sm:p-5 rounded-2xl flex items-center gap-4 sm:gap-5'} font-bold transition-all duration-300 select-none cursor-pointer group active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/30 ${btnClass} relative overflow-hidden`}
                    aria-label={`Alternativa ${String.fromCharCode(65 + idx)}${opt ? `: ${opt}` : ''}`}
                    aria-pressed={isUserSelection}
                    aria-disabled={isConfirmed}
                    tabIndex={isConfirmed ? -1 : 0}
                  >
                    <div className={`flex items-center flex-1 ${isQuickMode ? 'justify-center' : 'gap-4 sm:gap-5'}`}>
                      <span className={`${isQuickMode ? 'w-10 h-10 rounded-xl' : 'w-12 h-12 rounded-full'} border flex items-center justify-center text-[12px] font-black flex-shrink-0 transition-all ${circleClass}`}>{String.fromCharCode(65 + idx)}</span>
                      {!isQuickMode && <span className="text-[16px] font-semibold leading-snug">{opt}</span>}
                    </div>

                    {!isQuickMode && isConfirmed && isCorrectAnswer && (
                      <div className="w-8 h-8 rounded-full bg-[#4c6324] text-white flex items-center justify-center shadow-lg animate-in zoom-in-50">
                        <span className="text-sm">✓</span>
                      </div>
                    )}
                    {!isQuickMode && isConfirmed && isUserSelection && !isCorrectAnswer && (
                      <div className="w-8 h-8 rounded-full bg-[#9a3b26] text-white flex items-center justify-center shadow-lg animate-in zoom-in-50">
                        <span className="text-sm">✗</span>
                      </div>
                    )}
                    {!isQuickMode && !isConfirmed && <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isUserSelection ? 'border-[#a8431a] bg-[#a8431a]' : 'border-[#e8dcc8] dark:border-white/20'}`}>{isUserSelection && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}</div>}
                  </button>
                </div>
              );
            })}
          </div>

          {selectedAnswer === null ? (
            <>
              <div className={`flex flex-wrap items-center justify-between gap-3 mt-7 pt-5 border-t ${QP_RULE}`}>
                <button onClick={handleConfirmAnswer} disabled={tempSelectedAnswer === null} className={`flex min-h-[48px] items-center gap-2 px-5 rounded-full text-xs font-black uppercase tracking-wide ${QP_PRIMARY_BTN}`}>
                  <CheckCircle2 className="w-4 h-4" />
                  Conferir resposta
                </button>

                <div className="flex flex-wrap items-center gap-2">
                <button onClick={prevQuestion} disabled={currentIndex === 0} className={`flex min-h-[44px] items-center gap-1.5 px-3 rounded-full ${QP_SECONDARY_BTN}`} aria-label="Questão anterior" title="Questão anterior">
                  <ChevronLeft className="w-6 h-6" />
                  <span className="hidden sm:inline text-[10px] font-black uppercase">Anterior</span>
                </button>
                <button onClick={nextQuestion} disabled={currentIndex === questions.length - 1} className={`flex min-h-[44px] items-center gap-1.5 px-3 rounded-full ${QP_SECONDARY_BTN}`} aria-label="Próxima questão" title="Próxima questão">
                  <span className="hidden sm:inline text-[10px] font-black uppercase">Próxima</span>
                  <ChevronRight className="w-6 h-6" />
                </button>
                <button onClick={shuffleQuestions} className={`flex min-h-[44px] items-center gap-1.5 px-3 rounded-full ${QP_SECONDARY_BTN}`} title="Embaralhar questões">
                  <Shuffle className="w-6 h-6" />
                  <span className="hidden sm:inline text-[10px] font-black uppercase">Embaralhar</span>
                </button>
                <button onClick={handleResetNotebook} className={`flex min-h-[44px] items-center gap-1.5 px-3 rounded-full ${QP_SECONDARY_BTN}`} title="Zerar caderno (apaga todas as respostas salvas)">
                  <Trash2 className="w-6 h-6" />
                  <span className="hidden sm:inline text-[10px] font-black uppercase">Zerar caderno</span>
                </button>
                <button
                  onClick={() => {
                    handleSaveUserCommentary();
                    onBack();
                  }}
                  className={`flex min-h-[44px] items-center gap-1.5 px-3 rounded-full ${QP_SECONDARY_BTN}`}
                  title="Sair do simulado"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="hidden sm:inline text-[10px] font-black uppercase">Sair</span>
                </button>
                </div>
              </div>
            </>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
              <div className={`p-5 sm:p-6 rounded-3xl mb-5 border shadow-sm dark:shadow-none ${selectedAnswer === currentQ.correctAnswer ? 'bg-[#f1f6e8] dark:bg-[#34392c] border-[#abc270]/40 dark:border-[#82965b]' : 'bg-[#fff1ec] dark:bg-[#3d302a] border-[#df9278] dark:border-[#b96b50]'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl ${selectedAnswer === currentQ.correctAnswer ? 'bg-[#4c6324]' : 'bg-[#9a3b26]'}`}>{selectedAnswer === currentQ.correctAnswer ? '✓' : '✗'}</div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.4em] mb-1 ${selectedAnswer === currentQ.correctAnswer ? 'text-[#596b2a] dark:text-[#c4d99a]' : 'text-[#984b39] dark:text-[#f1a58b]'}`}>{selectedAnswer === currentQ.correctAnswer ? 'TARGET ACQUIRED' : 'ROUTE ERROR'}</p>
                    <p className={`text-[17px] font-bold ${selectedAnswer === currentQ.correctAnswer ? 'text-[#46523a] dark:text-[#f2efd2]' : 'text-[#713a2e] dark:text-[#f1c5b4]'}`}>{selectedAnswer === currentQ.correctAnswer ? 'Resposta correta! Você consolidou este conhecimento.' : `A resposta correta é a alternativa ${String.fromCharCode(65 + currentQ.correctAnswer)}.`}</p>
                  </div>
                </div>
              </div>

              <div className={`flex flex-wrap items-center gap-2 mb-5 p-3 rounded-2xl border ${QP_RULE} ${QP_CARD}`}>
                <span className={`mr-1 text-[10px] font-black uppercase tracking-widest ${QP_MUTED}`}>Apoio</span>
                <button
                  onClick={() => {
                    setShowNoteSection(!showNoteSection);
                    if (!showNoteSection) {
                      setTimeout(() => {
                        noteSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setIsNoteExpanded(true);
                      }, 100);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${showNoteSection ? 'bg-[#a8431a] text-white' : QP_ICON_BTN}`}
                  title="Alternar nota estratégica"
                >
                  <MessageSquarePlus className="w-4 h-4" /> Nota
                </button>
                <button
                  onClick={() => {
                    setShowImageArea(!showImageArea);
                    if (!showImageArea) {
                      setTimeout(() => imageInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${showImageArea ? 'bg-[#a8431a] text-white' : QP_ICON_BTN}`}
                  title="Alternar anexo de imagem"
                >
                  <ImageIcon className="w-4 h-4" /> Imagem
                </button>
                {onTriggerGuidedLesson && (
                  <button onClick={() => onTriggerGuidedLesson(currentQ.topic?.includes(':') ? currentQ.topic.split(':')[0] : folder.name, currentQ.topic?.includes(':') ? currentQ.topic.split(':')[1] : currentQ.topic || notebook.name)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide bg-[#fff0e5] text-[#a8431a] hover:bg-[#ffe3cf] dark:bg-[#35362e] dark:text-[#f2efd2] dark:hover:bg-white/10 transition-all" title="Abrir aula guiada">
                    <BookOpen className="w-4 h-4" /> Aula guiada
                  </button>
                )}
                <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className={`ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${QP_ICON_BTN}`} title="Voltar ao enunciado">
                  <HelpCircle className="w-4 h-4 rotate-180" /> Enunciado
                </button>
              </div>

              <div className={`rounded-2xl border p-5 sm:p-7 md:p-8 mb-6 transition-all ${QP_RULE} ${QP_PAPER}`}>
                {showNoteSection && (
                  <div ref={noteSectionRef} className={`border p-6 md:p-8 rounded-2xl mb-8 relative group transition-all ${QP_RULE} ${QP_CARD}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#fff0e5] text-[#e96f34] dark:bg-[#35362e] rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${QP_INK}`}>SUA NOTA ESTRATÉGICA</h4>
                          <p className={`text-[9px] font-bold uppercase tracking-tight ${QP_MUTED}`}>Refine seu conhecimento aqui</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-3 mr-4">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${QP_MUTED}`}>Tamanho</span>
                          <input type="range" min="0.5" max="6" step="0.1" value={noteFontSize} onChange={(e) => setNoteFontSize(parseFloat(e.target.value))} className="w-20 accent-[#e96f34] h-1" />
                        </div>
                        <button onClick={() => setIsNoteExpanded(true)} className="flex items-center gap-2 px-4 py-2 bg-[#fff0e5] text-[#a8431a] hover:bg-[#ffe3cf] dark:bg-[#35362e] dark:text-[#f2efd2] dark:hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">
                          <Maximize2 className="w-3.5 h-3.5" />
                          ABRIR EDITOR
                        </button>
                      </div>
                    </div>

                    {userCommentaryInput ? (
                      <>
                        <style>{`
 .note-container.markdown-body { 
 font-size: ${22 * noteFontSize}px !important; 
 line-height: 1.6 !important;
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
 .note-container.markdown-body code { font-size: 0.85em !important; background: rgba(127, 95, 70, 0.14) !important; padding: 0.2em 0.4em !important; border-radius: 4px !important; }
 .note-container.markdown-body ul, .note-container.markdown-body ol { padding-left: 1.5em !important; margin-bottom: 1em !important; }
 .note-container.markdown-body li { margin-bottom: 0.5em !important; }
 .note-container.markdown-body strong { font-weight: 700 !important; color: inherit !important; }
 `}</style>
                        <div
                          className={`font-medium space-y-4 markdown-body prose max-w-none border-l-4 border-[#e96f34] pl-6 py-2 note-container ${QP_INK}`}
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(userCommentaryInput),
                          }}
                        />
                      </>
                    ) : (
                      <div onClick={() => setIsNoteExpanded(true)} className={`cursor-pointer py-10 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-[#e96f34] transition-all ${QP_RULE} ${QP_MUTED}`}>
                        <Brain className="w-8 h-8 opacity-20" />
                        <p className="font-bold text-xs tracking-tight">Nenhuma anotação estratégica ainda. Clique para adicionar.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    <div aria-hidden="true" className="w-8 h-8 bg-[#fff0e5] text-[#e96f34] dark:bg-[#35362e] rounded-lg flex items-center justify-center font-black text-sm">A</div>
                    <h4 className="font-logo text-sm uppercase tracking-wide text-[#e96f34]">Mapeamento da lógica da questão</h4>
                  </div>
                  {canEditExplanation && !editingExplanation && (
                    <button onClick={handleStartEditExplanation} className="flex items-center gap-2 px-3 py-2 bg-[#473c33]/5 hover:bg-[#473c33]/10 text-[#473c33] rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                      <PenLine className="w-3.5 h-3.5" />
                      Editar (admin)
                    </button>
                  )}
                </div>

                {onTriggerGuidedLesson && (
                  <button onClick={() => onTriggerGuidedLesson(currentQ.topic?.includes(':') ? currentQ.topic.split(':')[0] : folder.name, currentQ.topic?.includes(':') ? currentQ.topic.split(':')[1] : currentQ.topic || notebook.name)} className="w-full mb-8 bg-gradient-to-r from-[#fec868] to-[#ffb22a] dark:from-[#8c2c0b] dark:to-[#42251d] text-[#42251d] dark:text-[#f4ebdd] p-6 rounded-[30px] flex items-center justify-between group transition-all hover:scale-[1.01] hover:shadow-xl shadow-[#fecc73]/20 active:scale-95">
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

                {editingExplanation ? (
                  <div className="space-y-3">
                    <textarea
                      value={explanationDraft}
                      onChange={(e) => setExplanationDraft(e.target.value)}
                      rows={12}
                      className="w-full bg-white border-2 border-[#fec868]/40 focus:border-[#fec868] rounded-2xl p-5 text-sm font-medium text-slate-700 outline-none transition-all resize-y shadow-inner"
                    />
                    {explanationSaveError && <p className="text-xs font-bold text-red-500">{explanationSaveError}</p>}
                    <div className="flex items-center gap-3">
                      <button onClick={handleSaveExplanation} disabled={savingExplanation} className="px-6 py-3 bg-[#473c33] hover:bg-[#5a4b3f] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40">
                        {savingExplanation ? 'Salvando...' : 'Salvar explicação'}
                      </button>
                      <button onClick={() => setEditingExplanation(false)} disabled={savingExplanation} className="px-6 py-3 text-slate-400 hover:text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <VerificationBadge verification={currentQ.verification} />
                    <MarkdownContent content={currentQ.explanation} />
                  </>
                )}

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
                        <div key={i} className={`relative group rounded-[35px] overflow-hidden border-2 border-slate-100 shadow-sm transition-all hover:shadow-xl hover:border-[#ffe6b9] mx-auto ${sizeClasses}`}>
                          <img src={img} alt={`Complemento Visual ${i}`} className="w-full h-auto object-contain bg-white min-h-[100px]" />

                          {/* Overlay de Ações */}
                          <div className="absolute inset-x-0 bottom-0 bg-[#473c33]/60 backdrop-blur-sm p-4 translate-y-full group-hover:translate-y-0 transition-all flex items-center justify-between">
                            <div className="flex gap-2">
                              {['sm', 'md', 'lg', 'full'].map((s) => (
                                <button key={s} onClick={() => handleUpdateImageSize(i, s)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${currentSize === s ? 'bg-[#fecc73] text-white shadow-lg' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
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
                  <div className="mt-10 flex flex-col items-center gap-4">
                    <label className="flex items-center gap-3 px-10 py-5 bg-white border-2 border-dashed border-[#fff0d5] hover:border-[#fedda1] text-[#fed386] hover:text-[#fec868] rounded-[30px] cursor-pointer transition-all active:scale-95 shadow-sm group">
                      <ImageIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">ANEXAR COMPLEMENTO VISUAL</span>
                      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                )}
                {(showImageArea || (currentQ.explanationImages && currentQ.explanationImages.length > 0)) && <p className={`text-[10px] font-bold uppercase tracking-widest text-center mt-4 ${QP_MUTED}`}>Aumente sua retenção com imagens, mapas mentais ou prints.</p>}

                {currentQ.memoryHint && (
                  <div className="bg-[#fec868] p-10 rounded-[45px] border border-[#fecc73]/10 shadow-2xl relative overflow-hidden mt-12 group transition-all hover:">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                    <p className="text-[11px] font-black text-white uppercase tracking-[0.5em] mb-6 flex items-center gap-4">
                      <span className="text-2xl animate-bounce">⚡</span> DICA DE MEMÓRIA
                    </p>
                    <MarkdownContent content={currentQ.memoryHint} isDark />
                  </div>
                )}
              </div>

              <div className={`flex flex-wrap items-center justify-between gap-3 mt-10 pt-5 border-t ${QP_RULE}`}>
                <button onClick={handleReviewAnswer} className={`flex min-h-[44px] items-center gap-2 px-3 rounded-full text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 ${QP_ICON_BTN}`}>
                  <ChevronLeft className="w-4 h-4" /> REVISAR RESPOSTA
                </button>

                <div className="flex gap-2">
                  <button onClick={prevQuestion} disabled={currentIndex === 0} className={`flex min-h-[48px] items-center gap-2 px-5 rounded-full ${QP_SECONDARY_BTN}`}>
                    <ChevronLeft className="w-4 h-4" /> ANTERIOR
                  </button>
                  <button onClick={nextQuestion} className={`flex min-h-[48px] items-center gap-2 px-6 rounded-full ${QP_PRIMARY_BTN}`}>
                    {currentIndex < questions.length - 1 ? 'PRÓXIMA' : 'FINALIZAR'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODALS OUTSIDE MAIN CARD BUT INSIDE INNER CONTAINER */}
        {showMoveModal && (
          <MoveToNotebookModal
            folders={folders}
            currentFolderId={folder.id}
            currentNotebookId={notebook.id}
            onConfirm={(targetFolderId, targetNotebookId) => {
              onMoveQuestion(currentQ.id, folder.id, notebook.id, targetFolderId, targetNotebookId);
              setShowMoveModal(false);
              if (questions.length === 1) {
                onBack();
              } else {
                const newQuestions = questions.filter((_, idx) => idx !== currentIndex);
                setQuestions(newQuestions);
                if (currentIndex >= newQuestions.length) setCurrentIndex(newQuestions.length - 1);
              }
            }}
            onClose={() => setShowMoveModal(false)}
          />
        )}

        {isNoteExpanded && (
          <div className="fixed inset-0 z-[1000] bg-[#473c33]/90 backdrop-blur-md p-6 md:p-12 flex flex-col">
            <div className="flex items-center justify-between mb-8 max-w-5xl mx-auto w-full">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#fecc73] rounded-2xl flex items-center justify-center text-white shadow-xl">
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
                <Minimize2 className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 max-w-5xl mx-auto w-full bg-white rounded-[40px] p-8 md:p-12 shadow-2xl overflow-hidden">
              <RichTextEditor content={userCommentaryInput} onChange={setUserCommentaryInput} fontSize={22 * noteFontSize} />
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

        {/* FOOTER: ABANDON */}
        <div className="flex justify-center mt-12 pb-12">
          <button
            onClick={() => {
              handleSaveUserCommentary();
              onBack();
            }}
            className={`flex min-h-[44px] items-center gap-3 px-4 rounded-full text-[10px] font-black tracking-[0.2em] transition-all group active:scale-95 ${QP_ICON_BTN}`}
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1" />
            ABANDONAR SIMULADO
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizPlayer;
