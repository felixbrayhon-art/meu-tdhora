import React, { lazy, Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppView, TimerMode, Flashcard, FlashcardFolder, UserStats, QuizFolder, Notebook, QuizAttempt, StudyPlan, DailyHistory, StudySubject, StudySession, Activity, QuizQuestion, StudyProfile, FocusSettings, EditalConfig, SmartRevisionSystem, SmartRevisionItem, ErrorVaultItem, SocialState, StudyCycle, StudyCycleStep, HandwrittenNote, NoteFolder } from './types';
import Header from './components/Header';
import Hub from './components/Hub';
import LoginModal from './components/LoginModal';
import SplashScreen from './components/SplashScreen';
import FishCompanion from './components/FishCompanion';
import BuildTag from './components/BuildTag';
import OnboardingFlow from './components/OnboardingFlow';
import AvatarBuilder from './components/AvatarBuilder';
import ProfileSelection from './components/ProfileSelection';
import { checkIsAdmin } from './services/questionBankService';
import Sidebar from './components/Sidebar';

const TimerView = lazy(() => import('./components/TimerView'));
const FlashcardView = lazy(() => import('./components/FlashcardView'));
const AIView = lazy(() => import('./components/AIView'));
const MaterialsManager = lazy(() => import('./components/MaterialsManager'));
const QuizPlayer = lazy(() => import('./components/QuizPlayer'));
const TDHQuestoes = lazy(() => import('./components/TDHQuestoes'));
const StudyPlanView = lazy(() => import('./components/StudyPlanView'));
const ProfileView = lazy(() => import('./components/ProfileView'));
const CommunityView = lazy(() => import('./components/CommunityView'));
const FocusModeView = lazy(() => import('./components/FocusModeView'));
const FishCatalog = lazy(() => import('./components/FishCatalog'));
const VadeMecumView = lazy(() => import('./components/VadeMecumView'));
const NotesView = lazy(() => import('./components/NotesView'));
const AdminQuestionReview = lazy(() => import('./components/AdminQuestionReview'));
const VRMethodView = lazy(() => import('./components/VRMethodView'));
const DynamicTimer = lazy(() => import('./components/DynamicTimer'));
const EditalSetup = lazy(() => import('./components/EditalSetup'));
const EditalView = lazy(() => import('./components/EditalView'));
const SmartRevisionView = lazy(() => import('./components/SmartRevisionView'));
const SocialModule = lazy(() => import('./components/SocialModule'));
const StudyCycleView = lazy(() => import('./components/StudyCycleView'));
const GuidedLessonView = lazy(() => import('./components/GuidedLessonView'));
const LivingLessonView = lazy(() => import('./components/LivingLessonView'));
const PerformanceView = lazy(() => import('./components/PerformanceView'));
const SavedGuidedLessonsView = lazy(() => import('./components/SavedGuidedLessonsView'));
const DriveReader = lazy(() => import('./components/DriveReader').then(({ DriveReader: Component }) => ({ default: Component })));
const DigitalNotebookView = lazy(() => import('./components/DigitalNotebookView'));

const LOFI_RELAX_URL = 'https://stream.zeno.fm/0r0xa792kwzuv';
const MPB_LOFI_URL = 'https://stream.zeno.fm/f978v6v6h0huv';
const RAIN_SOUND_URL = 'https://www.soundjay.com/nature/rain-01.mp3';

const APP_VIEW_IDS: AppView[] = [
  'HUB', 'TIMER', 'FLASHCARDS', 'AI_DIRECT', 'MATERIALS', 'QUIZ_PLAYER', 'TDH_QUESTOES',
  'STUDY_PLAN', 'PROFILE', 'COMMUNITY', 'FOCUS_MODE', 'DYNAMIC_TIMER', 'EDITAL_SETUP',
  'EDITAL_VIEW', 'SMART_REVISION', 'ERROR_VAULT', 'SOCIAL_MODULE', 'STUDY_CYCLE',
  'FISH_CATALOG', 'GUIDED_LESSON', 'PERFORMANCE', 'SAVED_GUIDED_LESSONS', 'DRIVE_READER',
  'VADE_MECUM', 'NOTES', 'ADMIN_QUESTION_REVIEW', 'VR_METHOD', 'DIGITAL_NOTEBOOK', 'LIVING_LESSON',
];
const STUDY_VIEWS: AppView[] = [
  'STUDY_CYCLE', 'FLASHCARDS', 'DYNAMIC_TIMER', 'TDH_QUESTOES', 'DRIVE_READER',
  'MATERIALS', 'QUIZ_PLAYER', 'GUIDED_LESSON', 'TIMER', 'FOCUS_MODE', 'VR_METHOD', 'DIGITAL_NOTEBOOK',
];

const readViewFromUrl = (): AppView => {
  const value = new URLSearchParams(window.location.search).get('view');
  return APP_VIEW_IDS.includes(value as AppView) ? (value as AppView) : 'HUB';
};

import { auth, googleProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, db, handleFirestoreError, OperationType, FirebaseUser, cleanData } from './src/lib/firebase';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { CharacterProvider } from './contexts/CharacterContext';
import { syncPublicProfile } from './services/socialService';
import { addLocalDays, toLocalDateKey } from './utils/localDate';

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  // Tracks whether the SplashScreen's own on-screen animation has finished — kept
  // separate from `isInitializing` (which the Firestore-sync effects below key off of)
  // so the splash stays visible for its full intended duration even when auth resolves
  // almost instantly (e.g. a logged-out user), instead of being unmounted early.
  const [splashDone, setSplashDone] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(() =>
    ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    new URLSearchParams(window.location.search).get('previewLogin') === '1'
  );
  const isProfilePreview =
    ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    new URLSearchParams(window.location.search).get('previewProfile') === '1';
  const isAvatarPreview =
    ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    new URLSearchParams(window.location.search).get('previewAvatar') === '1';
  const [isGoogleLoginLoading, setIsGoogleLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isStorageFull, setIsStorageFull] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [currentView, setCurrentViewState] = useState<AppView>(readViewFromUrl);
  const viewHistoryRef = useRef<AppView[]>([currentView]);
  const [isRevisionNoticeDismissed, setIsRevisionNoticeDismissed] = useState(false);
  const setCurrentView = useCallback((view: AppView) => {
    const stack = viewHistoryRef.current;
    if (stack[stack.length - 1] === view) return;
    if (stack.length > 1 && stack[stack.length - 2] === view) {
      window.history.back();
      return;
    }

    setCurrentViewState(view);
    setIsRevisionNoticeDismissed(false);
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    window.history.pushState({ ...window.history.state, appView: view }, '', `${url.pathname}${url.search}${url.hash}`);
    stack.push(view);
  }, []);

  useEffect(() => {
    const syncViewWithHistory = () => {
      const nextView = readViewFromUrl();
      const stack = viewHistoryRef.current;
      if (stack.length > 1 && stack[stack.length - 2] === nextView) stack.pop();
      else if (stack[stack.length - 1] !== nextView) stack.push(nextView);
      setIsRevisionNoticeDismissed(false);
      setCurrentViewState(nextView);
    };
    window.addEventListener('popstate', syncViewWithHistory);
    return () => window.removeEventListener('popstate', syncViewWithHistory);
  }, []);
  const [timerMode, setTimerMode] = useState<TimerMode>(TimerMode.POMODORO);
  const [showGlobalBar, setShowGlobalBar] = useState(true);

  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('focus_dark_mode') === 'true');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('focus_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  // Audio Global State
  const [activeChannel, setActiveChannel] = useState<'RELAX' | 'MPB' | null>(null);
  const [isPlayingRain, setIsPlayingRain] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.5);

  const relaxAudioRef = useRef<HTMLAudioElement | null>(null);
  const mpbAudioRef = useRef<HTMLAudioElement | null>(null);
  const rainAudioRef = useRef<HTMLAudioElement | null>(null);

  // Global Timer State
  const [globalTimerActive, setGlobalTimerActive] = useState(false);
  const [globalTimerSeconds, setGlobalTimerSeconds] = useState(1500);

  const safeJsonParse = (key: string, defaultValue: any) => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (e) {
      console.error(`Error parsing localStorage key "${key}":`, e);
      return defaultValue;
    }
  };

  const safeSetItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      if (e instanceof DOMException && (e.code === 22 || e.code === 1014 || e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        setIsStorageFull(true);
        console.warn(`LocalStorage quota exceeded for key "${key}". Data not saved locally.`);
      } else {
        console.error(`Error saving to localStorage key "${key}":`, e);
      }
    }
  };

  // States
  const [flashcards, setFlashcards] = useState<Flashcard[]>(() => {
    const cards = safeJsonParse('focus_flashcards', []);
    // Migrate cards without folderId to 'default'
    return cards.map((c: any) => ({ ...c, folderId: c.folderId || 'default' }));
  });
  const [flashcardFolders, setFlashcardFolders] = useState<FlashcardFolder[]>(() => {
    return safeJsonParse('focus_flashcard_folders', [
      {
        id: 'default',
        name: 'Geral',
        color: '#3B82F6',
        createdAt: Date.now(),
      },
    ]);
  });
  const [folders, setFolders] = useState<QuizFolder[]>(() => {
    return safeJsonParse('focus_folders', []);
  });
  const [attempts, setAttempts] = useState<QuizAttempt[]>(() => {
    return safeJsonParse('focus_attempts', []);
  });

  const [activeNotebookInfo, setActiveNotebookInfo] = useState<{
    folderId: string;
    notebookId: string;
  } | null>(null);
  const [guidedLessonData, setGuidedLessonData] = useState<{
    subject: string;
    topic: string;
    initialLesson?: any;
  } | null>(null);
  // Kept in sessionStorage so reloading the Aula Viva page repeats the same request.
  const [lessonDockOpen, setLessonDockOpen] = useState(false);
  const [livingLessonData, setLivingLessonData] = useState<{ subject: string; topic: string } | null>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('living_lesson_request') || 'null');
      return saved && typeof saved.subject === 'string' && typeof saved.topic === 'string' ? saved : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    try {
      if (livingLessonData) sessionStorage.setItem('living_lesson_request', JSON.stringify(livingLessonData));
    } catch { /* storage unavailable: lesson still works, just not after reload */ }
  }, [livingLessonData]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>(() => {
    return safeJsonParse('focus_activities', []);
  });
  const [history, setHistory] = useState<DailyHistory>(() => {
    return safeJsonParse('focus_history', {});
  });

  const [focusSettings, setFocusSettings] = useState<FocusSettings>(() => {
    return safeJsonParse('focus_settings', {
      waterReminder: true,
      waterInterval: 45,
      medicationReminder: false,
      medicationTime: '08:00',
      workTransition: true,
      workStartTime: '09:00',
      prepTime: 15,
    });
  });

  const [studyPlan, setStudyPlan] = useState<StudyPlan>(() => {
    return safeJsonParse('focus_studyplan', {
      subjects: [],
      dailyGoalMinutes: 120,
      sessions: [],
    });
  });

  const [stats, setStats] = useState<UserStats>(() => {
    return safeJsonParse('focus_stats', {
      name: 'Peixe Focado',
      avatarColor: '#facc15',
      level: 1,
      xp: 0,
      coins: 0,
      streak: 0,
      totalDaysStudied: 0,
      studyProfile: undefined,
      explanationStyle: 'Explique de forma técnica e exaustiva com mapeamento lógico passo a passo.',
    });
  });

  const [editalConfig, setEditalConfig] = useState<EditalConfig>(() => {
    return safeJsonParse('focus_edital', {
      isActive: false,
      subjects: [],
      examDate: '',
      dailyHours: 4,
    });
  });

  const [smartSystem, setSmartSystem] = useState<SmartRevisionSystem>(() => {
    return safeJsonParse('focus_smart_system', { queue: [], vault: [] });
  });

  const [socialState, setSocialState] = useState<SocialState>(() => {
    return safeJsonParse('focus_social_state', {
      myFriends: [],
      pendingRequests: [],
      chats: {},
      myId: Math.random().toString(36).substr(2, 6).toUpperCase(),
    });
  });

  const [studyCycle, setStudyCycle] = useState<StudyCycle | null>(() => {
    return safeJsonParse('focus_studycycle', null);
  });

  const [notes, setNotes] = useState<HandwrittenNote[]>(() => {
    return safeJsonParse('focus_notes', []);
  });

  const [noteFolders, setNoteFolders] = useState<NoteFolder[]>(() => {
    return safeJsonParse('focus_note_folders', []);
  });

  const [isAIEnabled, setIsAIEnabled] = useState<boolean>(() => {
    return safeJsonParse('focus_ai_enabled', true);
  });

  const [strategicMode, setStrategicMode] = useState(false);

  const [prefillAI, setPrefillAI] = useState<{
    topic: string;
    autoStart: boolean;
  } | null>(null);
  const [prefillQuiz, setPrefillQuiz] = useState<string | null>(null);

  const getPendingRevisionsCount = () => {
    const todayStr = toLocalDateKey();
    return smartSystem.queue.filter((item) => item.status === 'PENDING' && item.scheduledDate <= todayStr).length;
  };

  const pendingRevisionCount = getPendingRevisionsCount();
  const showRevisionNotice = STUDY_VIEWS.includes(currentView) && pendingRevisionCount > 0 && !isRevisionNoticeDismissed;

  // States for Sidebar Navigation
  const [tdhQuestionSession, setTDHQuestionSession] = useState(false);
  const isQuestionSession = currentView === 'QUIZ_PLAYER' || (currentView === 'TDH_QUESTOES' && tdhQuestionSession);
  // Reading/writing views (Aula Viva, Vade Mecum, notebooks): no mascot over the text, compact header, collapsed timer.
  const isFocusLesson = currentView === 'LIVING_LESSON' || currentView === 'VADE_MECUM' || currentView === 'DIGITAL_NOTEBOOK' || currentView === 'NOTES';
  useEffect(() => {
    if (!isFocusLesson) setLessonDockOpen(false);
  }, [isFocusLesson]);
  const [materialsSelectedFolderId, setMaterialsSelectedFolderId] = useState<string | null>(null);
  const [materialsSelectedNotebookId, setMaterialsSelectedNotebookId] = useState<string | null>(null);
  const [flashcardsSelectedFolderId, setFlashcardsSelectedFolderId] = useState<string | null>(null);
  const [flashcardsViewMode, setFlashcardsViewMode] = useState<'FOLDERS' | 'FOLDER_DETAIL' | 'REVIEW'>('FOLDERS');

  // The opening screen waits for a chain of Firestore reads. When Firestore does not answer (503, billing, offline) that chain never
  // ends and the app stayed on the splash forever: let go after 8 s. isSyncing stays true meanwhile, so nothing is written back to the cloud.
  useEffect(() => {
    if (!isInitializing) return undefined;
    const timer = setTimeout(() => setIsInitializing(false), 8000);
    return () => clearTimeout(timer);
  }, [isInitializing]);

  // Authentication and Data Loading
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Independent of the rest of this sync — a failed/denied admin check
        // shouldn't block the user's own data from loading.
        checkIsAdmin(firebaseUser.uid)
          .then(setIsAdmin)
          .catch(() => setIsAdmin(false));
        setIsSyncing(true);
        try {
          // Sync Stats
          const userRef = doc(db, 'users', firebaseUser.uid);
          const statsDoc = await getDoc(userRef);
          if (statsDoc.exists()) {
            setStats(statsDoc.data() as UserStats);
          }
          // First-time login (no doc yet): intentionally don't write `stats` here —
          // this effect's closure only ever sees the value from first render, so it
          // would overwrite Firestore with stale pre-session data (e.g. XP earned
          // before the user logged in). The stats-sync effect below (keyed on
          // [stats, user, isInitializing, isSyncing]) fires right after isInitializing
          // flips to false and writes the current, up-to-date stats instead.

          // Sync Edital
          const editalRef = doc(db, 'users', firebaseUser.uid, 'configs', 'edital');
          const editalDoc = await getDoc(editalRef);
          if (editalDoc.exists()) setEditalConfig(editalDoc.data() as EditalConfig);

          // Sync Quiz Folders
          const foldersRef = collection(db, 'users', firebaseUser.uid, 'quizFolders');
          const foldersSnap = await getDocs(foldersRef);
          if (!foldersSnap.empty) {
            const cloudFolders: QuizFolder[] = [];
            for (const fDoc of foldersSnap.docs) {
              const fData = fDoc.data() as any;
              // Get notebooks
              const notebooksSnap = await getDocs(collection(db, 'users', firebaseUser.uid, 'quizFolders', fDoc.id, 'notebooks'));
              const notebooks = notebooksSnap.docs.map((n) => n.data() as Notebook);
              cloudFolders.push({ ...fData, id: fDoc.id, notebooks });
            }
            // Merge instead of overwrite: cloud is the source of truth for folders
            // that exist there, but any folder that only exists locally (created
            // offline/unsynced before this login) must survive, not be discarded.
            setFolders((prevFolders) => {
              const cloudIds = new Set(cloudFolders.map((f) => f.id));
              const localOnly = prevFolders.filter((f) => !cloudIds.has(f.id));
              return [...cloudFolders, ...localOnly];
            });
          }

          // Sync Flashcards
          const cardsRef = collection(db, 'users', firebaseUser.uid, 'flashcards');
          const cardsSnap = await getDocs(cardsRef);
          if (!cardsSnap.empty) {
            const cloudCards = cardsSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as Flashcard);
            // Same merge rationale as folders above: keep local-only unsynced cards.
            setFlashcards((prevCards) => {
              const cloudIds = new Set(cloudCards.map((c) => c.id));
              const localOnly = prevCards.filter((c) => !cloudIds.has(c.id));
              return [...cloudCards, ...localOnly];
            });
          }
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.GET, 'users/initialSync');
          } catch (e) {
            console.error('Initial Sync Error (Logged & Caught):', e);
          }
        } finally {
          setIsSyncing(false);
          setIsInitializing(false);
        }
      } else {
        setIsAdmin(false);
        setIsInitializing(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    setLoginError(null);
    setIsLoginModalOpen(true);
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoginLoading(true);
    setLoginError(null);
    try {
      console.log('🔐 Tentando login com popup...');
      await signInWithPopup(auth, googleProvider);
      console.log('✅ Login OK!');
      setIsLoginModalOpen(false);
    } catch (error: any) {
      console.error('❌ Erro no login:', error?.code, error?.message);
      // Popups get silently blocked by a lot of mobile/privacy-focused browsers
      // (Brave, Safari, in-app webviews). Fall back to a full-page redirect,
      // which onAuthStateChanged picks up automatically when the user returns.
      if (['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/operation-not-supported-in-this-environment'].includes(error?.code)) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          console.error('Login failed (redirect)', redirectError);
          setLoginError('Não foi possível abrir o login agora. Tente novamente ou continue sem entrar.');
        }
      } else {
        console.error('Login failed', error);
        setLoginError(error?.code === 'auth/unauthorized-domain'
          ? `Este endereço (${window.location.hostname}) não está autorizado no Firebase Authentication. Adicione-o em Authentication → Settings → Authorized domains para entrar por este preview.`
          : error?.code === 'auth/network-request-failed'
            ? 'Verifique sua conexão e tente entrar novamente.'
            : 'Não foi possível entrar agora. Tente novamente em alguns instantes.');
      }
    } finally {
      setIsGoogleLoginLoading(false);
    }
  };

  useEffect(() => {
    if (user) setIsLoginModalOpen(false);
  }, [user]);

  const handleLogout = () => {
    auth.signOut()
      .then(() => setIsLoginModalOpen(true))
      .catch((e) => console.error('Logout failed', e));
  };

  // Helper to save sub-items to Firestore
  const saveToFirestore = async (path: string, data: any) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid, ...path.split('/')), cleanData(data));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  };
  useEffect(() => {
    // Migration for subjects without heat
    if (editalConfig.isActive && editalConfig.subjects.some((s) => s.heat === undefined)) {
      setEditalConfig((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) => ({ ...s, heat: s.heat ?? 50 })),
      }));
    }
    if (user && !isInitializing && !isSyncing) {
      saveToFirestore('configs/edital', editalConfig).catch((e) => {
        // Log is already done by handleFirestoreError inside saveToFirestore
        console.error('Background sync error (Edital):', e);
        setCloudSyncError('Não foi possível sincronizar seu edital com a nuvem. Suas alterações ficam salvas neste navegador, mas verifique sua conexão.');
      });
    }
    safeSetItem('focus_edital', JSON.stringify(editalConfig));
  }, [editalConfig, user, isInitializing, isSyncing]);

  useEffect(() => {
    if (user && !isInitializing && !isSyncing) {
      const syncCards = async () => {
        try {
          const cardsRef = collection(db, 'users', user.uid, 'flashcards');
          const existingSnap = await getDocs(cardsRef);
          const localIds = new Set(flashcards.map((c) => c.id));
          const batch = writeBatch(db);
          for (const card of flashcards) {
            const cardRef = doc(db, 'users', user.uid, 'flashcards', card.id);
            batch.set(cardRef, cleanData(card));
          }
          // Delete cards that exist in Firestore but were removed locally —
          // otherwise a deleted flashcard resurrects on the next login/device.
          for (const existingDoc of existingSnap.docs) {
            if (!localIds.has(existingDoc.id)) {
              batch.delete(existingDoc.ref);
            }
          }
          await batch.commit();
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'users/flashcardsBatch');
        }
      };
      syncCards().catch((e) => {
        console.error('Background sync error (Flashcards):', e);
        setCloudSyncError('Não foi possível sincronizar seus flashcards com a nuvem. Suas alterações ficam salvas neste navegador, mas verifique sua conexão.');
      });
    }
    safeSetItem('focus_flashcards', JSON.stringify(flashcards));
  }, [flashcards, user, isInitializing, isSyncing]);

  useEffect(() => {
    safeSetItem('focus_flashcard_folders', JSON.stringify(flashcardFolders));
  }, [flashcardFolders]);

  useEffect(() => {
    if (user && !isInitializing && !isSyncing) {
      const syncFolders = async () => {
        try {
          const foldersRef = collection(db, 'users', user.uid, 'quizFolders');
          const existingFoldersSnap = await getDocs(foldersRef);
          const localFolderIds = new Set(folders.map((f) => f.id));
          const batch = writeBatch(db);

          for (const folder of folders) {
            const folderRef = doc(db, 'users', user.uid, 'quizFolders', folder.id);
            const { notebooks, ...folderMeta } = folder;
            batch.set(folderRef, cleanData(folderMeta));

            const notebooksRef = collection(db, 'users', user.uid, 'quizFolders', folder.id, 'notebooks');
            const existingNotebooksSnap = await getDocs(notebooksRef);
            const localNotebookIds = new Set(notebooks.map((n) => n.id));
            for (const notebook of notebooks) {
              const notebookRef = doc(db, 'users', user.uid, 'quizFolders', folder.id, 'notebooks', notebook.id);
              batch.set(notebookRef, cleanData(notebook));
            }
            // Delete notebooks removed locally from this folder.
            for (const existingNotebookDoc of existingNotebooksSnap.docs) {
              if (!localNotebookIds.has(existingNotebookDoc.id)) {
                batch.delete(existingNotebookDoc.ref);
              }
            }
          }

          // Delete folders (and their notebooks) removed locally — otherwise a
          // deleted folder resurrects on the next login/device.
          for (const existingFolderDoc of existingFoldersSnap.docs) {
            if (!localFolderIds.has(existingFolderDoc.id)) {
              batch.delete(existingFolderDoc.ref);
              const orphanNotebooksSnap = await getDocs(collection(db, 'users', user.uid, 'quizFolders', existingFolderDoc.id, 'notebooks'));
              for (const nb of orphanNotebooksSnap.docs) {
                batch.delete(nb.ref);
              }
            }
          }

          await batch.commit();
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'users/quizFoldersBatch');
        }
      };
      syncFolders().catch((e) => {
        console.error('Background sync error (QuizFolders):', e);
        setCloudSyncError('Não foi possível sincronizar suas pastas de quiz com a nuvem. Suas alterações ficam salvas neste navegador, mas verifique sua conexão.');
      });
    }
    safeSetItem('focus_folders', JSON.stringify(folders));
  }, [folders, user, isInitializing, isSyncing]);

  useEffect(() => {
    safeSetItem('focus_attempts', JSON.stringify(attempts));
  }, [attempts]);

  useEffect(() => {
    safeSetItem('focus_activities', JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    safeSetItem('focus_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    safeSetItem('focus_settings', JSON.stringify(focusSettings));
  }, [focusSettings]);

  useEffect(() => {
    // Migration for studyPlan schedule
    if (studyPlan && !studyPlan.schedule) {
      setStudyPlan((prev) => ({ ...prev, schedule: [] }));
    }
    safeSetItem('focus_studyplan', JSON.stringify(studyPlan));
  }, [studyPlan]);

  useEffect(() => {
    if (user && !isInitializing && !isSyncing) {
      setDoc(doc(db, 'users', user.uid), cleanData(stats)).catch((e) => {
        try {
          handleFirestoreError(e, OperationType.WRITE, 'users/profile');
        } catch (err) {
          console.error('Background sync error (Profile):', err);
          setCloudSyncError('Não foi possível sincronizar seu progresso (XP/moedas) com a nuvem. Verifique sua conexão.');
        }
      });
    }
    safeSetItem('focus_stats', JSON.stringify(stats));
  }, [stats, user, isInitializing, isSyncing]);

  useEffect(() => {
    safeSetItem('focus_smart_system', JSON.stringify(smartSystem));
  }, [smartSystem]);

  useEffect(() => {
    safeSetItem('focus_social_state', JSON.stringify(socialState));
  }, [socialState]);

  useEffect(() => {
    if (!user) return;
    syncPublicProfile(user.uid, {
      name: stats.name,
      avatarColor: stats.avatarColor,
      characterId: stats.characterId,
      level: stats.level,
      xp: stats.xp,
      status: globalTimerActive ? 'STUDYING' : 'ONLINE',
    }).catch(() => {});
  }, [user, stats.name, stats.avatarColor, stats.characterId, stats.level, stats.xp, globalTimerActive]);

  useEffect(() => {
    safeSetItem('focus_studycycle', JSON.stringify(studyCycle));
  }, [studyCycle]);

  useEffect(() => {
    safeSetItem('focus_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    safeSetItem('focus_note_folders', JSON.stringify(noteFolders));
  }, [noteFolders]);

  useEffect(() => {
    safeSetItem('focus_ai_enabled', JSON.stringify(isAIEnabled));
  }, [isAIEnabled]);

  // Due flashcards count
  const dueFlashcardsCount = useMemo(() => {
    const now = Date.now();
    return flashcards.filter((f) => !f.nextReview || f.nextReview <= now).length;
  }, [flashcards]);

  // Audio Effects
  useEffect(() => {
    if (relaxAudioRef.current) relaxAudioRef.current.pause();
    if (mpbAudioRef.current) mpbAudioRef.current.pause();

    if (activeChannel === 'RELAX' && relaxAudioRef.current) {
      relaxAudioRef.current.play().catch(() => {});
    } else if (activeChannel === 'MPB' && mpbAudioRef.current) {
      mpbAudioRef.current.play().catch(() => {});
    }
  }, [activeChannel]);

  useEffect(() => {
    if (rainAudioRef.current) {
      if (isPlayingRain) rainAudioRef.current.play().catch(() => {});
      else rainAudioRef.current.pause();
    }
  }, [isPlayingRain]);

  useEffect(() => {
    if (relaxAudioRef.current) relaxAudioRef.current.volume = audioVolume;
    if (mpbAudioRef.current) mpbAudioRef.current.volume = audioVolume;
    if (rainAudioRef.current) rainAudioRef.current.volume = audioVolume * 0.6;
  }, [audioVolume]);

  // Global Clock
  useEffect(() => {
    let interval: any;
    if (globalTimerActive && globalTimerSeconds > 0) {
      interval = setInterval(() => {
        setGlobalTimerSeconds((s) => s - 1);
      }, 1000);
    } else if (globalTimerSeconds === 0 && globalTimerActive) {
      setGlobalTimerActive(false);
      logStudyMinutes(timerMode === TimerMode.EMERGENCY ? 5 : 25);
    }
    return () => clearInterval(interval);
  }, [globalTimerActive, globalTimerSeconds]);

  const addXP = (amount: number) => {
    setStats((prev) => {
      const newXP = prev.xp + amount;
      const newLevel = Math.floor(newXP / 1000) + 1;
      return { ...prev, xp: newXP, level: newLevel };
    });
  };

  // Monitor for level up to post notification
  useEffect(() => {
    const lastLevel = safeJsonParse('focus_last_notified_level', 1);
    if (stats.level > lastLevel) {
      // Post notification WITHOUT giving XP to avoid potential recursion
      const newActivity: Activity = {
        id: Math.random().toString(36).substr(2, 9),
        userName: stats.name,
        avatarColor: stats.avatarColor,
        subject: `Subiu para o nível ${stats.level}! O cardume está orgulhoso.`,
        duration: 0,
        type: 'STATUS',
        timestamp: Date.now(),
        bubbles: 0,
      };
      setActivities((prev) => [newActivity, ...prev]);
      safeSetItem('focus_last_notified_level', stats.level.toString());
    }
  }, [stats.level, stats.name, stats.avatarColor]);

  const addCoins = (amount: number) => {
    setStats((prev) => ({ ...prev, coins: prev.coins + amount }));
  };

  const getSubjectForTopic = (topic: string): string | null => {
    if (!editalConfig.isActive) return null;
    const lowerTopic = topic.toLowerCase();

    // Check direct match
    const subject = editalConfig.subjects.find((s) => s.name.toLowerCase().includes(lowerTopic) || s.topics.some((t) => t.toLowerCase().includes(lowerTopic) || lowerTopic.includes(t.toLowerCase())));

    return subject ? subject.name : null;
  };

  const logStudyMinutes = (minutes: number) => {
    const today = toLocalDateKey();
    setHistory((prev) => ({ ...prev, [today]: (prev[today] || 0) + minutes }));
    addXP(minutes * 2);

    // Update Edital Heat if applicable
    if (activeSubjectId) {
      const subj = studyPlan.subjects.find((s) => s.id === activeSubjectId);
      if (subj) updateHeat(subj.name, minutes / 2); // 1 heat per 2 mins
    } else if (prefillAI?.topic) {
      const mappedSubject = getSubjectForTopic(prefillAI.topic);
      if (mappedSubject) updateHeat(mappedSubject, minutes / 2);
    }

    const newActivity: Activity = {
      id: Math.random().toString(36).substr(2, 9),
      userName: stats.name,
      avatarColor: stats.avatarColor,
      subject: activeSubjectId ? studyPlan.subjects.find((s) => s.id === activeSubjectId)?.name || 'Estudo' : 'Mergulho de Foco',
      duration: minutes,
      type: timerMode === TimerMode.EMERGENCY ? 'EMERGENCY' : 'POMODORO',
      timestamp: Date.now(),
      bubbles: 0,
    };
    setActivities((prev) => [newActivity, ...prev]);
  };

  const handleManualPost = (text: string) => {
    const newActivity: Activity = {
      id: Math.random().toString(36).substr(2, 9),
      userName: stats.name,
      avatarColor: stats.avatarColor,
      subject: text,
      duration: 0,
      type: 'STATUS',
      timestamp: Date.now(),
      bubbles: 0,
    };
    setActivities((prev) => [newActivity, ...prev]);
    addXP(10);
  };

  const scheduleRevision = (topic: string, subjectName: string) => {
    const d1Date = addLocalDays(new Date(), 1);

    const d1: SmartRevisionItem = {
      id: Math.random().toString(36).substr(2, 9),
      topic,
      subjectName,
      scheduledDate: d1Date,
      intervalLevel: 1, // 1st Revision (scheduled within 24h)
      status: 'PENDING',
      createdAt: Date.now(),
    };

    setSmartSystem((prev) => ({
      ...prev,
      queue: [...prev.queue.filter((i) => !(i.topic === topic && i.subjectName === subjectName && i.status === 'PENDING')), d1],
    }));
  };

  const handleSmartComplete = (itemId: string, success: boolean) => {
    setSmartSystem((prev) => {
      const item = prev.queue.find((i) => i.id === itemId);
      if (!item) return prev;

      const newQueue = prev.queue.filter((i) => i.id !== itemId);

      if (success) {
        // Schedule next interval according to 24/7/30 Rule:
        // 1st Revision (1) -> 2nd Revision (7) in 7 days
        // 2nd Revision (7) -> 3rd Revision (30) in 30 days
        // 3rd Revision (30) -> Completed (0)
        // Backwards compatibility included (0->1, 3->7, 15->30)
        const intervals: Record<number, number> = {
          0: 1,
          1: 7,
          3: 7,
          7: 30,
          15: 30,
          30: 0,
        };
        const nextInterval = intervals[item.intervalLevel] || 0;

        if (nextInterval > 0) {
          const newItem: SmartRevisionItem = {
            ...item,
            id: Math.random().toString(36).substr(2, 9),
            intervalLevel: nextInterval as any,
            scheduledDate: addLocalDays(new Date(), nextInterval),
            status: 'PENDING',
            createdAt: Date.now(),
          };
          newQueue.push(newItem);
        }
        updateHeat(item.subjectName, 10);
      } else {
        // Re-schedule 1st Revision (Day 1) tomorrow
        const retryItem: SmartRevisionItem = {
          ...item,
          id: Math.random().toString(36).substr(2, 9),
          intervalLevel: 1,
          scheduledDate: addLocalDays(new Date(), 1),
          status: 'PENDING',
          createdAt: Date.now(),
        };
        newQueue.push(retryItem);
        updateHeat(item.subjectName, -5);
      }

      return { ...prev, queue: newQueue };
    });
  };

  const logErrorToVault = (topic: string, subjectName: string, missedQuestions?: QuizQuestion[]) => {
    setSmartSystem((prev) => {
      const existing = prev.vault.find((v) => v.topic === topic && v.subjectName === subjectName && !v.resolved);
      if (existing) {
        return {
          ...prev,
          vault: prev.vault.map((v) =>
            v.id === existing.id
              ? {
                  ...v,
                  errorCount: v.errorCount + 1,
                  lastErrorDate: Date.now(),
                  isStuck: v.errorCount + 1 >= 3,
                  missedQuestions: missedQuestions || v.missedQuestions,
                }
              : v,
          ),
        };
      } else {
        const newItem: ErrorVaultItem = {
          id: Math.random().toString(36).substr(2, 9),
          topic,
          subjectName,
          errorCount: 1,
          lastErrorDate: Date.now(),
          isStuck: false,
          resolved: false,
          missedQuestions,
        };
        return { ...prev, vault: [...prev.vault, newItem] };
      }
    });

    updateHeat(subjectName, -15);
  };

  const resolveVault = (vaultId: string, recoveryFlashcards?: any[]) => {
    setSmartSystem((prev) => ({
      ...prev,
      vault: prev.vault.map((v) => (v.id === vaultId ? { ...v, resolved: true } : v)),
    }));

    // If recovery cards provided, add them to a "Resgate" folder or general
    if (recoveryFlashcards && recoveryFlashcards.length > 0) {
      const v = smartSystem.vault.find((v) => v.id === vaultId);
      const newFlashcards: Flashcard[] = recoveryFlashcards.map((rf) => ({
        id: Math.random().toString(36).substr(2, 9),
        type: 'SIMPLE',
        question: rf.question,
        answer: rf.answer,
        explanation: rf.explanation || '',
        topic: v?.topic || 'Recuperação',
        interval: 1,
        easeFactor: 2.5,
        reviewsCount: 0,
        nextReview: Date.now() + 86400000, // Review tomorrow
      }));
      setFlashcards((prev) => [...prev, ...newFlashcards]);
      handleManualPost(`IA programou ${recoveryFlashcards.length} cards de resgate para "${v?.topic}"!`);
    }

    // When resolved, add back to queue at Day 1
    const v = smartSystem.vault.find((v) => v.id === vaultId);
    if (v) scheduleRevision(v.topic, v.subjectName);
  };

  const updateHeat = (subjectName: string, amount: number) => {
    setEditalConfig((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) => {
        if (s.name !== subjectName) return s;
        const newHeat = Math.min(100, Math.max(0, (s.heat || 0) + amount));
        return { ...s, heat: newHeat, lastActivity: Date.now() };
      }),
    }));
  };

  const handleSaveToNotebook = (folderId: string, notebookName: string, questions: QuizQuestion[], summary?: string, notebookColor?: string, folderColor?: string) => {
    let targetFolderId = folderId;

    setFolders((prev) => {
      let currentFolders = [...prev];

      // Handle NEW folder creation
      if (folderId.startsWith('NEW:')) {
        const newName = folderId.replace('NEW:', '');
        const newFolder: QuizFolder = {
          id: Math.random().toString(36).substr(2, 9),
          name: newName,
          color: folderColor || '#f4ad2d',
          topic: newName,
          notebooks: [],
          createdAt: Date.now(),
        };
        currentFolders.push(newFolder);
        targetFolderId = newFolder.id;
      }

      return currentFolders.map((f) => {
        if (f.id !== targetFolderId) return f;
        const existingNotebook = f.notebooks.find((n) => n.name.toLowerCase() === notebookName.toLowerCase());
        if (existingNotebook) {
          return {
            ...f,
            notebooks: f.notebooks.map((n) =>
              n.id === existingNotebook.id
                ? {
                    ...n,
                    color: notebookColor || n.color,
                    questions: [...n.questions, ...questions],
                    summary: summary || n.summary,
                  }
                : n,
            ),
          };
        } else {
          const newNotebook: Notebook = {
            id: Math.random().toString(36).substr(2, 9),
            name: notebookName,
            color: notebookColor || '#f97316',
            questions,
            summary,
            createdAt: Date.now(),
          };
          return { ...f, notebooks: [...f.notebooks, newNotebook] };
        }
      });
    });
  };

  // TDH Questões só filtra/gera as questões; responder e estudar acontece em
  // Meus Materiais (QuizPlayer). O aluno escolhe pasta (existente ou nova,
  // via o mesmo sentinel "NEW:<nome>" do SaveToFolderModal/handleSaveToNotebook)
  // e nome do caderno no próprio TDHQuestoes; aqui só resolvemos esse destino
  // e já abrimos o QuizPlayer nele, sem passar pela tela de prática que
  // existia dentro do TDHQuestoes.
  const handleStartFilteredQuiz = (topic: string, subject: string | undefined, questions: QuizQuestion[], folderId: string, notebookName: string, notebookColor?: string, folderColor?: string) => {
    if (!questions.length) return;
    const isNewFolder = folderId.startsWith('NEW:');
    const newFolderName = isNewFolder ? folderId.replace('NEW:', '') : null;
    const existingFolder = isNewFolder ? undefined : folders.find((f) => f.id === folderId);
    const targetFolderId = isNewFolder ? Math.random().toString(36).substr(2, 9) : folderId;
    const existingNotebook = existingFolder?.notebooks.find((n) => n.name.toLowerCase() === notebookName.toLowerCase());
    const notebookId = existingNotebook ? existingNotebook.id : Math.random().toString(36).substr(2, 9);
    const newNotebook: Notebook = {
      id: notebookId,
      name: notebookName,
      color: notebookColor || existingNotebook?.color || existingFolder?.color || '#f97316',
      questions,
      createdAt: Date.now(),
    };

    setFolders((prev) => {
      if (isNewFolder) {
        return [...prev, { id: targetFolderId, name: newFolderName!, color: folderColor || '#f4ad2d', topic: newFolderName!, notebooks: [newNotebook], createdAt: Date.now() }];
      }
      return prev.map((f) => {
        if (f.id !== targetFolderId) return f;
        if (existingNotebook) {
          return { ...f, notebooks: f.notebooks.map((n) => (n.id === existingNotebook.id ? { ...n, color: notebookColor || n.color, questions: [...n.questions, ...questions] } : n)) };
        }
        return { ...f, notebooks: [...f.notebooks, newNotebook] };
      });
    });

    setActiveNotebookInfo({ folderId: targetFolderId, notebookId });
    setCurrentView('QUIZ_PLAYER');
  };

  const handleUpdateQuestions = (folderId: string, notebookId: string, questions: QuizQuestion[]) => {
    setFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        return {
          ...f,
          notebooks: f.notebooks.map((n) => (n.id === notebookId ? { ...n, questions } : n)),
        };
      }),
    );
  };

  const handleMoveQuestion = (questionId: string, sourceFolderId: string, sourceNotebookId: string, targetFolderId: string, targetNotebookId: string) => {
    setFolders((prev) => {
      let questionToMove: QuizQuestion | undefined;
      const newFolders = prev.map((f) => {
        if (f.id === sourceFolderId) {
          return {
            ...f,
            notebooks: f.notebooks.map((n) => {
              if (n.id === sourceNotebookId) {
                questionToMove = n.questions.find((q) => q.id === questionId);
                return {
                  ...n,
                  questions: n.questions.filter((q) => q.id !== questionId),
                };
              }
              return n;
            }),
          };
        }
        return f;
      });

      if (!questionToMove) return prev;

      return newFolders.map((f) => {
        if (f.id === targetFolderId) {
          return {
            ...f,
            notebooks: f.notebooks.map((n) => {
              if (n.id === targetNotebookId) {
                return { ...n, questions: [...n.questions, questionToMove!] };
              }
              return n;
            }),
          };
        }
        return f;
      });
    });
  };

  const handleMoveAllQuestions = (sourceNotebookId: string, sourceFolderId: string, targetNotebookId: string, targetFolderId: string) => {
    setFolders((prev) => {
      let questionsToMove: QuizQuestion[] = [];
      const newFolders = prev.map((f) => {
        if (f.id === sourceFolderId) {
          return {
            ...f,
            notebooks: f.notebooks.map((n) => {
              if (n.id === sourceNotebookId) {
                questionsToMove = [...n.questions];
                return { ...n, questions: [] };
              }
              return n;
            }),
          };
        }
        return f;
      });

      if (questionsToMove.length === 0) return prev;

      return newFolders.map((f) => {
        if (f.id === targetFolderId) {
          return {
            ...f,
            notebooks: f.notebooks.map((n) => {
              if (n.id === targetNotebookId) {
                return {
                  ...n,
                  questions: [...n.questions, ...questionsToMove],
                };
              }
              return n;
            }),
          };
        }
        return f;
      });
    });
  };

  const handleCloseGlobalBar = () => {
    setGlobalTimerActive(false);
    setActiveChannel(null);
    setIsPlayingRain(false);
    setShowGlobalBar(false);
  };

  const finishInitialization = useCallback(() => {
    setSplashDone(true);
  }, []);

  if (isInitializing || !splashDone)
    return (
      <>
        <SplashScreen onComplete={finishInitialization} />
        <BuildTag />
      </>
    );
  if (isProfilePreview)
    return (
      <>
        <ProfileSelection onNext={() => undefined} />
        <BuildTag />
      </>
    );
  if (isAvatarPreview)
    return (
      <>
        <AvatarBuilder
          initialCharacterId={stats.characterId}
          confirmLabel="Prévia do personagem"
          onSave={() => undefined}
          onClose={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('previewAvatar');
            window.location.assign(`${url.pathname}${url.search}${url.hash}`);
          }}
        />
        <BuildTag />
      </>
    );
  if (!stats.studyProfile)
    return (
      <>
        <OnboardingFlow
          onComplete={({ name, studyProfile, characterId }) => {
            const defaultStyles = {
              VESTIBULAR: 'Explique de forma didática e interdisciplinar, como nos grandes vestibulares. Use analogias com a vida real e foque na base do conhecimento.',
              CONCURSO: 'Explique de forma exaustiva, técnica e analítica. Use cabeçalhos para Passo a Passo, Embasamento Legal, Por que a certa está certa e por que as outras estão erradas.',
            };
            setStats((prev) => ({
              ...prev,
              name,
              characterId,
              studyProfile,
              explanationStyle: defaultStyles[studyProfile],
            }));
          }}
        />
        <BuildTag />
      </>
    );

  const formatMiniTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <CharacterProvider characterId={stats.characterId}>
      <div className="min-h-screen w-screen bg-[#E8DDCC] dark:bg-[#141110] p-2 lg:p-5 flex">
      <div className="flex w-full h-[calc(100vh-16px)] lg:h-[calc(100vh-40px)] bg-[#FDFBF7] dark:bg-[#1c1712] text-[#473c33] dark:text-[#f4ebdd] overflow-hidden rounded-[24px] lg:rounded-[32px] shadow-2xl dark:shadow-none">
        <div className="hidden lg:block shrink-0">
          <Sidebar
            currentView={currentView}
            questionSession={isQuestionSession}
            setView={(v) => {
              setCurrentView(v);
              if (v === 'MATERIALS') {
                setMaterialsSelectedFolderId(null);
                setMaterialsSelectedNotebookId(null);
              }
              if (v === 'FLASHCARDS') {
                setFlashcardsSelectedFolderId(null);
                setFlashcardsViewMode('FOLDERS');
              }
            }}
            quizFolders={folders}
            flashcardFolders={flashcardFolders}
            stats={stats}
            onSelectNotebook={(fid, nid) => {
              setMaterialsSelectedFolderId(fid);
              setMaterialsSelectedNotebookId(nid);
              setCurrentView('MATERIALS');
            }}
            onSelectFlashcardFolder={(fid) => {
              setFlashcardsSelectedFolderId(fid);
              setFlashcardsViewMode('FOLDER_DETAIL');
              setCurrentView('FLASHCARDS');
            }}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode((v) => !v)}
          />
        </div>

        {/* A transformed pane contains fixed quiz headers, dialogs and progress bars within the space beside the sidebar. */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative" style={isQuestionSession ? { transform: 'translateZ(0)' } : undefined}>
          {cloudSyncError && (
            <div className="shrink-0 z-[200] bg-red-500 text-white text-xs font-bold px-4 py-2 flex items-center justify-between gap-3">
              <span>⚠️ {cloudSyncError}</span>
              <button onClick={() => setCloudSyncError(null)} className="shrink-0 opacity-80 hover:opacity-100 font-black px-2" title="Dispensar aviso">
                ✕
              </button>
            </div>
          )}
          {!isQuestionSession && <header className="shrink-0 z-50">
            <Header stats={stats} onLogoClick={() => setCurrentView('HUB')} isAIEnabled={isAIEnabled} isDarkMode={isDarkMode} compact={isFocusLesson} />
          </header>}

          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            <audio ref={relaxAudioRef} src={LOFI_RELAX_URL} loop />
            <audio ref={mpbAudioRef} src={MPB_LOFI_URL} loop />
            <audio ref={rainAudioRef} src={RAIN_SOUND_URL} loop />

            {showGlobalBar && isFocusLesson && !lessonDockOpen && (
              <button
                type="button"
                onClick={() => setLessonDockOpen(true)}
                aria-label="Abrir relógio e sons"
                className="fixed right-4 z-[150] flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#cfc9a2] bg-white/95 text-xs font-black tabular-nums text-[#473c33] shadow-xl backdrop-blur-xl dark:border-white/20 dark:bg-[#2d2e27] dark:text-[#f2efd2]"
                style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
              >
                {formatMiniTime(globalTimerSeconds)}
              </button>
            )}
            {showGlobalBar && isFocusLesson && lessonDockOpen && (
              <button
                type="button"
                onClick={() => setLessonDockOpen(false)}
                className="fixed right-4 z-[151] min-h-[44px] rounded-full bg-[#e96f34] px-4 text-xs font-black uppercase tracking-wide text-white shadow-lg"
                style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))' }}
              >
                Recolher relógio
              </button>
            )}
            {showGlobalBar && !isQuestionSession && (!isFocusLesson || lessonDockOpen) && (
              <div className="fixed left-1/2 -translate-x-1/2 z-[150] w-[95%] max-w-2xl animate-in slide-in-from-bottom-8 duration-500" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
                {isStorageFull && !user && <div className="bg-red-500 text-white text-[10px] font-black uppercase tracking-widest py-1 px-4 rounded-t-xl mb-[-10px] mx-auto w-fit shadow-lg animate-bounce">⚠️ Memória do Navegador Cheia! Entre com o Google para salvar na nuvem</div>}
                <div className="bg-white/90 backdrop-blur-xl border border-white shadow-2xl rounded-[35px] p-2 flex items-center justify-between gap-3 relative">
                  <button onClick={handleCloseGlobalBar} className="absolute -top-3 -right-3 w-8 h-8 bg-white shadow-md border border-gray-100 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 transition-all hover:scale-110 z-20" title="Parar atividades e fechar">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <div className="flex items-center gap-1 bg-gray-50/50 p-1 rounded-[25px]">
                    <button onClick={() => setActiveChannel(activeChannel === 'RELAX' ? null : 'RELAX')} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${activeChannel === 'RELAX' ? 'bg-[#fed386] text-white shadow-lg' : 'text-gray-400 hover:bg-gray-100'}`} title="Lofi Relax">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </button>
                    <button onClick={() => setIsPlayingRain(!isPlayingRain)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isPlayingRain ? 'bg-[#fecc73] text-white shadow-lg' : 'text-gray-400 hover:bg-gray-100'}`} title="Chuva de Fundo">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-1 flex items-center justify-center gap-4 bg-gray-50/50 p-1 rounded-[25px]">
                    <button onClick={() => setCurrentView('TIMER')} className="flex flex-col items-center hover:opacity-70 transition-opacity">
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">{timerMode}</span>
                      <span className="text-xl font-black tabular-nums leading-none">{formatMiniTime(globalTimerSeconds)}</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setGlobalTimerActive(!globalTimerActive)} className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${globalTimerActive ? 'bg-red-500 text-white' : 'bg-[#b1c77b] text-white'}`}>
                        {globalTimerActive ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pr-2">
                    <input type="range" min="0" max="1" step="0.01" value={audioVolume} onChange={(e) => setAudioVolume(parseFloat(e.target.value))} className="w-12 h-1 accent-[#fed386] hidden sm:block opacity-40 hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            )}

            <main className="max-w-[1400px] min-h-full mx-auto px-4 pt-8 relative" style={{ paddingBottom: showGlobalBar && !isQuestionSession && !isFocusLesson ? 'calc(10rem + env(safe-area-inset-bottom, 0px))' : '2rem' }}>
              {showRevisionNotice && (
                <aside role="status" className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#e5d7bd] bg-[#fff8ec] px-4 py-3 text-[#473c33] shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-[#65533d] dark:bg-[#2b241b] dark:text-[#f4ebdd]">
                  <p className="text-sm font-semibold">
                    <span className="font-black">{pendingRevisionCount} {pendingRevisionCount === 1 ? 'revisão pendente' : 'revisões pendentes'}.</span>{' '}
                    Você pode revisar agora ou continuar estudando.
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => setCurrentView('SMART_REVISION')} className="rounded-xl bg-[#e96f34] px-4 py-2 text-xs font-black text-white transition hover:bg-[#d8612b]">
                      Abrir revisão
                    </button>
                    <button onClick={() => setIsRevisionNoticeDismissed(true)} aria-label="Dispensar aviso de revisão" className="rounded-xl px-3 py-2 text-xs font-bold text-[#725442] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e96f34] dark:text-[#d8c8b2] dark:hover:bg-white/10">
                      Agora não
                    </button>
                  </div>
                </aside>
              )}

              <>
                <Suspense fallback={<div role="status" className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-sm font-bold text-[#725442] dark:text-[#c2b6a6]"><span className="h-8 w-8 animate-spin rounded-full border-4 border-[#e96f34]/20 border-t-[#e96f34]" aria-hidden="true" />Carregando ferramenta…</div>}>
                  {currentView === 'HUB' && (
                    <Hub
                      setView={setCurrentView}
                      setTimerMode={(mode) => {
                        setTimerMode(mode);
                        setGlobalTimerSeconds(mode === TimerMode.EMERGENCY ? 300 : 1500);
                        setShowGlobalBar(true);
                      }}
                      flashcardCount={dueFlashcardsCount}
                      stats={stats}
                      activeChannel={activeChannel}
                      setActiveChannel={setActiveChannel}
                      isPlayingRain={isPlayingRain}
                      setIsPlayingRain={setIsPlayingRain}
                      editalConfig={editalConfig}
                      setStrategicMode={setStrategicMode}
                      setGuidedLessonData={setGuidedLessonData}
                      setLivingLessonData={setLivingLessonData}
                      smartRevisionItems={smartSystem.queue}
                      isAIEnabled={isAIEnabled}
                      user={user}
                      onLogin={handleLogin}
                      isSyncing={isSyncing}
                      attempts={attempts}
                      folders={folders}
                      smartSystem={smartSystem}
                      isAdmin={isAdmin}
                    />
                  )}

                  {currentView === 'ADMIN_QUESTION_REVIEW' && user && <AdminQuestionReview uid={user.uid} onBack={() => setCurrentView('HUB')} />}

                  {currentView === 'VR_METHOD' && <VRMethodView uid={user?.uid ?? null} onBack={() => setCurrentView('HUB')} />}

                  {currentView === 'TIMER' && <TimerView isActive={globalTimerActive} setIsActive={setGlobalTimerActive} seconds={globalTimerSeconds} setSeconds={setGlobalTimerSeconds} mode={timerMode} onBack={() => setCurrentView('HUB')} onComplete={() => logStudyMinutes(timerMode === TimerMode.EMERGENCY ? 5 : 25)} />}

                  {currentView === 'AI_DIRECT' && (
                    <AIView
                      onBack={() => {
                        setCurrentView('HUB');
                        setStrategicMode(false);
                      }}
                      folders={folders}
                      onSaveToNotebook={handleSaveToNotebook}
                      studyProfile={stats.studyProfile!}
                      explanationStyle={stats.explanationStyle}
                      onNewContent={(c) => {
                        const cards = c.flashcards.map((f: any) => ({
                          id: Math.random().toString(36).substr(2, 9),
                          ...f,
                          nextReview: Date.now(),
                          interval: 0,
                          easeFactor: 2.5,
                          reviewsCount: 0,
                        }));
                        setFlashcards((prev) => [...prev, ...cards]);
                        if (cards.length > 0) handleManualPost(`Gerou ${cards.length} flashcards sobre "${c.topic || 'seu tema'}"!`);
                        if (strategicMode && c.topic) {
                          const [subject, theme] = c.topic.includes(':') ? c.topic.split(':').map((s: string) => s.trim()) : ['', c.topic];
                          scheduleRevision(theme, subject);
                        }
                      }}
                      prefill={prefillAI}
                      onConsumedPrefill={() => setPrefillAI(null)}
                      strategicMode={strategicMode}
                      editalConfig={editalConfig}
                    />
                  )}
                  {currentView === 'FLASHCARDS' && (
                    <FlashcardView
                      flashcards={flashcards}
                      setFlashcards={setFlashcards}
                      folders={flashcardFolders}
                      setFolders={setFlashcardFolders}
                      onBack={() => {
                        setCurrentView('HUB');
                        setStrategicMode(false);
                      }}
                      studyProfile={stats.studyProfile!}
                      strategicMode={strategicMode}
                      editalConfig={editalConfig}
                      onReviewBatchComplete={(folderName, count) => {
                        addXP(count * 5);
                        handleManualPost(`Revisou ${count} flashcards de "${folderName}"!`);
                        const mappedSubject = getSubjectForTopic(folderName);
                        if (mappedSubject) updateHeat(mappedSubject, count);
                      }}
                      selectedFolderId={flashcardsSelectedFolderId}
                      setSelectedFolderId={setFlashcardsSelectedFolderId}
                      viewMode={flashcardsViewMode}
                      setViewMode={setFlashcardsViewMode}
                    />
                  )}
                  {currentView === 'TDH_QUESTOES' && (
                    <TDHQuestoes
                      onQuestionSessionChange={setTDHQuestionSession}
                      onQuestionsReady={handleStartFilteredQuiz}
                      onBack={() => {
                        setCurrentView('HUB');
                        setStrategicMode(false);
                      }}
                      folders={folders}
                      onSaveToNotebook={handleSaveToNotebook}
                      studyProfile={stats.studyProfile!}
                      explanationStyle={stats.explanationStyle}
                      questionProfileStyle={stats.questionProfileStyle}
                      fontSizeMultiplier={stats.fontSizeMultiplier || 1}
                      prefill={prefillQuiz}
                      onConsumedPrefill={() => setPrefillQuiz(null)}
                      strategicMode={strategicMode}
                      editalConfig={editalConfig}
                      onBatchComplete={(topic, subject, total, correct, questions) => {
                        if (correct < total) {
                          const missed = questions?.filter((q) => q.userAnswer !== q.correctAnswer);
                          logErrorToVault(topic, subject, missed);
                        }
                        if (strategicMode) scheduleRevision(topic, subject);
                      }}
                      onTriggerGuidedLesson={(subject, topic) => {
                        setGuidedLessonData({ subject, topic });
                        setCurrentView('GUIDED_LESSON');
                      }}
                    />
                  )}
                  {currentView === 'MATERIALS' && (
                    <MaterialsManager
                      folders={folders}
                      attempts={attempts}
                      onCreateFolder={(name, parentId, color) =>
                        setFolders((prev) => [
                          ...prev,
                          {
                            id: Math.random().toString(36).substr(2, 9),
                            name,
                            color,
                            topic: name,
                            notebooks: [],
                            createdAt: Date.now(),
                            parentId,
                          },
                        ])
                      }
                      onUpdateFolderColor={(folderId, color) =>
                        setFolders((prev) => prev.map((folder) => (folder.id === folderId ? { ...folder, color } : folder)))
                      }
                      onRenameFolder={(folderId, name) =>
                        setFolders((prev) => prev.map((folder) => (folder.id === folderId ? { ...folder, name } : folder)))
                      }
                      onCreateNotebook={(fid, name, color) =>
                        setFolders((prev) =>
                          prev.map((f) =>
                            f.id === fid
                              ? {
                                  ...f,
                                  notebooks: [
                                    ...f.notebooks,
                                    {
                                      id: Math.random().toString(36).substr(2, 9),
                                      name,
                                      color: color || '#f97316',
                                      questions: [],
                                      createdAt: Date.now(),
                                    },
                                  ],
                                }
                              : f,
                          ),
                        )
                      }
                      onUpdateNotebook={(fid, nid, changes) =>
                        setFolders((prev) =>
                          prev.map((folder) => folder.id === fid
                            ? { ...folder, notebooks: folder.notebooks.map((notebook) => notebook.id === nid ? { ...notebook, ...changes } : notebook) }
                            : folder),
                        )
                      }
                      onDeleteFolder={(fid) => setFolders((prev) => prev.filter((f) => f.id !== fid))}
                      onDeleteNotebook={(fid, nid) =>
                        setFolders((prev) =>
                          prev.map((f) =>
                            f.id === fid
                              ? {
                                  ...f,
                                  notebooks: f.notebooks.filter((n) => n.id !== nid),
                                }
                              : f,
                          ),
                        )
                      }
                      onBack={() => {
                        setCurrentView('HUB');
                        setStrategicMode(false);
                      }}
                      onPlayQuiz={(fid, nid) => {
                        setActiveNotebookInfo({
                          folderId: fid,
                          notebookId: nid,
                        });
                        setCurrentView('QUIZ_PLAYER');
                      }}
                      onMoveAllQuestions={handleMoveAllQuestions}
                      strategicMode={strategicMode}
                      editalConfig={editalConfig}
                      selectedFolderId={materialsSelectedFolderId}
                      setSelectedFolderId={setMaterialsSelectedFolderId}
                      selectedNotebookId={materialsSelectedNotebookId}
                      setSelectedNotebookId={setMaterialsSelectedNotebookId}
                    />
                  )}
                  {currentView === 'QUIZ_PLAYER' && activeNotebookInfo && (
                    <QuizPlayer
                      folder={folders.find((f) => f.id === activeNotebookInfo.folderId) as QuizFolder}
                      notebook={folders.find((f) => f.id === activeNotebookInfo.folderId)?.notebooks.find((n) => n.id === activeNotebookInfo.notebookId) as Notebook}
                      folders={folders}
                      onBack={() => setCurrentView('MATERIALS')}
                      onUpdateQuestions={(qs) => handleUpdateQuestions(activeNotebookInfo.folderId, activeNotebookInfo.notebookId, qs)}
                      onMoveQuestion={handleMoveQuestion}
                      initialFontSizeMultiplier={stats.fontSizeMultiplier || 1}
                      isAdmin={isAdmin}
                      onTriggerGuidedLesson={(subject, topic) => {
                        setGuidedLessonData({ subject, topic });
                        setCurrentView('GUIDED_LESSON');
                      }}
                      onComplete={(score, total) => {
                        setAttempts((prev) => [
                          ...prev,
                          {
                            folderId: activeNotebookInfo.folderId,
                            notebookId: activeNotebookInfo.notebookId,
                            date: Date.now(),
                            score,
                            total,
                          },
                        ]);
                        addXP(score * 50);
                        // Optional-chained on purpose: the folder/notebook can have been deleted
                        // (locally or via a cloud sync) while the quiz was still in progress.
                        const notebookName = folders.find((f) => f.id === activeNotebookInfo.folderId)?.notebooks.find((n) => n.id === activeNotebookInfo.notebookId)?.name || 'Simulado';
                        handleManualPost(`Acertou ${score}/${total} no quiz "${notebookName}"!`);
                        const mappedSubject = getSubjectForTopic(notebookName);
                        if (mappedSubject) updateHeat(mappedSubject, score * 5);
                        setCurrentView('MATERIALS');
                      }}
                    />
                  )}
                  {currentView === 'STUDY_PLAN' && (
                    <StudyPlanView
                      onBack={() => setCurrentView('HUB')}
                      plan={studyPlan}
                      history={history}
                      onUpdatePlan={setStudyPlan}
                      onStartTimer={(s) => {
                        setActiveSubjectId(s.id);
                        setTimerMode(TimerMode.POMODORO);
                        setGlobalTimerSeconds(1500);
                        setShowGlobalBar(true);
                        setCurrentView('TIMER');
                      }}
                      editalConfig={editalConfig}
                      studyProfile={stats.studyProfile!}
                      onTopicComplete={(topic, subject, isCompleted) => {
                        if (isCompleted) {
                          scheduleRevision(topic, subject);
                          handleManualPost(`Concluiu o tópico "${topic}" de ${subject} pelo Plano de Estudos!`);
                        }
                      }}
                    />
                  )}
                  {currentView === 'FOCUS_MODE' && <FocusModeView settings={focusSettings} onUpdate={setFocusSettings} onBack={() => setCurrentView('HUB')} />}
                  {currentView === 'DYNAMIC_TIMER' && (
                    <DynamicTimer
                      studyProfile={stats.studyProfile!}
                      onBack={() => {
                        setCurrentView('HUB');
                        setStrategicMode(false);
                      }}
                      onComplete={(mins) => {
                        logStudyMinutes(mins);
                        setCurrentView('HUB');
                        setStrategicMode(false);
                      }}
                      strategicMode={strategicMode}
                      editalConfig={editalConfig}
                    />
                  )}

                  {currentView === 'EDITAL_SETUP' && (
                    <EditalSetup
                      studyProfile={stats.studyProfile!}
                      onComplete={(c) => {
                        setEditalConfig(c);
                        setCurrentView('EDITAL_VIEW');
                      }}
                      onBack={() => setCurrentView('HUB')}
                    />
                  )}

                  {currentView === 'EDITAL_VIEW' && (
                    <EditalView
                      studyProfile={stats.studyProfile!}
                      config={editalConfig}
                      onUpdate={setEditalConfig}
                      onBack={() => setCurrentView('HUB')}
                      onDisable={() => {
                        setEditalConfig({ ...editalConfig, isActive: false });
                        setCurrentView('HUB');
                      }}
                      onTopicComplete={(topic, subject, isCompleted) => {
                        if (isCompleted) {
                          scheduleRevision(topic, subject);
                          handleManualPost(`Concluiu o tópico "${topic}" de ${subject}!`);
                        }
                      }}
                      onSelectTopic={(subject, topic, type) => {
                        const fullTopic = `${subject}: ${topic}`;
                        if (type === 'LESSON') {
                          setPrefillAI({ topic: fullTopic, autoStart: true });
                          setCurrentView('AI_DIRECT');
                        } else if (type === 'GUIDED_LESSON') {
                          const [s, t] = fullTopic.includes(':') ? fullTopic.split(':').map((str) => str.trim()) : ['', fullTopic];
                          setGuidedLessonData({ subject: s, topic: t });
                          setCurrentView('GUIDED_LESSON');
                        } else if (type === 'QUIZ') {
                          setPrefillQuiz(fullTopic);
                          setCurrentView('TDH_QUESTOES');
                        } else if (type === 'FLASHCARDS') {
                          setPrefillAI({ topic: fullTopic, autoStart: true });
                          setCurrentView('AI_DIRECT');
                        }
                      }}
                      onSmartRevision={() => setCurrentView('SMART_REVISION')}
                    />
                  )}

                  {currentView === 'SMART_REVISION' && <SmartRevisionView items={smartSystem.queue} vault={smartSystem.vault} profile={stats.studyProfile!} plan={studyPlan} onBack={() => setCurrentView('HUB')} onComplete={handleSmartComplete} onResolveVault={resolveVault} />}

                  {currentView === 'STUDY_CYCLE' && (
                    <StudyCycleView
                      onBack={() => setCurrentView('HUB')}
                      edital={editalConfig}
                      currentCycle={studyCycle}
                      onUpdateCycle={setStudyCycle}
                      studyProfile={stats.studyProfile}
                      onStartSession={(step) => {
                        setActiveSubjectId(step.subjectId);
                        setTimerMode(TimerMode.POMODORO);
                        setGlobalTimerSeconds(1500);
                        setGlobalTimerActive(true);
                        setShowGlobalBar(true);
                        setCurrentView('TIMER');
                      }}
                    />
                  )}

                  {currentView === 'SOCIAL_MODULE' && <SocialModule myUid={user?.uid} myStats={stats} isLoggedIn={!!user} onLogin={handleLogin} isStudyMode={globalTimerActive} onBack={() => setCurrentView('HUB')} />}

                  {currentView === 'PROFILE' && <ProfileView stats={stats} onUpdate={setStats} onBack={() => setCurrentView('HUB')} onOpenCatalog={() => setCurrentView('FISH_CATALOG')} myId={socialState.myId} isAIEnabled={isAIEnabled} setIsAIEnabled={setIsAIEnabled} onLogout={handleLogout} onLogin={handleLogin} isLoggedIn={!!user} />}
                  {currentView === 'COMMUNITY' && <CommunityView activities={activities} onBack={() => setCurrentView('HUB')} onPostManual={handleManualPost} />}
                  {currentView === 'FISH_CATALOG' && <FishCatalog onBack={() => setCurrentView('HUB')} />}
                  {currentView === 'VADE_MECUM' && <VadeMecumView onBack={() => setCurrentView('HUB')} />}
                  {currentView === 'NOTES' && (
                    <NotesView
                      notes={notes}
                      folders={noteFolders}
                      onSave={(note) =>
                        setNotes((prev) => {
                          const exists = prev.some((n) => n.id === note.id);
                          return exists ? prev.map((n) => (n.id === note.id ? note : n)) : [...prev, note];
                        })
                      }
                      onDelete={(id) => setNotes((prev) => prev.filter((n) => n.id !== id))}
                      onCreateFolder={(name, color) =>
                        setNoteFolders((prev) => [
                          ...prev,
                          {
                            id: Math.random().toString(36).substr(2, 9),
                            name,
                            color,
                            createdAt: Date.now(),
                          },
                        ])
                      }
                      onDeleteFolder={(id) => {
                        setNoteFolders((prev) => prev.filter((f) => f.id !== id));
                        setNotes((prev) => prev.map((n) => (n.folderId === id ? { ...n, folderId: undefined } : n)));
                      }}
                      onRenameFolder={(id, name) => setNoteFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)))}
                      onUpdateFolderColor={(id, color) => setNoteFolders((prev) => prev.map((f) => (f.id === id ? { ...f, color } : f)))}
                      onBack={() => setCurrentView('HUB')}
                    />
                  )}
                  {currentView === 'PERFORMANCE' && <PerformanceView attempts={attempts} folders={folders} smartSystem={smartSystem} stats={stats} onBack={() => setCurrentView('HUB')} />}
                  {currentView === 'GUIDED_LESSON' && (
                    <GuidedLessonView
                      subject={guidedLessonData?.subject || ''}
                      topic={guidedLessonData?.topic || ''}
                      profile={stats.studyProfile || 'VESTIBULAR'}
                      explanationStyle={stats.explanationStyle}
                      initialLesson={guidedLessonData?.initialLesson}
                      onBack={() => {
                        if (guidedLessonData?.initialLesson) {
                          setCurrentView('SAVED_GUIDED_LESSONS');
                        } else {
                          setCurrentView('HUB');
                        }
                      }}
                      onComplete={(score) => {
                        addCoins(score * 10);
                        addXP(score * 20);
                        setCurrentView('HUB');
                      }}
                    />
                  )}
                  {currentView === 'LIVING_LESSON' && (
                    <LivingLessonView
                      subject={livingLessonData?.subject || ''}
                      topic={livingLessonData?.topic || ''}
                      profile={stats.studyProfile || 'VESTIBULAR'}
                      explanationStyle={stats.explanationStyle}
                      onBack={() => setCurrentView('HUB')}
                    />
                  )}

                  {currentView === 'SAVED_GUIDED_LESSONS' && (
                    <SavedGuidedLessonsView
                      onOpenLesson={(subject, topic, lesson) => {
                        setGuidedLessonData({
                          subject,
                          topic,
                          initialLesson: lesson,
                        });
                        setCurrentView('GUIDED_LESSON');
                      }}
                    />
                  )}
                  {currentView === 'DRIVE_READER' && <DriveReader onBack={() => setCurrentView('HUB')} studyProfile={stats.studyProfile} activeChannel={activeChannel} setActiveChannel={setActiveChannel} isPlayingRain={isPlayingRain} setIsPlayingRain={setIsPlayingRain} audioVolume={audioVolume} setAudioVolume={setAudioVolume} />}
                  {currentView === 'DIGITAL_NOTEBOOK' && <DigitalNotebookView key={user?.uid || 'guest'} owner={user?.uid || 'guest'} onBack={() => setCurrentView('HUB')} />}
                </Suspense>
                </>
              {currentView !== 'LIVING_LESSON' && !isQuestionSession && (
                <div aria-hidden="true" className="section-strip mt-10" />
              )}
            </main>
          </div>
        </div>

        {!isQuestionSession && !isFocusLesson && <FishCompanion studyProfile={stats.studyProfile} characterId={stats.characterId} />}
        <BuildTag />
        <LoginModal
          isOpen={isLoginModalOpen}
          isLoading={isGoogleLoginLoading}
          error={loginError}
          onClose={() => setIsLoginModalOpen(false)}
          onGoogleLogin={handleGoogleLogin}
        />
      </div>
      </div>
    </CharacterProvider>
  );
};

export default App;
