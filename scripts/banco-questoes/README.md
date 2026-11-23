# Carga do banco de questões (PDF → D1)

Pipeline usado em outubro/2026. Tudo roda no Mac, sem IA; os PDFs vêm de zips (lidos da memória, sem descompactar).

1. **Extrair** (grava JSON em `~/fontes-todahora/comentadas/`):
   - `extract-estrategia.py` — aulas do Estratégia com "Comentários:" (rodapé com CPF/nome do comprador é removido antes de ler).
   - `extract-solucao.py` — formato "Questão 2022 | id" / "(BANCA/ANO)" + "Solução", múltipla escolha e Certo/Errado; guarda o caminho do Drive.
   - `extract-caveira.py`, `extract-fc.py` — simulados Projeto Caveira e PDFs do FC Concursos.
2. **Limpar** — `limpar-json.py --aplicar` (guarde antes uma cópia em `comentadas-bruto/`): refaz ligaturas "fi/fl/ff" que o PDF devolve como caractere vazio e corta restos da próxima aula no comentário.
3. **Montar o pacote do banco de reais** — `montar-banco-reais.py` (só questão de prova de banca; organiza por Área → Matéria → Assunto como no Drive).
4. **Enviar ao banco que o app lê (D1 `todahora-questoes`)** — `node scripts/banco-questoes/para-d1.mjs --json <pacote.json> --out /tmp/lote` e depois, para cada arquivo gerado, `npx wrangler@4 d1 execute todahora-questoes --remote --file <arquivo> -y`.
5. **Busca auxiliar da IA (D1 `todahora-fontes`)** — `node scripts/ingest-questoes-comentadas.mjs --upload`.

O banco morou no Supabase até 2026-11-23, quando o plano grátis pausou o projeto por 7 dias sem uso e o app
ficou sem questão nenhuma. `scripts/enviar-supabase.py` e `d1-para-supabase.py` ficaram para trás por isso.

Nunca versionar chaves nem os PDFs/JSON extraídos.
