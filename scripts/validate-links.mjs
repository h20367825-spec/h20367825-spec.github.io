import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
if (!existsSync(DIST)) throw new Error('dist/ is missing. Run npm run build first.');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(DIST);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const errors = [];
const titles = new Map();

function localTarget(fromFile, value) {
  const clean = value.split('#')[0].split('?')[0];
  if (!clean) return null;
  if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(clean)) return null;
  const candidate = clean.startsWith('/') ? join(DIST, clean) : resolve(dirname(fromFile), clean);
  if (clean.endsWith('/')) return join(candidate, 'index.html');
  if (existsSync(candidate) && statSync(candidate).isDirectory()) return join(candidate, 'index.html');
  return candidate;
}

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const rel = file.slice(DIST.length + 1);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)"/i)?.[1];
  const h1Count = (html.match(/<h1[ >]/g) || []).length;
  if (!title) errors.push(`${rel}: missing <title>`);
  if (!description) errors.push(`${rel}: missing meta description`);
  if (h1Count !== 1) errors.push(`${rel}: expected one h1, found ${h1Count}`);
  if (title) {
    const duplicates = titles.get(title) || [];
    duplicates.push(rel);
    titles.set(title, duplicates);
  }

  const linkPattern = /\b(?:href|src)="([^"]+)"/g;
  for (const match of html.matchAll(linkPattern)) {
    const target = localTarget(file, match[1]);
    if (target && !existsSync(normalize(target))) errors.push(`${rel}: missing target ${match[1]}`);
  }
}

for (const [title, paths] of titles) {
  if (paths.length > 1) errors.push(`duplicate title "${title}": ${paths.join(', ')}`);
}

const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
const sitemapUrls = (sitemap.match(/<url>/g) || []).length;
if (sitemapUrls !== htmlFiles.length) {
  errors.push(`sitemap has ${sitemapUrls} URLs but build contains ${htmlFiles.length} HTML pages`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    htmlPages: htmlFiles.length,
    checkedFiles: files.length,
    sitemapUrls,
    uniqueTitles: titles.size
  }, null, 2));
}
