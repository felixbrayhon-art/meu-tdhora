# Carga do banco de questões (PDF → Supabase e D1)

Pipeline usado em outubro/2026. Tudo roda no Mac, sem IA; os PDFs vêm de zips (lidos da memória, sem descompactar).

1. **Extrair** (grava JSON em `~/fontes-todahora/comentadas/`):
   - `extract-estrategia.py` — aulas do Estratégia com "Comentários:" (rodapé com CPF/nome do comprador é removido antes de ler).
   - `extract-solucao.py` — formato "Questão 2022 | id" / "(BANCA/ANO)" + "Solução", múltipla escolha e Certo/Errado; guarda o caminho do Drive.
   - `extract-caveira.py`, `extract-fc.py` — simulados Projeto Caveira e PDFs do FC Concursos.
2. **Limpar** — `limpar-json.py --aplicar` (guarde antes uma cópia em `comentadas-bruto/`): refaz ligaturas "fi/fl/ff" que o PDF devolve como caractere vazio e corta restos da próxima aula no comentário.
3. **Montar o pacote do banco de reais** — `montar-banco-reais.py` (só questão de prova de banca; organiza por Área → Matéria → Assunto como no Drive).
4. **Enviar ao Supabase** — `scripts/enviar-supabase.py pacote-policial.json pacote-juridica.json` (chave secreta em `~/fontes-todahora/.supabase-key`; atualiza no lugar, nunca apaga).
5. **Busca auxiliar da IA (D1)** — `node scripts/ingest-questoes-comentadas.mjs --upload`.

Nunca versionar chaves nem os PDFs/JSON extraídos.
