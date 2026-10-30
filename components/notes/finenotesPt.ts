/**
 * Tradução da interface do FineNotes (textos em inglês do código vendorizado) para português.
 * Troca exata de textos, com regras para os que levam números. Só mexe em elementos do próprio
 * caderno (barra, painéis, menus, janelas e avisos), nunca no que a pessoa escreveu.
 */

const PT: Record<string, string> = {
  // Barra de ferramentas
  'Pen': 'Caneta', 'Pen (P)': 'Caneta (P)', 'Pen only': 'Só caneta', 'Pen options': 'Opções da caneta',
  'Pen type': 'Tipo de caneta', 'Pen gestures': 'Gestos da caneta', 'Back to pen types': 'Voltar aos tipos de caneta',
  'Ball pen': 'Esferográfica', 'Fountain pen': 'Tinteiro', 'Brush pen': 'Pincel', 'Highlighter': 'Marca-texto',
  'Highlighter only': 'Só marca-texto', 'Highlighter opacity': 'Opacidade do marca-texto',
  'Eraser': 'Borracha', 'Eraser (E)': 'Borracha (E)', 'Erase': 'Apagar', 'Erase entire stroke': 'Apagar o traço inteiro',
  'Erase highlighter only': 'Apagar só o marca-texto', 'Erase pen only': 'Apagar só a caneta',
  'Whole stroke': 'Traço inteiro', 'All ink': 'Toda a tinta', 'What the eraser erases': 'O que a borracha apaga',
  'Erase shapes and highlighter': 'Apagar formas e marca-texto',
  'Erase handwriting and drawings by scribbling over them.': 'Apague a escrita e os desenhos rabiscando por cima.',
  'Scribble to erase': 'Rabiscar para apagar', 'Circle to lasso': 'Círculo para laço',
  'Pictures and text boxes are never erased.': 'Imagens e caixas de texto nunca são apagadas.',
  'Draw around anything, then hold the pen on the loop to select it and move it.': 'Desenhe em volta de algo e segure a caneta no laço para selecionar e mover.',
  'Lasso Tool': 'Laço', 'Lasso tool': 'Laço', 'Lasso options': 'Opções do laço', 'Lasso select (V)': 'Laço (V)',
  'Lasso type': 'Tipo de laço', 'Rectangular': 'Retangular', 'Freehand': 'Mão livre',
  'What to include in the selection': 'O que incluir na seleção',
  'Shapes': 'Formas', 'Shapes (S)': 'Formas (S)', 'Shape colour': 'Cor da forma',
  'Circle': 'Círculo', 'Square': 'Quadrado', 'Rounded square': 'Quadrado arredondado', 'Diamond': 'Losango',
  'Triangle': 'Triângulo', 'Star': 'Estrela', 'Arrows': 'Setas', 'Table': 'Tabela',
  'Arrow: drag from tail to tip': 'Seta: arraste da ponta de trás até a frente',
  'Line: drag from start to end': 'Linha: arraste do começo ao fim',
  'Box fill': 'Preenchimento', 'Box fill: none': 'Preenchimento: nenhum',
  'Auto shape: off': 'Forma automática: desligada', 'Auto shape: on': 'Forma automática: ligada',
  'Auto-shape: draw any shape and it snaps clean': 'Forma automática: desenhe qualquer forma e ela fica certinha',
  'Draw and hold to make shapes': 'Desenhe e segure para criar formas', 'Snap to shape': 'Ajustar à forma',
  'Text': 'Texto', 'Text box (T)': 'Caixa de texto (T)', 'Text boxes': 'Caixas de texto', 'Add text box': 'Adicionar caixa de texto',
  'Delete text box': 'Excluir caixa de texto', 'Move text box': 'Mover caixa de texto', 'Resize text box': 'Redimensionar caixa de texto',
  'Remove text box': 'Remover caixa de texto', 'Page text box': 'Caixa de texto da página', 'Insert as text box': 'Inserir como caixa de texto',
  'Pin Text tool': 'Fixar ferramenta de texto', 'Drag to size': 'Arrastar para dimensionar',
  'Drag to size text boxes: off': 'Arrastar para dimensionar caixas: desligado', 'Drag to size text boxes: on': 'Arrastar para dimensionar caixas: ligado',
  'Tap to add a text box. It grows as you type.': 'Toque para adicionar uma caixa de texto. Ela cresce enquanto você digita.',
  'Text colour': 'Cor do texto', 'Text style': 'Estilo do texto', 'Text styles': 'Estilos de texto',
  'Bold': 'Negrito', 'Italic': 'Itálico', 'Underline': 'Sublinhado', 'Strikethrough': 'Tachado',
  'Bold, italic, underline, strikethrough': 'Negrito, itálico, sublinhado, tachado',
  'Alignment': 'Alinhamento', 'Align left': 'Alinhar à esquerda', 'Align right': 'Alinhar à direita', 'Centre': 'Centralizar',
  'Justify': 'Justificar', 'Line spacing': 'Espaçamento entre linhas', 'Lists': 'Listas', 'Bullets': 'Marcadores',
  'Numbering': 'Numeração', 'Bullets and numbering': 'Marcadores e numeração', 'Font': 'Fonte', 'Size': 'Tamanho',
  'Sans': 'Sem serifa', 'Serif': 'Com serifa', 'Mono': 'Monoespaçada', 'Layout must-haves': 'Essenciais do layout',
  'Colour': 'Cor', 'Change colour': 'Mudar cor', 'More colours': 'Mais cores', 'Common colours': 'Cores comuns',
  'Custom colors': 'Cores personalizadas', 'Custom colour': 'Cor personalizada', 'Custom colour…': 'Cor personalizada…',
  'Use this colour': 'Usar esta cor', 'Recent': 'Recentes', 'Saturation and brightness': 'Saturação e brilho',
  'Hue, 0 to 360 degrees': 'Matiz, de 0 a 360 graus',
  'Stroke width': 'Espessura do traço', 'More widths': 'Mais espessuras', 'Reset stroke width': 'Restaurar espessura',
  'Pressure sensitivity': 'Sensibilidade à pressão', 'Pressure-sensitive pens (advanced)': 'Canetas sensíveis à pressão (avançado)',
  'Undo': 'Desfazer', 'Undo (Cmd/Ctrl+Z)': 'Desfazer (Cmd/Ctrl+Z)', 'Redo (Cmd/Ctrl+Shift+Z)': 'Refazer (Cmd/Ctrl+Shift+Z)', 'Redo': 'Refazer',
  'Handwriting': 'Escrita à mão', 'Handwriting tools': 'Ferramentas de escrita', 'Handwriting recognition': 'Reconhecimento de escrita',
  'Tool options': 'Opções da ferramenta', 'Reset': 'Restaurar', 'Reset to default': 'Restaurar padrão', 'Escape': 'Esc',
  'Select active tool again to return to pen': 'Toque de novo na ferramenta ativa para voltar à caneta',
  'Return after one use': 'Voltar após um uso', 'Return to pen after one use': 'Voltar à caneta após um uso',
  'Select the active eraser, lasso, text or shape tool again to return to your previous pen or highlighter.': 'Toque de novo na borracha, laço, texto ou forma ativa para voltar à caneta ou marca-texto anterior.',

  // Páginas, barra lateral, busca
  'Add page': 'Nova página', 'Add Page': 'Nova página', 'Add page after': 'Adicionar página depois',
  'Add page before': 'Adicionar página antes', 'New page': 'Nova página', 'Page options': 'Opções da página',
  'Page thumbnails': 'Miniaturas das páginas', 'Close sidebar': 'Fechar barra lateral', 'Pages': 'Páginas', 'Contents': 'Sumário',
  'Contents entry options': 'Opções do item do sumário', 'Add to contents': 'Adicionar ao sumário', 'Remove from contents': 'Remover do sumário',
  'Rename in contents': 'Renomear no sumário', 'Rename': 'Renomear', 'Bookmark page': 'Marcar página', 'Remove bookmark': 'Remover marcador',
  'Bookmarks only': 'Marcadas', 'Bookmarks only ⌄': 'Marcadas ⌄', 'All pages': 'Todas', 'All pages ⌄': 'Todas ⌄',
  'No bookmarked pages yet. Tap the ribbon on a page, or bookmark it from ⋯ in the toolbar or its ⌄ menu.': 'Nenhuma página marcada ainda. Toque na fita da página ou marque pelo menu ⋯ ou ⌄.',
  'Listed in the Contents tab of the page sidebar, where it starts a section.': 'Aparece na aba Sumário da barra lateral e começa uma seção.',
  'Duplicate page': 'Duplicar página', 'Delete page': 'Excluir página', 'Clear page': 'Limpar página', 'Clear or delete page': 'Limpar ou excluir página',
  'Remove page': 'Remover página', 'Move page': 'Mover página', 'Move up': 'Mover para cima', 'Move down': 'Mover para baixo',
  'Go to page': 'Ir para a página', 'Next page': 'Próxima página', 'Last page': 'Última página', 'This page': 'Esta página',
  'Untitled page': 'Página sem título', 'Untitled notebook': 'Caderno sem título', 'Notebook': 'Caderno', 'New notebook': 'Novo caderno',
  'This page is empty': 'Esta página está vazia', 'This notebook is empty': 'Este caderno está vazio',
  'Nothing written on this page yet': 'Nada escrito nesta página ainda', 'Nothing written in this notebook yet': 'Nada escrito neste caderno ainda',
  'Pull to add page': 'Puxe para adicionar página', 'Release to add page': 'Solte para adicionar página',
  'Either way, pull past the last page to add one.': 'De qualquer forma, puxe além da última página para adicionar uma.',
  'Pages are numbered from 1': 'As páginas são numeradas a partir de 1', 'Single page': 'Página única', 'Make single page': 'Transformar em página única',
  'Search this notebook': 'Buscar neste caderno', 'Search this notebook…': 'Buscar neste caderno…',
  'Search the transcribed handwriting and typed text on every page.': 'Busque na escrita transcrita e no texto digitado de todas as páginas.',
  'No page has all of these words.': 'Nenhuma página tem todas essas palavras.',
  'Convert to notebook': 'Converter em caderno', 'Convert single page to notebook': 'Converter página única em caderno',
  'This page is now a notebook: add pages from the toolbar or the page panel.': 'Esta página agora é um caderno: adicione páginas pela barra ou pelo painel de páginas.',
  'This is a single page. Convert it to a notebook to add pages.': 'Esta é uma página única. Converta em caderno para adicionar páginas.',
  'Fit the page and go to the top': 'Ajustar a página e ir ao topo', 'Zoom in': 'Aproximar', 'Zoom out': 'Afastar',
  'Change scroll direction': 'Mudar direção da rolagem', 'Scroll direction': 'Direção da rolagem', 'Horizontal': 'Horizontal', 'Vertical': 'Vertical',
  'Vertical scrolls through the pages; horizontal turns them one at a time. ': 'Vertical rola pelas páginas; horizontal vira uma por vez. ',

  // Modelos, papéis e capas
  'Change template': 'Mudar modelo', 'Change paper': 'Mudar papel', 'Current template': 'Modelo atual', 'Recent templates': 'Modelos recentes',
  'More from templates…': 'Mais modelos…', 'New notebook or page…': 'Novo caderno ou página…', 'Templates shown here keep the current page\'s size.': 'Os modelos aqui mantêm o tamanho da página atual.',
  'Blank': 'Em branco', 'White Paper': 'Papel branco', 'Yellow Paper': 'Papel amarelo', 'Dark Paper': 'Papel escuro',
  'Ruled Narrow': 'Pautado estreito', 'Ruled Wide': 'Pautado largo', 'Squared Paper': 'Quadriculado', 'Dotted Paper': 'Pontilhado',
  'Cornell': 'Cornell', 'Single Column': 'Coluna única', 'Single Column Mix': 'Coluna única mista', 'Three Column': 'Três colunas',
  'Title & Date': 'Título e data', 'Monthly Planner': 'Planejador mensal', 'Weekly Planner': 'Planejador semanal', 'Planner': 'Planejador',
  'Todos': 'Tarefas', 'Music Paper': 'Pauta musical', 'Guitar Tablature': 'Tablatura de violão', 'Music': 'Música', 'Accounting': 'Contabilidade',
  'Physics': 'Física', 'Legal': 'Jurídico', 'Essentials': 'Essenciais', 'Writing papers': 'Papéis de escrita', 'Standard': 'Padrão',
  'Paper': 'Papel', 'Paper colour': 'Cor do papel', 'Paper width': 'Largura do papel', 'Page size': 'Tamanho da página', 'Current size': 'Tamanho atual',
  'Portrait': 'Retrato', 'Landscape': 'Paisagem', 'Letter': 'Carta', 'Tabloid': 'Tabloide', 'Position': 'Posição',
  'Cover': 'Capa', 'Change cover': 'Mudar capa', 'Cover colour': 'Cor da capa', 'No cover': 'Sem capa', 'Plain cover': 'Capa lisa',
  'Linen cover': 'Capa de linho', 'Spine cover': 'Capa com lombada', 'Label cover': 'Capa com etiqueta', 'Restyle cover title': 'Mudar estilo do título da capa',
  'Title': 'Título', 'Burgundy': 'Vinho', 'Charcoal': 'Carvão', 'Forest': 'Floresta', 'Mustard': 'Mostarda', 'Navy': 'Marinho', 'Sage': 'Sálvia',
  'Sky': 'Céu', 'Terracotta': 'Terracota', 'Yellow': 'Amarelo',

  // Seleção, menus
  'Select': 'Selecionar', 'Select all': 'Selecionar tudo', 'Selection': 'Seleção', 'Selected pages': 'Páginas selecionadas',
  'Delete': 'Excluir', 'Delete selection': 'Excluir seleção', 'Duplicate': 'Duplicar', 'Duplicate selection': 'Duplicar seleção',
  'Move selection': 'Mover seleção', 'Copy': 'Copiar', 'Cut': 'Recortar', 'Paste': 'Colar', 'Rotate': 'Girar',
  'Bring to front': 'Trazer para frente', 'Send to back': 'Enviar para trás', 'Front': 'Frente', 'Lock image': 'Bloquear imagem',
  'Unlock image': 'Desbloquear imagem', 'Unlock': 'Desbloquear', 'Delete image': 'Excluir imagem', 'Crop': 'Cortar', 'Crop image': 'Cortar imagem',
  'Transform image': 'Transformar imagem', 'Pasted image': 'Imagem colada', 'Add to page': 'Adicionar à página',
  'More': 'Mais', 'Done': 'Pronto', 'Apply': 'Aplicar', 'Cancel': 'Cancelar', 'Save': 'Salvar', 'Close': 'Fechar', 'Back': 'Voltar',
  'Create': 'Criar', 'Create notebook': 'Criar caderno', 'Open': 'Abrir', 'Import': 'Importar', 'Export': 'Exportar', 'Set': 'Definir',
  'Discard': 'Descartar', 'Dismiss this tip': 'Dispensar esta dica', 'Add': 'Adicionar', 'Remove': 'Remover', 'Replace': 'Substituir',
  'Move': 'Mover', 'Before': 'Antes', 'After': 'Depois', 'None': 'Nenhum', 'Not set': 'Não definido', 'Not set (optional)': 'Não definido (opcional)',
  'Choose': 'Escolher', 'Choose folder': 'Escolher pasta', 'Choose pages': 'Escolher páginas', 'Choose photo': 'Escolher foto',
  'Choose picture': 'Escolher imagem', 'Tap the pages to export.': 'Toque nas páginas para exportar.', 'Whole notebook': 'Caderno inteiro',
  'Page range': 'Intervalo de páginas', 'Pages to export': 'Páginas para exportar', 'Pages, e.g. 1-3, 5': 'Páginas, ex.: 1-3, 5',
  'Type the pages to export, e.g. 1-3, 5': 'Digite as páginas para exportar, ex.: 1-3, 5',
  'For example: 1-3, 5. Pages are imported in the order entered.': 'Por exemplo: 1-3, 5. As páginas são importadas na ordem digitada.',

  // Imagens, PDF, áudio
  'Images': 'Imagens', 'Images and PDFs': 'Imagens e PDFs', 'Insert image': 'Inserir imagem', 'Insert PDF': 'Inserir PDF', 'Import PDF': 'Importar PDF',
  'Import PDF…': 'Importar PDF…', 'Export as PDF': 'Exportar como PDF', 'Export as PDF…': 'Exportar como PDF…', 'Export cancelled': 'Exportação cancelada',
  'Photos': 'Fotos', 'Take photo': 'Tirar foto', 'Retake': 'Tirar de novo', 'Scan document': 'Digitalizar documento', 'Scan Documents': 'Digitalizar documentos',
  'From files': 'Dos arquivos', 'From vault': 'Do cofre', 'Files': 'Arquivos', 'Folder': 'Pasta', 'Vault root': 'Raiz do cofre',
  'Record': 'Gravar', 'Record audio': 'Gravar áudio', 'Stop recording': 'Parar gravação', 'Stop': 'Parar', 'Recording': 'Gravando',
  'Recordings': 'Gravações', 'Audio': 'Áudio', 'Play': 'Reproduzir', 'Pause': 'Pausar', 'Close player': 'Fechar player', 'Recording player': 'Player de gravação',
  'Back 10 seconds': 'Voltar 10 segundos', 'Discard recording': 'Descartar gravação', 'Discard this recording?': 'Descartar esta gravação?',
  'Add recording': 'Adicionar gravação', 'Remove recording': 'Remover gravação', 'Tap ▶ to play.': 'Toque em ▶ para reproduzir.',
  'No recordings in this note yet.': 'Nenhuma gravação neste caderno ainda.', 'No recordings in this note yet — tap the mic to record': 'Nenhuma gravação neste caderno ainda — toque no microfone para gravar',
  'Tap your writing to hear what was said as you wrote it.': 'Toque na sua escrita para ouvir o que foi dito enquanto você escrevia.',
  'Note Replay': 'Reprodução da anotação', 'Transcript': 'Transcrição', 'Transcription': 'Transcrição', 'Open transcript': 'Abrir transcrição',
  'Preparing the pages…': 'Preparando as páginas…', 'Reading the photo…': 'Lendo a foto…',
  'Take a photo of a page, or choose one.': 'Tire uma foto de uma página ou escolha uma.',

  // Configurações do caderno
  'Notebook settings': 'Configurações do caderno', 'Page settings': 'Configurações da página', 'Tool options ': 'Opções da ferramenta ',
  'Default tool': 'Ferramenta padrão', 'Default ink color': 'Cor padrão da tinta', 'Default stroke size': 'Espessura padrão do traço',
  'The tool that is picked when you open an ink note.': 'A ferramenta escolhida ao abrir um caderno.',
  'The pen color an ink note opens with.': 'A cor da caneta ao abrir um caderno.',
  'How thick the pen writes when you open an ink note.': 'A espessura da caneta ao abrir um caderno.',
  'How opaque highlighter strokes are.': 'Quão opacos são os traços do marca-texto.',
  'Writing is less smooth with pressure on': 'A escrita fica menos suave com a pressão ligada',
  'Apple Pencil': 'Apple Pencil', 'Support and diagnostics': 'Suporte e diagnóstico', "What's new in FineNotes": 'Novidades do caderno',
  'Show the changelog': 'Mostrar novidades', 'Open an issue on GitHub': 'Abrir um problema no GitHub',
  'Input debug overlay': 'Sobreposição de depuração', 'Show or hide the input debug overlay': 'Mostrar ou ocultar a sobreposição de depuração',
  'Show or hide the text layer': 'Mostrar ou ocultar a camada de texto', 'Desynchronized canvas': 'Tela dessincronizada',
  'Recognize automatically': 'Reconhecer automaticamente', 'Manual': 'Manual', 'Start page clock': 'Iniciar relógio da página',
  'Image <timestamp>': 'Imagem <timestamp>',

  // Avisos e textos de apoio
  'Nothing in the contents yet. Give a page a title here, from ⋯ in the toolbar, or from its ⌄ menu, and it starts a section.': 'Nada no sumário ainda. Dê um título a uma página aqui, pelo menu ⋯ da barra ou pelo menu ⌄, e ela começa uma seção.',
  'Part of this stroke is outside the page': 'Parte deste traço está fora da página',
  'a stroke that is a shape becomes one': 'um traço que seja uma forma vira uma forma certinha',
  'not available yet': 'ainda não disponível', 'AI': 'IA',

  'Table, 3 × 3: pick a size, then drag on the page': 'Tabela 3 × 3: escolha um tamanho e arraste na página',
  'Then drag it out on the page, or tap to place it': 'Depois arraste na página ou toque para posicionar',
  'Vertical scrolls through the pages; horizontal turns them one at a time. Either way, pull past the last page to add one.': 'Vertical rola pelas páginas; horizontal vira uma por vez. De qualquer forma, puxe além da última página para adicionar uma.',
  'Where new files are saved': 'Onde os novos arquivos são salvos',
  "Choose a folder for this notebook's new files. Empty: pictures, PDFs and recordings follow Obsidian's attachment setting, and exports go next to the note. Files already saved stay where they are.": 'Escolha uma pasta para os novos arquivos deste caderno. Vazio: imagens, PDFs e gravações seguem o padrão do app e as exportações ficam junto da anotação. Arquivos já salvos continuam onde estão.',
  'Inserted, pasted, scanned and generated pictures, and imported PDFs.': 'Imagens inseridas, coladas, digitalizadas e geradas, e PDFs importados.',
  'Audio recorded with the microphone button.': 'Áudio gravado com o botão do microfone.',
  'PDF exports': 'Exportações em PDF', 'PDFs made with the share button.': 'PDFs feitos com o botão de compartilhar.',
  "Obsidian's default": 'Padrão do app', 'Next to the note': 'Junto da anotação',
  'Folders for images and pdfs': 'Pastas de imagens e PDFs', 'Folders for recordings': 'Pastas de gravações', 'Folders for pdf exports': 'Pastas de exportações em PDF',
  'Search typed text on every page. Handwriting is searchable once it is transcribed (AI → Transcribe whole notebook).': 'Busque o texto digitado em todas as páginas. A escrita à mão só pode ser buscada depois de transcrita.',

  'Copy link to page': 'Copiar link da página', 'Copy link to current page': 'Copiar link da página atual',

  'Black & white': 'Preto e branco', 'Greyscale': 'Tons de cinza', 'A3': 'A3', 'A5': 'A5', 'A6': 'A6',

  // Meses (relógio e datas dos modelos)
  'Jan': 'Jan', 'Feb': 'Fev', 'Mar': 'Mar', 'Apr': 'Abr', 'May': 'Mai', 'Jun': 'Jun', 'Jul': 'Jul', 'Aug': 'Ago', 'Sep': 'Set', 'Oct': 'Out', 'Nov': 'Nov', 'Dec': 'Dez',
};

// Textos com números ou nomes que mudam.
const REGRAS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^Add page (\d+) to contents$/, (m) => `Adicionar a página ${m[1]} ao sumário`],
  [/^Width ([\d.]+) mm$/, (m) => `Espessura ${m[1].replace('.', ',')} mm`],
  [/^Table, (\d+) × (\d+)$/, (m) => `Tabela ${m[1]} × ${m[2]}`],
  [/^Table · (\d+) × (\d+)$/, (m) => `Tabela · ${m[1]} × ${m[2]}`],
  [/^(\d+) × (\d+) table$/, (m) => `Tabela ${m[1]} × ${m[2]}`],
  [/^Shape colour (#[0-9a-fA-F]+)$/, (m) => `Cor da forma ${m[1]}`],
  [/^Eraser mode: (.+)$/, (m) => `Modo da borracha: ${PT[m[1]] ?? m[1]}`],
  [/^Eraser size (\d+)$/, (m) => `Tamanho da borracha ${m[1]}`],
  [/^Eraser erases: (.+)$/, (m) => `A borracha apaga: ${(PT[m[1]] ?? m[1]).toLowerCase()}`],
  [/^Font size (\d+)$/, (m) => `Tamanho da fonte ${m[1]}`],
  [/^Font: (.+)$/, (m) => `Fonte: ${PT[m[1]] ?? m[1]}`],
  [/^Alignment: (.+)$/, (m) => `Alinhamento: ${PT[m[1]] ?? m[1]}`],
  [/^Line spacing ([\d.]+)$/, (m) => `Espaçamento entre linhas ${m[1].replace('.', ',')}`],
  [/^Add a page: (.+)$/, (m) => `Adicionar página: ${(PT[m[1]] ?? m[1]).toLowerCase()}`],
  [/^Page (\d+)$/, (m) => `Página ${m[1]}`],
  [/^Page (\d+) of (\d+)$/, (m) => `Página ${m[1]} de ${m[2]}`],
  [/^Go to page \(1 [–-] (\d+)\)$/, (m) => `Ir para a página (1 – ${m[1]})`],
  [/^(\d+) pages?$/, (m) => `${m[1]} ${m[1] === '1' ? 'página' : 'páginas'}`],
  [/^(.+) options$/, (m) => `Opções: ${PT[m[1]] ?? m[1]}`],
  [/^Delete (\d+) pages?\??$/, (m) => `Excluir ${m[1]} ${m[1] === '1' ? 'página' : 'páginas'}`],
];

export function traduz(texto: string): string {
  const miolo = texto.trim();
  if (!miolo) return texto;
  let alvo = PT[miolo];
  if (alvo === undefined && miolo.includes(' — ')) {
    // "Texto — explicação": traduz cada parte; só vale se alguma parte for conhecida.
    const partes = miolo.split(' — ');
    const feitas = partes.map((x) => { const t = traduz(x); return t; });
    if (feitas.some((x, i) => x !== partes[i])) alvo = feitas.join(' — ');
  }
  if (alvo === undefined) {
    for (const [re, fn] of REGRAS) {
      const m = miolo.match(re);
      if (m) { alvo = fn(m); break; }
    }
  }
  if (alvo === undefined) return texto;
  return texto.replace(miolo, alvo);
}

/** Elementos que pertencem ao caderno (e não ao app em volta). */
const AREA = '.fn-host, .modal-container, .menu, .notice-container, [class*="goodobsidian"], .suggestion-container, .prompt-results, .popover';
const ATRIBUTOS = ['aria-label', 'title', 'placeholder', 'alt'];
/** A folha de escrita e qualquer campo editável guardam o que a pessoa escreveu. */
const PROTEGIDO = '.goodobsidian-scroll, textarea, input, [contenteditable="true"], [contenteditable=""]';

function dentroDoCaderno(el: Element | null): boolean {
  return !!el && !!el.closest(AREA) && !el.closest(PROTEGIDO);
}

function traduzNo(no: Node): void {
  if (no.nodeType === Node.TEXT_NODE) {
    const pai = no.parentElement;
    if (!dentroDoCaderno(pai)) return;
    const v = no.nodeValue ?? '';
    const t = traduz(v);
    if (t !== v) no.nodeValue = t;
    return;
  }
  if (no.nodeType !== Node.ELEMENT_NODE) return;
  const el = no as Element;
  if (el.closest(PROTEGIDO)) return;
  if (dentroDoCaderno(el) || el.matches(AREA)) {
    for (const a of ATRIBUTOS) {
      const v = el.getAttribute(a);
      if (v) { const t = traduz(v); if (t !== v) el.setAttribute(a, t); }
    }
  }
  for (let c = el.firstChild; c; c = c.nextSibling) traduzNo(c);
}

/** Liga a tradução enquanto o caderno estiver aberto. Devolve a função que desliga. */
export function iniciaTraducao(): () => void {
  traduzNo(document.body);
  const obs = new MutationObserver((lista) => {
    for (const r of lista) {
      if (r.type === 'childList') r.addedNodes.forEach(traduzNo);
      else if (r.type === 'characterData') traduzNo(r.target);
      else if (r.type === 'attributes' && r.target instanceof Element) traduzNo(r.target);
    }
  });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
  return () => obs.disconnect();
}
