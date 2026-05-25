import React, { useState, useEffect, useRef } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../src/lib/firebase';
import { getQuickExplanation } from '../services/geminiService';
import { StudyProfile } from '../types';
import { 
  FolderOpen, 
  Search, 
  Loader2, 
  ArrowLeft, 
  BookOpen, 
  Sparkles, 
  Clock, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  RotateCcw, 
  FileText, 
  Download, 
  Plus, 
  ArrowRight,
  HelpCircle,
  Dribbble,
  Music,
  Maximize2,
  FileIcon,
  Check,
  Upload,
  Trash2,
  Share2,
  Database,
  CloudLightning,
  Cloud,
  Laptop
} from 'lucide-react';

// IndexedDB core database config for persistent local PDFs
const DB_NAME = 'tdah_reader_db';
const STORE_NAME = 'pdf_files';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e: any) => resolve(e.target.result);
    request.onerror = (e: any) => reject(e.target.error);
  });
};

const saveFileToDB = async (id: string, name: string, blob: Blob): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const item = {
      id,
      name,
      blob,
      size: blob.size.toString(),
      modifiedTime: new Date().toISOString(),
    };
    const request = store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    request.onerror = () => reject(request.error);
  });
};

const getFileBlobFromDB = async (id: string): Promise<Blob> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.blob);
      } else {
        reject(new Error('Arquivo não encontrado localmente.'));
      }
    };
    request.onerror = () => reject(request.error);
  });
};

const getAllFilesFromDB = async (): Promise<{ id: string; name: string; size: string; modifiedTime: string }[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result || [];
        resolve(
          results.map((r: any) => ({
            id: r.id,
            name: r.name,
            size: r.size,
            modifiedTime: r.modifiedTime,
          }))
        );
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("IndexedDB error", e);
    return [];
  }
};

const deleteFileFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

interface UploadedBookPage {
  name: string;
  blob: Blob;
}

const getBookPagesFromDB = async (fileId: string): Promise<UploadedBookPage[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(`pages_${fileId}`);
      request.onsuccess = () => {
        if (request.result && request.result.pages) {
          resolve(request.result.pages);
        } else {
          resolve([]);
        }
      };
      request.onerror = () => resolve([]);
    });
  } catch (e) {
    console.error("IndexedDB error retrieving pages:", e);
    return [];
  }
};

const saveBookPagesToDB = async (fileId: string, pages: UploadedBookPage[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const item = {
      id: `pages_${fileId}`,
      pages,
      modifiedTime: new Date().toISOString()
    };
    const request = store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    request.onerror = () => reject(request.error);
  });
};

interface DriveReaderProps {
  onBack: () => void;
  studyProfile?: StudyProfile;
  activeChannel: 'RELAX' | 'MPB' | null;
  setActiveChannel: (channel: 'RELAX' | 'MPB' | null) => void;
  isPlayingRain: boolean;
  setIsPlayingRain: (playing: boolean) => void;
  audioVolume: number;
  setAudioVolume: (vol: number) => void;
}

interface FirebaseResource {
  id: string;
  name: string;
  url: string;
  size?: string;
  modifiedTime?: string;
}

function extractPdfs(json: any, path: string = ''): FirebaseResource[] {
  const list: FirebaseResource[] = [];
  if (!json) return list;

  if (typeof json === 'object') {
    // Check if this specific node resembles a PDF file entry
    const hasUrl = json.url || json.pdfUrl || json.fileUrl || json.downloadUrl || json.uri || json.link;
    if (hasUrl && typeof hasUrl === 'string' && (hasUrl.toLowerCase().includes('.pdf') || hasUrl.startsWith('data:application/pdf'))) {
      const parentKey = path.split('/').pop() || 'Sem_Nome';
      const name = json.name || json.title || json.fileName || json.label || parentKey;
      const sizeValue = json.size || json.fileSize || String(hasUrl.length);
      list.push({
        id: path || Math.random().toString(36).substring(2, 7),
        name: name.toString().endsWith('.pdf') ? name : `${name}.pdf`,
        url: hasUrl,
        size: String(sizeValue),
        modifiedTime: json.modifiedTime || json.createdAt || new Date().toISOString()
      });
      return list;
    }

    // Traverse keys
    for (const key in json) {
      if (Object.prototype.hasOwnProperty.call(json, key)) {
        const value = json[key];
        const nextPath = path ? `${path}/${key}` : key;
        if (value && typeof value === 'object') {
          list.push(...extractPdfs(value, nextPath));
        } else if (typeof value === 'string' && (value.toLowerCase().includes('.pdf') || value.startsWith('data:application/pdf'))) {
          // Flat key-value pair string URL
          list.push({
            id: nextPath,
            name: `${key}.pdf`,
            url: value,
            modifiedTime: new Date().toISOString()
          });
        }
      }
    }
  } else if (Array.isArray(json)) {
    json.forEach((item, index) => {
      list.push(...extractPdfs(item, path ? `${path}/${index}` : String(index)));
    });
  }

  return list;
}

export interface LibraryFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  source: 'google' | 'local' | 'firebase';
  localUrl?: string; // Loaded dynamically on select
  firebaseUrl?: string; // Original URL if from Firebase
}

export const DriveReader: React.FC<DriveReaderProps> = ({
  onBack,
  studyProfile = 'VESTIBULAR',
  activeChannel,
  setActiveChannel,
  isPlayingRain,
  setIsPlayingRain,
  audioVolume,
  setAudioVolume
}) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleFiles, setGoogleFiles] = useState<LibraryFile[]>([]);
  const [localFiles, setLocalFiles] = useState<LibraryFile[]>([]);
  const [explorerTab, setExplorerTab] = useState<'LOCAL' | 'FIREBASE'>('LOCAL');
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Firebase Realtime Database Integration States
  const [firebaseFiles, setFirebaseFiles] = useState<LibraryFile[]>([]);
  const [firebasePathInput, setFirebasePathInput] = useState('pdfs');
  const [firebaseSyncLoading, setFirebaseSyncLoading] = useState(false);
  const [firebaseStatusMsg, setFirebaseStatusMsg] = useState<string | null>(null);
  const [firebaseTargetFileId, setFirebaseTargetFileId] = useState<string | null>(null);

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab within reader sidebar
  const [sidebarTab, setSidebarTab] = useState<'NOTES' | 'FOCUS' | 'AI'>('NOTES');

  // Reader Focus states
  const [selectedFile, setSelectedFile] = useState<LibraryFile | null>(null);
  const [notes, setNotes] = useState('');
  const [isNotesSaved, setIsNotesSaved] = useState(true);
  const [activeLocalUrl, setActiveLocalUrl] = useState<string>('');

  // Book pages / Screenshots state (to prevent Google Chrome nested iframe blocks!)
  interface LoadedBookPage {
    id: string;
    name: string;
    url: string;
    blob: Blob;
  }
  const [bookPagesList, setBookPagesList] = useState<LoadedBookPage[]>([]);
  const [activePageIdx, setActivePageIdx] = useState<number>(-1);
  const [viewerMode, setViewerMode] = useState<'IFRAME_PDF' | 'IMAGE_PAGES'>('IMAGE_PAGES');

  const loadBookPages = async (fileId: string) => {
    const stored = await getBookPagesFromDB(fileId);
    // Release existing object URLs of dynamic images to avoid memory leaks
    setBookPagesList((prev) => {
      prev.forEach((p) => {
        if (p.url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(p.url);
          } catch (e) {}
        }
      });
      return [];
    });

    const mapped = stored.map((p, idx) => ({
      id: `page_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: p.name,
      url: URL.createObjectURL(p.blob),
      blob: p.blob
    }));

    setBookPagesList(mapped);
    if (mapped.length > 0) {
      setActivePageIdx(0);
    } else {
      setActivePageIdx(-1);
    }
  };

  useEffect(() => {
    if (selectedFile?.id) {
      loadBookPages(selectedFile.id);
      // Set to IMAGE_PAGES as default so the user is welcomed with the direct, safe image render
      setViewerMode('IMAGE_PAGES');
    } else {
      setBookPagesList([]);
      setActivePageIdx(-1);
    }
  }, [selectedFile?.id]);

  // Quick Timer inside Reader
  const [timerSeconds, setTimerSeconds] = useState(1500); // 25 min default
  const [timerActive, setTimerActive] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // AI chat states
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Load persistent local PDFs metadata on assembly
  const loadLocalFiles = async () => {
    try {
      const persisted = await getAllFilesFromDB();
      const mapped: LibraryFile[] = persisted.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: 'application/pdf',
        size: f.size,
        modifiedTime: f.modifiedTime,
        source: 'local'
      }));
      setLocalFiles(mapped);
    } catch (e) {
      console.error("Erro carregando arquivos locais", e);
    }
  };

  useEffect(() => {
    loadLocalFiles();
  }, []);

  // Save notes linked to fileId
  useEffect(() => {
    if (selectedFile) {
      const savedNotes = localStorage.getItem(`drive_notes_${selectedFile.id}`);
      setNotes(savedNotes || '');
      setIsNotesSaved(true);
    }
  }, [selectedFile]);

  // Clean active local URL as selectedFile changes
  useEffect(() => {
    return () => {
      if (activeLocalUrl) {
        URL.revokeObjectURL(activeLocalUrl);
      }
    };
  }, [activeLocalUrl]);

  // Autosave notes
  useEffect(() => {
    if (selectedFile) {
      setIsNotesSaved(false);
      const timeout = setTimeout(() => {
        localStorage.setItem(`drive_notes_${selectedFile.id}`, notes);
        setIsNotesSaved(true);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [notes, selectedFile]);

  // Pomodoro timer logic
  useEffect(() => {
    if (timerActive) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            // Play sound if possible
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              osc.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 1.2);
            } catch (e) {
              console.log("Audio contextual trigger blocked", e);
            }
            alert("⏰ Bloco focado de estudos concluído! Excelente rendimento!");
            return 1500;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerActive]);

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      await handleProcessFile(droppedFiles[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      await handleProcessFile(selectedFiles[0]);
    }
  };

  const handleProcessFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert("Ops! Por favor, insira um arquivo do tipo PDF.");
      return;
    }

    setLoading(true);
    try {
      const fileId = 'local_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
      await saveFileToDB(fileId, file.name, file);
      
      // Update local storage explorer list
      await loadLocalFiles();
      
      // Create session URL and carry over to selected state
      const objectUrl = URL.createObjectURL(file);
      setActiveLocalUrl(objectUrl);

      const targetFile: LibraryFile = {
        id: fileId,
        name: file.name,
        mimeType: 'application/pdf',
        size: file.size.toString(),
        modifiedTime: new Date().toISOString(),
        source: 'local',
        localUrl: objectUrl
      };
      
      setSelectedFile(targetFile);
    } catch (err: any) {
      alert("Erro ao ler e armazenar PDF localmente: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocalFile = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Deseja realmente remover este PDF da sua biblioteca local? As notas salvas não serão excluídas.")) {
      try {
        await deleteFileFromDB(id);
        await loadLocalFiles();
        if (selectedFile?.id === id) {
          setSelectedFile(null);
        }
      } catch (err: any) {
        alert("Erro ao excluir arquivo: " + err.message);
      }
    }
  };

  // Connect Google Drive Cloud
  const handleConnectGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
      googleProvider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');
      
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        fetchGoogleFiles(credential.accessToken, '');
      } else {
        throw new Error("Não foi possível conseguir o token de acesso do Google Drive.");
      }
    } catch (err: any) {
      console.error("Popup blocker or authentication problem: ", err);
      setError(
        err.message?.includes("cancelled-by-user") 
          ? "Login cancelado. Use a aba de Biblioteca Local para adicionar PDFs diretamente sem login!" 
          : "Erro de autenticação com o Google. Use a Biblioteca Local para estudar com 100% de estabilidade!"
      );
    } finally {
      setLoading(false);
    }
  };

  // Google Drive Files Fetch
  const fetchGoogleFiles = async (token: string, search: string) => {
    setLoading(true);
    setError(null);
    try {
      let query = "mimeType = 'application/pdf' and trashed = false";
      if (search.trim()) {
        const escaped = search.replace(/'/g, "\\'");
        query += ` and name contains '${escaped}'`;
      }
      
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,webViewLink,thumbnailLink,modifiedTime)&pageSize=40`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          setAccessToken(null);
          throw new Error("Sessão Google Drive expirada. Favor login novamente.");
        }
        const errData = await res.json();
        throw new Error(errData.error?.message || "Erro acessando Google Drive API.");
      }
      
      const data = await res.json();
      const mapped: LibraryFile[] = (data.files || []).map((f: any) => ({
        ...f,
        source: 'google'
      }));
      setGoogleFiles(mapped);
    } catch (err: any) {
      setError(err.message || "Não foi possível carregar a nuvem do Google Drive");
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    if (explorerTab === 'FIREBASE' && firebaseFiles.length === 0) {
      fetchFirebaseFiles();
    }
  }, [explorerTab]);

  // Firebase Realtime DB Pull Files
  const fetchFirebaseFiles = async () => {
    setFirebaseSyncLoading(true);
    setFirebaseStatusMsg(null);
    try {
      const rawPath = firebasePathInput.trim().replace(/^\/|\/$/g, '');
      const dbUrl = `https://gen-lang-client-0709783251-default-rtdb.firebaseio.com/${rawPath ? rawPath + '.json' : '.json'}`;
      
      const res = await fetch(dbUrl);
      if (!res.ok) {
        throw new Error(`Erro HTTP: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (!data) {
        setFirebaseFiles([]);
        setFirebaseStatusMsg("Banco de dados vazio neste caminho! Adicione PDFs abaixo para inicializá-lo.");
        return;
      }
      
      const parsedResources = extractPdfs(data, rawPath);
      
      const mapped: LibraryFile[] = parsedResources.map(res => ({
        id: 'firebase_' + res.id.replace(/\//g, '_'),
        name: res.name,
        mimeType: 'application/pdf',
        size: res.size,
        modifiedTime: res.modifiedTime,
        source: 'firebase',
        firebaseUrl: res.url
      }));
      
      setFirebaseFiles(mapped);
      setFirebaseStatusMsg(`Sincronizado! Encontrados ${mapped.length} livros.`);
    } catch (err: any) {
      console.error("Erro ao ler do Firebase:", err);
      setFirebaseStatusMsg("Erro de conexão: " + err.message);
    } finally {
      setFirebaseSyncLoading(false);
    }
  };

  // Initialize Realtime DB with sample medical / cognitive books
  const handleInitializeSampleFirebase = async () => {
    setFirebaseSyncLoading(true);
    setFirebaseStatusMsg("Escrevendo PDF de Amostra no Firebase...");
    try {
      const rawPath = firebasePathInput.trim().replace(/^\/|\/$/g, '');
      const writeUrl = `https://gen-lang-client-0709783251-default-rtdb.firebaseio.com/${rawPath ? rawPath : 'pdfs'}.json`;
      
      const samplePayload = {
        "amostra_tdah": {
          "name": "Cartilha_de_Boas_Praticas_TDAH.pdf",
          "url": "https://extensaorv.com.br/arquivos/Manual_TDAH.pdf",
          "size": "1543160",
          "modifiedTime": new Date().toISOString()
        },
        "amostra_estudo_ativo": {
          "name": "Manual_USP_Mapeamento_Mental_Estudos.pdf",
          "url": "https://edisciplinas.usp.br/pluginfile.php/4283570/mod_resource/content/1/GuiaAcademicov4.pdf",
          "size": "3154320",
          "modifiedTime": new Date().toISOString()
        }
      };

      const res = await fetch(writeUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePayload)
      });

      if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
      
      setFirebaseStatusMsg("Sucesso! Banco inicializado com livros de Amostra USP e TDAH.");
      alert("🎉 Excelente! Escrevemos 2 livros de alto padrão (USP Guia do Estudante e Cartilha de Boas Práticas de Atenção) diretamente no seu banco do Firebase. Clique em 'Puxar do Firebase' para carregá-los!");
      
      await fetchFirebaseFiles();
    } catch (err: any) {
      console.error(err);
      setFirebaseStatusMsg("Erro de inicialização: " + err.message);
      alert("Erro ao gravar livros de amostra no Firebase: " + err.message);
    } finally {
      setFirebaseSyncLoading(false);
    }
  };

  // Convert File blob to Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Upload/Push a Local Selected File to Firebase as full Base64
  const handlePublishLocalFileToFirebase = async () => {
    if (!firebaseTargetFileId) return;
    setFirebaseSyncLoading(true);
    setFirebaseStatusMsg("Convertendo arquivo local...");
    try {
      const targetLocalFile = localFiles.find(f => f.id === firebaseTargetFileId);
      if (!targetLocalFile) throw new Error("Livro local não localizado.");
      
      const blob = await getFileBlobFromDB(targetLocalFile.id);
      
      // Safety threshold
      if (blob.size > 3.55 * 1024 * 1024) {
        alert(`⚠️ O PDF "${targetLocalFile.name}" é pesado demais (${(blob.size / 1024 / 1024).toFixed(1)}MB) para uploads Base64 diretos em Realtime Database. Por segurança de processamento, use a opção B de link direto da internet ou selecione um arquivo menor de até 3.5MB.`);
        setFirebaseStatusMsg("Tamanho excedido (>3.5MB)");
        return;
      }

      setFirebaseStatusMsg("Carregando bytes (Base64)...");
      const base64Data = await blobToBase64(blob);

      setFirebaseStatusMsg("Gravando no Firebase Cloud... Por favor aguarde.");
      const cleanKey = targetLocalFile.name.replace(/[\.\$#\[\]\/]/g, '_').replace(/_+/g, '_').substring(0, 50) + '_' + Date.now();
      const rawPath = firebasePathInput.trim().replace(/^\/|\/$/g, '');
      const finalUrl = `https://gen-lang-client-0709783251-default-rtdb.firebaseio.com/${rawPath ? rawPath : 'pdfs'}/${cleanKey}.json`;

      const payload = {
        name: targetLocalFile.name,
        url: base64Data,
        size: blob.size.toString(),
        modifiedTime: new Date().toISOString()
      };

      const res = await fetch(finalUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Falha HTTP: ${res.status}`);

      setFirebaseStatusMsg("Sucesso! Livro publicado como recipiente de dados offline.");
      alert(`🚀 Sucesso completo! O livro "${targetLocalFile.name}" foi totalmente publicado no seu Realtime Database com a codificação Base64 e pode ser baixado/lido em qualquer dispositivo!`);
      
      setFirebaseTargetFileId(null);
      await fetchFirebaseFiles();
    } catch (err: any) {
      console.error(err);
      setFirebaseStatusMsg("Erro de upload: " + err.message);
      alert("Erro ao publicar bytes do arquivo local: " + err.message);
    } finally {
      setFirebaseSyncLoading(false);
    }
  };

  // Publish raw external Link
  const handlePublishLinkToFirebase = async () => {
    const nameInput = document.getElementById('custom-pdf-name-input') as HTMLInputElement | null;
    const urlInput = document.getElementById('custom-pdf-url-input') as HTMLInputElement | null;
    
    if (!nameInput || !urlInput) return;
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();

    if (!name || !url) {
      alert("Por favor insira tanto o Nome do livro quanto o endereço de link PDF válido.");
      return;
    }

    if (!url.toLowerCase().startsWith('http')) {
      alert("Insira uma URL de link válida iniciada com http:// ou https://");
      return;
    }

    setFirebaseSyncLoading(true);
    setFirebaseStatusMsg("Definindo referência link...");
    try {
      const cleanKey = name.replace(/[\.\$#\[\]\/]/g, '_').replace(/_+/g, '_').substring(0, 50) + '_' + Date.now();
      const rawPath = firebasePathInput.trim().replace(/^\/|\/$/g, '');
      const finalUrl = `https://gen-lang-client-0709783251-default-rtdb.firebaseio.com/${rawPath ? rawPath : 'pdfs'}/${cleanKey}.json`;

      const payload = {
        name: name.endsWith('.pdf') ? name : `${name}.pdf`,
        url: url,
        size: "0",
        modifiedTime: new Date().toISOString()
      };

      const res = await fetch(finalUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Status: ${res.status}`);

      setFirebaseStatusMsg("Sucesso! Link de referência criado.");
      alert(`🔗 Livro publicado por referência URL com sucesso! "${name}" já está no seu Realtime Database.`);
      
      nameInput.value = '';
      urlInput.value = '';
      await fetchFirebaseFiles();
    } catch (err: any) {
      console.error(err);
      setFirebaseStatusMsg("Falha ao salvar link: " + err.message);
      alert("Falha ao publicar link de referência: " + err.message);
    } finally {
      setFirebaseSyncLoading(false);
    }
  };

  const handleSaveFirebaseToLocal = async (file: LibraryFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    setFirebaseStatusMsg("Iniciando download...");
    try {
      let fileBlob: Blob;
      
      if (file.firebaseUrl?.startsWith('data:application/pdf') || file.firebaseUrl?.startsWith('data:;base64')) {
        const base64Parts = file.firebaseUrl.split(',');
        const byteString = atob(base64Parts[1]);
        const mimeString = base64Parts[0].includes(':') ? base64Parts[0].split(':')[1].split(';')[0] : 'application/pdf';
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        fileBlob = new Blob([ab], { type: mimeString });
      } else {
        const res = await fetch(file.firebaseUrl!);
        if (!res.ok) throw new Error("Erro no download das nuvens");
        fileBlob = await res.blob();
      }
      
      const fileId = 'local_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
      await saveFileToDB(fileId, file.name, fileBlob);
      await loadLocalFiles();
      setFirebaseStatusMsg(`Sucesso! "${file.name}" salvo offline.`);
      alert(`📚 "${file.name}" foi importado para a sua Biblioteca Local com sucesso! Você pode lê-lo offline a qualquer momento.`);
    } catch (err: any) {
      console.error(err);
      alert("Falha no download para armazenamento offline (CORS restrito ou falha de rede). Tente abrir online primeiro!");
      setFirebaseStatusMsg("Falha de Sync Offline: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFileEntry = async (file: LibraryFile) => {
    if (file.source === 'local') {
      setLoading(true);
      try {
        const blob = await getFileBlobFromDB(file.id);
        const objectUrl = URL.createObjectURL(blob);
        setActiveLocalUrl(objectUrl);
        
        setSelectedFile({
          ...file,
          localUrl: objectUrl
        });
      } catch (err: any) {
        alert("Erro ao buscar conteúdo offline: " + err.message);
      } finally {
        setLoading(false);
      }
    } else if (file.source === 'firebase') {
      setLoading(true);
      try {
        if (file.firebaseUrl?.startsWith('data:application/pdf') || file.firebaseUrl?.startsWith('data:;base64')) {
          const base64Parts = file.firebaseUrl.split(',');
          const byteString = atob(base64Parts[1]);
          const mimeString = base64Parts[0].includes(':') ? base64Parts[0].split(':')[1].split(';')[0] : 'application/pdf';
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: mimeString });
          const objectUrl = URL.createObjectURL(blob);
          setActiveLocalUrl(objectUrl);
          setSelectedFile({
            ...file,
            localUrl: objectUrl
          });
        } else {
          // Try loading PDF directly as safe raw blob first to bypass standard iframe blocks
          const response = await fetch(file.firebaseUrl!);
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          setActiveLocalUrl(objectUrl);
          setSelectedFile({
            ...file,
            localUrl: objectUrl
          });
        }
      } catch (err: any) {
        console.warn("Could not fetch direct blob (CORS limit reached), using URL directly", err);
        // Fallback: render direct web link
        setSelectedFile({
          ...file,
          localUrl: file.firebaseUrl
        });
      } finally {
        setLoading(false);
      }
    } else {
      setSelectedFile(file);
    }
  };

  const handleUploadBookPage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedFile || !e.target.files) return;
    const filesArray = Array.from(e.target.files);
    const newPages: { name: string; blob: Blob }[] = [];
    
    for (const file of filesArray) {
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        newPages.push({
          name: file.name,
          blob: file
        });
      }
    }

    if (newPages.length === 0) {
      alert("Por favor selecione apenas imagens válidas (PNG, JPG, JPEG, WEBP) para as páginas.");
      return;
    }

    const currentStored = await getBookPagesFromDB(selectedFile.id);
    const updated = [...currentStored, ...newPages];
    await saveBookPagesToDB(selectedFile.id, updated);
    await loadBookPages(selectedFile.id);
  };

  const handleDeleteBookPage = async (index: number) => {
    if (!selectedFile) return;
    const currentStored = await getBookPagesFromDB(selectedFile.id);
    const updated = currentStored.filter((_, idx) => idx !== index);
    await saveBookPagesToDB(selectedFile.id, updated);
    await loadBookPages(selectedFile.id);
  };

  // Format bytes
  const formatSize = (bytesStr?: string) => {
    if (!bytesStr) return 'Tamanho Indefinido';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return 'Tamanho Indefinido';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // Export Notes
  const handleExportNotes = () => {
    if (!notes.trim() || !selectedFile) return;
    const blob = new Blob([notes], { type: 'text/plain;charset=utf-8' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `Anote_Foco_${selectedFile.name.replace(/\.pdf$/i, '')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
  };

  // Ask AI preset or prompt text
  const handleAskAI = async (promptPreset?: string) => {
    const textToAsk = promptPreset || aiInput;
    if (!textToAsk.trim()) return;
    
    setAiLoading(true);
    setAiResponse('');
    try {
      const responseText = await getQuickExplanation(textToAsk, notes, studyProfile);
      setAiResponse(responseText);
      if (!promptPreset) setAiInput('');
    } catch (err: any) {
      setAiResponse(`Erro ao contatar o Bizu Tutor: ${err.message || 'Tente novamente.'}`);
    } finally {
      setAiLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Filter display list
  const activeFileList = 
    explorerTab === 'LOCAL' 
      ? localFiles 
      : firebaseFiles;

  const filteredFiles = activeFileList.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col p-4 md:p-8 animate-in fade-in duration-500">
      
      {/* Upper header controls */}
      <div className="flex justify-between items-center gap-4 mb-6 relative z-10 w-full">
        <button 
          onClick={selectedFile ? () => setSelectedFile(null) : onBack} 
          className="text-gray-400 font-bold text-xs tracking-widest flex items-center gap-2 hover:text-gray-700 transition-colors uppercase py-2 px-3 hover:bg-gray-100/70 rounded-2xl"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          {selectedFile ? 'Biblioteca' : 'Sair e Voltar ao Painel'}
        </button>
        
        <div className="flex flex-col text-right">
          <div className="flex items-center gap-2 justify-end">
            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-200">
              {selectedFile ? `Modo Leitura: ${selectedFile.source === 'local' ? 'Local' : 'Firebase Cloud'}` : 'Navegação Coletiva'}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase mt-1">
            BIBLIOTECA <span className="text-blue-500">de foco</span>
          </h2>
        </div>
      </div>

      {/* Main Section */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden relative">
        
        {!selectedFile ? (
          
          /* EXPLORER DISPLAY (Unified with tabs for Locals and Google Drive) */
          <div className="flex-1 flex flex-col p-6 md:p-10 min-h-0 select-none">
            
            {/* Upper Selection Nav Tabs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center mb-8 pb-6 border-b border-gray-100">
              <div>
                <div className="flex bg-gray-100 p-1.5 rounded-2xl w-fit gap-1 mb-2">
                  <button 
                    onClick={() => setExplorerTab('LOCAL')}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 ${explorerTab === 'LOCAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    <Laptop className="w-4 h-4" />
                    Biblioteca Local ({localFiles.length})
                  </button>
                  <button 
                    onClick={() => setExplorerTab('FIREBASE')}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 ${explorerTab === 'FIREBASE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    <Database className="w-4 h-4" />
                    Biblioteca Firebase ({firebaseFiles.length})
                  </button>
                </div>
                <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">
                  {explorerTab === 'LOCAL' 
                    ? "Arraste e solte seus PDFs locais. Ficam salvos de forma segura no seu próprio navegador." 
                    : "Sincronize ou suba livros codificados em Base64 no Firebase Realtime Database."}
                </p>
              </div>

              {/* Filtering */}
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar por nome..."
                    className="bg-gray-50 border-2 border-transparent focus:border-blue-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:outline-none transition-all placeholder:text-gray-400 w-full sm:w-48"
                  />
                </div>
              </div>
            </div>

            {/* Error alerts if any */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl mb-6 text-xs font-bold">
                {error}
                <button onClick={() => setError(null)} className="ml-3 text-red-800 underline">Fechar</button>
              </div>
            )}

            {/* Tab Local Body: Drag & Drop Zone + Listings */}
            {explorerTab === 'LOCAL' && (
              <div className="flex-1 flex flex-col md:flex-row gap-8 min-h-0">
                
                {/* PDF Uploader Section */}
                <div className="w-full md:w-80 flex flex-col shrink-0">
                  <span className="text-gray-400 text-[9px] font-black uppercase tracking-widest mb-3 block">ADICIONAR NOVO PDF</span>
                  
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 min-h-[180px] border-2 border-dashed rounded-[30px] p-6 text-center flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-[1.01] ${isDragging ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-blue-300'}`}
                  >
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept=".pdf,application/pdf"
                      className="hidden"
                    />
                    
                    {loading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                        <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider animate-pulse">Armazenando na Biblioteca...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                          <Upload className="w-6 h-6 stroke-[2]" />
                        </div>
                        <h4 className="font-extrabold text-xs text-gray-700 uppercase tracking-tight mb-1">
                          Solte o PDF aqui
                        </h4>
                        <p className="text-gray-400 text-[10px] font-bold leading-normal max-w-[150px]">
                          ou clique para selecionar do seu dispositivo
                        </p>
                      </>
                    )}
                  </div>
                  
                  <div className="mt-4 bg-blue-50/40 border border-blue-50 rounded-2xl p-4 flex gap-2">
                    <Database className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-gray-500 font-bold leading-relaxed">
                      Sua biblioteca é armazenada no banco local (<span className="text-blue-600 font-extrabold">IndexedDB</span>) do seu navegador. Zero custos de plano de internet e total privacidade acadêmica!
                    </p>
                  </div>
                </div>

                {/* Local PDFs Grid */}
                <div className="flex-1 flex flex-col min-h-0">
                  <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-3 block">LIVROS E EDITAIS SALVOS ({filteredFiles.length})</span>
                  
                  {filteredFiles.length === 0 ? (
                    <div className="flex-1 border border-dashed border-gray-100 rounded-[35px] flex flex-col items-center justify-center text-center p-8">
                      <BookOpen className="w-10 h-10 text-gray-300 mb-3" />
                      <p className="text-gray-400 text-xs font-bold">Nenhum livro PDF salvo.</p>
                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Solte um arquivo ao lado para carregar sua primeira apostila!</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto pr-2 max-h-[350px] md:max-h-none grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredFiles.map((file) => (
                        <div 
                          key={file.id}
                          onClick={() => handleSelectFileEntry(file)}
                          className="bg-white border border-gray-100 hover:border-blue-200 rounded-[25px] p-5 shadow-inner/5 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                        >
                          <div className="flex items-start gap-4 mb-3">
                            <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform shrink-0">
                              <FileIcon className="w-5 h-5 stroke-[2]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-extrabold text-xs text-gray-800 line-clamp-2 leading-tight uppercase group-hover:text-blue-600 transition-colors">
                                {file.name}
                              </h4>
                              <span className="text-[9px] font-extrabold text-gray-400 block mt-1">
                                {formatSize(file.size)}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-gray-50 mt-auto">
                            <span className="text-[9px] bg-gray-100 px-2 py-0.5 rounded text-gray-500 uppercase font-black tracking-wider">
                              LOCAL ACC
                            </span>
                            
                            <div className="flex gap-2">
                              <button 
                                onClick={(e) => handleDeleteLocalFile(file.id, e)}
                                className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                title="Deletar este livro"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>

                              <span className="bg-blue-50 group-hover:bg-blue-500 text-blue-600 group-hover:text-white px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-1">
                                Abrir
                                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab Firebase Database Body */}
            {explorerTab === 'FIREBASE' && (
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                <div className="bg-blue-50/50 p-6 rounded-[25px] border border-blue-50 mb-6">
                  <h4 className="text-xs font-black uppercase text-blue-900 mb-2 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-blue-600" />
                    Sincronizador Firebase Realtime Database
                  </h4>
                  <p className="text-[10px] text-gray-500 font-bold mb-4">
                    Conectado ao link: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 break-all select-all">https://gen-lang-client-0709783251-default-rtdb.firebaseio.com/</code>
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-2 items-end mb-4">
                    <div className="flex-1">
                      <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                        Caminho do Banco (ex: pdfs, livros, /)
                      </label>
                      <input 
                        type="text"
                        value={firebasePathInput}
                        onChange={(e) => setFirebasePathInput(e.target.value)}
                        placeholder="pdfs"
                        className="w-full bg-white border border-gray-200 px-3 py-2.5 text-xs font-bold rounded-xl focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    
                    <button 
                      onClick={fetchFirebaseFiles}
                      disabled={firebaseSyncLoading}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-black text-[10px] uppercase tracking-wider px-5 py-3 rounded-xl flex items-center gap-1.5 transition-all text-center h-10"
                    >
                      {firebaseSyncLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                      Puxar do Firebase
                    </button>
                  </div>

                  {firebaseStatusMsg && (
                    <p className="text-[10px] bg-white px-3 py-2 rounded-lg border border-gray-100 font-extrabold text-blue-600">
                      {firebaseStatusMsg}
                    </p>
                  )}
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      LIVROS NO FIREBASE ({filteredFiles.length})
                    </span>
                    
                    {filteredFiles.length === 0 && !firebaseSyncLoading && (
                      <button 
                        onClick={handleInitializeSampleFirebase}
                        className="text-blue-500 hover:text-blue-700 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 bg-blue-50 px-2.5 py-1.5 rounded-xl transition-all"
                        title="Escreve livros de amostra diretamente no seu banco para teste instantâneo!"
                      >
                        <Sparkles className="w-3 h-3 text-blue-500" />
                        Sem Dados? Inicializar com Livros USP/TDAH
                      </button>
                    )}
                  </div>

                  {firebaseSyncLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 my-auto">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                      <span className="text-[10px] font-black uppercase text-gray-400">Varrendo banco de dados Firebase...</span>
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="flex-1 border border-dashed border-gray-100 rounded-[35px] flex flex-col items-center justify-center text-center p-8">
                      <BookOpen className="w-8 h-8 text-gray-300 mb-3" />
                      <p className="text-gray-400 text-xs font-bold mb-1">Nenhum livro PDF encontrado em "{firebasePathInput}".</p>
                      <p className="text-[10px] text-gray-400 max-w-sm mb-4">Caso seu banco de dados esteja vazio, use o botão acima para inicializar com dados de teste ou publique um livro na seção abaixo!</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                      {filteredFiles.map((file) => {
                        const isLoadedLocal = localFiles.some(lf => lf.name === file.name);
                        return (
                          <div 
                            key={file.id}
                            onClick={() => handleSelectFileEntry(file)}
                            className="bg-white border border-gray-100 hover:border-blue-200 rounded-[25px] p-5 shadow-inner/5 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                          >
                            <div className="flex items-start gap-4 mb-3">
                              <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform shrink-0">
                                <FileIcon className="w-5 h-5 stroke-[2]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-extrabold text-xs text-gray-800 line-clamp-2 leading-tight uppercase group-hover:text-blue-600 transition-colors">
                                  {file.name}
                                </h4>
                                <span className="text-[9px] font-extrabold text-gray-400 block mt-1">
                                  {file.firebaseUrl?.startsWith('data:') ? 'Base64 Byte Container' : formatSize(file.size)}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center pt-3 border-t border-gray-50 mt-auto gap-2">
                              {isLoadedLocal ? (
                                <span className="text-[9px] font-black uppercase text-green-600 bg-green-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  Salvo Local
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => handleSaveFirebaseToLocal(file, e)}
                                  className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Baixar e guardar localmente no navegador para usar 100% offline"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Sinc Offline
                                </button>
                              )}
                              
                              <span className="bg-blue-50 group-hover:bg-blue-500 text-blue-600 group-hover:text-white px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-1">
                                Ler Online
                                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Push Local to Firebase Realtime Database Option */}
                  <div className="mt-6 pt-6 border-t border-gray-100 bg-gray-50/50 p-6 rounded-[30px] my-6">
                    <h5 className="text-xs font-black uppercase text-slate-700 mb-2 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-purple-600" />
                      Publicar livro na Biblioteca Firebase
                    </h5>
                    <p className="text-[10px] text-gray-400 font-bold mb-4">
                      Você pode compartilhar seus materiais com outros aparelhos! Selecione um PDF de sua biblioteca local para subir como Base64 ou publique um link da internet.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Pushing existing local file */}
                      <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col justify-between">
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">A) Enviar de sua Biblioteca Local</span>
                          {localFiles.length === 0 ? (
                            <p className="text-[10px] text-gray-400 italic">Adicione livros na aba "Biblioteca Local" primeiro.</p>
                          ) : (
                            <select 
                              id="local-file-select-to-push"
                              onChange={(e) => setFirebaseTargetFileId(e.target.value)}
                              value={firebaseTargetFileId || ''}
                              className="w-full bg-slate-50 border border-gray-200 text-xs font-bold p-2.5 rounded-xl text-gray-700 outline-none"
                            >
                              <option value="">-- Escolha um livro local --</option>
                              {localFiles.map(lf => (
                                <option key={lf.id} value={lf.id}>
                                  {lf.name.length > 35 ? lf.name.substring(0, 35) + '...' : lf.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <button
                          disabled={!firebaseTargetFileId || firebaseSyncLoading}
                          onClick={handlePublishLocalFileToFirebase}
                          className="mt-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 text-white font-black text-[9px] uppercase tracking-widest py-2.5 rounded-xl h-10 transition-colors"
                        >
                          {firebaseSyncLoading ? "Subindo..." : "Upload Bytes (Base64)"}
                        </button>
                      </div>

                      {/* Publishing custom direct PDF link */}
                      <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col justify-between">
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">B) Publicar por Link direto da PDF</span>
                          <input 
                            type="text"
                            placeholder="Nome do livro (ex: Fisiologia de Guyton)"
                            id="custom-pdf-name-input"
                            className="w-full bg-slate-50 border border-gray-200 text-xs font-bold p-2 rounded-xl mb-2 focus:outline-none"
                          />
                          <input 
                            type="text"
                            placeholder="Endereço URL (http://.../livro.pdf)"
                            id="custom-pdf-url-input"
                            className="w-full bg-slate-50 border border-gray-200 text-xs font-bold p-2 rounded-xl focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={handlePublishLinkToFirebase}
                          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[9px] uppercase tracking-widest py-2.5 rounded-xl h-10 transition-colors"
                        >
                          Publicar Link (.pdf)
                        </button>
                      </div>

                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>
        ) : (
          
          /* SPLIT READER SYSTEM (Iframe displaying PDF file and custom sidebar) */
          <div id="drive-reader-split-layout" className="flex-1 flex flex-col lg:flex-row min-h-0 h-full">
            
            {/* Left Side: Viewer */}
            <div className="flex-1 bg-gray-950 flex flex-col min-h-[400px] lg:min-h-0 relative">
              
              {/* Header bar */}
              <div className="bg-gray-900 text-white/90 p-4 border-b border-white/5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg">
                    <FileIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-xs max-w-xs sm:max-w-md md:max-w-xl truncate uppercase tracking-tight">
                      {selectedFile.name}
                    </h4>
                    <span className="text-[10px] text-gray-400 font-bold block">
                      {bookPagesList.length} página(s) segura(s) carregada(s)
                    </span>
                  </div>
                </div>
                
                {/* Mode Selector Tabs inside the viewer */}
                <div className="flex bg-gray-950/80 p-1 rounded-xl border border-white/5 self-start sm:self-auto shrink-0">
                  <button
                    onClick={() => setViewerMode('IMAGE_PAGES')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${viewerMode === 'IMAGE_PAGES' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    <Sparkles className="w-3 h-3" />
                    Leitor Seguro (Páginas/Prints 📸)
                  </button>
                  <button
                    onClick={() => setViewerMode('IFRAME_PDF')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${viewerMode === 'IFRAME_PDF' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    <FileIcon className="w-3 h-3" />
                    Ver PDF Inteiro
                  </button>
                </div>
              </div>

              {/* MAIN CONTROLLER AREA */}
              <div className="flex-1 flex flex-col min-h-0 relative">
                
                {/* MODE A: SAFE IMAGE PAGES READER */}
                {viewerMode === 'IMAGE_PAGES' && (
                  <div className="flex-1 flex flex-col min-h-0 bg-slate-900 text-slate-100 overflow-y-auto">
                    
                    {/* Upload bar */}
                    <div className="bg-slate-950 p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                      <div className="text-center sm:text-left">
                        <h5 className="text-[11px] font-black uppercase tracking-wider text-blue-400">
                          📸 Enviar Páginas do Livro (Sem Bloqueios)
                        </h5>
                        <p className="text-[9px] text-gray-400 font-bold">
                          Envie fotos ou capturas de tela das páginas de estudo. Salvas off-line com total segurança!
                        </p>
                      </div>
                      
                      <label className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                        Escolher Imagens/Prints
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*" 
                          onChange={handleUploadBookPage} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    {/* Dynamic thumbnails flow */}
                    {bookPagesList.length > 0 && (
                      <div className="bg-slate-950/50 p-3 border-b border-slate-800 flex items-center gap-3 overflow-x-auto shrink-0 min-h-[90px]">
                        <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 shrink-0 select-none mr-1">Relação:</span>
                        {bookPagesList.map((p, idx) => (
                          <div 
                            key={p.id}
                            onClick={() => setActivePageIdx(idx)}
                            className={`group relative w-16 h-16 rounded-lg border-2 overflow-hidden shrink-0 cursor-pointer transition-all ${activePageIdx === idx ? 'border-blue-500 scale-105 shadow-md shadow-blue-500/20' : 'border-slate-800 hover:border-slate-600'}`}
                          >
                            <img 
                              src={p.url} 
                              alt={p.name} 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                            
                            {/* Delete button indicator inside page */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBookPage(idx);
                              }}
                              className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-700 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-20"
                              title="Excluir página"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>

                            <div className="absolute bottom-0 inset-x-0 bg-black/75 text-center text-[7px] py-0.5 font-black truncate text-white uppercase px-1 leading-tight z-10">
                              Pág {idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Display Canvas area */}
                    <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[300px]">
                      {bookPagesList.length === 0 ? (
                        <div className="text-center max-w-sm py-12 px-6">
                          <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-500/25">
                            <Plus className="w-8 h-8" />
                          </div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">Nenhuma página enviada</h4>
                          <p className="text-[10px] text-gray-400 font-bold leading-relaxed mt-2">
                            Se o navegador bloqueou o PDF completo por restrições do Chrome, tire print das páginas de estudo e faça o upload aqui! Elas carregam instantaneamente no app.
                          </p>
                          <div className="mt-5 inline-block bg-slate-950 p-3 rounded-2xl border border-slate-800 text-left">
                            <span className="text-[8px] font-black uppercase text-blue-400 tracking-widest block mb-1">Passo a passo:</span>
                            <p className="text-[9px] text-slate-450 leading-normal font-bold">
                              1. Abra o PDF em seu smartphone ou na guia cheia.<br />
                              2. Faça captura de tela da página ou tire foto com a câmera.<br />
                              3. Clique no botão de enviar acima para estudar tranquilamente!
                            </p>
                          </div>
                        </div>
                      ) : activePageIdx >= 0 && bookPagesList[activePageIdx] ? (
                        <div className="w-full flex-1 flex flex-col items-center justify-between min-h-0 bg-slate-900/40 rounded-2xl border border-slate-800/80 p-4 max-w-4xl mx-auto">
                          
                          {/* Page header controls */}
                          <div className="w-full flex justify-between items-center bg-slate-950/80 px-4 py-2 rounded-xl mb-4 border border-slate-800 shrink-0 select-none">
                            <span className="text-[9px] font-black uppercase tracking-wider text-blue-400">
                              Visualizando página {activePageIdx + 1} de {bookPagesList.length}
                            </span>
                            
                            <div className="flex items-center gap-2">
                              <button
                                disabled={activePageIdx <= 0}
                                onClick={() => setActivePageIdx(prev => prev - 1)}
                                className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-colors"
                              >
                                Anterior
                              </button>
                              <button
                                disabled={activePageIdx >= bookPagesList.length - 1}
                                onClick={() => setActivePageIdx(prev => prev + 1)}
                                className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-colors"
                              >
                                Próxima
                              </button>
                            </div>
                          </div>

                          {/* Main centered image frame with full zoom capability */}
                          <div className="flex-1 w-full flex items-center justify-center overflow-auto min-h-0 relative p-2 select-none">
                            <img 
                              src={bookPagesList[activePageIdx].url} 
                              alt={`Página ${activePageIdx + 1}`} 
                              className="max-h-[60vh] max-w-full rounded-lg border border-slate-800 shadow-2xl object-contain transition-all duration-300" 
                              referrerPolicy="no-referrer"
                            />
                          </div>

                          {/* Tips footer */}
                          <p className="text-[9px] text-gray-500 font-extrabold text-center uppercase tracking-wider mt-4">
                            💡 Use a aba do lado direito para escrever suas notas e ativar o temporizador de foco!
                          </p>
                        </div>
                      ) : null}
                    </div>

                  </div>
                )}

                {/* MODE B: ORIGINAL IFRAME PDF (Standard view) */}
                {viewerMode === 'IFRAME_PDF' && (
                  <div className="flex-1 flex flex-col min-h-0 relative">
                    {/* Informative Help Bar if standard nested iframe blocks on Chrome */}
                    <div className="bg-amber-950/40 border-b border-amber-500/10 px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 text-amber-300 text-[10px] font-bold z-10 shrink-0">
                      <span className="flex items-center gap-1.5 leading-tight text-center md:text-left">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Se faltar compatibilidade com iframe no Chrome Sandbox, mude para o "Leitor Seguro 📸" acima!</span>
                      </span>
                      <a 
                        href={selectedFile.source === 'google' ? `https://drive.google.com/file/d/${selectedFile.id}/view` : selectedFile.localUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="bg-amber-600 hover:bg-amber-500 text-slate-950 px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all shrink-0 hover:scale-[1.02]"
                      >
                        Abrir PDF externo ↗
                      </a>
                    </div>

                    {/* PDF Frame */}
                    <div className="flex-1 w-full bg-gray-950 relative">
                      {selectedFile.source === 'local' || selectedFile.source === 'firebase' ? (
                        selectedFile.localUrl ? (
                          <iframe 
                            src={`${selectedFile.localUrl}#toolbar=0`}
                            className="w-full h-full border-0 absolute inset-0"
                            allow="autoplay"
                            title={selectedFile.name}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8">
                            <p className="font-bold mb-2">LocalUrl expirada para esta sessão.</p>
                            <button 
                              onClick={() => handleSelectFileEntry(selectedFile)}
                              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider"
                            >
                              Recarregar PDF Local
                            </button>
                          </div>
                        )
                      ) : (
                        <iframe 
                          src={`https://drive.google.com/file/d/${selectedFile.id}/preview`}
                          className="w-full h-full border-0 absolute inset-0"
                          allow="autoplay"
                          title={selectedFile.name}
                        />
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Right Side: Study Buddy Control Companion */}
            <div className="w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col h-[550px] lg:h-auto bg-white min-h-0">
              
              {/* Sideroad Navigation Heads */}
              <div className="flex border-b border-gray-100 bg-gray-50/50 p-2 gap-1 shrink-0">
                <button 
                  onClick={() => setSidebarTab('NOTES')}
                  className={`flex-1 py-3 px-1 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${sidebarTab === 'NOTES' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Notas
                </button>
                <button 
                  onClick={() => setSidebarTab('FOCUS')}
                  className={`flex-1 py-3 px-1 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${sidebarTab === 'FOCUS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Foco / Ambient
                </button>
                <button 
                  onClick={() => setSidebarTab('AI')}
                  className={`flex-1 py-3 px-1 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${sidebarTab === 'AI' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Bizu IA
                </button>
              </div>

              {/* Sidebar Content Space */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col">
                
                {/* 1. NOTES WRITER */}
                {sidebarTab === 'NOTES' && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-4 cursor-default">
                      <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isNotesSaved ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`}></span>
                        {isNotesSaved ? 'Salvo Automaticamente' : 'Escrevendo...'}
                      </span>
                      
                      {notes.trim() && (
                        <button 
                          onClick={handleExportNotes}
                          className="text-blue-500 hover:text-blue-700 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg"
                        >
                          <Download className="w-3 h-3" />
                          Baixar Notas (.txt)
                        </button>
                      )}
                    </div>

                    <textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="DIGITE SEUS RESUMOS E RECORDAÇÕES AQUI...
Use este espaço-rascunho para registrar fórmulas, conceitos críticos, ideias e insights gerados durante a leitura ativa!"
                      className="flex-1 w-full bg-slate-50 border-2 border-transparent focus:border-blue-400 p-5 rounded-[25px] font-mono text-xs leading-relaxed focus:outline-none resize-none transition-all placeholder:text-gray-400 shadow-inner min-h-[220px]"
                    />

                    <div className="mt-4 bg-emerald-50/50 rounded-2xl p-4 border border-emerald-50">
                      <p className="text-emerald-700 font-extrabold text-[10px] uppercase tracking-widest mb-1">RECORDATIVO TDAH:</p>
                      <p className="text-[10px] text-gray-500 leading-normal font-bold">
                        Ao terminar um capítulo importante, registre aqui 3 tópicos essenciais baseados unicamente em sua memória. Esse treino de recall ativo melhora drásticamente a fixação para o seu exame!
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. POMODORO TIMER AND WHITE NOISE MIXER */}
                {sidebarTab === 'FOCUS' && (
                  <div className="space-y-8 select-none">
                    
                    {/* Interval shield clock */}
                    <div className="bg-slate-50 rounded-[35px] p-6 border border-slate-100/50 text-center relative overflow-hidden">
                      <span className="text-orange-500 font-black text-[9px] uppercase tracking-widest block mb-1">TEMPORIZADOR FOCUS</span>
                      <h5 className="text-xs font-bold text-gray-500 mb-4">Sprints produtivas de 10 ou 25 minutos</h5>
                      
                      <div className="text-5xl font-black font-mono tracking-tight text-slate-800 mb-6 flex justify-center items-center gap-1">
                        {formatTime(timerSeconds)}
                      </div>

                      <div className="flex gap-3 justify-center">
                        <button 
                          onClick={() => setTimerActive(!timerActive)}
                          className={`px-5 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-all text-white ${timerActive ? 'bg-red-500 shadow-md shadow-red-100' : 'bg-orange-500 shadow-lg shadow-orange-100'}`}
                        >
                          {timerActive ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                          {timerActive ? 'Pausar' : 'Iniciar'}
                        </button>
                        <button 
                          onClick={() => {
                            setTimerActive(false);
                            setTimerSeconds(1500);
                          }}
                          className="bg-white hover:bg-gray-100 text-gray-500 border border-gray-100 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        
                        <button 
                          type="button"
                          onClick={() => { setTimerActive(false); setTimerSeconds(10 * 60); }} 
                          className="bg-white hover:bg-gray-100 text-[#0c1830] border border-gray-100 px-3 py-2 rounded-xl text-[9px] font-black"
                        >
                          10m
                        </button>
                        
                        <button 
                          type="button"
                          onClick={() => { setTimerActive(false); setTimerSeconds(25 * 60); }} 
                          className="bg-white hover:bg-gray-100 text-[#0c1830] border border-gray-100 px-3 py-2 rounded-xl text-[9px] font-black"
                        >
                          25m
                        </button>
                      </div>
                    </div>

                    {/* Integrated background noise player */}
                    <div className="bg-slate-50/50 rounded-[35px] p-6 border border-slate-100">
                      <span className="text-blue-500 font-black text-[9px] uppercase tracking-widest block mb-4">MÚSICA E BLOQUEADORES DE RUÍDO</span>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-center bg-white p-3.5 rounded-2xl border border-gray-100">
                          <span className="text-xs font-extrabold text-gray-700">Canal MPB Lofi</span>
                          <button 
                            onClick={() => setActiveChannel(activeChannel === 'MPB' ? null : 'MPB')}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeChannel === 'MPB' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            {activeChannel === 'MPB' ? 'TOCANDO' : 'TOCAR'}
                          </button>
                        </div>

                        <div className="flex justify-between items-center bg-white p-3.5 rounded-2xl border border-gray-100">
                          <span className="text-xs font-extrabold text-gray-700">Canal Relax Lofi</span>
                          <button 
                            onClick={() => setActiveChannel(activeChannel === 'RELAX' ? null : 'RELAX')}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeChannel === 'RELAX' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            {activeChannel === 'RELAX' ? 'TOCANDO' : 'TOCAR'}
                          </button>
                        </div>

                        <div className="flex justify-between items-center bg-white p-3.5 rounded-2xl border border-gray-100">
                          <span className="text-xs font-extrabold text-gray-700">Sons de Chuva</span>
                          <button 
                            onClick={() => setIsPlayingRain(!isPlayingRain)}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isPlayingRain ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            {isPlayingRain ? 'MUTAR' : 'CHOVER'}
                          </button>
                        </div>

                        {/* Rain slider */}
                        <div className="flex items-center gap-3 pt-4">
                          <VolumeX className="w-4 h-4 text-gray-300" />
                          <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05" 
                            value={audioVolume}
                            onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                            className="flex-1 accent-blue-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                          />
                          <Volume2 className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* 3. BIZU TUTOR CHAT MODULE */}
                {sidebarTab === 'AI' && (
                  <div className="flex-1 flex flex-col min-h-0 space-y-4">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-2xl p-4 border border-blue-100/50 flex gap-3">
                      <Sparkles className="w-5 h-5 text-blue-500 shrink-0 mt-0.5 animate-bounce" />
                      <div>
                        <h6 className="font-extrabold text-blue-900 text-[10px] uppercase tracking-widest">RASCUNHO RÁPIDO DO BIZU</h6>
                        <p className="text-[10px] text-gray-500 leading-relaxed font-semibold mt-1">
                          Cole parágrafos complexos do PDF abaixo para o Bizu traduzir instantaneamente com analogias para mentes com TDAH.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <textarea 
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        placeholder="Ex: Copie e cole um conceito confuso para entender em 3 palavras..."
                        className="w-full bg-slate-50 border border-gray-100 focus:border-blue-300 rounded-2xl p-4 text-[11px] font-bold focus:outline-none resize-none transition-all placeholder:text-gray-400 h-24 shadow-inner"
                      />
                      
                      <div className="flex justify-end">
                        <button 
                          disabled={aiLoading}
                          onClick={() => handleAskAI()}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center gap-1 text-center"
                        >
                          {aiLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Explicar Conceito
                        </button>
                      </div>
                    </div>

                    {/* Quick shortcuts */}
                    <div className="flex flex-wrap gap-1.5 py-1">
                      <span className="text-gray-400 text-[8px] font-black uppercase tracking-widest block w-full">PRESSET DIAGNÓSTICOS:</span>
                      <button 
                        onClick={() => handleAskAI("Gere um resumo em 3 bullet-points super didáticos do assunto das minhas anotações.")}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg text-[9px] font-bold"
                      >
                        Resumir Notas
                      </button>
                      <button 
                        onClick={() => handleAskAI("Crie uma analogia absurda e divertida da biologia ou informática para esclarecer o assunto atual")}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg text-[9px] font-bold"
                      >
                        Analogia Maluca
                      </button>
                      <button 
                        onClick={() => handleAskAI("Me faça 3 perguntas rápidas do tipo certo-ou-errado para testar minha atenção neste exato assunto")}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg text-[9px] font-bold"
                      >
                        Game de Atenção
                      </button>
                    </div>

                    {/* Chat result */}
                    <div className="flex-1 min-h-[150px] bg-slate-50 rounded-[25px] p-5 border border-slate-100 overflow-y-auto max-h-[220px] scrollbar-thin">
                      {aiLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 my-auto">
                          <Loader2 className="w-7 h-7 animate-spin text-blue-500 mb-2" />
                          <p className="text-[10px] uppercase font-black tracking-wider text-gray-400">O Bizu está digerindo...</p>
                        </div>
                      ) : aiResponse ? (
                        <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-medium markdown-body">
                          {aiResponse}
                        </div>
                      ) : (
                        <p className="text-gray-400 italic text-[10px] text-center font-bold py-10 my-auto">
                          Digite uma pergunta para o Bizu decifrar o assunto.
                        </p>
                      )}
                    </div>
                  </div>
                )}

              </div>
              
              {/* Footer navigation */}
              <div className="bg-slate-50/50 p-4 border-t border-gray-100 shrink-0 text-center flex justify-between items-center select-none">
                <button 
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-400 hover:text-gray-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Mudar de Livro
                </button>
                
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Estudos TDAH v1.1
                </span>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
