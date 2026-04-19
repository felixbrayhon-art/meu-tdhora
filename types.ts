
export type AppView = 'HUB' | 'TIMER' | 'FLASHCARDS' | 'AI_DIRECT' | 'MATERIALS' | 'QUIZ_PLAYER' | 'TDH_QUESTOES' | 'STUDY_PLAN' | 'PROFILE' | 'COMMUNITY' | 'FOCUS_MODE' | 'DYNAMIC_TIMER' | 'EDITAL_SETUP' | 'EDITAL_VIEW' | 'SMART_REVISION' | 'ERROR_VAULT' | 'SOCIAL_MODULE' | 'STUDY_CYCLE';
export type StudyProfile = 'VESTIBULAR' | 'CONCURSO';
export type HubCategory = 'ESTUDO' | 'ORGANIZACAO' | 'RELAXE' | 'EDITAL' | 'REVISAO';

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
  question: string;
  answer: string;
  topic: string;
  folderId?: string;
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
  level: number;
  xp: number;
  coins: number;
  streak: number;
  totalDaysStudied: number;
  lastStudyDate?: string;
  studyProfile?: StudyProfile;
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
  commentary?: string;
}

export interface Notebook {
  id: string;
  name: string;
  questions: QuizQuestion[];
  summary?: string;
  createdAt: number;
}

export interface QuizFolder {
  id: string;
  name: string;
  notebooks: Notebook[];
  topic: string;
  createdAt: number;
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
}

export interface SmartRevisionItem {
  id: string;
  topic: string;
  subjectName: string;
  scheduledDate: string; // YYYY-MM-DD
  intervalLevel: 0 | 1 | 3 | 7 | 15;
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
  id: string;
  name: string;
  avatarColor: string;
  level: number;
  xp: number;
  status: 'ONLINE' | 'STUDYING' | 'OFFLINE';
  lastEditalProgress: { [subjectName: string]: number }; // Heat map from edital
  currentSession?: FriendSession;
  lastRevAt?: number; // Last revision done
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
