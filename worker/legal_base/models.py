from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ParsedProvision:
    """One retrievable unit within a diploma: the caput of an article, a
    paragraph, an inciso, or an alínea — whichever granularity the source
    text actually breaks the norm into. `artigo` is always set; the other
    three are None when not applicable (e.g. a caput has no paragrafo/
    inciso/alinea; an inciso directly under the caput has paragrafo=None).
    """

    artigo: str
    texto: str
    paragrafo: str | None = None
    inciso: str | None = None
    alinea: str | None = None


@dataclass
class LegalProvisionRecord:
    """A fully-qualified row as stored in SQLite — a ParsedProvision plus
    the source-level fields that are the same for every provision of a
    given diploma (see worker/legal_base/sources.py).
    """

    diploma: str
    tipo: str
    numero: str
    artigo: str
    texto: str
    fonte: str
    url_oficial: str
    data_de_coleta: str
    paragrafo: str | None = None
    inciso: str | None = None
    alinea: str | None = None

    def referencia(self) -> str:
        """Human-readable citation, e.g. "Código Penal, art. 18, I" — also
        what gets indexed alongside `texto` so a search on "artigo 18" or
        "inciso I" can match the citation itself, not just the body text.
        """
        parts = [self.diploma, f"art. {self.artigo}"]
        if self.paragrafo:
            parts.append("parágrafo único" if self.paragrafo == "único" else f"§ {self.paragrafo}º")
        if self.inciso:
            parts.append(f"inciso {self.inciso}")
        if self.alinea:
            parts.append(f"alínea {self.alinea}")
        return ", ".join(parts)
