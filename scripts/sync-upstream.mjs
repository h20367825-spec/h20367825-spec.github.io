import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = join(ROOT, 'vendor', 'modelfit', 'src', 'data', 'models.json');
const META_FILE = join(ROOT, 'data', 'source-meta.json');
const RAW_URL = process.env.MODELFIT_DATA_URL || 'https://raw.githubusercontent.com/Wecko-ai/modelfit/main/src/data/models.json';
const API_URL = process.env.MODELFIT_API_URL || 'https://modelfit.io/api/dataset/';
const OLLAMA_COMMAND = /^ollama (?:run|pull) [a-z0-9][a-z0-9._:/-]+$/i;
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'local-ai-radar-updater/0.1' } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

function validateModels(models) {
  if (!Array.isArray(models) || models.length < 50 || models.length > 1000) {
    throw new Error(`Expected 50-1000 models, received ${Array.isArray(models) ? models.length : typeof models}.`);
  }
  const ids = new Set();
  for (const [index, model] of models.entries()) {
    const at = `entry ${index}`;
    for (const key of ['id', 'name', 'family', 'quantization', 'bestFor']) {
      if (typeof model[key] !== 'string' || !model[key].trim() || CONTROL.test(model[key])) {
        throw new Error(`${at}: invalid ${key}.`);
      }
    }
    for (const key of ['sizeB', 'estimatedLoadGb', 'speedScore', 'qualityScore']) {
      if (!Number.isFinite(model[key]) || model[key] < 0) throw new Error(`${at}: invalid ${key}.`);
    }
    if (ids.has(model.id)) throw new Error(`${at}: duplicate id ${model.id}.`);
    ids.add(model.id);
    if (model.ollamaCommand != null && !OLLAMA_COMMAND.test(model.ollamaCommand)) {
      throw new Error(`${at}: unsafe ollamaCommand.`);
    }
    if (!Array.isArray(model.tags) || !Array.isArray(model.sources)) throw new Error(`${at}: tags/sources must be arrays.`);
    for (const source of model.sources) {
      let parsed;
      try { parsed = new URL(source); } catch { throw new Error(`${at}: invalid source URL.`); }
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error(`${at}: unsafe source URL protocol.`);
    }
  }
  return {
    models: models.length,
    local: models.filter((model) => !model.cloud_only).length,
    cloud: models.filter((model) => model.cloud_only).length,
    families: new Set(models.map((model) => model.family)).size
  };
}

function assertApi(api, counts) {
  if (api?.license?.includes('CC BY 4.0') !== true) throw new Error('Official API no longer declares CC BY 4.0.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(api.updated || '')) throw new Error('Official API has no valid updated date.');
  for (const key of ['models', 'local', 'cloud', 'families']) {
    if (Number(api.counts?.[key]) !== counts[key]) {
      throw new Error(`Source mismatch for ${key}: repository ${counts[key]}, official API ${api.counts?.[key]}.`);
    }
  }
}

const previousModels = readFileSync(DATA_FILE, 'utf8');
const previousMeta = readFileSync(META_FILE, 'utf8');

try {
  const [models, api] = await Promise.all([fetchJson(RAW_URL), fetchJson(API_URL)]);
  const counts = validateModels(models);
  assertApi(api, counts);
  const nextModels = `${JSON.stringify(models, null, 2)}\n`;
  const changed = nextModels !== previousModels;
  if (changed) {
    writeFileSync(DATA_FILE, nextModels);
    writeFileSync(META_FILE, `${JSON.stringify({
      schemaVersion: 1,
      attribution: api.attribution,
      license: api.license,
      upstreamUpdated: api.updated,
      source: RAW_URL,
      verifiedAgainst: API_URL,
      counts,
      syncedAt: new Date().toISOString()
    }, null, 2)}\n`);
  }

  const verify = spawnSync('npm', ['run', 'verify'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  if (verify.status !== 0) throw new Error(`Build verification failed.\n${verify.stdout}\n${verify.stderr}`);
  console.log(JSON.stringify({ ok: true, changed, upstreamUpdated: api.updated, counts }, null, 2));
} catch (error) {
  writeFileSync(DATA_FILE, previousModels);
  writeFileSync(META_FILE, previousMeta);
  spawnSync('npm', ['run', 'verify'], { cwd: ROOT, stdio: 'ignore' });
  throw error;
}
