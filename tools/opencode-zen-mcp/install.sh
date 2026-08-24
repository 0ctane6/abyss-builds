#!/usr/bin/env bash
# Branche le serveur MCP OpenCode Zen (Ox Alpha) sur Claude Desktop.
#
#   ./install.sh                      # demande la cle API puis installe
#   ./install.sh --key sk-...         # cle en argument
#   ./install.sh --model x-preview-f-free
#   ./install.sh --inline-key         # ecrit la cle dans claude_desktop_config.json
#   ./install.sh --uninstall          # retire l'entree
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_JS="$SCRIPT_DIR/server.js"

SERVER_NAME="opencode-zen"
MODEL="x-preview-f-free"
BASE_URL="https://opencode.ai/zen/v1"
KEY="${OPENCODE_ZEN_API_KEY:-}"
KEY_FILE="$HOME/.config/opencode-zen/api-key"
INLINE_KEY=0
UNINSTALL=0
NO_TEST=0

die() { printf '\033[31merreur:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
ok() { printf '\033[32m ok\033[0m %s\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --key) KEY="${2:-}"; shift 2 ;;
    --key=*) KEY="${1#*=}"; shift ;;
    --model) MODEL="${2:-}"; shift 2 ;;
    --model=*) MODEL="${1#*=}"; shift ;;
    --base-url) BASE_URL="${2:-}"; shift 2 ;;
    --base-url=*) BASE_URL="${1#*=}"; shift ;;
    --name) SERVER_NAME="${2:-}"; shift 2 ;;
    --name=*) SERVER_NAME="${1#*=}"; shift ;;
    --key-file) KEY_FILE="${2:-}"; shift 2 ;;
    --key-file=*) KEY_FILE="${1#*=}"; shift ;;
    --inline-key) INLINE_KEY=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    --no-test) NO_TEST=1; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) die "option inconnue : $1" ;;
  esac
done

# ---------------------------------------------------------------- prerequis
NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || die "node introuvable. Installe Node.js 18+ (https://nodejs.org)."
NODE_MAJOR="$("$NODE_BIN" -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18+ requis (detecte : $("$NODE_BIN" --version))."
[ -f "$SERVER_JS" ] || die "server.js introuvable a cote de install.sh."

# ------------------------------------------------- emplacement de la config
case "$(uname -s 2>/dev/null || echo unknown)" in
  Darwin) CONFIG_DIR="$HOME/Library/Application Support/Claude" ;;
  MINGW*|MSYS*|CYGWIN*) CONFIG_DIR="${APPDATA:-$HOME/AppData/Roaming}/Claude" ;;
  *)
    if [ -n "${APPDATA:-}" ]; then
      CONFIG_DIR="$APPDATA/Claude"
    else
      CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/Claude"
    fi
    ;;
esac
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

# ------------------------------------------------------------- desinstall
if [ "$UNINSTALL" -eq 1 ]; then
  [ -f "$CONFIG_FILE" ] || die "aucune config Claude Desktop a $CONFIG_FILE"
  cp "$CONFIG_FILE" "$CONFIG_FILE.bak"
  "$NODE_BIN" -e '
    const fs = require("fs");
    const [file, name] = process.argv.slice(1);
    const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
    if (cfg.mcpServers && cfg.mcpServers[name]) {
      delete cfg.mcpServers[name];
      fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
      console.log("entree supprimee");
    } else {
      console.log("aucune entree a supprimer");
    }
  ' "$CONFIG_FILE" "$SERVER_NAME"
  ok "sauvegarde : $CONFIG_FILE.bak — redemarre Claude Desktop."
  exit 0
fi

# -------------------------------------------------------------------- cle
if [ -z "$KEY" ] && [ "$INLINE_KEY" -eq 0 ] && [ -s "$KEY_FILE" ]; then
  info "cle existante reutilisee depuis $KEY_FILE"
else
  if [ -z "$KEY" ]; then
    [ -t 0 ] || die "pas de cle API : passe --key ou definis OPENCODE_ZEN_API_KEY."
    printf 'Cle API OpenCode Zen (https://opencode.ai/zen) : '
    read -r -s KEY
    printf '\n'
  fi
  [ -n "$KEY" ] || die "cle vide."
fi

if [ "$INLINE_KEY" -eq 0 ] && [ -n "$KEY" ]; then
  mkdir -p "$(dirname "$KEY_FILE")"
  printf '%s' "$KEY" > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
  ok "cle enregistree dans $KEY_FILE (chmod 600)"
fi

# ------------------------------------------- variables d'auth du serveur MCP
if [ "$INLINE_KEY" -eq 1 ]; then
  AUTH_NAME="OPENCODE_ZEN_API_KEY"
  AUTH_VALUE="$KEY"
else
  AUTH_NAME="OPENCODE_ZEN_API_KEY_FILE"
  AUTH_VALUE="$KEY_FILE"
fi

# ------------------------------------------------------------ test de fumee
if [ "$NO_TEST" -eq 0 ]; then
  info "test de la passerelle…"
  env OPENCODE_ZEN_BASE_URL="$BASE_URL" \
      OPENCODE_ZEN_MODEL="$MODEL" \
      "$AUTH_NAME=$AUTH_VALUE" \
      "$NODE_BIN" "$SERVER_JS" --selftest \
    || die "le test a echoue — rien n'a ete installe. Corrige la cle/le modele, ou relance avec --no-test."
  ok "passerelle joignable"
fi

# ----------------------------------------------------------- ecriture config
mkdir -p "$CONFIG_DIR"
[ -f "$CONFIG_FILE" ] || printf '{}\n' > "$CONFIG_FILE"
BACKUP="$CONFIG_FILE.bak.$(date +%Y%m%d%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP"

ZEN_AUTH_NAME="$AUTH_NAME" ZEN_AUTH_VALUE="$AUTH_VALUE" "$NODE_BIN" -e '
  const fs = require("fs");
  const [file, name, nodeBin, serverJs, baseUrl, model] = process.argv.slice(1);
  let cfg = {};
  const raw = fs.readFileSync(file, "utf8").trim();
  if (raw) {
    try { cfg = JSON.parse(raw); }
    catch (e) { console.error("config JSON illisible : " + e.message); process.exit(1); }
  }
  if (typeof cfg !== "object" || cfg === null || Array.isArray(cfg)) cfg = {};
  if (typeof cfg.mcpServers !== "object" || cfg.mcpServers === null || Array.isArray(cfg.mcpServers)) cfg.mcpServers = {};
  const env = { OPENCODE_ZEN_BASE_URL: baseUrl, OPENCODE_ZEN_MODEL: model };
  env[process.env.ZEN_AUTH_NAME] = process.env.ZEN_AUTH_VALUE;
  cfg.mcpServers[name] = { command: nodeBin, args: [serverJs], env };
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
' "$CONFIG_FILE" "$SERVER_NAME" "$NODE_BIN" "$SERVER_JS" "$BASE_URL" "$MODEL" \
  || die "ecriture de la config impossible (sauvegarde : $BACKUP)"

chmod 600 "$CONFIG_FILE" 2>/dev/null || true

ok "serveur \"$SERVER_NAME\" ajoute a $CONFIG_FILE"
ok "sauvegarde de l'ancienne config : $BACKUP"
echo
info "Redemarre Claude Desktop (quitter completement, pas juste fermer la fenetre),"
info "puis les outils ox_alpha_ask / ox_alpha_chat / zen_list_models apparaitront"
info "dans le menu des outils MCP."
