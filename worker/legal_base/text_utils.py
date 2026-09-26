from __future__ import annotations

import re
import unicodedata

# Curated PT-BR stopword list — small on purpose (function words that would
# otherwise dilute BM25 relevance or, worse, generate near-universal prefix
# matches like "o*"). Not a linguistic resource, just enough to keep the
# search precise for legal text.
STOPWORDS = {
    "a", "as", "ao", "aos", "à", "às", "o", "os", "de", "da", "das", "do",
    "dos", "em", "no", "na", "nos", "nas", "num", "numa", "por", "pela",
    "pelo", "pelas", "pelos", "para", "com", "sem", "sob", "sobre", "entre",
    "que", "quando", "se", "ou", "e", "um", "uma", "uns", "umas", "é", "ser",
    "são", "foi", "foram", "seu", "sua", "seus", "suas", "este", "esta",
    "esse", "essa", "isso", "isto", "aquele", "aquela", "lhe", "lhes",
    "mais", "menos", "muito", "não", "nao", "já", "ja", "também", "tambem",
    "como", "onde", "qual", "quais", "cada", "outro", "outra", "outros",
    "outras", "todo", "toda", "todos", "todas",
}


def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


def normalize_whitespace(text: str) -> str:
    # Planalto's HTML consistently uses non-breaking spaces (U+00A0) instead
    # of regular ones between "Art." and the article number — normalizing
    # this up front is what makes a single regex handle every diploma's
    # formatting quirks instead of needing per-source special cases.
    text = text.replace("\xa0", " ")
    return re.sub(r"[ \t]+", " ", text)


def normalize_for_index(text: str) -> str:
    """Lowercase + accent-fold, for QUERY-side term extraction. The FTS5
    index itself accent-folds via `remove_diacritics 2` at insert time, so
    this only needs to keep the query side consistent with that.
    """
    return strip_accents(text).lower()


_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize_query(query: str, min_length: int = 3) -> list[str]:
    """Splits a free-text query into significant search terms: normalized,
    stopwords removed, very short tokens dropped (they're almost always
    function words or noise, and as FTS5 prefix terms they'd match too
    broadly to be useful).
    """
    normalized = normalize_for_index(query)
    tokens = _TOKEN_RE.findall(normalized)
    seen: list[str] = []
    for t in tokens:
        if len(t) < min_length or t in STOPWORDS:
            continue
        if t not in seen:
            seen.append(t)
    return seen
