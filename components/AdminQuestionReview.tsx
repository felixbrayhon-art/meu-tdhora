import React, { useEffect, useState } from 'react';
import { QuestionDraft, QuestionImportBatch, PublishedQuestion } from '../types';
import {
  approveDraft,
  findPackageDuplicates,
  findPossibleDuplicates,
  listDraftsForImport,
  listImports,
  PackageQuestion,
  parsePackage,
  publishPackage,
  rejectDraft,
  updateDraft,
} from '../services/questionBankService';
import { ChevronLeft, ClipboardList, Check, X, Trash2, AlertTriangle, CheckCircle2, Save } from './icons';

interface AdminQuestionReviewProps {
  uid: string;
  onBack: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pendente',
  needs_attention: 'Precisa de revisão',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
};

const STATUS_COLOR: Record<string, string> = {
  pending_review: 'bg-gray-100 text-gray-600',
  needs_attention: 'bg-[#fee6d5] text-[#ff832a]',
  approved: 'bg-[#e9efda] text-[#98b847]',
  rejected: 'bg-red-100 text-red-600',
};

const DraftEditor: React.FC<{
  draft: QuestionDraft;
  uid: string;
  onClose: () => void;
  onChanged: (updated: QuestionDraft | null) => void;
}> = ({ draft, uid, onClose, onChanged }) => {
  const [statement, setStatement] = useState(draft.statement);
  const [subjectRaw, setSubjectRaw] = useState(draft.subjectRaw ?? '');
  const [topicRaw, setTopicRaw] = useState(draft.topicRaw ?? '');
  const [explanation, setExplanation] = useState(draft.explanation);
  const [alternatives, setAlternatives] = useState(draft.alternatives);
  const [correctLetter, setCorrectLetter] = useState(draft.correctLetter ?? '');
  const [duplicates, setDuplicates] = useState<PublishedQuestion[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    findPossibleDuplicates(draft).then(setDuplicates).catch(() => setDuplicates([]));
  }, [draft.id]);

  const buildPatch = () => ({
    statement: statement.trim(),
    subjectRaw: subjectRaw.trim() || null,
    topicRaw: topicRaw.trim() || null,
    explanation: explanation.trim(),
    correctLetter: correctLetter || null,
    alternatives: alternatives.map(a => ({ ...a, isCorrect: a.letter === correctLetter })),
  });

  const handleSave = async () => {
    setBusy(true);
    try {
      const patch = buildPatch();
      await updateDraft(draft.id, patch);
      onChanged({ ...draft, ...patch });
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    setBusy(true);
    try {
      const patch = buildPatch();
      await updateDraft(draft.id, patch);
      await approveDraft({ ...draft, ...patch }, uid);
      onChanged(null);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await rejectDraft(draft.id);
      onChanged(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-[#473c33]/40 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-[28px] max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-logo text-xl text-gray-900">Questão {draft.number}</h3>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">Página {draft.sourcePage} · {draft.source}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {duplicates.length > 0 && (
            <div className="flex items-start gap-2 bg-[#fff1e8] border border-[#fed6ba] rounded-2xl px-4 py-3 text-sm text-[#ec6300]">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>Esta questão provavelmente já está cadastrada ({duplicates.length} correspondência{duplicates.length > 1 ? 's' : ''} no banco publicado).</span>
            </div>
          )}

          {draft.warnings.length > 0 && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <ul className="list-disc pl-4 space-y-0.5">
                {draft.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Matéria</label>
              <input value={subjectRaw} onChange={e => setSubjectRaw(e.target.value)} className="w-full mt-1 bg-gray-50 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#fec8a2]" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Assunto</label>
              <input value={topicRaw} onChange={e => setTopicRaw(e.target.value)} className="w-full mt-1 bg-gray-50 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#fec8a2]" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Enunciado</label>
            <textarea value={statement} onChange={e => setStatement(e.target.value)} rows={5} className="w-full mt-1 bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#fec8a2]" />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wide text-gray-400 mb-1 block">Alternativas — marque a correta</label>
            <div className="space-y-2">
              {alternatives.map((alt, idx) => (
                <div key={alt.letter} className={`flex items-start gap-3 rounded-2xl border px-3 py-2.5 ${correctLetter === alt.letter ? 'border-[#fec8a2] bg-[#fff1e8]' : 'border-gray-100'}`}>
                  <button
                    onClick={() => setCorrectLetter(alt.letter)}
                    className={`mt-0.5 w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center font-black text-xs ${correctLetter === alt.letter ? 'bg-[#fdad74] text-white' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {alt.letter}
                  </button>
                  <textarea
                    value={alt.text}
                    onChange={e => {
                      const next = [...alternatives];
                      next[idx] = { ...alt, text: e.target.value };
                      setAlternatives(next);
                    }}
                    rows={2}
                    className="flex-1 min-w-0 bg-transparent text-sm text-gray-800 focus:outline-none resize-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Explicação</label>
            <textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={6} className="w-full mt-1 bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#fec8a2]" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
          <button disabled={busy} onClick={handleReject} className="px-4 py-3 rounded-xl bg-red-50 text-red-600 font-black text-xs uppercase tracking-wide hover:bg-red-100 transition-colors disabled:opacity-50">
            Rejeitar
          </button>
          <button disabled={busy} onClick={handleSave} className="flex-1 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-black text-xs uppercase tracking-wide hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> Salvar alteração
          </button>
          <button disabled={busy || !correctLetter} onClick={handleApprove} className="flex-1 px-4 py-3 rounded-xl bg-[#fdad74] text-white font-black text-xs uppercase tracking-wide hover:bg-[#fda769] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            <Check className="w-4 h-4" /> Aprovar
          </button>
        </div>
      </div>
    </div>
  );
};

// Publishes a JSON package (built by montar_banco_reais.py) straight to the published bank, skipping the draft review.
// Admin only (firestore.rules enforces it): shows what is in the file and how many are new before anything is written.
const PackagePublisher: React.FC<{ uid: string }> = ({ uid }) => {
  const [fileName, setFileName] = useState('');
  const [questions, setQuestions] = useState<PackageQuestion[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState('');

  const docKey = (q: PackageQuestion) => `${q.source}_${q.externalId}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 1400);
  const fresh = duplicates ? questions.filter(q => !duplicates.has(docKey(q))) : [];
  const groups = new Map<string, number>();
  fresh.forEach(q => { const k = `${q.position ?? 'Sem área'} › ${q.importSubject ?? 'Sem matéria'}`; groups.set(k, (groups.get(k) ?? 0) + 1); });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(''); setDuplicates(null); setBusy(true); setProgress('Lendo o arquivo…');
    try {
      const parsed = parsePackage(JSON.parse(await file.text()));
      setFileName(file.name); setQuestions(parsed.questions); setProblems(parsed.problems);
      setProgress('Conferindo o que já está no banco…');
      setDuplicates(await findPackageDuplicates(parsed.questions));
    } catch (error) {
      setResult(`Não consegui ler o arquivo: ${error instanceof Error ? error.message : error}`);
    } finally { setBusy(false); setProgress(''); }
  };

  const publish = async () => {
    if (!fresh.length || !window.confirm(`Publicar ${fresh.length} questões novas direto no banco de reais, sem passar pela revisão?`)) return;
    setBusy(true); setResult('');
    try {
      const done = await publishPackage(fresh, uid, (d, t) => setProgress(`Publicando… ${d}/${t}`));
      setResult(`Pronto: ${done} questões publicadas no banco de reais.`);
      setDuplicates(null); setQuestions([]);
    } catch (error) {
      setResult(`Falhou no meio: ${error instanceof Error ? error.message : error}. O que já foi gravado fica; envie o mesmo arquivo de novo para completar (as repetidas são puladas).`);
    } finally { setBusy(false); setProgress(''); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 mb-4 space-y-3">
      <p className="font-black text-gray-900">Publicar pacote de questões (JSON)</p>
      <p className="text-xs text-gray-500">Envia direto ao banco de reais, sem a revisão de rascunhos. Questões que já existem (mesmo id ou mesmo enunciado) são puladas.</p>
      <input type="file" accept="application/json,.json" disabled={busy} onChange={e => onFile(e.target.files?.[0])} className="text-sm" />
      {progress && <p className="text-sm font-bold text-gray-500">{progress}</p>}
      {fileName && duplicates && (
        <div className="text-sm text-gray-700 space-y-1">
          <p><b>{fileName}</b>: {questions.length} questões válidas{problems.length ? `, ${problems.length} recusadas pela validação` : ''}; <b>{fresh.length} novas</b>, {questions.length - fresh.length} já no banco.</p>
          {[...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => <p key={k} className="text-xs text-gray-500">{n} · {k}</p>)}
          {groups.size > 12 && <p className="text-xs text-gray-400">… e mais {groups.size - 12} grupos</p>}
          {problems.slice(0, 3).map(p => <p key={p} className="text-xs text-amber-600">{p}</p>)}
          <button onClick={publish} disabled={busy || !fresh.length} className="mt-2 px-4 py-2 rounded-xl bg-[#fdad74] text-white font-black text-sm disabled:opacity-40">Publicar {fresh.length} questões</button>
        </div>
      )}
      {result && <p className="text-sm font-bold text-gray-700">{result}</p>}
    </div>
  );
};

const AdminQuestionReview: React.FC<AdminQuestionReviewProps> = ({ uid, onBack }) => {
  const [imports, setImports] = useState<QuestionImportBatch[]>([]);
  const [selectedImport, setSelectedImport] = useState<QuestionImportBatch | null>(null);
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [editingDraft, setEditingDraft] = useState<QuestionDraft | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listImports().then(setImports).finally(() => setLoading(false));
  }, []);

  const openImport = async (batch: QuestionImportBatch) => {
    setSelectedImport(batch);
    setLoading(true);
    try {
      setDrafts(await listDraftsForImport(batch.id));
    } finally {
      setLoading(false);
    }
  };

  const refreshDrafts = async () => {
    if (!selectedImport) return;
    setDrafts(await listDraftsForImport(selectedImport.id));
  };

  const handleDraftChanged = async (updated: QuestionDraft | null) => {
    setEditingDraft(null);
    if (updated) {
      setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    } else {
      await refreshDrafts();
    }
  };

  const pending = drafts.filter(d => d.status === 'pending_review' || d.status === 'needs_attention');
  const needingAttention = drafts.filter(d => d.status === 'needs_attention').length;

  return (
    <div className="flex-1 w-full flex flex-col bg-[#FDFBF7] h-full" style={{ overflowY: 'auto' }}>
      <div className="bg-white px-6 md:px-10 py-6 shadow-sm border-b border-gray-100 flex-shrink-0 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => (selectedImport ? setSelectedImport(null) : onBack())} className="p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="font-logo text-2xl text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[#fdad74]" />
            {selectedImport ? selectedImport.title ?? 'Importação' : 'Revisão de importações'}
          </h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide mt-0.5">
            {selectedImport
              ? `${drafts.length} detectadas · ${drafts.length - needingAttention - drafts.filter(d => d.status === 'approved' || d.status === 'rejected').length} pendentes · ${needingAttention} precisam de revisão`
              : `${imports.length} importações`}
          </p>
        </div>
      </div>

      <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
        {!selectedImport && <PackagePublisher uid={uid} />}

        {loading && <p className="text-center text-gray-400 font-bold py-16">Carregando…</p>}

        {!loading && !selectedImport && imports.length === 0 && (
          <p className="text-center text-gray-400 font-bold py-16">
            Nenhuma importação ainda. Rode <code className="bg-gray-100 px-1.5 py-0.5 rounded">worker/scripts/push_drafts.py</code> para enviar um PDF processado.
          </p>
        )}

        {!loading && !selectedImport && (
          <div className="space-y-2">
            {imports.map(batch => (
              <button key={batch.id} onClick={() => openImport(batch)} className="w-full flex items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 px-5 py-4 hover:shadow-md hover:border-[#fed6ba] transition-all text-left">
                <div className="min-w-0">
                  <p className="font-black text-gray-900 truncate">{batch.title ?? batch.source}</p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mt-0.5">{batch.source} · {batch.totalQuestions} questões</p>
                </div>
                <p className="text-xs text-gray-400 flex-shrink-0">{new Date(batch.importedAt).toLocaleDateString('pt-BR')}</p>
              </button>
            ))}
          </div>
        )}

        {!loading && selectedImport && (
          <div className="space-y-2">
            {drafts.map(d => (
              <button key={d.id} onClick={() => setEditingDraft(d)} className="w-full flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-5 py-3.5 hover:shadow-md hover:border-[#fed6ba] transition-all text-left">
                <span className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center font-black text-xs text-gray-500 flex-shrink-0">{d.number}</span>
                <p className="flex-1 min-w-0 text-sm text-gray-700 truncate">{d.statement}</p>
                <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full flex-shrink-0 flex items-center gap-1 ${STATUS_COLOR[d.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {d.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                  {d.status === 'needs_attention' && <AlertTriangle className="w-3 h-3" />}
                  {d.status === 'rejected' && <Trash2 className="w-3 h-3" />}
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
              </button>
            ))}
            {drafts.length === 0 && <p className="text-center text-gray-400 font-bold py-16">Nenhuma questão nesta importação.</p>}
          </div>
        )}
      </div>

      {editingDraft && (
        <DraftEditor draft={editingDraft} uid={uid} onClose={() => setEditingDraft(null)} onChanged={handleDraftChanged} />
      )}
    </div>
  );
};

export default AdminQuestionReview;
