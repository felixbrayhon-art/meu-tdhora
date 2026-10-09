import React, { useRef, useState } from 'react';
import { Download, Upload } from './icons';
import { downloadBackup, readBackupFile, restoreBackup, backupSummary } from '../services/localBackup';

interface RestoreCallbacks {
  onStart: () => void;
  onDone: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

// Asks before overwriting, restores, then reloads so every screen reads the restored data.
const restoreFromFile = async (file: File | undefined, cb: RestoreCallbacks) => {
  if (!file) return;
  try {
    const backup = await readBackupFile(file);
    const when = backupSummary(backup).createdAt.toLocaleString('pt-BR');
    if (!window.confirm(`Restaurar o backup de ${when}?\n\nOs dados deste backup vão substituir os itens com o mesmo nome neste navegador. O app recarrega no final.`)) {
      cb.onCancel();
      return;
    }
    cb.onStart();
    await restoreBackup(backup);
    cb.onDone();
    setTimeout(() => window.location.reload(), 900);
  } catch (error) {
    cb.onError(error instanceof Error ? error.message : 'Não foi possível restaurar o backup.');
  }
};
// Download / restore everything this browser keeps (notes, cadernos, flashcards, edital,
// revisões, Drive files, drawings). Needed to move to a new address or device, since
// browser data stays tied to the site it was saved on.
export const BackupSection: React.FC = () => {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setBusy('export');
    setMessage(null);
    try {
      const { bytes } = await downloadBackup();
      setMessage({ kind: 'ok', text: `Backup baixado (${(bytes / 1024 / 1024).toFixed(1)} MB). Guarde o arquivo em um lugar seguro.` });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Não foi possível gerar o backup.' });
    } finally {
      setBusy(null);
    }
  };

  const handleImport = (file?: File) => restoreFromFile(file, {
    onStart: () => { setMessage(null); setBusy('import'); },
    onDone: () => setMessage({ kind: 'ok', text: 'Backup restaurado. Recarregando…' }),
    onError: (text) => { setMessage({ kind: 'error', text }); setBusy(null); },
    onCancel: () => setBusy(null),
  }).finally(() => { if (fileRef.current) fileRef.current.value = ''; });

  return (
    <div>
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Backup dos seus dados</label>
      <div className="rounded-[30px] border border-[#fff0d5] bg-white p-6">
        <p className="text-sm font-semibold text-[#473c33]">Anotações, cadernos, flashcards, edital, revisões, arquivos do Drive e desenhos ficam guardados neste navegador.</p>
        <p className="mt-1 text-xs font-medium text-gray-500">Baixe um backup para guardar uma cópia ou levar tudo para outro aparelho ou endereço do app.</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={handleExport} disabled={!!busy} className="min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-[#a8431a] px-4 text-xs font-black uppercase tracking-wide text-white transition-all hover:bg-[#bf4f1b] active:scale-95 disabled:opacity-50">
            <Download className="h-4 w-4" /> {busy === 'export' ? 'Gerando…' : 'Baixar backup'}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className="min-h-[48px] flex items-center justify-center gap-2 rounded-2xl border-2 border-[#fed386] bg-white px-4 text-xs font-black uppercase tracking-wide text-[#473c33] transition-all active:scale-95 disabled:opacity-50">
            <Upload className="h-4 w-4" /> {busy === 'import' ? 'Restaurando…' : 'Restaurar backup'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="Escolher arquivo de backup" onChange={(e) => handleImport(e.target.files?.[0])} />
        {message && (
          <p role="status" className={`mt-3 text-xs font-bold ${message.kind === 'ok' ? 'text-[#4c6324] dark:text-[#b4cd86]' : 'text-[#a64b32] dark:text-[#f28b8b]'}`}>{message.text}</p>
        )}
      </div>
    </div>
  );
};

/** Small link for the first screen, so a student moving to a new address restores instead of starting over. */
export const RestoreBackupLink: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#473c33]/20 px-4 text-xs font-black text-[#725e4a] transition-colors hover:border-[#e96f34] hover:text-[#a8431a] disabled:opacity-50 dark:border-white/15 dark:text-[#d1c7b3]"
      >
        <Upload className="h-4 w-4" /> {busy ? 'Restaurando…' : 'Já tenho um backup'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label="Escolher arquivo de backup"
        onChange={(e) => {
          setError(null);
          restoreFromFile(e.target.files?.[0], {
            onStart: () => setBusy(true),
            onDone: () => undefined,
            onError: (text) => { setError(text); setBusy(false); },
            onCancel: () => setBusy(false),
          }).finally(() => { if (fileRef.current) fileRef.current.value = ''; });
        }}
      />
      {error && <p role="alert" className="mt-2 text-xs font-bold text-[#a64b32] dark:text-[#f28b8b]">{error}</p>}
    </div>
  );
};
