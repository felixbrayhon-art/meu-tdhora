from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path


DEFAULT_MODEL = "gemini-3.8-flash"


class GeminiError(RuntimeError):
    pass


def _load_project_env() -> None:
    """
    Carrega somente GEMINI_API_KEY / GOOGLE_API_KEY do .env.local
    sem imprimir ou expor o valor.
    """
    project_root = Path(__file__).resolve().parents[2]
    env_path = project_root / ".env.local"

    if not env_path.exists():
        return

    try:
        lines = env_path.read_text(encoding="utf-8").splitlines()
    except Exception:
        return

    allowed = {"GEMINI_API_KEY", "GOOGLE_API_KEY"}

    for raw in lines:
        line = raw.strip()

        if not line or line.startswith("#"):
            continue

        if line.startswith("export "):
            line = line[7:].strip()

        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()

        if key not in allowed:
            continue

        value = value.strip()

        if (
            len(value) >= 2
            and value[0] == value[-1]
            and value[0] in {"'", '"'}
        ):
            value = value[1:-1]

        if value:
            os.environ.setdefault(key, value)


def _api_key() -> str | None:
    _load_project_env()

    return (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
    )


def is_available() -> bool:
    return bool(_api_key())


def generate(
    prompt: str,
    model: str = DEFAULT_MODEL,
    options: dict | None = None,
) -> str:
    api_key = _api_key()

    if not api_key:
        raise GeminiError(
            "GEMINI_API_KEY ou GOOGLE_API_KEY não encontrada "
            "no ambiente nem em .env.local."
        )

    options = options or {}

    generation_config = {
        "responseMimeType": "application/json",
        "thinkingConfig": {
            "thinkingLevel": "low",
            "includeThoughts": False,
        },
    }

    if options.get("num_predict"):
        generation_config["maxOutputTokens"] = int(
            options["num_predict"]
        )

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt}
                ],
            }
        ],
        "generationConfig": generation_config,
    }

    url = (
        "https://generativelanguage.googleapis.com/"
        f"v1beta/models/{model}:generateContent"
    )

    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=180,
        ) as response:
            body = json.loads(
                response.read().decode("utf-8")
            )

    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(
            "utf-8",
            errors="replace",
        )

        raise GeminiError(
            f"Gemini HTTP {exc.code}: {detail[:1500]}"
        ) from exc

    except Exception as exc:
        raise GeminiError(
            f"Erro ao chamar Gemini: {exc}"
        ) from exc

    candidates = body.get("candidates") or []

    if not candidates:
        raise GeminiError(
            "Gemini não retornou candidates: "
            + json.dumps(
                body,
                ensure_ascii=False,
            )[:1500]
        )

    parts = (
        candidates[0]
        .get("content", {})
        .get("parts", [])
    )

    result = "".join(
        part.get("text", "")
        for part in parts
        if isinstance(part, dict)
        and not part.get("thought")
    ).strip()

    if not result:
        raise GeminiError(
            "Gemini retornou resposta vazia."
        )

    return result
