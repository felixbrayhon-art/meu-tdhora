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
# Procura um node_modules que tenha TODAS as dependências do package.json (uma pasta antiga pode não ter as novas).
completo() { (cd "$W" && NODE_PATH="$1" node -e 'const p=require("./package.json");const d={...p.dependencies,...p.devDependencies};const miss=Object.keys(d).filter(k=>{try{require.resolve(k+"/package.json")}catch(e){try{require.resolve(k)}catch(e2){return true}}return false});process.exit(miss.length?1:0)' >/dev/null 2>&1); }
NM=""
for wt in $(git -C "$REPO" worktree list --porcelain | awk '/^worktree /{print $2}'); do
  [[ -d "$wt/node_modules/vite" ]] && completo "$wt/node_modules" && { NM="$wt/node_modules"; break; }
done
if [[ -z "$NM" ]]; then
  echo "! nenhum node_modules completo nos worktrees; instalando as dependências aqui (leva um minuto)"
  (cd "$W" && npm install --no-audit --no-fund >/tmp/tdhora-npm.log 2>&1) || { tail -10 /tmp/tdhora-npm.log; echo "✗ npm install falhou"; exit 1; }
else
  ln -s "$NM" node_modules
fi
GROQ_API_KEY=set-on-server OPENROUTER_API_KEY=set-on-server \
FREELLMAPI_BASE_URL=https://set-on-server.invalid FREELLMAPI_API_KEY=set-on-server \
FREELLMAPI_ALLOWED_UIDS=set-on-server npx vite build >/tmp/tdhora-build.log 2>&1 \
  || { tail -20 /tmp/tdhora-build.log; echo "✗ build falhou"; exit 1; }

# Catálogo de leis federais do Vade Mecum (ctresb/leis): fica fora do git (~150 MB). Gere com scripts/build-vademecum-leis.mjs em ~/fontes-todahora/leis-dist.
LEIS="${TDHORA_LEIS_DIST:-$HOME/fontes-todahora/leis-dist}"
if [[ -f "$LEIS/indice.json" ]]; then
  mkdir -p dist/vademecum/leis && cp -R "$LEIS/." dist/vademecum/leis/
  echo "+ catálogo de leis federais incluído ($(du -sh "$LEIS" | cut -f1))"
else
  echo "! catálogo de leis federais não encontrado em $LEIS; o app sai sem ele"
fi

OUT="$(npx wrangler@4 pages deploy dist --project-name meu-tdhora --branch main 2>&1)" \
  || { echo "$OUT" | tail -15; echo "✗ deploy falhou"; exit 1; }
echo "✓ publicado $SHA → https://meu-tdhora.pages.dev ($(echo "$OUT" | grep -o 'https://[a-z0-9]*\.meu-tdhora.pages.dev' | tail -1))"
