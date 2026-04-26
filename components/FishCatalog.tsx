import React from 'react';
import { Target, Compass, Zap, HelpCircle, Clock, Book, Trophy, Sparkles, AlertCircle, FileText } from 'lucide-react';

interface FishInfo {
  id: string;
  name: string;
  description: string;
  source: string;
  colorClass: string;
  bgClass: string;
  icon: React.ReactNode;
}

const FISHES: FishInfo[] = [
  {
    id: "guia",
    name: "O Peixe-Guia",
    description: "Representa o foco inabalável, o mergulho profundo no conhecimento e a harmonia entre TDAH e sucesso nos estudos. O peixe central de 'STUDY'.",
    source: "TDAH Ora Study",
    colorClass: "text-amber-500",
    bgClass: "bg-amber-50 border-amber-200",
    icon: <Compass className="w-10 h-10" />
  },
  {
    id: "arquetipo_golden",
    name: "O Peixe-Arquétipo Golden",
    description: "Representa o objetivo central e o usuário exemplar.",
    source: "Do Perfil",
    colorClass: "text-yellow-500",
    bgClass: "bg-yellow-50 border-yellow-200",
    icon: <Target className="w-10 h-10" />
  },
  {
    id: "questoes",
    name: "Peixe de Questões",
    description: "Representa o sistema de questões abrangente.",
    source: "Do Apoio ao Estudo",
    colorClass: "text-emerald-700",
    bgClass: "bg-emerald-50 border-emerald-200",
    icon: <HelpCircle className="w-10 h-10" />
  },
  {
    id: "flashcards",
    name: "Peixe de Flashcards",
    description: "Representa a revisão espaçada e a memorização ativa.",
    source: "Do Apoio ao Estudo",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-50 border-blue-200",
    icon: <Zap className="w-10 h-10" />
  },
  {
    id: "tempo",
    name: "Peixe do Tempo",
    description: "Representa o gerenciamento do tempo e a rotina cronometrada.",
    source: "Do Hub",
    colorClass: "text-red-500",
    bgClass: "bg-red-50 border-red-200",
    icon: <Clock className="w-10 h-10" />
  },
  {
    id: "materiais",
    name: "Peixe dos Materiais",
    description: "Representa a organização de resumos e cadernos.",
    source: "Do Hub",
    colorClass: "text-purple-500",
    bgClass: "bg-purple-50 border-purple-200",
    icon: <Book className="w-10 h-10" />
  },
  {
    id: "alevino",
    name: "Peixe Alevino",
    description: "Representa o início da jornada.",
    source: "Do Perfil",
    colorClass: "text-orange-400",
    bgClass: "bg-orange-50 border-orange-200",
    icon: <Sparkles className="w-10 h-10" />
  },
  {
    id: "elite",
    name: "Peixe Palhaço/Elite",
    description: "Representa a gamificação e o reconhecimento do esforço.",
    source: "Do Perfil",
    colorClass: "text-orange-600",
    bgClass: "bg-orange-50 border-orange-300",
    icon: <Trophy className="w-10 h-10" />
  },
  {
    id: "bulbo",
    name: "Peixe-Bulbo",
    description: "Representa a inovação e as aulas IA-powered.",
    source: "Da Aula Direta e Icons",
    colorClass: "text-yellow-600",
    bgClass: "bg-yellow-50 border-yellow-300",
    icon: <Sparkles className="w-10 h-10" />
  },
  {
    id: "foco",
    name: "Peixe Cirurgião/Foco",
    description: "Representa a seleção cirúrgica do melhor edital.",
    source: "Do Hub",
    colorClass: "text-amber-400",
    bgClass: "bg-amber-50 border-amber-200",
    icon: <FileText className="w-10 h-10" />
  }
];

interface FishCatalogProps {
  onBack: () => void;
}

const FishCatalog: React.FC<FishCatalogProps> = ({ onBack }) => {
  return (
    <div className="flex-1 w-full flex flex-col bg-[#FDFBF7] h-full" style={{ overflowY: 'auto' }}>
      <div className="bg-white px-8 py-8 md:py-10 shadow-sm border-b border-gray-100 flex-shrink-0 flex items-center justify-between sticky top-0 z-30">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-amber-500" />
            Catálogo de Peixes
          </h2>
          <p className="text-gray-500 mt-1 font-medium tracking-wide uppercase text-sm">
            TDAH Ora Study
          </p>
        </div>
        
        <button 
          onClick={onBack}
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors uppercase tracking-widest text-sm"
        >
          Voltar
        </button>
      </div>

      <div className="p-8 md:p-12 w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {FISHES.map(fish => (
            <div key={fish.id} className={`rounded-3xl border-2 ${fish.bgClass} p-6 flex flex-col items-center text-center hover:scale-[1.02] transition-transform shadow-sm relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-40 rounded-full -mr-10 -mt-10 blur-2xl"></div>
              
              {/* Fish Illustration (Icon-based for now) */}
              <div className={`w-28 h-28 rounded-full bg-white mb-6 flex items-center justify-center shadow-inner relative`}>
                <div className={`absolute inset-0 border-4 border-dashed rounded-full border-white/50 animate-[spin_10s_linear_infinite]`}></div>
                <div className={`${fish.colorClass} drop-shadow-md`}>
                   {fish.icon}
                </div>
              </div>

              <h3 className="text-xl font-black text-gray-900 mb-2 leading-tight uppercase tracking-tight">{fish.name}</h3>
              <span className={`inline-block px-3 py-1 bg-white/60 rounded-full text-xs font-bold uppercase tracking-widest ${fish.colorClass} mb-4`}>
                {fish.source}
              </span>
              <p className="text-gray-700 text-sm font-medium leading-relaxed">
                {fish.description}
              </p>
            </div>
          ))}
        </div>
        
        {/* Banner for Brain/Mind */}
        <div className="mt-8 bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-100 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-sm relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-40 rounded-full -mr-20 -mt-20 blur-3xl"></div>
           <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm text-pink-500 shrink-0">
             <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
           </div>
           <div className="relative z-10">
             <h3 className="text-xl font-black text-rose-900 mb-2 uppercase tracking-tight">O Cérebro-Aquário & Os Caminhos e Balanças</h3>
             <p className="text-rose-800 text-sm font-medium leading-relaxed max-w-3xl">
               O Cérebro representa a mente TDAH neurodivergente e o repositório de conhecimento (Do Icon). <br/>
               Os Caminhos e Balanças (Chave e Balança) representam os itens de escolha e peso de foco (Do Onboarding).
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default FishCatalog;
