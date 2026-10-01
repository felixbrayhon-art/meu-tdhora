
export type AppView = 'HUB' | 'TIMER' | 'FLASHCARDS' | 'AI_DIRECT' | 'MATERIALS' | 'QUIZ_PLAYER' | 'TDH_QUESTOES' | 'STUDY_PLAN' | 'PROFILE' | 'COMMUNITY' | 'FOCUS_MODE' | 'DYNAMIC_TIMER' | 'EDITAL_SETUP' | 'EDITAL_VIEW' | 'SMART_REVISION' | 'ERROR_VAULT' | 'SOCIAL_MODULE' | 'STUDY_CYCLE' | 'FISH_CATALOG' | 'GUIDED_LESSON' | 'PERFORMANCE' | 'SAVED_GUIDED_LESSONS' | 'DRIVE_READER' | 'VADE_MECUM' | 'NOTES' | 'ADMIN_QUESTION_REVIEW' | 'VR_METHOD' | 'DIGITAL_NOTEBOOK';

// --- Question bank import pipeline (admin-only) ---
// Populated by worker/ (a local Python script, not a hosted service — see
// worker/scripts/push_drafts.py) which parses a source PDF (e.g. a
// FC Concursos export) and pushes the result here via the Admin SDK,
// bypassing these client-facing types entirely on the way in. The app only
// ever reads/writes these through the admin review UI.

export type QuestionType = 'multipla_escolha' | 'certo_errado';
export type QuestionDraftStatus = 'pending_review' | 'needs_attention' | 'approved' | 'rejected';

export interface QuestionAlternative {
  letter: string;
  text: string;
  isCorrect: boolean;
  position: number;
}

export interface QuestionImportBatch {
  id: string;
  source: string; // e.g. 'fc_concursos'
  title: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  generatedAt?: string | null;
  bloco?: string | null;
  totalQuestions: number;
  importedAt: number;
  importedBy: string; // uid of the admin who ran the push script
}

export interface QuestionDraft {
  id: string;
  importId: string;
  source: string;
  externalId: string;
  number: number;
  importSubject?: string | null;
  importYear?: number | null;
  questionType: QuestionType;
  subjectRaw: string | null;
  topicRaw: string | null;
  statement: string;
  alternatives: QuestionAlternative[];
  correctLetter: string | null;
  explanation: string;
  sourcePage: number;
  contentHash: string;
  status: QuestionDraftStatus;
  warnings: string[];
  possibleDuplicateOfId?: string;
  // Optional exam metadata — mirrors PublishedQuestion's own fields (see its
  // comment). Present on the Firestore doc for a source like
  // worker/exam_discovery well before approval; declared here too so
  // approveDraft() can read and carry it through instead of silently
  // dropping it at publish time.
  examBoard?: string | null;
  organization?: string | null;
  position?: string | null;
  examYear?: number | null;
}

export interface PublishedQuestion {
  id: string;
  source: string;
  externalId: string;
  importSubject?: string | null;
  importYear?: number | null;
  questionType: QuestionType;
  subjectRaw: string | null;
  topicRaw: string | null;
  statement: string;
  alternatives: QuestionAlternative[];
  correctLetter: string | null;
  explanation: string;
  contentHash: string;
  approvedAt: number;
  approvedBy: string;
  // Optional exam metadata (only populated by newer sources, e.g. a future
  // publish of worker/parsers/direto_ao_ponto.py content — never present on
  // fc_concursos-sourced questions). Every consumer must treat these as
  // absent, not just falsy.
  examBoard?: string | null;
  organization?: string | null;
  position?: string | null;
  examYear?: number | null;
}

export interface DrawPoint {
  x: number;
  y: number;
  pressure: number;
}

export type NotePenType = 'pen' | 'monoline' | 'brush';
export type NoteShapeType = 'line' | 'arrow' | 'rectangle' | 'circle' | 'polygon' | 'polyline';
export type NoteElementKind = 'stroke' | 'shape' | 'text';

export interface DrawStroke {
  points: DrawPoint[];
  color: string;
  width: number;
  isEraser?: boolean;
  opacity?: number;
  penType?: NotePenType;
  /** True when the input device has no real pressure sensor (mouse/touch) — tells perfect-freehand to synthesize a pressure curve from point velocity instead of using the flat stored values. */
  simulatePressure?: boolean;
  /** When set, `points` holds just the 2 anchor points (start/end) that define this shape (or, for polygon/polyline, every vertex), and it's rendered parametrically instead of as freehand ink. */
  shapeType?: NoteShapeType;
  /** Discriminant for the element-renderer dispatch. Undefined/'stroke' = legacy freehand ink (backward compatible with notes saved before this field existed). */
  kind?: NoteElementKind;
  /** Only for kind:'text' — the typed text (may contain \n), anchored at points[0]. */
  text?: string;
  /** Only for kind:'text' — world-space font size in px (scales with zoom like everything else). */
  fontSize?: number;
}

export type NotePaperStyle = 'dots' | 'lines' | 'grid' | 'blank';
export type NotePenPreset = 'ballpoint' | 'fineliner' | 'pencil' | 'highlighter' | 'brush' | 'monoline';

export interface HandwrittenNote {
  id: string;
  title: string;
  /** Optional cover color selected by the user. */
  color?: string;
  folderId?: string;
  /** @deprecated Only present on notes saved before the switch to Excalidraw — the current editor no longer reads or writes this. */
  paperStyle?: NotePaperStyle;
  /** Preset selected for new strokes in the Excalidraw editor. */
  penPreset?: NotePenPreset;
  /** @deprecated Only present on notes saved before the switch to Excalidraw. */
  strokes?: DrawStroke[];
  /** Excalidraw's own scene data (elements/appState/files), untyped here since it's opaque to the rest of the app — read back from ExcalidrawImperativeAPI on save, passed straight through as initialData on open. */
  excalidrawElements?: unknown[];
  excalidrawAppState?: Record<string, unknown>;
  excalidrawFiles?: Record<string, unknown>;
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}

export interface NoteFolder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface VadeMecumArticle {
  // String, not number: some codes have letter-suffixed articles inserted by
  // later amendments (e.g. "121-A", or even "359-M-A") that a plain int can't represent.
  numero: string;
  titulo: string | null;
  capitulo: string | null;
  secao: string | null;
  subsecao: string | null;
  texto: string;
}

export interface VadeMecumLaw {
  id: string;
  name: string;
  shortName: string;
}

export const VADE_MECUM_LAWS: VadeMecumLaw[] = [
  { id: 'constituicao-federal', name: 'Constituição Federal de 1988', shortName: 'CF/88' },
  { id: 'codigo-penal', name: 'Código Penal (Decreto-Lei nº 2.848/1940)', shortName: 'CP' },
];
export type StudyProfile = 'VESTIBULAR' | 'CONCURSO' | 'FACULDADE';
export type ExplanationStyle = string;

export type GuidedLessonStepType = 'OPENING' | 'OVERVIEW' | 'NARRATIVE' | 'CONCEPT' | 'QUESTION_PAUSE' | 'REINFORCEMENT' | 'ANALOGY' | 'CLOSING_APPLICATION';

export interface GuidedLessonStep {
  type: GuidedLessonStepType;
  content: string;
  /** Exact excerpts from content that the alternate guided-lesson view should underline. */
  keyPoints?: string[];
  pauseAfterMilliseconds?: number;
}

export interface GuidedLesson {
  id: string;
  topic: string;
  subject?: string; // Optional subject for saving purposes
  steps: GuidedLessonStep[];
  quiz?: QuizQuestion[];
  createdAt: number;
}

export interface SavedGuidedLesson {
  id: string;
  subject: string;
  topic: string;
  lesson: GuidedLesson;
  savedAt: number;
}
export type HubCategory = 'ESTUDO' | 'ORGANIZACAO' | 'RELAXE' | 'EDITAL' | 'REVISAO' | 'MOTIVACAO' | 'PERFORMANCE';

export enum TimerMode {
  POMODORO = 'POMODORO',
  EMERGENCY = 'EMERGENCY',
  BREAK = 'BREAK'
}

export interface FishRank {
  days: number;
  label: string;
  id: 'PALHACO' | 'CIRURGIAO' | 'CAVALO' | 'ARRAIA' | 'ESPADA' | 'TUBARAO' | 'INICIANTE';
  description: string;
}

export const FISH_RANKS: FishRank[] = [
  { days: 0, label: 'Alevino', id: 'INICIANTE', description: 'O começo da jornada nas águas profundas.' },
  { days: 30, label: 'Peixe Palhaço', id: 'PALHACO', description: 'Iniciante - O primeiro mergulho no foco.' },
  { days: 60, label: 'Peixe Cirurgião', id: 'CIRURGIAO', description: 'Navegador - Já sabe filtrar o conteúdo importante.' },
  { days: 90, label: 'Cavalo-marinho', id: 'CAVALO', description: 'Resiliente - Mantém o ritmo mesmo em mar agitado.' },
  { days: 180, label: 'Arraia', id: 'ARRAIA', description: 'Estrategista - Estuda com suavidade e precisão.' },
  { days: 270, label: 'Peixe-Espada', id: 'ESPADA', description: 'Guerreiro - Foco total e ataque certeiro às questões.' },
  { days: 365, label: 'Tubarão Rei', id: 'TUBARAO', description: 'Mestre / Aprovado - O predador absoluto dos editais.' }
];

export const getFishRank = (days: number): FishRank => {
  return [...FISH_RANKS].reverse().find(r => days >= r.days) || FISH_RANKS[0];
};

export interface FocusSettings {
  waterReminder: boolean;
  waterInterval: number; // em minutos
  medicationReminder: boolean;
  medicationTime: string; // HH:mm
  workTransition: boolean;
  workStartTime: string; // HH:mm
  prepTime: number; // minutos antes do trabalho
}

export interface Flashcard {
  id: string;
  topic: string;
  folderId?: string;
  type: 'SIMPLE' | 'MULTIPLE_CHOICE'; // NEW
  question: string;
  answer: string; // Only for simple
  explanation?: string; // NEW - Added explanation field
  
  // For multiple choice
  options?: string[]; // 5 options
  correctAnswerIndex?: number; // 0-4

  // SRS Fields
  nextReview?: number; // timestamp
  interval?: number; // in days
  easeFactor?: number;
  reviewsCount?: number;
}

export interface FlashcardFolder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface UserStats {
  name: string;
  avatarColor: string;
  characterId?: string;
  level: number;
  xp: number;
  coins: number;
  streak: number;
  totalDaysStudied: number;
  lastStudyDate?: string;
  studyProfile?: StudyProfile;
  explanationStyle?: ExplanationStyle;
  questionProfileStyle?: string;
  fontSizeMultiplier?: number; // 1, 1.25, 1.5
  heroScenario?: 'quarto' | 'estudio' | 'biblioteca' | 'quarto-3d' | 'estudio-3d' | 'biblioteca-3d' | 'solido'; // cenário de fundo do card principal do Hub
  heroTintColor?: string; // cor do degradê sobreposto ao cenário do card principal do Hub
}

export interface Activity {
  id: string;
  userName: string;
  avatarColor: string;
  subject: string;
  duration: number;
  type: 'POMODORO' | 'EMERGENCY' | 'QUIZ' | 'STATUS';
  timestamp: number;
  bubbles: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  userAnswer?: number;
  explanation?: string;
  memoryHint?: string;
  topic?: string;
  userCommentary?: string;
  explanationImages?: string[];
  explanationImageSizes?: string[];
  // Optional exam metadata, carried through from PublishedQuestion when the
  // source question bank has it (see Método VR) — absent for every other
  // question source (AI-generated, ENEM, pasted, etc).
  examBoard?: string | null;
  organization?: string | null;
  position?: string | null;
  examYear?: number | null;
}

export interface Notebook {
  id: string;
  name: string;
  /** Optional cover color selected by the user. */
  color?: string;
  questions: QuizQuestion[];
  summary?: string;
  createdAt: number;
}

export interface QuizFolder {
  id: string;
  name: string;
  color?: string;
  notebooks: Notebook[];
  topic: string;
  createdAt: number;
  parentId?: string; // Support for subfolders
}

export interface QuizAttempt {
  folderId: string;
  notebookId: string;
  date: number;
  score: number;
  total: number;
}

export interface StudySession {
  id: string;
  subjectId: string;
  durationMinutes: number;
  date: number;
}

export interface StudySubject {
  id: string;
  name: string;
  weight: number; 
  color: string;
  targetMinutes: number; 
  completedMinutesTotal: number;
  editalSubjectId?: string; // Link to edital subject
  completedTopics?: string[];
  targetTopics?: string[]; // Pull from edital
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD
  sessions: {
    subjectId: string;
    subjectName: string;
    minutes: number;
    topics?: string[]; // Planned topics for this session
  }[];
}

export interface StudyPlan {
  subjects: StudySubject[];
  dailyGoalMinutes: number;
  sessions: StudySession[];
  schedule: DaySchedule[]; // Predicted/Planned sessions
}

export interface DailyHistory {
  [date: string]: number;
}

export interface EditalSubject {
  id: string;
  name: string;
  content: string;
  topics: string[];
  heat: number; // 0 to 100
  lastActivity?: number;
  completedTopics?: string[]; // Track progress in Edital
}

export interface EditalConfig {
  isActive: boolean;
  subjects: EditalSubject[];
  examDate: string;
  dailyHours: number;
  period?: string; // added for college / academic period orientation
}

export interface SmartRevisionItem {
  id: string;
  topic: string;
  subjectName: string;
  scheduledDate: string; // YYYY-MM-DD
  intervalLevel: 0 | 1 | 3 | 7 | 15 | 30;
  status: 'PENDING' | 'DONE' | 'MISSED';
  createdAt: number;
}

export interface ErrorVaultItem {
  id: string;
  topic: string;
  subjectName: string;
  errorCount: number;
  lastErrorDate: number;
  isStuck: boolean; // True if errorCount >= 3
  resolved: boolean;
  missedQuestions?: QuizQuestion[];
}

export interface SmartRevisionSystem {
  queue: SmartRevisionItem[];
  vault: ErrorVaultItem[];
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface FriendSession {
  subjectName: string;
  minutesStudied: number;
  lastActive: number;
}

export interface FriendProfile {
  id: string; // friend's Firebase uid
  name: string;
  avatarColor: string;
  characterId?: string;
  level: number;
  xp: number;
  status: 'ONLINE' | 'STUDYING' | 'OFFLINE';
  lastActive?: number;
}

export interface FriendRequest {
  id: string; // `${fromUid}_${toUid}`
  fromUid: string;
  toUid: string;
  fromName: string;
  fromAvatarColor: string;
  createdAt: number;
}

export interface SocialState {
  myFriends: FriendProfile[];
  pendingRequests: string[];
  chats: { [friendId: string]: DirectMessage[] };
  myId: string;
}

export interface StudyCycleStep {
  id: string;
  subjectId: string;
  subjectName: string;
  durationMinutes: number;
  completed: boolean;
}

export interface StudyCycle {
  id: string;
  name: string;
  steps: StudyCycleStep[];
  currentStepIndex: number;
  createdAt: number;
}

// --- Método VR (question-by-question reverse engineering study mode) ---
// Additive-only: does not touch QuizAttempt, ErrorVaultItem or any other
// existing progress type. See services/vrMethodService.ts.

export type VRErrorReason = 'nao_sabia' | 'confundi_conceitos' | 'cai_na_pegadinha' | 'erro_atencao' | 'chutei';
export type VRCorrectReason = 'sabia' | 'duvida' | 'chute_acertou';
export type VRConfidenceLevel = 'baixa' | 'media' | 'alta';

export interface VRAttempt {
  id: string;
  sessionId: string;
  questionId: string;
  subject: string;
  topic?: string | null;
  examBoard?: string | null;
  examYear?: number | null;
  isCorrect: boolean;
  selectedIndex: number;
  correctIndex: number;
  errorReason?: VRErrorReason;
  correctReason?: VRCorrectReason;
  confidence?: VRConfidenceLevel;
  answeredAt: number;
}

export interface VRSession {
  id: string;
  subject: string;
  topic?: string | null;
  startedAt: number;
  finishedAt?: number;
  totalQuestions: number;
  totalCorrect: number;
}
