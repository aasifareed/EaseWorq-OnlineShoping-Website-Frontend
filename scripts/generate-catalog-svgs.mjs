import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsRoot = path.resolve(__dirname, '../src/assets/images');
const catDir = path.join(assetsRoot, 'categories');
const brandDir = path.join(assetsRoot, 'brands');
fs.mkdirSync(catDir, { recursive: true });
fs.mkdirSync(brandDir, { recursive: true });

const catalogPath = path.join(assetsRoot, 'catalog-source.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const palette = [
  ['#111827', '#F9FAFB'],
  ['#0F172A', '#F8FAFC'],
  ['#1E3A5F', '#E8F1FF'],
  ['#14532D', '#ECFDF3'],
  ['#7C2D12', '#FFF7ED'],
  ['#4C1D95', '#F5F3FF'],
  ['#0E7490', '#ECFEFF'],
  ['#9A3412', '#FFFBEB'],
  ['#1F2937', '#FFC400'],
  ['#312E81', '#EEF2FF'],
];

function slug(name) {
  let s = String(name || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!s) s = 'item';
  return s.slice(0, 80).replace(/-+$/g, '');
}

function esc(t) {
  return String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colors(name) {
  let h = 0;
  for (const ch of String(name)) h = ((h * 33) + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

function splitLabel(label) {
  const words = String(label).trim().split(/\s+/);
  if (words.length < 2) return [label, ''];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function brandSvg(label) {
  const [bg, fg] = colors(label);
  const safe = esc(label);
  const long = label.length > 18;
  const fontSize = label.length <= 6 ? 72 : label.length <= 10 ? 52 : label.length <= 16 ? 38 : 28;
  if (long) {
    const [l1, l2] = splitLabel(label);
    const fs = label.length <= 28 ? 34 : 26;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${safe}">
  <rect width="512" height="512" rx="40" fill="${bg}"/>
  <text x="256" y="240" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fs}" font-weight="800" fill="${fg}">${esc(l1)}</text>
  <text x="256" y="290" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fs}" font-weight="800" fill="${fg}">${esc(l2)}</text>
</svg>
`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${safe}">
  <rect width="512" height="512" rx="40" fill="${bg}"/>
  <text x="256" y="286" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800" fill="${fg}">${safe}</text>
</svg>
`;
}

function categorySvg(label) {
  const [bg, fg] = colors(label);
  const safe = esc(label);
  const fontSize = label.length <= 18 ? 42 : label.length <= 28 ? 32 : 26;
  const needsSplit = label.length > 22 || label.trim().split(/\s+/).length >= 3;
  if (needsSplit) {
    const [l1, l2] = splitLabel(label);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" role="img" aria-label="${safe}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#g)"/>
  <rect x="0" y="420" width="1280" height="300" fill="#000000" fill-opacity="0.45"/>
  <text x="64" y="560" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800" fill="${fg}">${esc(l1)}</text>
  <text x="64" y="620" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800" fill="${fg}">${esc(l2)}</text>
</svg>
`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" role="img" aria-label="${safe}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#g)"/>
  <rect x="0" y="460" width="1280" height="260" fill="#000000" fill-opacity="0.45"/>
  <text x="64" y="600" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800" fill="${fg}">${safe}</text>
</svg>
`;
}

const manifest = ['type,id,name,file'];
const usedCat = new Set();
const usedBrand = new Set();

for (const c of catalog.categories) {
  const name = (c.displayName || c.name || 'category').trim();
  let s = slug(name);
  if (usedCat.has(s)) s = `${s}-${slug(c.id).slice(0, 8)}`;
  usedCat.add(s);
  const file = `${s}.svg`;
  fs.writeFileSync(path.join(catDir, file), categorySvg(name), 'utf8');
  manifest.push(`category,${c.id},${name.replace(/,/g, ' ')},categories/${file}`);
}

for (const b of catalog.brands) {
  const name = (b.name || 'brand').trim();
  let s = slug(name);
  if (usedBrand.has(s)) s = `${s}-${slug(b.id).slice(0, 8)}`;
  usedBrand.add(s);
  const file = `${s}.svg`;
  fs.writeFileSync(path.join(brandDir, file), brandSvg(name), 'utf8');
  manifest.push(`brand,${b.id},${name.replace(/,/g, ' ')},brands/${file}`);
}

fs.writeFileSync(path.join(assetsRoot, 'catalog-images-manifest.csv'), manifest.join('\n') + '\n', 'utf8');
console.log(`categories=${usedCat.size} brands=${usedBrand.size}`);
console.log(`manifest=${path.join(assetsRoot, 'catalog-images-manifest.csv')}`);
