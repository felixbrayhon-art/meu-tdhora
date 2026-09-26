from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from legal_base.unified_search import search_unified_legal_sources


CASES = [
    # Código Penal
    {
        "name": "CP dolo eventual",
        "subject": "Direito Penal",
        "query": "assumiu o risco de produzir o resultado dolo eventual",
        "expected_article": "18",
    },
    {
        "name": "CP tentativa",
        "subject": "Direito Penal",
        "query": "pena diminuída de um a dois terços tentativa",
        "expected_article": "14",
    },
    {
        "name": "CP relação de causalidade",
        "subject": "Direito Penal",
        "query": "resultado somente é imputável a quem lhe deu causa",
        "expected_article": "13",
    },
    {
        "name": "CP desistência voluntária",
        "subject": "Direito Penal",
        "query": "desiste voluntariamente de prosseguir na execução impede que o resultado se produza",
        "expected_article": "15",
    },
    {
        "name": "CP arrependimento posterior",
        "subject": "Direito Penal",
        "query": "crime cometido sem violência ou grave ameaça reparado o dano restituída a coisa",
        "expected_article": "16",
    },
    {
        "name": "CP crime impossível",
        "subject": "Direito Penal",
        "query": "ineficácia absoluta do meio ou absoluta impropriedade do objeto crime impossível",
        "expected_article": "17",
    },
    {
        "name": "CP erro de tipo",
        "subject": "Direito Penal",
        "query": "erro sobre elemento constitutivo do tipo legal de crime exclui o dolo",
        "expected_article": "20",
    },

    # CPP
    {
        "name": "CPP preventiva",
        "subject": "Direito Processual Penal",
        "query": "prisão preventiva garantia da ordem pública",
        "expected_article": "312",
    },
    {
        "name": "CPP audiência de custódia",
        "subject": "Direito Processual Penal",
        "query": "audiência de custódia prazo máximo 24 horas prisão",
        "expected_article": "310",
    },
    {
        "name": "CPP flagrante",
        "subject": "Direito Processual Penal",
        "query": "está cometendo a infração penal acaba de cometê-la flagrante",
        "expected_article": "302",
    },
    {
        "name": "CPP cautelares",
        "subject": "Direito Processual Penal",
        "query": "comparecimento periódico em juízo proibição de acesso a determinados lugares medida cautelar",
        "expected_article": "319",
    },
    {
        "name": "CPP necessidade e adequação cautelar",
        "subject": "Direito Processual Penal",
        "query": "necessidade para aplicação da lei penal investigação instrução criminal adequação medida cautelar",
        "expected_article": "282",
    },

    # Constituição Federal
    {
        "name": "CF presunção de inocência",
        "subject": "Direito Constitucional",
        "query": "ninguém será considerado culpado até o trânsito em julgado",
        "expected_article": "5",
    },
    {
        "name": "CF legalidade",
        "subject": "Direito Constitucional",
        "query": "ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei",
        "expected_article": "5",
    },
    {
        "name": "CF princípios administração",
        "subject": "Direito Constitucional",
        "query": "administração pública legalidade impessoalidade moralidade publicidade eficiência",
        "expected_article": "37",
    },
    {
        "name": "CF separação dos poderes",
        "subject": "Direito Constitucional",
        "query": "poderes da união independentes e harmônicos entre si legislativo executivo judiciário",
        "expected_article": "2",
    },

    # Negativos: não devem ganhar HIGH por mera coincidência lexical.
    {
        "name": "NEG penal versus férias trabalhistas",
        "subject": "Direito Penal",
        "query": "férias anuais remuneradas adicional de um terço empregado",
        "forbid_high": True,
    },
    {
        "name": "NEG penal versus servidor",
        "subject": "Direito Penal",
        "query": "servidor público estabilidade após três anos de efetivo exercício",
        "forbid_high": True,
    },
    {
        "name": "NEG processo penal versus usucapião",
        "subject": "Direito Processual Penal",
        "query": "usucapião imóvel urbano duzentos e cinquenta metros quadrados",
        "forbid_high": True,
    },
    {
        "name": "NEG penal versus tributário",
        "subject": "Direito Penal",
        "query": "ICMS combustíveis incidência monofásica alíquota uniforme",
        "forbid_high": True,
    },
]


def main() -> None:
    passed = 0
    failed = 0
    started = time.perf_counter()

    print("=" * 90)
    print("AVALIAÇÃO DO UNIFIED LEGAL RETRIEVER")
    print("=" * 90)

    for index, case in enumerate(CASES, start=1):
        results = search_unified_legal_sources(
            case["query"],
            subject=case["subject"],
            limit=5,
        )

        top = results[0] if results else None

        if "expected_article" in case:
            ok = (
                top is not None
                and str(top.get("artigo")) == case["expected_article"]
            )
        else:
            ok = not (
                top is not None
                and top.get("confidence") == "HIGH"
            )

        if ok:
            passed += 1
            status = "PASS"
        else:
            failed += 1
            status = "FAIL"

        print()
        print(f"[{index:02d}/20] {status} — {case['name']}")
        print(f"query: {case['query']}")

        if top:
            print(f"top: {top['referencia']}")
            print(f"confiança: {top['confidence']}")
            print(f"motivo: {top['confidence_reason']}")
            print(f"rank local: {top.get('local_rank')}")
            print(f"rank AA: {top.get('advocacia_rank')}")
        else:
            print("top: nenhum resultado")

        if "expected_article" in case:
            print(f"esperado: art. {case['expected_article']}")
        else:
            print("esperado: primeiro resultado NÃO pode ser HIGH")

    elapsed = time.perf_counter() - started

    print()
    print("=" * 90)
    print("RESUMO")
    print("=" * 90)
    print(f"PASS: {passed}")
    print(f"FAIL: {failed}")
    print(f"TOTAL: {len(CASES)}")
    print(f"TEMPO: {elapsed:.2f}s")

    if failed:
        print()
        print("Existem casos para ajustar antes de conectar o retriever ao Ollama.")


if __name__ == "__main__":
    main()
