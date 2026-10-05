import React, { useEffect, useState } from 'react';
import { BankFacetOption, listBankImportSubjects } from '../services/questionBankService';
import { ChevronLeft, Search } from './icons';
import LoadingFish from './LoadingFish';

// Método VR — question-by-question reverse engineering study mode.
// This is the entry scaffold only (subject selection + a placeholder for
// the session flow below it): QUESTÃO → RESULTADO → ENGENHARIA REVERSA →
// MICROESTUDO → DIAGNÓSTICO DO ERRO → PRÓXIMA QUESTÃO → RESUMO DA SESSÃO
// gets built incrementally on top of this, screen by screen. Reuses the
// same `questions` bank (via questionBankService) that the CONCURSO tab
// already reads from — no new collection, no changes to that service.

interface VRMethodViewProps {
  uid: string | null;
  onBack: () => void;
}

const VRMethodView: React.FC<VRMethodViewProps> = ({ uid, onBack }) => {
  const [subjects, setSubjects] = useState<BankFacetOption[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The question bank (Firestore `questions`) requires a signed-in reader
    // (see firestore.rules) — without a uid there's nothing to fetch, and
    // we show a proper "faça login" message below instead of leaving this
    // blank or letting the fetch fail silently.
    if (!uid) {
      setLoadingSubjects(false);
      return;
    }
    let cancelled = false;
    setLoadingSubjects(true);
    setError(null);
    listBankImportSubjects()
      .then(result => { if (!cancelled) setSubjects(result); })
      .catch(() => { if (!cancelled) setError('Não foi possível carregar as matérias do banco de questões.'); })
      .finally(() => { if (!cancelled) setLoadingSubjects(false); });
    return () => { cancelled = true; };
  }, [uid]);

  return (
    <div className="flex-1 w-full flex flex-col bg-[#FDFBF7] h-full" style={{ overflowY: 'auto' }}>
      <div className="bg-white px-6 md:px-10 py-6 shadow-sm border-b border-gray-100 flex-shrink-0 flex items-center gap-3 sticky top-0 z-30">
        <button
          onClick={() => (selectedSubject ? setSelectedSubject(null) : onBack())}
          aria-label="Voltar"
          className="p-3 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="font-logo text-2xl text-gray-900 flex items-center gap-2">
            <Search className="w-6 h-6 text-[#fecc73]" />
            Método <span className="text-[#fecc73]">VR</span>
          </h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide mt-0.5">
            Aprenda desmontando cada questão e descobrindo como a banca cobra
          </p>
        </div>
      </div>

      <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
        {!uid && (
          <p className="text-center text-gray-400 font-bold py-16">
            Faça login para usar o Método VR — ele lê o banco de questões, que exige uma conta conectada.
          </p>
        )}

        {uid && !selectedSubject && (
          <>
            <h3 className="font-black text-gray-900 mb-1">Escolha a matéria</h3>
            <p className="text-sm text-gray-400 mb-6">Vamos aplicar a engenharia reversa nas questões dessa matéria.</p>

            {loadingSubjects && <LoadingFish />}

            {!loadingSubjects && error && (
              <p className="text-center text-red-500 font-bold py-16">{error}</p>
            )}

            {!loadingSubjects && !error && subjects.length === 0 && (
              <p className="text-center text-gray-400 font-bold py-16">
                Nenhuma questão disponível no banco ainda.
              </p>
            )}

            {!loadingSubjects && !error && subjects.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {subjects.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setSelectedSubject(s.value)}
                    className="w-full flex items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 px-5 py-4 hover:shadow-md hover:border-[#ffe6b9] transition-all text-left"
                  >
                    <p className="font-black text-gray-900 truncate">{s.value}</p>
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wide flex-shrink-0">
                      {s.count} questões
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {uid && selectedSubject && (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#fff6e8] text-[#fec868] flex items-center justify-center">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="font-black text-gray-900 mb-1">{selectedSubject}</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto">
              O fluxo completo do Método VR ainda está em desenvolvimento para esta matéria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VRMethodView;
