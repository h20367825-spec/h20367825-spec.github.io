import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = join(ROOT, 'data', 'measured-benchmarks.json');
const API = process.env.OLLAMA_API || 'http://127.0.0.1:11434';
const requestedModel = process.argv[2];
const profileSlug = process.env.BENCH_PROFILE || 'mac-mini-m4-16gb';
const contextTokens = Number(process.env.BENCH_CONTEXT || 4096);
const runs = Number(process.env.BENCH_RUNS || 3);

if (!Number.isInteger(contextTokens) || contextTokens < 512) throw new Error('BENCH_CONTEXT must be an integer >= 512.');
if (!Number.isInteger(runs) || runs < 1 || runs > 10) throw new Error('BENCH_RUNS must be an integer from 1 to 10.');

async function jsonRequest(path, init) {
  const response = await fetch(`${API}${path}`, init);
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}: ${await response.text()}`);
  return response.json();
}

const tags = await jsonRequest('/api/tags');
const installed = tags.models || [];
if (!installed.length) throw new Error('No local Ollama models are installed.');

const model = requestedModel || installed[0].name;
const descriptor = installed.find((item) => item.name === model || item.model === model);
if (!descriptor) {
  throw new Error(`Model ${model} is not installed. Available: ${installed.map((item) => item.name).join(', ')}`);
}

async function generate(numPredict) {
  return jsonRequest('/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      keep_alive: '5m',
      prompt: '请用中文简要说明在本地运行大语言模型时，统一内存、量化精度和上下文长度为什么会影响速度。',
      options: {
        num_ctx: contextTokens,
        num_predict: numPredict,
        temperature: 0,
        seed: 42
      }
    })
  });
}

// Load the model before timing so disk-loading time is not reported as generation speed.
await generate(24);
const samples = [];
for (let index = 0; index < runs; index += 1) {
  const result = await generate(128);
  if (!result.eval_count || !result.eval_duration) throw new Error('Ollama response did not include eval_count/eval_duration.');
  samples.push({
    tokensPerSecond: result.eval_count / (result.eval_duration / 1e9),
    promptTokens: result.prompt_eval_count || 0,
    outputTokens: result.eval_count,
    firstTokenSeconds: (result.prompt_eval_duration || 0) / 1e9,
    totalSeconds: (result.total_duration || 0) / 1e9
  });
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const now = new Date().toISOString();
const record = {
  profileSlug,
  modelName: descriptor.name,
  modelFamily: descriptor.details?.family || null,
  parameterSize: descriptor.details?.parameter_size || null,
  quantization: descriptor.details?.quantization_level || null,
  runtime: `Ollama ${tags.version || 'local API'}`,
  contextTokens,
  tokensPerSecond: Number(median(samples.map((item) => item.tokensPerSecond)).toFixed(1)),
  firstTokenSeconds: Number(median(samples.map((item) => item.firstTokenSeconds)).toFixed(2)),
  runs,
  sampleTokensPerSecond: samples.map((item) => Number(item.tokensPerSecond.toFixed(1))),
  promptTokens: samples[0].promptTokens,
  outputTokens: samples[0].outputTokens,
  collectedAt: now,
  method: 'Warm model; deterministic Chinese prompt; median decode speed; Ollama /api/generate.'
};

const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
data.records = data.records.filter((item) => !(item.profileSlug === profileSlug && item.modelName === descriptor.name && item.contextTokens === contextTokens));
data.records.push(record);
data.records.sort((a, b) => `${a.profileSlug}|${a.modelName}|${a.contextTokens}`.localeCompare(`${b.profileSlug}|${b.modelName}|${b.contextTokens}`));
writeFileSync(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);

console.log(JSON.stringify({ ok: true, record }, null, 2));
