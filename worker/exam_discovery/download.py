from __future__ import annotations

import hashlib
import re
import socket
import sqlite3
import urllib.error
import urllib.request
from pathlib import Path

from . import catalog
from .base import SourceUnsupportedError
from .models import DiscoveredDocument, DownloadResult

DEFAULT_CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "exam_sources"

_UA = "Mozilla/5.0 (compatible; TDHoraExamDiscovery/1.0)"
_TIMEOUT_SECONDS = 30.0
_MAX_PDF_BYTES = 40 * 1024 * 1024  # 40 MB — generous for a text exam PDF, still a hard ceiling
_CHUNK_SIZE = 1 << 16

_RE_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_filename(title: str, download_url: str) -> str:
    base = title.strip() or download_url.rsplit("/", 1)[-1]
    base = _RE_SAFE.sub("-", base).strip("-").lower()
    if not base:
        base = "document"
    if not base.endswith(".pdf"):
        base += ".pdf"
    return base


def download_document(
    doc: DiscoveredDocument,
    conn: sqlite3.Connection,
    cache_dir: Path | str = DEFAULT_CACHE_DIR,
) -> DownloadResult:
    """Downloads `doc` into `cache_dir`, named by its own SHA-256 (so two
    different URLs that happen to serve byte-identical content collapse
    onto one file) plus a human-readable slug. If the catalog already
    has this exact source_url downloaded, no network request is made at
    all — this is what makes a daily re-run of the whole pipeline cheap.
    """
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)

    existing = catalog.get_by_download_url(conn, doc.download_url)
    if existing is not None and existing["sha256"] and existing["download_path"]:
        path = Path(existing["download_path"])
        if path.exists():
            return DownloadResult(
                document=doc, path=str(path), sha256=existing["sha256"],
                size_bytes=path.stat().st_size, already_cached=True,
            )
        # Catalog says downloaded but the file is gone (cache cleared,
        # moved disk, ...) — fall through and re-download.

    request = urllib.request.Request(doc.download_url, headers={"User-Agent": _UA})
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            status = getattr(response, "status", 200)
            if status != 200:
                raise SourceUnsupportedError(f"{doc.download_url}: HTTP {status}")
            content_type = response.headers.get("Content-Type", "")
            if "pdf" not in content_type.lower():
                raise SourceUnsupportedError(
                    f"{doc.download_url}: expected a PDF, got Content-Type {content_type!r}"
                )

            hasher = hashlib.sha256()
            chunks: list[bytes] = []
            total = 0
            while True:
                chunk = response.read(_CHUNK_SIZE)
                if not chunk:
                    break
                total += len(chunk)
                if total > _MAX_PDF_BYTES:
                    raise SourceUnsupportedError(
                        f"{doc.download_url}: exceeds {_MAX_PDF_BYTES} bytes, refusing"
                    )
                hasher.update(chunk)
                chunks.append(chunk)
    except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError) as exc:
        raise SourceUnsupportedError(f"{doc.download_url}: could not download ({exc})") from exc

    sha256 = hasher.hexdigest()

    by_hash = catalog.get_by_sha256(conn, sha256)
    if by_hash is not None and by_hash["download_path"] and Path(by_hash["download_path"]).exists():
        # Identical bytes already cached under a different source_url
        # (e.g. the page relinked the same file) — reuse it, never
        # duplicate the download on disk.
        path = Path(by_hash["download_path"])
    else:
        filename = f"{sha256[:16]}_{_safe_filename(doc.title, doc.download_url)}"
        path = cache_dir / filename
        if not path.exists():
            path.write_bytes(b"".join(chunks))

    catalog.set_downloaded(conn, doc.download_url, sha256, str(path))

    return DownloadResult(
        document=doc, path=str(path), sha256=sha256, size_bytes=path.stat().st_size, already_cached=False,
    )
