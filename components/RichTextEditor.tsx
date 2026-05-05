import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Bold, Italic, Underline as UnderlineIcon, Palette, Highlighter } from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export const RichTextEditor = ({ content, onChange }: RichTextEditorProps) => {
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
    <div className="border border-white/10 rounded-[30px] p-4 bg-white/5">
      <div className="flex gap-2 mb-4 border-b border-white/5 pb-4">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded ${editor.isActive('bold') ? 'bg-orange-500' : 'bg-white/5'}`}>
          <Bold className="w-5 h-5 text-white" />
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded ${editor.isActive('italic') ? 'bg-orange-500' : 'bg-white/5'}`}>
          <Italic className="w-5 h-5 text-white" />
        </button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-2 rounded ${editor.isActive('underline') ? 'bg-orange-500' : 'bg-white/5'}`}>
          <UnderlineIcon className="w-5 h-5 text-white" />
        </button>
        <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={`p-2 rounded ${editor.isActive('highlight') ? 'bg-orange-500' : 'bg-white/5'}`}>
          <Highlighter className="w-5 h-5 text-white" />
        </button>
        <button onClick={() => editor.chain().focus().setColor('#f97316').run()} className="p-2 rounded bg-white/5">
          <Palette className="w-5 h-5 text-orange-500" />
        </button>
      </div>
      <EditorContent editor={editor} className="prose prose-invert prose-orange max-w-none min-h-[300px]" />
    </div>
  );
};
