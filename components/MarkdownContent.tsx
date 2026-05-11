
import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
  content: string;
  className?: string;
  isDark?: boolean;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = '', isDark = false }) => {
  // Clean content - sometimes AI puts \n as literals or extra spaces
  const cleanContent = (content || '').replace(/\\n/g, '\n');

  return (
    <div className={`markdown-content ${className} ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
      <ReactMarkdown
        components={{
          h3: ({ node, ...props }) => (
            <h3 className={`text-[12px] font-black uppercase tracking-[0.2em] mt-10 mb-6 pb-2 border-b-2 flex items-center gap-2 ${isDark ? 'text-blue-400 border-white/5' : 'text-blue-600 border-blue-100'}`} {...props}>
              {props.children}
            </h3>
          ),
          h4: ({ node, ...props }) => (
            <h4 className={`text-[11px] font-black uppercase tracking-wider mt-8 mb-4 ${isDark ? 'text-slate-100' : 'text-slate-800'}`} {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className={`mb-5 leading-relaxed font-medium text-[16px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`} {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className={`font-black px-1.5 rounded-[4px] shadow-sm ${isDark ? 'text-white bg-blue-900/40 border border-white/5' : 'text-slate-900 bg-blue-50 border-b border-blue-200'}`} {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-none pl-0 space-y-4 mb-8" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="flex items-start gap-4 pl-0 group" {...props}>
              <div className="mt-1.5 shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full group-hover:scale-125 transition-transform shadow-lg ${isDark ? 'bg-blue-500 shadow-blue-500/20' : 'bg-blue-400 shadow-blue-400/20'}`} />
              </div>
              <span className={`leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>{props.children}</span>
            </li>
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className={`border-l-4 p-8 rounded-r-3xl italic mb-10 font-medium shadow-sm transition-all hover:shadow-md ${isDark ? 'border-blue-500 bg-blue-900/20 text-slate-300' : 'border-blue-500 bg-blue-50/50 text-slate-700'}`} {...props} />
          ),
          code: ({ node, ...props }) => (
            <code className={`px-2 py-0.5 rounded-md font-mono text-sm border ${isDark ? 'bg-white/5 text-blue-300 border-white/10' : 'bg-slate-100 text-blue-600 border-slate-200'}`} {...props} />
          ),
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownContent;
