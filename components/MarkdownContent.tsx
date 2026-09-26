import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
  content: string;
  className?: string;
  isDark?: boolean;
  fontSizeMultiplier?: number;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = '', isDark = false, fontSizeMultiplier = 1 }) => {
  // Clean content - sometimes AI puts \n as literals or extra spaces
  const cleanContent = (content || '').replace(/\\n/g, '\n');

  return (
    <div className={`markdown-content ${className} ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
      <ReactMarkdown
        components={{
          h3: ({ node, ...props }) => (
            <h3 className={`font-black uppercase tracking-[0.2em] mt-10 mb-6 pb-2 border-b-2 flex items-center gap-2 ${isDark ? 'text-[#fed386] border-white/5' : 'text-[#fec868] border-[#fff0d5]'}`} style={{ fontSize: `${12 * fontSizeMultiplier}px` }} {...props}>
              {props.children}
            </h3>
          ),
          h4: ({ node, ...props }) => <h4 className={`font-black uppercase tracking-wider mt-8 mb-4 ${isDark ? 'text-slate-100' : 'text-slate-800'}`} style={{ fontSize: `${11 * fontSizeMultiplier}px` }} {...props} />,
          p: ({ node, ...props }) => <p className={`mb-5 leading-relaxed font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`} style={{ fontSize: `${16 * fontSizeMultiplier}px` }} {...props} />,
          strong: ({ node, ...props }) => <strong className={`font-black px-1.5 rounded-[4px] shadow-sm ${isDark ? 'text-white bg-[#ac6e00]/40 border border-white/5' : 'text-slate-900 bg-[#fff6e8] border-b border-[#ffe6b9]'}`} style={{ fontSize: `${16 * fontSizeMultiplier}px` }} {...props} />,
          ul: ({ node, ...props }) => <ul className="list-none pl-0 space-y-4 mb-8" {...props} />,
          li: ({ node, ...props }) => (
            <li className="flex items-start gap-4 pl-0 group" {...props}>
              <div className="mt-1.5 shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full group-hover:scale-125 transition-transform shadow-lg ${isDark ? 'bg-[#fecc73] shadow-[#fecc73]/20' : 'bg-[#fed386] shadow-[#fed386]/20'}`} />
              </div>
              <span className={`leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`} style={{ fontSize: `${16 * fontSizeMultiplier}px` }}>
                {props.children}
              </span>
            </li>
          ),
          blockquote: ({ node, ...props }) => <blockquote className={`border-l-4 p-8 rounded-r-3xl mb-10 font-medium shadow-sm transition-all hover:shadow-md ${isDark ? 'border-[#fecc73] bg-[#ac6e00]/20 text-slate-300' : 'border-[#fecc73] bg-[#fff6e8]/50 text-slate-700'}`} style={{ fontSize: `${16 * fontSizeMultiplier}px` }} {...props} />,
          code: ({ node, ...props }) => <code className={`px-2 py-0.5 rounded-md font-mono border ${isDark ? 'bg-white/5 text-[#fedda1] border-white/10' : 'bg-slate-100 text-[#fec868] border-slate-200'}`} style={{ fontSize: `${14 * fontSizeMultiplier}px` }} {...props} />,
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownContent;
