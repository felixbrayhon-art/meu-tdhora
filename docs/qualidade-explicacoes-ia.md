# Avaliação e privacidade das explicações de IA

## Como avaliar antes de trocar o modelo

`npm run test:quality` executa verificações locais do filtro que já protege as questões: estrutura, alternativas duplicadas, citações legais inexistentes, troca de conceitos jurídicos, contradição entre explicação e gabarito e localização de evidência literal. Os exemplos são sintéticos. O comando não chama modelo, não precisa de chave e não envia dados para fora do computador.

Para testar também a recuperação de normas usada na preparação de explicações, execute `python3 worker/scripts/evaluate_unified_retrieval.py`. Esse conjunto já cobre 20 perguntas jurídicas e casos negativos; na verificação desta rodada, passou em 20/20 em 3,89 s.

O relatório da geração agora mede, em milissegundos, busca de fontes, geração, conferência do gabarito, revisão da explicação e duração total. O novo campo de tempo contém apenas números; o relatório local já existente também pode conter nomes de fontes e motivos resumidos de rejeição. Nada disso é enviado a um serviço de métricas. Compare várias execuções com o mesmo tema e quantidade para localizar a etapa que domina o tempo antes de adicionar um gateway ou paralelismo.

## Papel de cada projeto open source

- **[Promptfoo](https://www.promptfoo.dev/docs/configuration/expected-outputs/):** regressões e comparação controlada de modelos/prompts usando casos de referência. Use exemplos sintéticos ou já públicos; não rode conjuntos com anotações pessoais ou dados de alunos.
- **[Ragas](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/):** avaliação offline de fidelidade às fontes recuperadas e qualidade do contexto. Deve medir respostas já produzidas, nunca decidir sozinho se uma explicação jurídica está correta.
- **[Langfuse](https://langfuse.com/self-hosting/security/data-masking):** observabilidade opcional. Se for ativado, envie apenas duração, provedor/modelo e contadores de aprovação/rejeição. Não envie entrada/saída. A documentação recomenda mascaramento no cliente antes do envio para que dados sensíveis não deixem o app.
- **[Vercel AI SDK](https://vercel.com/kb/guide/ai-gateway-and-ai-sdk):** abstração tipada para comparar provedores e estruturar respostas. Streaming pode mostrar progresso, mas a questão/explicação só deve aparecer depois de passar pela auditoria atual; mostrar texto parcial quebraria esse bloqueio.
- **[LiteLLM](https://docs.litellm.ai/docs/routing):** gateway opcional para balanceamento, fallback e cache. O app já possui gateways server-side para Groq, OpenRouter e FreeLLMAPI. Colocar LiteLLM entre eles adicionaria outro serviço e outro ponto que recebe prompts; só vale migrar depois de medir falhas/latência e escolher onde hospedá-lo. Cache de conteúdo de aluno fica desativado por privacidade.

## Regra de liberação

A etapa local é o primeiro gate. Em uma comparação de modelos, registre para cada candidato a taxa de questões aprovadas, falsos aceites em casos negativos, fidelidade às fontes, p50/p95 de latência e falhas por provedor. Só substitua a configuração atual quando o novo candidato mantiver ou melhorar a qualidade e a auditoria final continuar bloqueando resultados não verificados.

Não há chamada automática a Promptfoo, Ragas, Langfuse ou LiteLLM no fluxo de produção. Isso mantém a geração sem um novo salto de rede e impede enviar conteúdo a serviços de avaliação/observabilidade sem configuração deliberada.
