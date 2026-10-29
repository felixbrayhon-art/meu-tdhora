# Avisos de terceiros

## OwlLuna

Partes do caderno de anotações à mão foram **portadas do OwlLuna** (Swift) para TypeScript. A lógica, as medidas e as cores seguem o original; o código foi reescrito para Canvas 2D.

- Projeto: https://github.com/owaisazmal/OwlLuna
- Licença: MIT, Copyright (c) 2024-2026 Owais Khan

Arquivos portados e a origem de cada um:

| Arquivo deste repositório | Origem no OwlLuna |
| --- | --- |
| `services/ink/templates.ts` | `OwlLuna/Models/Paper.swift`, `OwlLuna/Canvas/PaperTemplates.swift` |

Texto da licença MIT:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## FineNotes (versão 1.5.0)

O motor e a tela do caderno à mão (`vendor/finenotes`) são o código do **FineNotes 1.5.0**, publicado sob a **licença MIT**, sem alterações no código-fonte além de uma linha de tipos em `src/view/backdrop-renderer.ts` (o TypeScript do app é menos estrito que o do FineNotes); só a camada `vendor/finenotes-shim` (que imita as poucas partes do Obsidian que ele usa) e o componente `components/notes/FineNotesHost.tsx` são deste projeto.

- Projeto: https://github.com/Joost-8/FineNotes (tag `1.5.0`)
- Licença: MIT, Copyright (c) 2026 Joost (FineNotes); texto em `vendor/finenotes/LICENSE`
- **Atenção:** a partir da 2.0.0 o FineNotes passou para a GPL-3.0. Este projeto usa a 1.5.0 (MIT) de propósito; não atualize para 2.x sem decidir a licença do app.
- Dependências do motor: `fflate` (MIT) e `pdf-lib` (MIT, Andrew Dillon; ver `vendor/finenotes/THIRD_PARTY_NOTICES.txt`).
- Ícones: `lucide` (ISC).
