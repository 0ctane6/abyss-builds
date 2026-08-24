#!/usr/bin/env node
'use strict';

/**
 * Serveur MCP (stdio) qui expose OpenCode Zen — modele Ox Alpha — a Claude Desktop.
 *
 * Zero dependance : JSON-RPC 2.0 en JSON delimite par lignes sur stdin/stdout,
 * fetch natif (Node >= 18).
 *
 * Config par variables d'environnement :
 *   OPENCODE_ZEN_API_KEY        cle API (ou OPENCODE_ZEN_API_KEY_FILE)
 *   OPENCODE_ZEN_API_KEY_FILE   chemin d'un fichier contenant la cle
 *   OPENCODE_ZEN_BASE_URL       defaut https://opencode.ai/zen/v1
 *   OPENCODE_ZEN_MODEL          defaut x-preview-f-free (Ox Alpha)
 *   OPENCODE_ZEN_MAX_TOKENS     defaut 8192
 *   OPENCODE_ZEN_TIMEOUT_MS     defaut 300000
 *   OPENCODE_ZEN_AUTODETECT     "0" pour desactiver la resolution auto du modele
 *
 * CLI : --selftest   ping l'API et affiche la reponse du modele
 *       --list-models liste les modeles exposes par la passerelle
 */

const fs = require('fs');

const NAME = 'opencode-zen';
const VERSION = '1.0.0';
const DEFAULT_PROTOCOL = '2025-06-18';
const SUPPORTED_PROTOCOLS = new Set(['2024-11-05', '2025-03-26', '2025-06-18']);

const BASE_URL = (process.env.OPENCODE_ZEN_BASE_URL || 'https://opencode.ai/zen/v1').replace(/\/+$/, '');
const DEFAULT_MODEL = process.env.OPENCODE_ZEN_MODEL || 'x-preview-f-free';
const DEFAULT_MAX_TOKENS = intEnv('OPENCODE_ZEN_MAX_TOKENS', 8192);
const TIMEOUT_MS = intEnv('OPENCODE_ZEN_TIMEOUT_MS', 300000);
const AUTODETECT = process.env.OPENCODE_ZEN_AUTODETECT !== '0';

// Les modeles furtifs changent d'identifiant au fil des semaines : on accepte les
// alias courants et on retombe sur /models si la passerelle refuse l'id.
const MODEL_ALIASES = {
  'ox-alpha': 'x-preview-f-free',
  'oxalpha': 'x-preview-f-free',
  'ox_alpha': 'x-preview-f-free',
};
const OX_ALPHA_PATTERN = /(ox[-_.]?alpha|x-preview-f)/i;

let resolvedModel = null; // memorise un id corrige par l'autodetection

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function log(...args) {
  process.stderr.write(`[${NAME}] ${args.join(' ')}\n`);
}

function apiKey() {
  const file = process.env.OPENCODE_ZEN_API_KEY_FILE;
  if (file) {
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch (err) {
      throw new Error(`Impossible de lire OPENCODE_ZEN_API_KEY_FILE (${file}) : ${err.message}`);
    }
    const key = raw.trim();
    if (key) return key;
    throw new Error(`Le fichier de cle ${file} est vide.`);
  }
  const key = (process.env.OPENCODE_ZEN_API_KEY || '').trim();
  if (key) return key;
  throw new Error(
    'Aucune cle API. Definis OPENCODE_ZEN_API_KEY ou OPENCODE_ZEN_API_KEY_FILE ' +
      '(cle a recuperer sur https://opencode.ai/zen).'
  );
}

/* ------------------------------------------------------------------ HTTP */

const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function zenFetch(path, init = {}, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': `${NAME}-mcp/${VERSION}`,
        ...(init.headers || {}),
      },
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Timeout apres ${TIMEOUT_MS} ms sur ${path}.`);
    }
    if (attempt < 2) {
      await sleep(1000 * 2 ** attempt);
      return zenFetch(path, init, attempt + 1);
    }
    throw new Error(`Echec reseau vers ${BASE_URL}${path} : ${err.message}`);
  }
  clearTimeout(timer);

  if (RETRYABLE.has(res.status) && attempt < 2) {
    const retryAfter = Number.parseFloat(res.headers.get('retry-after') || '');
    const wait = Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 30000) : 1000 * 2 ** attempt;
    log(`HTTP ${res.status} sur ${path}, nouvelle tentative dans ${wait} ms`);
    await sleep(wait);
    return zenFetch(path, init, attempt + 1);
  }
  return res;
}

async function readBody(res) {
  const text = await res.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}

function apiErrorMessage(res, body) {
  const detail =
    body.json?.error?.message ||
    body.json?.message ||
    body.text.slice(0, 500) ||
    res.statusText;
  if (res.status === 401 || res.status === 403) {
    return `HTTP ${res.status} : cle API refusee par OpenCode Zen. ${detail}`;
  }
  if (res.status === 429) {
    return `HTTP 429 : quota gratuit atteint sur OpenCode Zen, reessaie plus tard. ${detail}`;
  }
  return `HTTP ${res.status} : ${detail}`;
}

/* ---------------------------------------------------------------- modeles */

async function listModels() {
  const res = await zenFetch('/models', { method: 'GET' });
  const body = await readBody(res);
  if (!res.ok) throw new Error(apiErrorMessage(res, body));
  const data = body.json?.data || body.json?.models || [];
  return data.map((m) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
}

async function autodetectModel() {
  const ids = await listModels();
  const hit = ids.find((id) => OX_ALPHA_PATTERN.test(id));
  if (!hit) {
    throw new Error(
      `Aucun modele Ox Alpha trouve sur la passerelle. Modeles disponibles : ${ids.join(', ') || '(aucun)'}`
    );
  }
  return hit;
}

function normalizeModel(requested) {
  const raw = (requested || resolvedModel || DEFAULT_MODEL).trim();
  return MODEL_ALIASES[raw.toLowerCase()] || raw;
}

function looksLikeUnknownModel(res, body) {
  if (res.status !== 400 && res.status !== 404 && res.status !== 422) return false;
  const detail = `${body.json?.error?.message || ''} ${body.text}`.toLowerCase();
  return /model|endpoint/.test(detail);
}

/* ------------------------------------------------------------ completions */

function flattenContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .filter(Boolean)
      .join('');
  }
  return '';
}

async function chatCompletion(opts) {
  const model = normalizeModel(opts.model);
  const payload = {
    model,
    messages: opts.messages,
    stream: false,
    max_tokens: opts.max_tokens || DEFAULT_MAX_TOKENS,
  };
  if (typeof opts.temperature === 'number') payload.temperature = opts.temperature;

  // NB : on n'envoie jamais de champ `tools` — la passerelle Zen rejette les
  // requetes outillees sur les modeles preview (Ox Alpha inclus).
  let res = await zenFetch('/chat/completions', { method: 'POST', body: JSON.stringify(payload) });
  let body = await readBody(res);

  if (!res.ok && AUTODETECT && !opts.model && looksLikeUnknownModel(res, body)) {
    const detected = await autodetectModel();
    if (detected !== model) {
      log(`modele "${model}" refuse, bascule automatique sur "${detected}"`);
      resolvedModel = detected;
      payload.model = detected;
      res = await zenFetch('/chat/completions', { method: 'POST', body: JSON.stringify(payload) });
      body = await readBody(res);
    }
  }

  if (!res.ok) throw new Error(apiErrorMessage(res, body));
  if (!body.json) throw new Error(`Reponse non-JSON de la passerelle : ${body.text.slice(0, 300)}`);

  const choice = body.json.choices?.[0];
  if (!choice) throw new Error(`Reponse sans choix exploitable : ${body.text.slice(0, 300)}`);

  return {
    model: body.json.model || payload.model,
    text: flattenContent(choice.message?.content),
    reasoning: flattenContent(choice.message?.reasoning_content ?? choice.message?.reasoning),
    finishReason: choice.finish_reason || null,
    usage: body.json.usage || null,
  };
}

function renderCompletion(result, includeReasoning) {
  const parts = [];
  if (includeReasoning && result.reasoning) {
    parts.push(`<raisonnement>\n${result.reasoning}\n</raisonnement>`);
  }
  parts.push(result.text || '(reponse vide)');
  const usage = result.usage;
  const meta = [`modele: ${result.model}`];
  if (result.finishReason) meta.push(`fin: ${result.finishReason}`);
  if (usage) meta.push(`tokens: ${usage.prompt_tokens ?? '?'} in / ${usage.completion_tokens ?? '?'} out`);
  parts.push(`\n---\n${meta.join(' | ')}`);
  return parts.join('\n\n');
}

/* ------------------------------------------------------------------ tools */

const TOOLS = [
  {
    name: 'ox_alpha_ask',
    description:
      'Envoie une question ponctuelle au modele Ox Alpha via OpenCode Zen (contexte 1M tokens) ' +
      'et renvoie sa reponse. A utiliser pour deleguer une analyse de code longue, une seconde ' +
      'opinion ou un gros volume de contexte a un modele externe.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'La question ou la consigne a envoyer au modele.' },
        system: { type: 'string', description: 'Consigne systeme optionnelle.' },
        temperature: { type: 'number', minimum: 0, maximum: 2, description: 'Temperature (defaut : celle du modele).' },
        max_tokens: { type: 'integer', minimum: 1, description: `Tokens de sortie max (defaut ${DEFAULT_MAX_TOKENS}).` },
        model: { type: 'string', description: 'Forcer un autre identifiant de modele Zen.' },
        include_reasoning: { type: 'boolean', description: 'Inclure la trace de raisonnement si le modele en renvoie une.' },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
  },
  {
    name: 'ox_alpha_chat',
    description:
      'Comme ox_alpha_ask mais avec un historique de conversation complet ' +
      '(liste de messages role/content) transmis a Ox Alpha.',
    inputSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          minItems: 1,
          description: 'Historique au format OpenAI.',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
            additionalProperties: false,
          },
        },
        temperature: { type: 'number', minimum: 0, maximum: 2 },
        max_tokens: { type: 'integer', minimum: 1 },
        model: { type: 'string' },
        include_reasoning: { type: 'boolean' },
      },
      required: ['messages'],
      additionalProperties: false,
    },
  },
  {
    name: 'zen_list_models',
    description: "Liste les modeles disponibles sur la passerelle OpenCode Zen avec la cle configuree.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

async function callTool(name, args) {
  switch (name) {
    case 'ox_alpha_ask': {
      if (typeof args.prompt !== 'string' || !args.prompt.trim()) {
        throw new Error('Le parametre "prompt" est requis et doit etre une chaine non vide.');
      }
      const messages = [];
      if (args.system) messages.push({ role: 'system', content: String(args.system) });
      messages.push({ role: 'user', content: args.prompt });
      const result = await chatCompletion({ ...args, messages });
      return renderCompletion(result, Boolean(args.include_reasoning));
    }
    case 'ox_alpha_chat': {
      if (!Array.isArray(args.messages) || args.messages.length === 0) {
        throw new Error('Le parametre "messages" est requis et doit etre une liste non vide.');
      }
      const messages = args.messages.map((m, i) => {
        if (!m || typeof m.role !== 'string' || typeof m.content !== 'string') {
          throw new Error(`messages[${i}] doit avoir les champs "role" et "content" (chaines).`);
        }
        return { role: m.role, content: m.content };
      });
      const result = await chatCompletion({ ...args, messages });
      return renderCompletion(result, Boolean(args.include_reasoning));
    }
    case 'zen_list_models': {
      const ids = await listModels();
      if (!ids.length) return 'La passerelle ne renvoie aucun modele.';
      return ids.map((id) => (OX_ALPHA_PATTERN.test(id) ? `* ${id}  <- Ox Alpha` : `* ${id}`)).join('\n');
    }
    default:
      throw new Error(`Outil inconnu : ${name}`);
  }
}

/* --------------------------------------------------------------- JSON-RPC */

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function respond(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function respondError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion;
      const protocolVersion = SUPPORTED_PROTOCOLS.has(asked) ? asked : DEFAULT_PROTOCOL;
      respond(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: NAME, version: VERSION },
        instructions:
          'Passerelle vers le modele Ox Alpha (OpenCode Zen). Utilise ox_alpha_ask pour une question ' +
          'ponctuelle, ox_alpha_chat pour une conversation, zen_list_models pour verifier les identifiants.',
      });
      return;
    }
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return;
    case 'ping':
      if (!isNotification) respond(id, {});
      return;
    case 'tools/list':
      respond(id, { tools: TOOLS });
      return;
    case 'resources/list':
      respond(id, { resources: [] });
      return;
    case 'prompts/list':
      respond(id, { prompts: [] });
      return;
    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};
      try {
        const text = await callTool(toolName, args);
        respond(id, { content: [{ type: 'text', text }], isError: false });
      } catch (err) {
        log(`erreur outil ${toolName} : ${err.message}`);
        respond(id, { content: [{ type: 'text', text: `Erreur OpenCode Zen : ${err.message}` }], isError: true });
      }
      return;
    }
    default:
      if (!isNotification) respondError(id, -32601, `Methode non supportee : ${method}`);
  }
}

function serve() {
  let buffer = '';
  let pending = 0;
  let stdinClosed = false;

  const done = () => {
    pending -= 1;
    if (stdinClosed && pending === 0) process.exit(0);
  };

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        log('message JSON invalide ignore');
        continue;
      }
      pending += 1;
      Promise.resolve(handle(msg))
        .catch((err) => {
          log(`erreur interne : ${err.stack || err.message}`);
          if (msg && msg.id !== undefined && msg.id !== null) {
            respondError(msg.id, -32603, err.message);
          }
        })
        .finally(done);
    }
  });
  const onStdinEnd = () => {
    stdinClosed = true;
    if (pending === 0) process.exit(0);
    // Filet de securite : ne pas rester bloque si une requete ne revient jamais.
    setTimeout(() => process.exit(0), TIMEOUT_MS).unref();
  };
  process.stdin.on('end', onStdinEnd);
  process.stdin.on('close', onStdinEnd);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
  log(`pret — base=${BASE_URL} modele=${normalizeModel()}`);
}

/* -------------------------------------------------------------------- CLI */

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--list-models')) {
    const ids = await listModels();
    process.stdout.write(`${ids.join('\n')}\n`);
    return;
  }

  if (argv.includes('--selftest')) {
    process.stdout.write(`base url : ${BASE_URL}\n`);
    const ids = await listModels().catch((err) => {
      throw new Error(`/models injoignable : ${err.message}`);
    });
    const hit = ids.find((id) => OX_ALPHA_PATTERN.test(id));
    process.stdout.write(`modeles  : ${ids.length} disponibles${hit ? ` (Ox Alpha : ${hit})` : ''}\n`);
    const result = await chatCompletion({
      messages: [{ role: 'user', content: 'Reponds exactement : OK' }],
      max_tokens: 32,
    });
    process.stdout.write(`modele   : ${result.model}\n`);
    process.stdout.write(`reponse  : ${result.text.trim().slice(0, 200)}\n`);
    return;
  }

  serve();
}

main().catch((err) => {
  log(err.message);
  process.exit(1);
});
