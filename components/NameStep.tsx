import React, { useState } from 'react';
import FishLogo from './FishLogo';

interface NameStepProps {
  initialName?: string;
  onNext: (name: string) => void;
}

const NameStep: React.FC<NameStepProps> = ({ initialName, onNext }) => {
  const [name, setName] = useState(initialName ?? '');

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed) onNext(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[#FDFBF7] flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
      <div className="max-w-md w-full text-center space-y-10">
        <div className="flex flex-col items-center space-y-4">
          <FishLogo className="scale-125 mb-4" />
          <h1 className="font-logo text-4xl md:text-5xl text-[#0A0F1E] uppercase">
            Como podemos te <span className="text-yellow-400">chamar</span>?
          </h1>
          <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">
            Vamos usar esse nome em todo o app
          </p>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Digite seu apelido..."
          autoFocus
          className="w-full bg-white border-2 border-gray-100 rounded-3xl px-6 py-5 text-xl font-bold text-center focus:outline-none focus:border-yellow-400 transition-all shadow-sm"
        />

        <button
          onClick={submit}
          disabled={!name.trim()}
          className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:opacity-30 disabled:hover:bg-yellow-400 text-[#0A0F1E] font-black uppercase tracking-wide py-5 rounded-2xl shadow-xl transition-colors"
        >
          Continuar
        </button>
      </div>
    </div>
  );
};

export default NameStep;
