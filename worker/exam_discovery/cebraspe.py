from __future__ import annotations

import json
import re
import socket
import urllib.error
import urllib.request
from datetime import datetime, timezone

from .base import ExamProvider, SourceUnsupportedError
from .models import DiscoveredDocument, ExamSourceConfig

# Cebraspe's own site (cebraspe.org.br/concursos/<slug>) is a client-side-
# rendered React app with no useful content in the raw HTML — but it
# calls a clean, public, unauthenticated JSON API to fill itself in:
#   https://apis.cebraspe.org.br/cebraspe/eventos/<slug>
# (found via the browser's own network log while the page rendered — not
# reverse-engineered from obfuscated code or any access control). This
# provider talks to that API directly with the same stdlib-only urllib
# approach fgv.py uses; no headless browser dependency needed.
#
# `ExamSourceConfig.url` is that API URL for this provider (not an HTML
# page) — e.g. "https://apis.cebraspe.org.br/cebraspe/eventos/PC_PE_23".
_UA = "Mozilla/5.0 (compatible; TDHoraExamDiscovery/1.0)"
_TIMEOUT_SECONDS = 20.0
_MAX_RESPONSE_BYTES = 4 * 1024 * 1024
_CDN_URL_TEMPLATE = "https://cdn.cebraspe.org.br/concursos/{evento_url}/arquivos/{nome_arquivo}"

_RE_CARGO = re.compile(r"CARGO\s+(\d+)", re.IGNORECASE)
_RE_TIPO = re.compile(r"\btipo\s*(\d+)", re.IGNORECASE)


def _strip_accents_lower(text: str) -> str:
    import unicodedata

    stripped = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return stripped.lower()


def fetch_evento_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": _UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            status = getattr(response, "status", 200)
            if status != 200:
                raise SourceUnsupportedError(f"{url}: HTTP {status}")
            content_type = response.headers.get("Content-Type", "")
            if "json" not in content_type.lower():
                raise SourceUnsupportedError(f"{url}: unexpected Content-Type {content_type!r}")
            raw = response.read(_MAX_RESPONSE_BYTES + 1)
            if len(raw) > _MAX_RESPONSE_BYTES:
                raise SourceUnsupportedError(f"{url}: response exceeds {_MAX_RESPONSE_BYTES} bytes, refusing")
    except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError) as exc:
        raise SourceUnsupportedError(f"{url}: could not fetch API response ({exc})") from exc

    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise SourceUnsupportedError(f"{url}: response is not valid JSON ({exc})") from exc


def _role_for_cargo(evento_cargos: list[dict], cargo_number: str) -> str | None:
    target = cargo_number.lstrip("0") or "0"
    for cargo in evento_cargos:
        id_area = str(cargo.get("idArea", "")).lstrip("0") or "0"
        if id_area == target:
            return cargo.get("area")
    return None


def _classify_gabarito_entry(descricao: str) -> str | None:
    """Returns a DiscoveredDocument.document_type, or None for a file
    this provider deliberately doesn't treat as importable exam/gabarito
    material — a superseded ("SEM EFEITO") document, a discursive-exam
    file (out of scope: this pipeline only handles objective questions),
    or a "PROVA OBJETIVA ... COM JUSTIFICATIVA" bundle (the exam text is
    interleaved with per-alternative commentary markup this module
    doesn't yet know how to strip cleanly — see extraction.py's module
    docstring; returning None here means it's simply not discovered as
    an "exam" document rather than risk feeding extraction garbled text).
    """
    normalized = _strip_accents_lower(descricao)

    if "sem efeito" in normalized:
        return None
    if "discursiv" in normalized or ("padrao" in normalized and "resposta" in normalized):
        return None
    # Checked BEFORE the gabarito/exam checks below: a bundled "PROVA
    # OBJETIVA ... E GABARITO PRELIMINAR COM JUSTIFICATIVAS" description
    # contains "gabarito" AND "preliminar" too — without this check first,
    # it would wrongly match the "answer_key_preliminary" branch and be
    # discovered as if it were a clean, standalone gabarito file.
    if "justificativa" in normalized:
        return None
    if "gabarito" in normalized and "definitivo" in normalized:
        return "answer_key_final"
    if "gabarito" in normalized and "preliminar" in normalized:
        return "answer_key_preliminary"
    if "prova objetiva" in normalized:
        return "exam"
    return None


class CebraspeProvider(ExamProvider):
    board = "Cebraspe"

    def discover(self, sources: list[ExamSourceConfig]) -> list[DiscoveredDocument]:
        discovered_at = datetime.now(timezone.utc).isoformat()
        documents: list[DiscoveredDocument] = []

        for source in sources:
            if source.board != self.board:
                continue

            data = fetch_evento_json(source.url)
            evento_url = data.get("eventoURL")
            evento_cargos = data.get("eventoCargos", [])
            year = data.get("eventoAno") or source.year
            exam_name = data.get("eventoNomeCompleto") or source.exam_name

            if not evento_url:
                raise SourceUnsupportedError(f"{source.url}: response has no eventoURL")

            for entry in data.get("arquivosGabarito", []):
                descricao = entry.get("descricaoArquivo", "") or ""
                doc_type = _classify_gabarito_entry(descricao)
                if doc_type is None:
                    continue

                nome_arquivo = entry.get("nomeArquivo")
                if not nome_arquivo:
                    continue

                cargo_match = _RE_CARGO.search(descricao)
                role = _role_for_cargo(evento_cargos, cargo_match.group(1)) if cargo_match else None

                tipo_match = _RE_TIPO.search(descricao)
                test_type = tipo_match.group(1) if tipo_match else None

                documents.append(
                    DiscoveredDocument(
                        source_url=source.url,
                        download_url=_CDN_URL_TEMPLATE.format(evento_url=evento_url, nome_arquivo=nome_arquivo),
                        discovered_at=discovered_at,
                        board=source.board,
                        institution=source.institution,
                        exam_name=exam_name,
                        role=role,
                        year=year,
                        test_type=test_type,
                        document_type=doc_type,
                        title=descricao,
                        published_at=entry.get("dataArquivoObj"),
                    )
                )

        return documents
