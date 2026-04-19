
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppView, TimerMode, Flashcard, FlashcardFolder, UserStats, QuizFolder, Notebook, QuizAttempt, StudyPlan, DailyHistory, StudySubject, StudySession, Activity, QuizQuestion, StudyProfile, FocusSettings, EditalConfig, SmartRevisionSystem, SmartRevisionItem, ErrorVaultItem, SocialState, StudyCycle, StudyCycleStep } from './types';
import Header from './components/Header';
import Hub from './components/Hub';
import TimerView from './components/TimerView';
import FlashcardView from './components/FlashcardView';
import AIView from './components/AIView';
import MaterialsManager from './components/MaterialsManager';
import QuizPlayer from './components/QuizPlayer';
import TDHQuestoes from './components/TDHQuestoes';
import StudyPlanView from './components/StudyPlanView';
import ProfileView from './components/ProfileView';
import CommunityView from './components/CommunityView';
import SplashScreen from './components/SplashScreen';
import FishCompanion from './components/FishCompanion';
import ProfileSelection from './components/ProfileSelection';
import FocusModeView from './components/FocusModeView';
import DynamicTimer from './components/DynamicTimer';
import EditalSetup from './components/EditalSetup';
import EditalView from './components/EditalView';
import SmartRevisionView from './components/SmartRevisionView';
import SocialModule from './components/SocialModule';
import StudyCycleView from './components/StudyCycleView';

const LOFI_RELAX_URL = "https://stream.zeno.fm/0r0xa792kwzuv"; 
const MPB_LOFI_URL = "https://stream.zeno.fm/f978v6v6h0huv";
const RAIN_SOUND_URL = "https://www.soundjay.com/nature/rain-01.mp3"; 

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>('HUB');
  const [timerMode, setTimerMode] = useState<TimerMode>(TimerMode.POMODORO);
  const [showGlobalBar, setShowGlobalBar] = useState(true);
  
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

  // States
  const [flashcards, setFlashcards] = useState<Flashcard[]>(() => {
    const saved = localStorage.getItem('focus_flashcards');
    const cards = saved ? JSON.parse(saved) : [];
    // Migrate cards without folderId to 'default'
    return cards.map((c: any) => ({ ...c, folderId: c.folderId || 'default' }));
  });
  const [flashcardFolders, setFlashcardFolders] = useState<FlashcardFolder[]>(() => {
    const saved = localStorage.getItem('focus_flashcard_folders');
    return saved ? JSON.parse(saved) : [{ id: 'default', name: 'Geral', color: '#3B82F6', createdAt: Date.now() }];
  });
  const [folders, setFolders] = useState<QuizFolder[]>(() => {
    const saved = localStorage.getItem('focus_folders');
    return saved ? JSON.parse(saved) : [];
  });
  const [attempts, setAttempts] = useState<QuizAttempt[]>(() => {
    const saved = localStorage.getItem('focus_attempts');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeNotebookInfo, setActiveNotebookInfo] = useState<{folderId: string, notebookId: string} | null>(null);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [history, setHistory] = useState<DailyHistory>(() => {
    const saved = localStorage.getItem('focus_history');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [focusSettings, setFocusSettings] = useState<FocusSettings>(() => {
    const saved = localStorage.getItem('focus_settings');
    return saved ? JSON.parse(saved) : {
      waterReminder: true,
      waterInterval: 45,
      medicationReminder: false,
      medicationTime: '08:00',
      workTransition: true,
      workStartTime: '09:00',
      prepTime: 15
    };
  });

  const [studyPlan, setStudyPlan] = useState<StudyPlan>(() => {
    const saved = localStorage.getItem('focus_studyplan');
    return saved ? JSON.parse(saved) : {
      subjects: [],
      dailyGoalMinutes: 120,
      sessions: []
    };
  });

  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('focus_stats');
    return saved ? JSON.parse(saved) : {
      name: 'Peixe Focado',
      avatarColor: '#FACC15',
      level: 1,
      xp: 0,
      coins: 0,
      streak: 0,
      totalDaysStudied: 0,
      studyProfile: undefined
    };
  });

  const [editalConfig, setEditalConfig] = useState<EditalConfig>(() => {
    const saved = localStorage.getItem('focus_edital');
    return saved ? JSON.parse(saved) : {
      isActive: false,
      subjects: [],
      examDate: '',
      dailyHours: 4
    };
  });

  const [smartSystem, setSmartSystem] = useState<SmartRevisionSystem>(() => {
    const saved = localStorage.getItem('focus_smart_system');
    return saved ? JSON.parse(saved) : { queue: [], vault: [] };
  });

  const [socialState, setSocialState] = useState<SocialState>(() => {
    const saved = localStorage.getItem('focus_social_state');
    return saved ? JSON.parse(saved) : {
      myFriends: [],
      pendingRequests: [],
      chats: {},
      myId: Math.random().toString(36).substr(2, 6).toUpperCase()
    };
  });

  const [studyCycle, setStudyCycle] = useState<StudyCycle | null>(() => {
    const saved = localStorage.getItem('focus_studycycle');
    return saved ? JSON.parse(saved) : null;
  });

  const [isAIEnabled, setIsAIEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('focus_ai_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [strategicMode, setStrategicMode] = useState(false);

  const [prefillAI, setPrefillAI] = useState<{topic: string, autoStart: boolean} | null>(null);
  const [prefillQuiz, setPrefillQuiz] = useState<string | null>(null);

  // Persistence Effects
  useEffect(() => {
    // Migration for subjects without heat
    if (editalConfig.isActive && editalConfig.subjects.some(s => s.heat === undefined)) {
      setEditalConfig(prev => ({
        ...prev,
        subjects: prev.subjects.map(s => ({ ...s, heat: s.heat ?? 50 }))
      }));
    }
    localStorage.setItem('focus_edital', JSON.stringify(editalConfig));
  }, [editalConfig]);
  useEffect(() => {
    localStorage.setItem('focus_flashcards', JSON.stringify(flashcards));
  }, [flashcards]);

  useEffect(() => {
    localStorage.setItem('focus_flashcard_folders', JSON.stringify(flashcardFolders));
  }, [flashcardFolders]);

  useEffect(() => {
    localStorage.setItem('focus_folders', JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem('focus_attempts', JSON.stringify(attempts));
  }, [attempts]);

  useEffect(() => {
    localStorage.setItem('focus_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('focus_settings', JSON.stringify(focusSettings));
  }, [focusSettings]);

  useEffect(() => {
    // Migration for studyPlan schedule
    if (studyPlan && !studyPlan.schedule) {
      setStudyPlan(prev => ({ ...prev, schedule: [] }));
    }
    localStorage.setItem('focus_studyplan', JSON.stringify(studyPlan));
  }, [studyPlan]);

  useEffect(() => {
    localStorage.setItem('focus_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('focus_smart_system', JSON.stringify(smartSystem));
  }, [smartSystem]);

  useEffect(() => {
    localStorage.setItem('focus_social_state', JSON.stringify(socialState));
  }, [socialState]);

  useEffect(() => {
    localStorage.setItem('focus_studycycle', JSON.stringify(studyCycle));
  }, [studyCycle]);

  useEffect(() => {
    localStorage.setItem('focus_ai_enabled', JSON.stringify(isAIEnabled));
  }, [isAIEnabled]);

  // Due flashcards count
  const dueFlashcardsCount = useMemo(() => {
    const now = Date.now();
    return flashcards.filter(f => !f.nextReview || f.nextReview <= now).length;
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
        setGlobalTimerSeconds(s => s - 1);
      }, 1000);
    } else if (globalTimerSeconds === 0 && globalTimerActive) {
      setGlobalTimerActive(false);
      logStudyMinutes(timerMode === TimerMode.EMERGENCY ? 5 : 25);
    }
    return () => clearInterval(interval);
  }, [globalTimerActive, globalTimerSeconds]);

  const addXP = (amount: number) => {
    setStats(prev => {
      const newXP = prev.xp + amount;
      const newLevel = Math.floor(newXP / 1000) + 1;
      
      if (newLevel > prev.level) {
        handleManualPost(`Subiu para o nível ${newLevel}! O cardume está orgulhoso.`);
      }
      
      return { ...prev, xp: newXP, level: newLevel };
    });
  };

  const getSubjectForTopic = (topic: string): string | null => {
    if (!editalConfig.isActive) return null;
    const lowerTopic = topic.toLowerCase();
    
    // Check direct match
    const subject = editalConfig.subjects.find(s => 
      s.name.toLowerCase().includes(lowerTopic) || 
      s.topics.some(t => t.toLowerCase().includes(lowerTopic) || lowerTopic.includes(t.toLowerCase()))
    );
    
    return subject ? subject.name : null;
  };

  const logStudyMinutes = (minutes: number) => {
    const today = new Date().toISOString().split('T')[0];
    setHistory(prev => ({ ...prev, [today]: (prev[today] || 0) + minutes }));
    addXP(minutes * 2);

    // Update Edital Heat if applicable
    if (activeSubjectId) {
      const subj = studyPlan.subjects.find(s => s.id === activeSubjectId);
      if (subj) updateHeat(subj.name, minutes / 2); // 1 heat per 2 mins
    } else if (prefillAI?.topic) {
       const mappedSubject = getSubjectForTopic(prefillAI.topic);
       if (mappedSubject) updateHeat(mappedSubject, minutes / 2);
    }
    
    const newActivity: Activity = {
      id: Math.random().toString(36).substr(2, 9),
      userName: stats.name,
      avatarColor: stats.avatarColor,
      subject: activeSubjectId ? (studyPlan.subjects.find(s => s.id === activeSubjectId)?.name || 'Estudo') : 'Mergulho de Foco',
      duration: minutes,
      type: timerMode === TimerMode.EMERGENCY ? 'EMERGENCY' : 'POMODORO',
      timestamp: Date.now(),
      bubbles: 0
    };
    setActivities(prev => [newActivity, ...prev]);
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
      bubbles: 0
    };
    setActivities(prev => [newActivity, ...prev]);
    addXP(10);
  };

  const scheduleRevision = (topic: string, subjectName: string) => {
    const today = new Date();
    const d0Date = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const d1Date = tomorrow.toISOString().split('T')[0];

    const d0: SmartRevisionItem = {
      id: Math.random().toString(36).substr(2, 9),
      topic,
      subjectName,
      scheduledDate: d0Date,
      intervalLevel: 0,
      status: 'PENDING',
      createdAt: Date.now()
    };

    const d1: SmartRevisionItem = {
      id: Math.random().toString(36).substr(2, 9),
      topic,
      subjectName,
      scheduledDate: d1Date,
      intervalLevel: 1,
      status: 'PENDING',
      createdAt: Date.now()
    };

    setSmartSystem(prev => ({
      ...prev,
      queue: [...prev.queue.filter(i => !(i.topic === topic && i.status === 'PENDING')), d0, d1]
    }));
  };

  const handleSmartComplete = (itemId: string, success: boolean) => {
    setSmartSystem(prev => {
      const item = prev.queue.find(i => i.id === itemId);
      if (!item) return prev;

      const newQueue = prev.queue.filter(i => i.id !== itemId);
      
      if (success) {
        // Schedule next interval
        const intervals: Record<number, number> = { 0: 1, 1: 3, 3: 7, 7: 15, 15: 0 };
        const nextInterval = intervals[item.intervalLevel];
        
        if (nextInterval > 0) {
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + nextInterval);
          const newItem: SmartRevisionItem = {
            ...item,
            id: Math.random().toString(36).substr(2, 9),
            intervalLevel: nextInterval as any,
            scheduledDate: nextDate.toISOString().split('T')[0],
            status: 'PENDING',
            createdAt: Date.now()
          };
          newQueue.push(newItem);
        }
        updateHeat(item.subjectName, 10);
      } else {
        // Re-schedule Day 1
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const retryItem: SmartRevisionItem = {
          ...item,
          id: Math.random().toString(36).substr(2, 9),
          intervalLevel: 1,
          scheduledDate: tomorrow.toISOString().split('T')[0],
          status: 'PENDING',
          createdAt: Date.now()
        };
        newQueue.push(retryItem);
        updateHeat(item.subjectName, -5);
      }

      return { ...prev, queue: newQueue };
    });
  };

  const logErrorToVault = (topic: string, subjectName: string, missedQuestions?: QuizQuestion[]) => {
    setSmartSystem(prev => {
      const existing = prev.vault.find(v => v.topic === topic && !v.resolved);
      if (existing) {
        return {
          ...prev,
          vault: prev.vault.map(v => v.id === existing.id ? { 
            ...v, 
            errorCount: v.errorCount + 1, 
            lastErrorDate: Date.now(),
            isStuck: v.errorCount + 1 >= 3,
            missedQuestions: missedQuestions || v.missedQuestions
          } : v)
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
          missedQuestions
        };
        return { ...prev, vault: [...prev.vault, newItem] };
      }
    });

    updateHeat(subjectName, -15);
  };

  const resolveVault = (vaultId: string, recoveryFlashcards?: any[]) => {
    setSmartSystem(prev => ({
      ...prev,
      vault: prev.vault.map(v => v.id === vaultId ? { ...v, resolved: true } : v)
    }));
    
    // If recovery cards provided, add them to a "Resgate" folder or general
    if (recoveryFlashcards && recoveryFlashcards.length > 0) {
      const v = smartSystem.vault.find(v => v.id === vaultId);
      const newFlashcards: Flashcard[] = recoveryFlashcards.map(rf => ({
        id: Math.random().toString(36).substr(2, 9),
        question: rf.question,
        answer: rf.answer,
        topic: v?.topic || 'Recuperação',
        interval: 1,
        easeFactor: 2.5,
        reviewsCount: 0,
        nextReview: Date.now() + 86400000 // Review tomorrow
      }));
      setFlashcards(prev => [...prev, ...newFlashcards]);
      handleManualPost(`IA programou ${recoveryFlashcards.length} cards de resgate para "${v?.topic}"!`);
    }

    // When resolved, add back to queue at Day 1
    const v = smartSystem.vault.find(v => v.id === vaultId);
    if (v) scheduleRevision(v.topic, v.subjectName);
  };

  const updateHeat = (subjectName: string, amount: number) => {
    setEditalConfig(prev => ({
      ...prev,
      subjects: prev.subjects.map(s => {
        if (s.name !== subjectName) return s;
        const newHeat = Math.min(100, Math.max(0, (s.heat || 0) + amount));
        return { ...s, heat: newHeat, lastActivity: Date.now() };
      })
    }));
  };

  const handleSaveToNotebook = (folderId: string, notebookName: string, questions: QuizQuestion[], summary?: string) => {
    setFolders(prev => prev.map(f => {
      if (f.id !== folderId) return f;
      const existingNotebook = f.notebooks.find(n => n.name.toLowerCase() === notebookName.toLowerCase());
      if (existingNotebook) {
        return { ...f, notebooks: f.notebooks.map(n => n.id === existingNotebook.id ? { ...n, questions: [...n.questions, ...questions], summary: summary || n.summary } : n) };
      } else {
        const newNotebook: Notebook = { id: Math.random().toString(36).substr(2, 9), name: notebookName, questions, summary, createdAt: Date.now() };
        return { ...f, notebooks: [...f.notebooks, newNotebook] };
      }
    }));
  };

  const handleCloseGlobalBar = () => {
    setGlobalTimerActive(false);
    setActiveChannel(null);
    setIsPlayingRain(false);
    setShowGlobalBar(false);
  };

  if (isInitializing) return <SplashScreen onComplete={() => setIsInitializing(false)} />;
  if (!stats.studyProfile) return <ProfileSelection onSelect={(p) => setStats(prev => ({ ...prev, studyProfile: p }))} />;

  const formatMiniTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0A0F1E] pb-32">
      <audio ref={relaxAudioRef} src={LOFI_RELAX_URL} loop />
      <audio ref={mpbAudioRef} src={MPB_LOFI_URL} loop />
      <audio ref={rainAudioRef} src={RAIN_SOUND_URL} loop />

      <Header 
        stats={stats} 
        onProfileClick={() => setCurrentView('PROFILE')} 
        onLogoClick={() => setCurrentView('HUB')} 
        onRevisionClick={() => setCurrentView('SMART_REVISION')}
        onSocialClick={() => setCurrentView('SOCIAL_MODULE')}
        isAIEnabled={isAIEnabled}
      />

      {showGlobalBar && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[150] w-[95%] max-w-2xl animate-in slide-in-from-bottom-8 duration-500">
          <div className="bg-white/90 backdrop-blur-xl border border-white shadow-2xl rounded-[35px] p-2 flex items-center justify-between gap-3 relative">
            <button 
              onClick={handleCloseGlobalBar}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white shadow-md border border-gray-100 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 transition-all hover:scale-110 z-20"
              title="Parar atividades e fechar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="flex items-center gap-1 bg-gray-50/50 p-1 rounded-[25px]">
              <button onClick={() => setActiveChannel(activeChannel === 'RELAX' ? null : 'RELAX')} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${activeChannel === 'RELAX' ? 'bg-yellow-400 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-100'}`} title="Lofi Relax">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
              </button>
              <button onClick={() => setIsPlayingRain(!isPlayingRain)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isPlayingRain ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-100'}`} title="Chuva de Fundo">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center gap-4 bg-gray-50/50 p-1 rounded-[25px]">
              <button onClick={() => setCurrentView('TIMER')} className="flex flex-col items-center hover:opacity-70 transition-opacity">
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">{timerMode}</span>
                <span className="text-xl font-black tabular-nums leading-none">{formatMiniTime(globalTimerSeconds)}</span>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => setGlobalTimerActive(!globalTimerActive)} className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${globalTimerActive ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                  {globalTimerActive ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg> : <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
                </button>
              </div>
            </div>

            <div className="pr-2">
              <input type="range" min="0" max="1" step="0.01" value={audioVolume} onChange={(e) => setAudioVolume(parseFloat(e.target.value))} className="w-12 h-1 accent-yellow-400 hidden sm:block opacity-40 hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8 relative">
        {currentView === 'HUB' && (
          <Hub 
            setView={setCurrentView} 
            setTimerMode={(mode) => { setTimerMode(mode); setGlobalTimerSeconds(mode === TimerMode.EMERGENCY ? 300 : 1500); setShowGlobalBar(true); }}
            flashcardCount={dueFlashcardsCount}
            stats={stats}
            activeChannel={activeChannel}
            setActiveChannel={setActiveChannel}
            isPlayingRain={isPlayingRain}
            setIsPlayingRain={setIsPlayingRain}
            editalConfig={editalConfig}
            setStrategicMode={setStrategicMode}
            smartRevisionItems={smartSystem.queue}
            isAIEnabled={isAIEnabled}
          />
        )}
        
        {currentView === 'TIMER' && (
          <TimerView 
            isActive={globalTimerActive} 
            setIsActive={setGlobalTimerActive} 
            seconds={globalTimerSeconds} 
            setSeconds={setGlobalTimerSeconds} 
            mode={timerMode} 
            onBack={() => setCurrentView('HUB')} 
            onComplete={() => logStudyMinutes(timerMode === TimerMode.EMERGENCY ? 5 : 25)} 
          />
        )}

        {currentView === 'AI_DIRECT' && (
          <AIView 
            onBack={() => { setCurrentView('HUB'); setStrategicMode(false); }} 
            folders={folders} 
            onSaveToNotebook={handleSaveToNotebook} 
            studyProfile={stats.studyProfile!} 
            onNewContent={(c) => {
              const cards = c.flashcards.map((f:any) => ({id: Math.random().toString(36).substr(2,9), ...f, nextReview: Date.now(), interval: 0, easeFactor: 2.5, reviewsCount: 0}));
              setFlashcards(prev => [...prev, ...cards]);
              if (cards.length > 0) handleManualPost(`Gerou ${cards.length} flashcards sobre "${c.topic || 'seu tema'}"!`);
              if (strategicMode && c.topic) {
                const [subject, theme] = c.topic.includes(':') ? c.topic.split(':').map((s:string) => s.trim()) : ['', c.topic];
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
            onBack={() => { setCurrentView('HUB'); setStrategicMode(false); }} 
            studyProfile={stats.studyProfile!}
            strategicMode={strategicMode}
            editalConfig={editalConfig}
            onReviewBatchComplete={(folderName, count) => {
              addXP(count * 5);
              handleManualPost(`Revisou ${count} flashcards de "${folderName}"!`);
              const mappedSubject = getSubjectForTopic(folderName);
              if (mappedSubject) updateHeat(mappedSubject, count);
            }}
          />
        )}
        {currentView === 'TDH_QUESTOES' && (
          <TDHQuestoes 
            onBack={() => { setCurrentView('HUB'); setStrategicMode(false); }} 
            folders={folders} 
            onSaveToNotebook={handleSaveToNotebook} 
            studyProfile={stats.studyProfile!} 
            prefill={prefillQuiz}
            onConsumedPrefill={() => setPrefillQuiz(null)}
            strategicMode={strategicMode}
            editalConfig={editalConfig}
            onBatchComplete={(topic, subject, total, correct, questions) => {
               if (correct < total) {
                 const missed = questions?.filter(q => q.userAnswer !== q.correctAnswer);
                 logErrorToVault(topic, subject, missed);
               }
               if (strategicMode) scheduleRevision(topic, subject);
            }}
          />
        )}
        {currentView === 'MATERIALS' && (
          <MaterialsManager 
            folders={folders} 
            attempts={attempts} 
            onCreateFolder={name => setFolders(prev => [...prev, { id: Math.random().toString(36).substr(2,9), name, topic: name, notebooks: [], createdAt: Date.now() }])} 
            onCreateNotebook={(fid, name) => setFolders(prev => prev.map(f => f.id === fid ? { ...f, notebooks: [...f.notebooks, { id: Math.random().toString(36).substr(2,9), name, questions: [], createdAt: Date.now() }] } : f))} 
            onBack={() => { setCurrentView('HUB'); setStrategicMode(false); }} 
            onPlayQuiz={(fid, nid) => { setActiveNotebookInfo({folderId: fid, notebookId: nid}); setCurrentView('QUIZ_PLAYER'); }} 
            strategicMode={strategicMode}
            editalConfig={editalConfig}
          />
        )}
        {currentView === 'QUIZ_PLAYER' && activeNotebookInfo && (
           <QuizPlayer 
             folder={folders.find(f => f.id === activeNotebookInfo.folderId)!} 
             notebook={folders.find(f => f.id === activeNotebookInfo.folderId)!.notebooks.find(n => n.id === activeNotebookInfo.notebookId)!} 
             onBack={() => setCurrentView('MATERIALS')} 
             onComplete={(score, total) => { 
                setAttempts(prev => [...prev, { folderId: activeNotebookInfo.folderId, notebookId: activeNotebookInfo.notebookId, date: Date.now(), score, total }]); 
                addXP(score * 50); 
                const notebookName = folders.find(f => f.id === activeNotebookInfo.folderId)!.notebooks.find(n => n.id === activeNotebookInfo.notebookId)!.name;
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
            onBack={() => { setCurrentView('HUB'); setStrategicMode(false); }} 
            onComplete={(mins) => { logStudyMinutes(mins); setCurrentView('HUB'); setStrategicMode(false); }} 
            strategicMode={strategicMode}
            editalConfig={editalConfig}
          />
        )}
        
        {currentView === 'EDITAL_SETUP' && (
          <EditalSetup 
            onComplete={(c) => { setEditalConfig(c); setCurrentView('EDITAL_VIEW'); }} 
            onBack={() => setCurrentView('HUB')} 
          />
        )}
        
        {currentView === 'EDITAL_VIEW' && (
          <EditalView 
            config={editalConfig} 
            onUpdate={setEditalConfig} 
            onBack={() => setCurrentView('HUB')}
            onDisable={() => { setEditalConfig({ ...editalConfig, isActive: false }); setCurrentView('HUB'); }}
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

        {currentView === 'SMART_REVISION' && (
          <SmartRevisionView 
            items={smartSystem.queue}
            vault={smartSystem.vault}
            profile={stats.studyProfile!}
            plan={studyPlan}
            onBack={() => setCurrentView('HUB')}
            onComplete={handleSmartComplete}
            onResolveVault={resolveVault}
          />
        )}

        {currentView === 'STUDY_CYCLE' && (
          <StudyCycleView 
            onBack={() => setCurrentView('HUB')}
            edital={editalConfig}
            currentCycle={studyCycle}
            onUpdateCycle={setStudyCycle}
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

        {currentView === 'SOCIAL_MODULE' && (
          <SocialModule 
            socialState={socialState}
            onUpdateSocial={setSocialState}
            myStats={stats}
            editalConfig={editalConfig}
            isStudyMode={globalTimerActive}
            onBack={() => setCurrentView('HUB')}
          />
        )}

        {currentView === 'PROFILE' && (
          <ProfileView 
            stats={stats} 
            onUpdate={setStats} 
            onBack={() => setCurrentView('HUB')} 
            myId={socialState.myId} 
            isAIEnabled={isAIEnabled}
            setIsAIEnabled={setIsAIEnabled}
          />
        )}
        {currentView === 'COMMUNITY' && <CommunityView activities={activities} onBack={() => setCurrentView('HUB')} onPostManual={handleManualPost} />}
      </main>

      <FishCompanion studyProfile={stats.studyProfile} />
    </div>
  );
};

export default App;
