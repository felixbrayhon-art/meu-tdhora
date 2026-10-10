#!/usr/bin/env bash
# Publica origin/main em https://meu-tdhora.pages.dev (Cloudflare Pages) a partir de um worktree limpo.
#   ./scripts/deploy.sh        (mostra o commit e pede confirmação)
#   ./scripts/deploy.sh -y     (sem perguntar)
set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
W="$(mktemp -d /private/tmp/tdhora-deploy.XXXXXX)"
trap 'git -C "$REPO" worktree remove --force "$W" >/dev/null 2>&1 || true' EXIT

git -C "$REPO" fetch origin main --quiet
git -C "$REPO" worktree add --detach "$W" origin/main --quiet
SHA="$(git -C "$W" rev-parse --short HEAD)"
echo "origin/main: $SHA — $(git -C "$W" log -1 --format=%s)"

if [[ "${1:-}" != "-y" ]]; then
  read -r -p "Publicar $SHA em meu-tdhora.pages.dev? [pode/n] " ok
  [[ "$ok" == "pode" ]] || { echo "cancelado"; exit 1; }
fi

cd "$W"
NM=""
for wt in $(git -C "$REPO" worktree list --porcelain | awk '/^worktree /{print $2}'); do
  [[ -d "$wt/node_modules/vite" ]] && { NM="$wt/node_modules"; break; }
done
[[ -n "$NM" ]] || { echo "✗ nenhum worktree com node_modules (rode npm ci em um deles)"; exit 1; }
ln -s "$NM" node_modules
GROQ_API_KEY=set-on-server OPENROUTER_API_KEY=set-on-server \
FREELLMAPI_BASE_URL=https://set-on-server.invalid FREELLMAPI_API_KEY=set-on-server \
FREELLMAPI_ALLOWED_UIDS=set-on-server npx vite build >/tmp/tdhora-build.log 2>&1 \
  || { tail -20 /tmp/tdhora-build.log; echo "✗ build falhou"; exit 1; }

OUT="$(npx wrangler@4 pages deploy dist --project-name meu-tdhora --branch main 2>&1)" \
  || { echo "$OUT" | tail -15; echo "✗ deploy falhou"; exit 1; }
echo "✓ publicado $SHA → https://meu-tdhora.pages.dev ($(echo "$OUT" | grep -o 'https://[a-z0-9]*\.meu-tdhora.pages.dev' | tail -1))"
