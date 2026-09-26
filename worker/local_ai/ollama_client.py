from __future__ import annotations

import json
import socket
import urllib.error
import urllib.request

# Talks ONLY to a local Ollama daemon — never any paid/hosted API (no
# OpenAI/Claude/Gemini key anywhere in this module). `base_url` defaults to
# Ollama's own localhost-only default; this client never sends a request
# anywhere else, and nothing here exposes Ollama beyond localhost (that's a
# property of how the Ollama daemon itself is started, not of this client —
# this module simply never suggests or configures a non-localhost bind).
DEFAULT_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "qwen3:4b-instruct-2507-q4_K_M"
# A 4B model on an M1 8GB, generating a full 10-section structured JSON,
# has been observed taking 60-150s per call, and longer once several
# questions run back to back in a batch (no dedicated GPU, shared with
# everything else on the machine). 180s was too tight and caused a real
# failure mid-batch — keep this generous rather than tune it against a
# single observed run.
DEFAULT_TIMEOUT_SECONDS = 600.0


class OllamaError(RuntimeError):
    pass


def generate(
    prompt: str,
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    options: dict | None = None,
) -> str:
    """Sends one prompt to a local Ollama daemon and returns the full
    (non-streamed) text response. Stdlib-only (urllib) on purpose — this
    package adds no new pip dependency for a single local HTTP call.
    """
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    if options:
        payload["options"] = options

    request = urllib.request.Request(
        f"{base_url}/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError) as exc:
        # A slow generation can time out mid-response (raw socket.timeout,
        # raised by http.client during read — NOT always wrapped into
        # URLError the way a connect-time failure is), so this needs its
        # own branch rather than assuming URLError covers every case.
        raise OllamaError(
            f"Não foi possível falar com o Ollama em {base_url} — ele está rodando, ou a "
            f"geração excedeu o timeout de {timeout:.0f}s? ({exc})"
        ) from exc
    except json.JSONDecodeError as exc:
        raise OllamaError(f"Resposta do Ollama não é um JSON válido: {exc}") from exc

    if "error" in body:
        raise OllamaError(f"Ollama retornou erro: {body['error']}")
    return body.get("response", "")


def is_available(base_url: str = DEFAULT_BASE_URL, timeout: float = 3.0) -> bool:
    try:
        with urllib.request.urlopen(f"{base_url}/api/tags", timeout=timeout):
            return True
    except urllib.error.URLError:
        return False
