# opencode-zen-mcp — Ox Alpha dans Claude Desktop

Serveur MCP (stdio, zero dependance) qui branche la passerelle **OpenCode Zen** et son
modele **Ox Alpha** sur **Claude Desktop**. Claude garde la main sur la conversation et
peut deleguer une question a Ox Alpha via trois outils :

| Outil | Ce qu'il fait |
|---|---|
| `ox_alpha_ask` | une question ponctuelle (+ `system`, `temperature`, `max_tokens`) |
| `ox_alpha_chat` | une conversation complete (liste de messages `role`/`content`) |
| `zen_list_models` | liste les modeles vus par ta cle, marque celui qui est Ox Alpha |

## Installation

```bash
cd tools/opencode-zen-mcp
./install.sh            # demande la cle API, teste la passerelle, ecrit la config
```

Puis **quitte completement Claude Desktop** (pas juste fermer la fenetre) et relance-le.
Les outils apparaissent dans le menu MCP de la zone de saisie.

La cle se recupere sur <https://opencode.ai/zen>.

### Options

```bash
./install.sh --key sk-...              # cle en argument (sinon : saisie masquee)
./install.sh --model x-preview-f-free  # forcer un identifiant de modele
./install.sh --base-url https://opencode.ai/zen/v1
./install.sh --name zen-ox             # nom de l'entree dans la config
./install.sh --inline-key              # cle ecrite dans claude_desktop_config.json
./install.sh --no-test                 # sauter le test de fumee
./install.sh --uninstall               # retirer l'entree
```

Par defaut la cle **n'est pas** ecrite dans `claude_desktop_config.json` : elle va dans
`~/.config/opencode-zen/api-key` (chmod 600), et la config ne contient que le chemin.
Pratique quand on partage une capture d'ecran de sa config MCP.

L'installeur sauvegarde toujours l'ancienne config
(`claude_desktop_config.json.bak.<horodatage>`) et preserve les autres serveurs MCP deja
declares.

### Emplacement de la config Claude Desktop

| OS | Chemin |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Sur Windows, lance `install.sh` depuis Git Bash — il detecte `%APPDATA%` tout seul.

### Config manuelle

Si tu preferes editer le JSON a la main :

```json
{
  "mcpServers": {
    "opencode-zen": {
      "command": "/chemin/absolu/vers/node",
      "args": ["/chemin/absolu/vers/tools/opencode-zen-mcp/server.js"],
      "env": {
        "OPENCODE_ZEN_API_KEY": "sk-...",
        "OPENCODE_ZEN_MODEL": "x-preview-f-free"
      }
    }
  }
}
```

Mets le **chemin absolu** de `node` : Claude Desktop ne lance pas les serveurs avec ton
`PATH` de shell, un simple `"command": "node"` echoue souvent sur macOS.

## Verification hors Claude

```bash
node server.js --selftest      # ping /models + un aller-retour sur le modele
node server.js --list-models   # identifiants exacts exposes par ta cle
```

## Variables d'environnement

| Variable | Defaut | Role |
|---|---|---|
| `OPENCODE_ZEN_API_KEY` | — | cle API |
| `OPENCODE_ZEN_API_KEY_FILE` | — | fichier contenant la cle (prioritaire) |
| `OPENCODE_ZEN_BASE_URL` | `https://opencode.ai/zen/v1` | passerelle |
| `OPENCODE_ZEN_MODEL` | `x-preview-f-free` | modele (alias `ox-alpha` accepte) |
| `OPENCODE_ZEN_MAX_TOKENS` | `8192` | tokens de sortie par defaut |
| `OPENCODE_ZEN_TIMEOUT_MS` | `300000` | timeout par requete |
| `OPENCODE_ZEN_AUTODETECT` | actif | mettre `0` pour desactiver la resolution auto du modele |

## Notes sur Ox Alpha

- Ox Alpha est un modele *stealth*, son identifiant bouge : cote Zen il est publie comme
  `x-preview-f-free`, cote route Go comme `ox-alpha-free`. Si la passerelle refuse l'id
  configure, le serveur interroge `/models`, retient le premier id qui matche
  `ox-alpha` / `x-preview-f` et rejoue la requete une fois.
- Les requetes contenant un champ `tools` sont rejetees par Zen sur les modeles preview :
  le serveur n'en envoie jamais. Ox Alpha repond en texte, c'est Claude qui outille.
- Le palier gratuit renvoie beaucoup de `429`. Le serveur retente jusqu'a 2 fois avec
  backoff exponentiel et respecte `Retry-After` avant de remonter l'erreur.
- Prerequis : Node.js 18+ (aucun `npm install`).
