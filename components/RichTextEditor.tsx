import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Bold, Italic, Underline as UnderlineIcon, Palette, Highlighter, Type, Eraser } from 'lucide-react';
import { useState } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
}

const TEXT_COLORS = [
  { name: 'White', color: '#FFFFFF' },
  { name: 'Orange', color: '#F97316' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Green', color: '#10B981' },
  { name: 'Red', color: '#EF4444' },
  { name: 'Yellow', color: '#EAB308' },
  { name: 'Purple', color: '#8B5CF6' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', color: '#facc15' },
  { name: 'Orange', color: '#fb923c' },
  { name: 'Green', color: '#4ade80' },
  { name: 'Blue', color: '#60a5fa' },
  { name: 'Pink', color: '#f472b6' },
  { name: 'Purple', color: '#c084fc' },
];

export const RichTextEditor = ({ content, onChange }: RichTextEditorProps) => {
  const [showColorMenu, setShowColorMenu] = useState<'text' | 'highlight' | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-white/10 rounded-[30px] p-6 bg-white/5 shadow-2xl relative">
      <div className="flex flex-wrap gap-3 mb-6 border-b border-white/10 pb-6 items-center">
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
          <button 
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()} 
            className={`p-3 rounded-xl transition-all ${editor.isActive('bold') ? 'bg-orange-500 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Bold className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()} 
            className={`p-3 rounded-xl transition-all ${editor.isActive('italic') ? 'bg-orange-500 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Italic className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()} 
            className={`p-3 rounded-xl transition-all ${editor.isActive('underline') ? 'bg-orange-500 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="h-8 w-px bg-white/10 mx-1" />

        <div className="relative">
          <button 
            type="button"
            onClick={() => setShowColorMenu(showColorMenu === 'text' ? null : 'text')} 
            className={`flex items-center gap-2 p-3 rounded-xl transition-all ${showColorMenu === 'text' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Palette className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Cor</span>
          </button>

          {showColorMenu === 'text' && (
            <div className="absolute top-full left-0 mt-2 p-3 bg-[#1A1F2E] border border-white/10 rounded-[24px] shadow-3xl z-[50] flex gap-2">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => {
                    editor.chain().focus().setColor(c.color).run();
                    setShowColorMenu(null);
                  }}
                  className="w-8 h-8 rounded-xl border border-white/10 hover:scale-110 transition-transform shadow-lg"
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setShowColorMenu(null);
                }}
                className="w-8 h-8 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center hover:scale-110 transition-transform"
                title="Reset Color"
              >
                <div className="w-full h-px bg-red-500 rotate-45" />
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button 
            type="button"
            onClick={() => setShowColorMenu(showColorMenu === 'highlight' ? null : 'highlight')} 
            className={`flex items-center gap-2 p-3 rounded-xl transition-all ${showColorMenu === 'highlight' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Highlighter className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Realce</span>
          </button>

          {showColorMenu === 'highlight' && (
            <div className="absolute top-full left-0 mt-2 p-3 bg-[#1A1F2E] border border-white/10 rounded-[24px] shadow-3xl z-[50] flex gap-2">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => {
                    editor.chain().focus().setHighlight({ color: c.color }).run();
                    setShowColorMenu(null);
                  }}
                  className="w-8 h-8 rounded-xl border border-white/10 hover:scale-110 transition-transform shadow-lg"
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run();
                  setShowColorMenu(null);
                }}
                className="w-8 h-8 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center hover:scale-110 transition-transform font-black text-[8px] text-white/40"
                title="Clear Highlight"
              >
                OFF
              </button>
            </div>
          )}
        </div>

        <button 
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().run()} 
          className="p-3 text-white/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
          title="Limpar Estilos"
        >
          <Eraser className="w-4 h-4" />
        </button>
      </div>

      <div className="min-h-[400px] overflow-y-auto px-2">
        <EditorContent 
          editor={editor} 
          className="prose prose-invert prose-orange max-w-none focus:outline-none min-h-[300px] text-lg font-medium selection:bg-blue-500/30" 
        />
      </div>

      {/* Backdrop to close menus */}
      {showColorMenu && (
        <div 
          className="fixed inset-0 z-[40]" 
          onClick={() => setShowColorMenu(null)}
        />
      )}
    </div>
  );
};
