import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATASET, getRecommendations, ramBudgetRatio } from '../vendor/modelfit/src/engine.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ORIGIN = String(process.env.SITE_ORIGIN || 'http://localhost:4173').replace(/\/$/, '');

if (DIST !== join(ROOT, 'dist')) throw new Error('Refusing to build outside the project dist directory.');
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const measuredData = JSON.parse(readFileSync(join(ROOT, 'data', 'measured-benchmarks.json'), 'utf8'));
const sourceMeta = JSON.parse(readFileSync(join(ROOT, 'data', 'source-meta.json'), 'utf8'));
if (measuredData.schemaVersion !== 1 || !Array.isArray(measuredData.records)) {
  throw new Error('data/measured-benchmarks.json does not match schemaVersion 1.');
}
for (const [index, record] of measuredData.records.entries()) {
  const required = ['profileSlug', 'modelName', 'runtime', 'contextTokens', 'tokensPerSecond', 'collectedAt'];
  const missing = required.filter((key) => record[key] === undefined || record[key] === null || record[key] === '');
  if (missing.length) throw new Error(`Measured benchmark ${index} is missing: ${missing.join(', ')}`);
}

const profiles = [
  { slug: 'mac-mini-m1-8gb', label: 'Mac mini M1 · 8GB', deviceType: 'Mac Mini', chip: 'Apple M1', ramGb: 8, generation: 'M1' },
  { slug: 'mac-mini-m1-16gb', label: 'Mac mini M1 · 16GB', deviceType: 'Mac Mini', chip: 'Apple M1', ramGb: 16, generation: 'M1' },
  { slug: 'mac-mini-m2-16gb', label: 'Mac mini M2 · 16GB', deviceType: 'Mac Mini', chip: 'Apple M2', ramGb: 16, generation: 'M2' },
  { slug: 'mac-mini-m2-pro-32gb', label: 'Mac mini M2 Pro · 32GB', deviceType: 'Mac Mini', chip: 'Apple M2 Pro', ramGb: 32, generation: 'M2 Pro' },
  { slug: 'mac-mini-m4-16gb', label: 'Mac mini M4 · 16GB', deviceType: 'Mac Mini', chip: 'Apple M4', ramGb: 16, generation: 'M4' },
  { slug: 'mac-mini-m4-24gb', label: 'Mac mini M4 · 24GB', deviceType: 'Mac Mini', chip: 'Apple M4', ramGb: 24, generation: 'M4' },
  { slug: 'mac-mini-m4-32gb', label: 'Mac mini M4 · 32GB', deviceType: 'Mac Mini', chip: 'Apple M4', ramGb: 32, generation: 'M4' },
  { slug: 'mac-mini-m4-pro-24gb', label: 'Mac mini M4 Pro · 24GB', deviceType: 'Mac Mini', chip: 'Apple M4 Pro', ramGb: 24, generation: 'M4 Pro' },
  { slug: 'mac-mini-m4-pro-48gb', label: 'Mac mini M4 Pro · 48GB', deviceType: 'Mac Mini', chip: 'Apple M4 Pro', ramGb: 48, generation: 'M4 Pro' },
  { slug: 'macbook-air-m2-16gb', label: 'MacBook Air M2 · 16GB', deviceType: 'MacBook Air', chip: 'Apple M2', ramGb: 16, generation: 'M2' },
  { slug: 'macbook-air-m3-16gb', label: 'MacBook Air M3 · 16GB', deviceType: 'MacBook Air', chip: 'Apple M3', ramGb: 16, generation: 'M3' },
  { slug: 'macbook-air-m3-24gb', label: 'MacBook Air M3 · 24GB', deviceType: 'MacBook Air', chip: 'Apple M3', ramGb: 24, generation: 'M3' },
  { slug: 'macbook-air-m4-16gb', label: 'MacBook Air M4 · 16GB', deviceType: 'MacBook Air', chip: 'Apple M4', ramGb: 16, generation: 'M4' },
  { slug: 'macbook-air-m4-24gb', label: 'MacBook Air M4 · 24GB', deviceType: 'MacBook Air', chip: 'Apple M4', ramGb: 24, generation: 'M4' },
  { slug: 'macbook-pro-m3-pro-18gb', label: 'MacBook Pro M3 Pro · 18GB', deviceType: 'MacBook Pro', chip: 'Apple M3 Pro', ramGb: 18, generation: 'M3 Pro' },
  { slug: 'macbook-pro-m4-16gb', label: 'MacBook Pro M4 · 16GB', deviceType: 'MacBook Pro', chip: 'Apple M4', ramGb: 16, generation: 'M4' },
  { slug: 'macbook-pro-m4-pro-24gb', label: 'MacBook Pro M4 Pro · 24GB', deviceType: 'MacBook Pro', chip: 'Apple M4 Pro', ramGb: 24, generation: 'M4 Pro' },
  { slug: 'macbook-pro-m4-pro-48gb', label: 'MacBook Pro M4 Pro · 48GB', deviceType: 'MacBook Pro', chip: 'Apple M4 Pro', ramGb: 48, generation: 'M4 Pro' },
  { slug: 'macbook-pro-m4-max-64gb', label: 'MacBook Pro M4 Max · 64GB', deviceType: 'MacBook Pro', chip: 'Apple M4 Max', ramGb: 64, generation: 'M4 Max' },
  { slug: 'mac-studio-m2-max-32gb', label: 'Mac Studio M2 Max · 32GB', deviceType: 'Mac Studio', chip: 'Apple M2 Max', ramGb: 32, generation: 'M2 Max' },
  { slug: 'mac-studio-m2-ultra-64gb', label: 'Mac Studio M2 Ultra · 64GB', deviceType: 'Mac Studio', chip: 'Apple M2 Ultra', ramGb: 64, generation: 'M2 Ultra' },
  { slug: 'mac-studio-m3-ultra-96gb', label: 'Mac Studio M3 Ultra · 96GB', deviceType: 'Mac Studio', chip: 'Apple M3 Ultra', ramGb: 96, generation: 'M3 Ultra' },
  { slug: 'mac-studio-m3-ultra-128gb', label: 'Mac Studio M3 Ultra · 128GB', deviceType: 'Mac Studio', chip: 'Apple M3 Ultra', ramGb: 128, generation: 'M3 Ultra' }
];

const useCases = [
  { value: 'Mixed', slug: 'general', label: '综合使用', title: '日常问答、写作与综合任务', focus: '兼顾中文问答、写作、知识整理与轻量推理' },
  { value: 'Coding', slug: 'coding', label: '编程', title: '本地代码模型', focus: '代码补全、调试、脚本生成与仓库理解' },
  { value: 'Chat', slug: 'chat', label: '中文对话', title: '本地中文对话模型', focus: '中文交流、摘要、改写和通用助手任务' },
  { value: 'Translation', slug: 'translation', label: '翻译', title: '本地翻译模型', focus: '中英互译、多语言整理和隐私文本处理' }
];

const priorities = ['Balanced', 'Speed', 'Quality'];
const priorityLabels = { Balanced: '平衡', Speed: '速度优先', Quality: '质量优先' };
const verdictLabels = {
  local_feasible: '适合本地运行',
  local_slow: '可运行但偏慢',
  local_unlikely: '不建议本地运行',
  cloud_only: '仅云端'
};
const verdictClasses = { local_feasible: 'good', local_slow: 'slow', local_unlikely: 'bad', cloud_only: 'cloud' };

const familyIntros = {
  Qwen: '通义千问开源家族覆盖从轻量端侧到高参数模型，中文能力、工具调用与代码任务是其常见优势。',
  DeepSeek: 'DeepSeek 家族以推理和代码任务见长。小型蒸馏或量化版本适合本地部署，大型版本通常需要更高内存。',
  MiniCPM: 'MiniCPM 面向高效端侧推理，在较小体量下强调实用的中文与多模态能力。',
  MiniMax: 'MiniMax 的公开条目以云端服务为主；页面会明确区分云端模型与可下载权重。',
  Kimi: 'Kimi 系列强调长上下文与推理体验。当前数据中的相关条目需要通过云端使用。',
  Zhipu: '智谱模型覆盖通用对话与推理场景。当前数据中的条目以云端服务为主。',
  Llama: 'Llama 是本地 AI 生态中覆盖广泛的开放权重家族，运行时、量化版本与教程资源丰富。',
  Gemma: 'Gemma 是 Google 的开放权重模型家族，提供多个尺寸，适合从轻量助手到高质量本地任务。',
  Mistral: 'Mistral 家族兼顾推理效率和多语言能力，在本地运行工具中拥有较完整的生态支持。',
  Phi: 'Phi 系列以小模型能力密度见长，适合内存有限的 Mac 和对响应速度敏感的任务。',
  Granite: 'Granite 家族面向企业与代码任务，提供可本地运行的多个尺寸。',
  'GPT-OSS': 'GPT-OSS 是开放权重模型条目，适合在具备足够统一内存的设备上进行本地评估。'
};

const chineseFamilies = ['Qwen', 'DeepSeek', 'MiniCPM', 'MiniMax', 'Kimi', 'Zhipu', 'MiMo'];
const familySlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const cleanUrl = (path) => path === '/' ? '/' : `${path.replace(/^\/+|\/+$/g, '')}/`;
const routeToFile = (route) => route === '/' ? join(DIST, 'index.html') : join(DIST, cleanUrl(route), 'index.html');
const routes = [];

function writeRoute(route, html) {
  const normalized = cleanUrl(route);
  const target = routeToFile(normalized);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  routes.push(normalized);
}

function writeAsset(path, content) {
  const target = join(DIST, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function inputFor(profile, useCase = 'Mixed', priority = 'Balanced') {
  return { deviceType: profile.deviceType, chip: profile.chip, ramGb: profile.ramGb, priority, useCase };
}

function localRecommendations(profile, useCase = 'Mixed', priority = 'Balanced') {
  const all = getRecommendations(inputFor(profile, useCase, priority)).filter((item) => !item.cloud_only);
  const tier = (item) => item.localVerdict === 'local_feasible' ? 0 : item.localVerdict === 'local_slow' ? 1 : 2;
  return all.sort((a, b) => tier(a) - tier(b) || b.score - a.score || b.qualityScore - a.qualityScore);
}

function topFor(profile, useCase = 'Mixed', priority = 'Balanced', count = 6) {
  return localRecommendations(profile, useCase, priority).slice(0, count);
}

function bestFamilyFor(profile, family) {
  return localRecommendations(profile).filter((item) => item.family === family)[0] || null;
}

const favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%2306101a'/%3E%3Cpath d='M13 40h8l6-18 9 28 7-20 4 10h5' fill='none' stroke='%2365e5d1' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

function header() {
  return `<header class="site-header"><nav class="nav" aria-label="主导航">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M2 15h4l3-9 4.5 14L17 10l2 5h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>本地 AI 选型雷达</span></a>
    <div class="nav-links"><a href="/#selector">开始选型</a><a href="/hardware/">设备库</a><a href="/models/">模型库</a><a href="/about/data-method/">数据方法</a></div>
  </nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="shell footer-grid">
    <div>兼容性与速度为估算值，真实结果受运行时、上下文长度和系统负载影响。</div>
    <div class="footer-links"><a href="/about/data-method/">数据方法</a><a href="/about/license/">授权与署名</a><a href="https://modelfit.io/" rel="noopener">数据来源 ModelFit</a></div>
  </div></footer>`;
}

function layout({ title, description, route, body, extraScripts = '' }) {
  const canonical = `${ORIGIN}${cleanUrl(route)}`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${esc(canonical)}">
  <link rel="icon" type="image/svg+xml" href="${favicon}">
  <link rel="stylesheet" href="/assets/styles.css">
</head>
<body>
  ${header()}
  <main>${body}</main>
  ${footer()}
  <script src="/assets/site-data.js"></script>
  <script src="/assets/app.js"></script>
  ${extraScripts}
</body>
</html>`;
}

function breadcrumb(items) {
  return `<nav class="breadcrumb" aria-label="面包屑">${items.map((item, index) =>
    index === items.length - 1 ? `<span aria-current="page">${esc(item.label)}</span>` : `<a href="${item.href}">${esc(item.label)}</a><span>/</span>`
  ).join('')}</nav>`;
}

function status(item) {
  return `<span class="status ${verdictClasses[item.localVerdict]}">${verdictLabels[item.localVerdict]}</span>`;
}

function modelCard(item, index = null) {
  const command = item.ollamaCommand ? `<div class="command"><code>${esc(item.ollamaCommand)}</code><button class="copy" type="button" data-copy="${esc(item.ollamaCommand)}">复制</button></div>` : '';
  return `<article class="model-card">
    <div>
      <div class="model-title-row">${index == null ? '' : `<span class="rank">${index + 1}</span>`}<h3><a href="/models/${familySlug(item.family)}/">${esc(item.name)}</a></h3>${status(item)}<span class="estimate-badge">模型估算</span></div>
      <p>${esc(item.bestFor)} · ${esc(item.quantization)}。预计加载 ${item.estimatedLoadGb} GB，质量评分 ${item.qualityScore}/100。</p>
      ${command}
    </div>
    <div class="model-numbers">
      <div class="number-cell"><span class="number-value">${item.estimatedTokensPerSec == null ? '—' : item.estimatedTokensPerSec}</span><span class="number-label">估算 tok/s</span></div>
      <div class="number-cell"><span class="number-value">${item.estimatedFirstTokenSec == null ? '—' : `${item.estimatedFirstTokenSec}s`}</span><span class="number-label">估算首字</span></div>
      <div class="number-cell"><span class="number-value">${item.fitPct}%</span><span class="number-label">内存余量</span></div>
    </div>
  </article>`;
}

function recommendationTable(items) {
  return `<div class="table-wrap"><table><thead><tr><th>模型</th><th>本地判断</th><th>预计占用</th><th>估算速度</th><th>量化</th><th>适合任务</th></tr></thead><tbody>
    ${items.map((item) => `<tr><td><a href="/models/${familySlug(item.family)}/"><strong>${esc(item.name)}</strong></a></td><td>${verdictLabels[item.localVerdict]}</td><td>${item.estimatedLoadGb} GB</td><td>${item.estimatedTokensPerSec == null ? '无可靠估算' : `${item.estimatedTokensPerSec} tok/s`}</td><td>${esc(item.quantization)}</td><td>${esc(item.bestFor)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function measuredTable(items) {
  return `<div class="table-wrap"><table><thead><tr><th>模型</th><th>运行时</th><th>上下文</th><th>实测速度</th><th>采集时间</th></tr></thead><tbody>
    ${items.map((item) => `<tr><td><strong>${esc(item.modelName)}</strong> <span class="measured-badge">本机实测</span></td><td>${esc(item.runtime)}</td><td>${Number(item.contextTokens).toLocaleString('zh-CN')} tokens</td><td>${Number(item.tokensPerSecond)} tok/s</td><td>${esc(item.collectedAt)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function familySummary(family, models) {
  const local = models.filter((model) => !model.cloud_only);
  const min = local.length ? Math.min(...local.map((model) => model.sizeB)) : null;
  const max = local.length ? Math.max(...local.map((model) => model.sizeB)) : null;
  return familyIntros[family] || `${family} 家族在当前数据集中收录 ${models.length} 个条目，其中 ${local.length} 个具有本地运行配置。${min == null ? '当前仅收录云端条目。' : `本地版本参数规模从 ${min}B 到 ${max}B。`}`;
}

const families = [...new Set(DATASET.map((model) => model.family))].sort((a, b) => a.localeCompare(b, 'en'));
const localCount = DATASET.filter((model) => !model.cloud_only).length;
const measuredCount = measuredData.records.length;

const precomputed = {};
for (const profile of profiles) {
  for (const useCase of useCases) {
    for (const priority of priorities) {
      precomputed[`${profile.slug}|${useCase.value}|${priority}`] = topFor(profile, useCase.value, priority, 5).map((item) => ({
        id: item.id,
        name: item.name,
        family: item.family,
        quantization: item.quantization,
        estimatedLoadGb: item.estimatedLoadGb,
        estimatedTokensPerSec: item.estimatedTokensPerSec,
        localVerdict: item.localVerdict
      }));
    }
  }
}

const clientData = {
  profiles: profiles.map(({ slug, label }) => ({ slug, label })),
  useCases: useCases.map((item) => item.value),
  useCaseLabels: Object.fromEntries(useCases.map((item) => [item.value, item.label])),
  priorities,
  recommendations: precomputed
};

writeAsset('assets/site-data.js', `window.LOCAL_AI_RADAR_DATA=${JSON.stringify(clientData).replaceAll('<', '\\u003c')};\n`);
copyFileSync(join(ROOT, 'src', 'styles.css'), join(DIST, 'assets', 'styles.css'));
copyFileSync(join(ROOT, 'src', 'client.js'), join(DIST, 'assets', 'app.js'));
mkdirSync(join(DIST, 'licenses'), { recursive: true });
copyFileSync(join(ROOT, 'vendor', 'modelfit', 'LICENSE'), join(DIST, 'licenses', 'ModelFit-MIT-and-dataset-notice.txt'));
copyFileSync(join(ROOT, 'NOTICE.md'), join(DIST, 'NOTICE.md'));

const defaultProfile = profiles.find((item) => item.slug === 'mac-mini-m4-16gb');
const defaultTop = topFor(defaultProfile, 'Mixed', 'Balanced', 5);
const popularProfiles = ['mac-mini-m4-16gb', 'mac-mini-m4-24gb', 'mac-mini-m4-pro-24gb', 'macbook-air-m4-16gb', 'macbook-pro-m4-pro-24gb', 'mac-studio-m3-ultra-96gb']
  .map((slug) => profiles.find((profile) => profile.slug === slug));

const homeBody = `<div class="shell">
  <section class="workspace" id="selector">
    <div class="intro-panel">
      <p class="eyebrow">Apple Silicon · 本地模型 · 中文选型</p>
      <h1>先看机器，<br>再选模型。</h1>
      <p class="lede">用统一内存、芯片带宽和模型量化数据，快速判断你的 Mac 能跑什么、预计多快、该从哪个版本开始。</p>
      <div class="proof-row" aria-label="数据覆盖">
        <div><span class="proof-value">${DATASET.length}</span><span class="proof-label">模型条目</span></div>
        <div><span class="proof-value">${localCount}</span><span class="proof-label">本地运行配置</span></div>
        <div><span class="proof-value">${profiles.length}</span><span class="proof-label">Mac 配置</span></div>
      </div>
    </div>
    <div class="picker-panel">
      <div class="picker-heading"><div><p class="eyebrow">即时推荐</p><h2>你的本地模型清单</h2></div><span class="estimate-badge">模型估算</span></div>
      <div class="controls">
        <div class="field"><label for="profile-select">Mac 配置</label><select id="profile-select">${profiles.map((profile) => `<option value="${profile.slug}"${profile.slug === defaultProfile.slug ? ' selected' : ''}>${esc(profile.label)}</option>`).join('')}</select></div>
        <div class="field"><label for="usecase-select">主要用途</label><select id="usecase-select">${useCases.map((item) => `<option value="${item.value}">${item.label}</option>`).join('')}</select></div>
        <div class="field"><label for="priority-select">选择侧重</label><select id="priority-select">${priorities.map((value) => `<option value="${value}">${priorityLabels[value]}</option>`).join('')}</select></div>
      </div>
      <div class="result-summary" id="result-summary"><strong>${esc(defaultProfile.label)}</strong>：首选 <strong>${esc(defaultTop[0].name)}</strong>。页面速度均为模型估算，实际表现请以本机测试为准。</div>
      <div class="recommendations" id="recommendations" aria-live="polite">${defaultTop.map((model, index) => `<article class="recommendation"><div class="rank">${index + 1}</div><div><p class="recommendation-name">${esc(model.name)}</p><div class="recommendation-meta">${esc(model.quantization)} · 预计占用 ${model.estimatedLoadGb} GB · ${verdictLabels[model.localVerdict]}</div></div><div class="recommendation-speed"><span class="speed-value">${model.estimatedTokensPerSec == null ? '—' : `${model.estimatedTokensPerSec} tok/s`}</span><span class="speed-label">估算生成速度</span></div></article>`).join('')}</div>
    </div>
  </section>
  <div class="notice-strip"><strong>数据边界：</strong>“模型估算”由公开模型规格和硬件参数计算；“本机实测”只接受真实运行记录。当前实测记录 ${measuredCount} 条，站点不会把估算结果包装成跑分。</div>

  <section class="section" id="hardware">
    <div class="section-heading"><p class="eyebrow">常用配置</p><h2>从你的 Mac 开始</h2><p>每个设备页分别计算综合、编程、中文对话和翻译场景，推荐不是一张所有设备共用的名单。</p></div>
    <div class="grid-3">${popularProfiles.map((profile) => {
      const top = topFor(profile)[0];
      return `<a class="family-card" href="/hardware/${profile.slug}/"><div><h3>${esc(profile.label)}</h3><p>统一内存可用预算约 ${Math.round(profile.ramGb * ramBudgetRatio(profile.ramGb) * 10) / 10} GB；综合首选 ${esc(top.name)}。</p></div><div class="family-meta"><span class="family-pill">${top.estimatedLoadGb} GB</span><span class="family-pill">${top.estimatedTokensPerSec ?? '—'} tok/s 估算</span></div></a>`;
    }).join('')}</div>
  </section>

  <section class="section" id="families">
    <div class="section-heading"><p class="eyebrow">中文生态</p><h2>国产模型家族</h2><p>同时展示开放权重和仅云端条目，让“能调用”与“能在 Mac 本地运行”保持清楚。</p></div>
    <div class="grid-4">${chineseFamilies.map((family) => {
      const models = DATASET.filter((model) => model.family === family);
      const local = models.filter((model) => !model.cloud_only).length;
      return `<a class="family-card" href="/models/${familySlug(family)}/"><div><h3>${esc(family)}</h3><p>${esc(familySummary(family, models))}</p></div><div class="family-meta"><span class="family-pill">${models.length} 个条目</span><span class="family-pill">${local} 个可本地运行</span></div></a>`;
    }).join('')}</div>
  </section>

  <section class="section compact"><div class="surface"><div class="grid-3">
    <div class="method-card"><p class="eyebrow">01 · 内存</p><h3>先判断能否加载</h3><p>为系统和上下文预留空间，再比较模型预计占用，避免只看参数量。</p></div>
    <div class="method-card"><p class="eyebrow">02 · 速度</p><h3>再估算生成速度</h3><p>综合芯片带宽、量化精度、模型有效参数和设备持续散热能力。</p></div>
    <div class="method-card"><p class="eyebrow">03 · 实测</p><h3>最后用本机验证</h3><p>估算用于缩小范围；购买硬件或长期部署前，应在真实任务上跑一遍。</p></div>
  </div></div></section>
</div>`;

writeRoute('/', layout({
  title: '本地 AI 选型雷达｜Mac 本地大模型推荐',
  description: '选择 Mac mini、MacBook 或 Mac Studio 配置，查看本地大模型兼容性、内存占用、估算速度和 Ollama 启动命令。',
  route: '/',
  body: homeBody
}));

const hardwareIndexBody = `<div class="shell">
  <section class="page-hero">${breadcrumb([{ label: '首页', href: '/' }, { label: '设备库' }])}<p class="eyebrow">23 个常用配置</p><h1>Apple Silicon 本地模型设备库</h1><p class="lede">按设备系列查看统一内存预算、综合首选模型和四类任务的独立推荐。所有速度数字均为模型估算。</p></section>
  ${['Mac Mini', 'MacBook Air', 'MacBook Pro', 'Mac Studio'].map((deviceType) => {
    const deviceProfiles = profiles.filter((profile) => profile.deviceType === deviceType);
    return `<section class="section"><div class="section-heading"><p class="eyebrow">${esc(deviceType)}</p><h2>${esc(deviceType)} 配置</h2></div><div class="grid-3">${deviceProfiles.map((profile) => {
      const top = topFor(profile)[0];
      return `<a class="family-card" href="/hardware/${profile.slug}/"><div><h3>${esc(profile.label)}</h3><p>综合首选 ${esc(top.name)}，预计占用 ${top.estimatedLoadGb} GB。</p></div><div class="family-meta"><span class="family-pill">${top.estimatedTokensPerSec ?? '—'} tok/s 估算</span><span class="family-pill">${verdictLabels[top.localVerdict]}</span></div></a>`;
    }).join('')}</div></section>`;
  }).join('')}
</div>`;
writeRoute('/hardware/', layout({ title: 'Mac 本地大模型设备库｜本地 AI 选型雷达', description: '浏览 Mac mini、MacBook Air、MacBook Pro 和 Mac Studio 的本地大模型兼容性与速度估算。', route: '/hardware/', body: hardwareIndexBody }));

const modelsIndexBody = `<div class="shell">
  <section class="page-hero">${breadcrumb([{ label: '首页', href: '/' }, { label: '模型库' }])}<p class="eyebrow">${families.length} 个模型家族</p><h1>本地大模型家族库</h1><p class="lede">查看每个模型家族的本地权重、云端条目、参数规模、上游来源，以及在三档 Mac 配置上的首选版本。</p></section>
  <section class="section"><div class="grid-4">${families.map((family) => {
    const models = DATASET.filter((model) => model.family === family);
    const local = models.filter((model) => !model.cloud_only).length;
    return `<a class="family-card" href="/models/${familySlug(family)}/"><div><h3>${esc(family)}</h3><p>${esc(familySummary(family, models))}</p></div><div class="family-meta"><span class="family-pill">${models.length} 个条目</span><span class="family-pill">${local} 个本地配置</span></div></a>`;
  }).join('')}</div></section>
</div>`;
writeRoute('/models/', layout({ title: '本地大模型家族库｜本地 AI 选型雷达', description: 'Qwen、DeepSeek、Llama、Gemma 等模型家族的本地运行配置、内存规模和上游来源。', route: '/models/', body: modelsIndexBody }));

for (const profile of profiles) {
  const general = topFor(profile, 'Mixed', 'Balanced', 8);
  const budget = Number((profile.ramGb * ramBudgetRatio(profile.ramGb)).toFixed(1));
  const scenarioRows = useCases.map((useCase) => ({ useCase, best: topFor(profile, useCase.value, 'Balanced', 1)[0] }));
  const measured = measuredData.records.filter((record) => record.profileSlug === profile.slug);
  const hardwareBody = `<div class="shell">
    <section class="page-hero">${breadcrumb([{ label: '首页', href: '/' }, { label: '设备库', href: '/hardware/' }, { label: profile.label }])}
      <p class="eyebrow">硬件选型报告 · 模型估算</p><h1>${esc(profile.label)} 能跑哪些本地大模型？</h1>
      <p class="lede">${esc(profile.chip)} 配合 ${profile.ramGb} GB 统一内存，模型计算预算约 ${budget} GB。综合场景首选 ${esc(general[0].name)}，预计生成速度 ${general[0].estimatedTokensPerSec ?? '暂无可靠数据'}${general[0].estimatedTokensPerSec == null ? '' : ' tok/s'}。</p>
      <div class="hero-actions">${useCases.map((item) => `<a class="button secondary" href="/hardware/${profile.slug}/${item.slug}/">${item.label}推荐</a>`).join('')}</div>
    </section>
    <section class="section"><div class="grid-3">
      <div class="metric-card"><div class="metric-number">${budget} GB</div><div class="metric-label">模型可用内存预算（估算）</div></div>
      <div class="metric-card"><div class="metric-number">${general.filter((item) => item.localVerdict === 'local_feasible').length}</div><div class="metric-label">前 8 名中适合本地运行</div></div>
      <div class="metric-card"><div class="metric-number">${measured.length}</div><div class="metric-label">本站已收录本机实测</div></div>
    </div></section>
    <section class="section compact"><div class="section-heading"><p class="eyebrow">不同任务，不同首选</p><h2>四个场景的第一推荐</h2><p>下面四组结果使用同一台设备，但按任务标签重新排序。</p></div>
      <div class="grid-4">${scenarioRows.map(({ useCase, best }) => `<a class="family-card" href="/hardware/${profile.slug}/${useCase.slug}/"><div><p class="eyebrow">${useCase.label}</p><h3>${esc(best.name)}</h3><p>${esc(useCase.focus)}。</p></div><div class="family-meta"><span class="family-pill">${best.estimatedLoadGb} GB</span><span class="family-pill">${best.estimatedTokensPerSec ?? '—'} tok/s 估算</span></div></a>`).join('')}</div>
    </section>
    <section class="section"><div class="section-heading"><p class="eyebrow">综合推荐</p><h2>${esc(profile.label)} 的本地模型候选</h2><p>优先列出可舒适运行的模型，再列出能够加载但可能偏慢的选择。</p></div>${recommendationTable(general)}</section>
    <section class="section compact"><div class="section-heading"><p class="eyebrow">真实跑分</p><h2>本机实测与模型估算分开显示</h2></div>
      ${measured.length ? measuredTable(measured) : '<div class="empty-state"><strong>这台设备暂无本站实测记录</strong>当前页面只展示估算值，不会用估算速度冒充实机跑分。</div>'}
    </section>
  </div>`;
  writeRoute(`/hardware/${profile.slug}/`, layout({
    title: `${profile.label} 本地大模型推荐与速度估算｜本地 AI 选型雷达`,
    description: `${profile.label} 本地运行 Qwen、DeepSeek、Llama、Gemma 等模型的内存适配、速度估算与场景推荐。`,
    route: `/hardware/${profile.slug}/`,
    body: hardwareBody
  }));

  for (const useCase of useCases) {
    const items = topFor(profile, useCase.value, 'Balanced', 10);
    const fastest = topFor(profile, useCase.value, 'Speed', 1)[0];
    const quality = topFor(profile, useCase.value, 'Quality', 1)[0];
    const feasibleCount = localRecommendations(profile, useCase.value).filter((item) => item.localVerdict === 'local_feasible').length;
    const scenarioBody = `<div class="shell">
      <section class="page-hero">${breadcrumb([{ label: '首页', href: '/' }, { label: profile.label, href: `/hardware/${profile.slug}/` }, { label: useCase.label }])}
        <p class="eyebrow">${esc(profile.label)} · ${useCase.label} · 模型估算</p><h1>${esc(profile.label)} 的${esc(useCase.title)}推荐</h1>
        <p class="lede">针对${esc(useCase.focus)}，平衡模式首选 ${esc(items[0].name)}。${feasibleCount} 个本地模型达到当前引擎的舒适运行门槛，前十名按内存适配、质量、速度和任务标签综合排序。</p>
        <div class="hero-actions"><a class="button" href="#list">查看完整候选</a><a class="button secondary" href="/hardware/${profile.slug}/">返回设备总览</a></div>
      </section>
      <section class="section"><div class="grid-3">
        <div class="metric-card"><p class="eyebrow">平衡首选</p><h3>${esc(items[0].name)}</h3><div class="metric-label">${items[0].estimatedTokensPerSec ?? '—'} tok/s 估算 · ${items[0].estimatedLoadGb} GB</div></div>
        <div class="metric-card"><p class="eyebrow">速度优先</p><h3>${esc(fastest.name)}</h3><div class="metric-label">${fastest.estimatedTokensPerSec ?? '—'} tok/s 估算 · ${fastest.estimatedLoadGb} GB</div></div>
        <div class="metric-card"><p class="eyebrow">质量优先</p><h3>${esc(quality.name)}</h3><div class="metric-label">质量评分 ${quality.qualityScore}/100 · ${quality.estimatedLoadGb} GB</div></div>
      </div></section>
      <section class="section compact" id="list"><div class="section-heading"><p class="eyebrow">候选清单</p><h2>按当前硬件重新计算的前十名</h2><p>所有速度和首字延迟都标为“模型估算”；命令只在数据源提供明确 Ollama 标识时显示。</p></div><div class="model-list">${items.map((item, index) => modelCard(item, index)).join('')}</div></section>
      <section class="section"><div class="surface"><div class="prose"><h2>如何使用这份结果</h2><p>先从平衡首选开始。如果响应太慢，切换到速度优先模型；如果输出质量不足且内存仍有余量，再尝试质量优先模型。${profile.deviceType === 'MacBook Air' ? 'MacBook Air 没有风扇，长时间生成时的持续速度可能低于短时估算。' : `${profile.deviceType} 的持续散热相对稳定，但后台应用仍会占用统一内存。`}</p><div class="callout"><p><strong>不要把参数量当成唯一标准。</strong> 同一参数量在不同量化、上下文长度和运行时下，实际内存与速度都会变化。购买硬件前，请对目标模型进行本机或同配置实测。</p></div></div></div></section>
    </div>`;
    writeRoute(`/hardware/${profile.slug}/${useCase.slug}/`, layout({
      title: `${profile.label} ${useCase.title}：推荐、内存与速度估算`,
      description: `${profile.label} 用于${useCase.focus}时的本地大模型推荐、预计内存占用、速度估算和 Ollama 命令。`,
      route: `/hardware/${profile.slug}/${useCase.slug}/`,
      body: scenarioBody
    }));
  }
}

for (const family of families) {
  const models = DATASET.filter((model) => model.family === family).sort((a, b) => a.cloud_only - b.cloud_only || a.sizeB - b.sizeB || a.name.localeCompare(b.name));
  const local = models.filter((model) => !model.cloud_only);
  const cloud = models.filter((model) => model.cloud_only);
  const deviceSnapshots = [
    profiles.find((item) => item.slug === 'mac-mini-m4-16gb'),
    profiles.find((item) => item.slug === 'mac-mini-m4-pro-24gb'),
    profiles.find((item) => item.slug === 'mac-studio-m3-ultra-96gb')
  ];
  const familyBody = `<div class="shell">
    <section class="page-hero">${breadcrumb([{ label: '首页', href: '/' }, { label: '模型库', href: '/models/' }, { label: family }])}
      <p class="eyebrow">模型家族 · ${local.length ? '含本地运行配置' : '当前仅云端条目'}</p><h1>${esc(family)} 本地运行与 Mac 适配</h1>
      <p class="lede">${esc(familySummary(family, models))}</p>
    </section>
    <section class="section"><div class="grid-3">
      <div class="metric-card"><div class="metric-number">${models.length}</div><div class="metric-label">数据集收录条目</div></div>
      <div class="metric-card"><div class="metric-number">${local.length}</div><div class="metric-label">本地运行配置</div></div>
      <div class="metric-card"><div class="metric-number">${cloud.length}</div><div class="metric-label">仅云端条目</div></div>
    </div></section>
    <section class="section compact"><div class="section-heading"><p class="eyebrow">三档 Mac</p><h2>这个家族在常见配置上的首选</h2><p>每一项都使用该设备重新计算；没有本地权重时不会给出伪造的兼容结论。</p></div>
      <div class="grid-3">${deviceSnapshots.map((profile) => {
        const pick = bestFamilyFor(profile, family);
        return `<a class="family-card" href="/hardware/${profile.slug}/"><div><h3>${esc(profile.label)}</h3><p>${pick ? `${esc(pick.name)} · ${verdictLabels[pick.localVerdict]}。预计占用 ${pick.estimatedLoadGb} GB。` : '当前数据没有可在本地运行的该家族模型。'}</p></div><div class="family-meta">${pick ? `<span class="family-pill">${pick.estimatedTokensPerSec ?? '—'} tok/s 估算</span><span class="family-pill">${pick.quantization}</span>` : '<span class="family-pill">云端条目</span>'}</div></a>`;
      }).join('')}</div>
    </section>
    <section class="section"><div class="section-heading"><p class="eyebrow">完整条目</p><h2>${esc(family)} 型号与来源</h2><p>表格保留量化、预计加载内存和原始来源。云端模型不参与本地速度估算。</p></div>
      <div class="table-wrap"><table><thead><tr><th>模型</th><th>运行方式</th><th>参数 / 量化</th><th>预计加载</th><th>适合任务</th><th>来源</th></tr></thead><tbody>
      ${models.map((model) => `<tr><td><strong>${esc(model.name)}</strong></td><td>${model.cloud_only ? '仅云端' : '本地权重'}</td><td>${model.sizeB}B · ${esc(model.quantization)}</td><td>${model.cloud_only ? '—' : `${model.estimatedLoadGb} GB`}</td><td>${esc(model.bestFor)}</td><td>${(model.sources || []).slice(0, 1).map((url) => `<a href="${esc(url)}" rel="noopener">上游资料</a>`).join('') || '未提供'}</td></tr>`).join('')}
      </tbody></table></div>
    </section>
    <section class="section compact"><div class="callout"><p><strong>许可与准确性：</strong>模型数据改编自 ModelFit 的 CC BY 4.0 数据集。条目用于选型参考，不代表模型发布方背书；下载和商用前仍需核对对应模型自己的许可。</p></div></section>
  </div>`;
  writeRoute(`/models/${familySlug(family)}/`, layout({
    title: `${family} 本地模型：Mac 兼容性、内存与型号对比`,
    description: `${family} 模型家族在 Mac mini、MacBook 和 Mac Studio 上的本地运行适配、预计内存与来源对比。`,
    route: `/models/${familySlug(family)}/`,
    body: familyBody
  }));
}

const methodBody = `<div class="shell"><section class="page-hero">${breadcrumb([{ label: '首页', href: '/' }, { label: '数据方法' }])}<p class="eyebrow">透明方法</p><h1>估算怎么来，边界在哪里</h1><p class="lede">本站把“模型估算”和“本机实测”分成两条数据通道。没有真实测试记录时，只显示估算。</p></section>
  <section class="section"><div class="prose">
    <h2>1. 内存适配</h2><p>模型预计加载量来自模型规格与量化信息。计算会为 macOS、上下文缓存和其他应用预留统一内存；可用预算随总内存从约 70% 逐步提高，但不会按全部内存计算。</p>
    <h2>2. 速度估算</h2><p>速度模型综合 Apple Silicon 的公开内存带宽、参考模型的吞吐、模型有效参数、量化字节量、内存压力和设备散热。它适合做初筛，不能替代同一运行时、同一上下文长度下的真实跑分。</p>
    <h2>3. 推荐排序</h2><p>排序会根据用途调整标签权重，并综合内存甜点区、质量、速度、普及度、量化损失和不适配惩罚。首页默认优先展示达到本地舒适运行门槛的模型。</p>
    <h2>4. 本机实测</h2><p>真实记录必须包含设备、芯片、内存、模型、运行时、上下文长度、生成速度和采集时间。实测记录始终带“本机实测”标签，不会与估算值混写。</p>
    <h2>5. 数据来源与更新</h2><p>推荐引擎改编自 ModelFit 的 MIT 开源代码，模型数据集采用 CC BY 4.0。每个模型页保留上游来源链接。数据更新时间应以重新构建时使用的快照为准，本站不声称覆盖所有新发布模型。</p>
  </div></section></div>`;
writeRoute('/about/data-method/', layout({ title: '数据方法｜本地 AI 选型雷达', description: '了解本地大模型内存适配、速度估算、推荐排序与真实跑分的分离方法。', route: '/about/data-method/', body: methodBody }));

const licenseBody = `<div class="shell"><section class="page-hero">${breadcrumb([{ label: '首页', href: '/' }, { label: '授权与署名' }])}<p class="eyebrow">开放数据 · 明确署名</p><h1>授权与署名</h1><p class="lede">本站的中文页面和交互为原创；底层开源代码与数据按各自许可使用并保留署名。</p></section>
  <section class="section"><div class="prose">
    <h2>推荐引擎</h2><p>推荐计算引擎改编自 <a href="https://modelfit.io/" rel="noopener">ModelFit</a> 的开源实现，采用 MIT License。完整文本随站点保存在 <a href="/licenses/ModelFit-MIT-and-dataset-notice.txt">许可文件</a> 中。</p>
    <h2>模型数据</h2><p>模型数据集源自 ModelFit，采用 <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener">CC BY 4.0</a>。署名：ModelFit — https://modelfit.io/。</p>
    <h2>模型自身许可</h2><p>数据集许可不替代模型权重本身的许可。下载、修改、分发或商用任一模型前，应打开页面中的上游资料并核对该模型的最新许可。</p>
    <h2>免责声明</h2><p>兼容性和性能数字是选型估算，不是性能承诺。实际结果可能因运行时版本、提示长度、上下文、并发、温度和系统负载而变化。</p>
  </div></section></div>`;
writeRoute('/about/license/', layout({ title: '授权与署名｜本地 AI 选型雷达', description: '本地 AI 选型雷达使用的 MIT 推荐引擎与 CC BY 4.0 模型数据集署名说明。', route: '/about/license/', body: licenseBody }));

writeAsset('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
writeAsset('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(routes)].sort().map((route) => `  <url><loc>${esc(`${ORIGIN}${route}`)}</loc></url>`).join('\n')}\n</urlset>\n`);
writeAsset('llms.txt', `# 本地 AI 选型雷达\n\n面向中文用户的 Apple Silicon 本地大模型选型站。\n\n## 数据边界\n- 兼容性、tokens/sec 和首字延迟默认是模型估算，不是本机实测。\n- 实测数据只有在页面明确标注“本机实测”时才属于真实采集。\n- 模型数据改编自 ModelFit，CC BY 4.0；推荐引擎改编自 MIT 开源代码。\n\n## 主要入口\n- ${ORIGIN}/ — 交互式硬件与模型选择器\n- ${ORIGIN}/about/data-method/ — 计算方法与限制\n- ${ORIGIN}/about/license/ — 授权与署名\n\n## 覆盖\n- ${profiles.length} 个常用 Mac 配置\n- ${DATASET.length} 个模型条目，其中 ${localCount} 个具有本地运行配置\n- ${families.length} 个模型家族\n`);

writeAsset('data/build-manifest.json', `${JSON.stringify({
  schemaVersion: 1,
  modelCount: DATASET.length,
  localModelCount: localCount,
  familyCount: families.length,
  hardwareProfileCount: profiles.length,
  measuredBenchmarkCount: measuredCount,
  upstreamUpdated: sourceMeta.upstreamUpdated,
  upstreamLicense: sourceMeta.license,
  routeCount: new Set(routes).size,
  origin: ORIGIN
}, null, 2)}\n`);

console.log(JSON.stringify({
  output: DIST,
  routes: new Set(routes).size,
  hardwareProfiles: profiles.length,
  useCasePages: profiles.length * useCases.length,
  families: families.length,
  models: DATASET.length,
  localModels: localCount,
  measuredBenchmarks: measuredCount
}, null, 2));
