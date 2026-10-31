// Validates the tokens before they are built:
//   - every {reference} resolves, with no cycles
//   - every theme defines exactly the same token names
//   - key foreground/background pairs meet WCAG contrast in every theme
//
// Text needs 4.5:1 (7:1 in high-contrast). Non-text UI needs 3:1 (4.5:1 in high-contrast).
// Focus indicators need 3:1 everywhere (WCAG 2.4.11).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const load = (file) => JSON.parse(readFileSync(join(root, file), 'utf8'));

function flatten(node, path = [], out = {}) {
  if ('$value' in node) {
    out[path.join('.')] = node.$value;
    return out;
  }
  for (const [key, child] of Object.entries(node)) if (!key.startsWith('$')) flatten(child, [...path, key], out);
  return out;
}

const jsonIn = (dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.json')).sort();
const primitives = flatten(load('primitives.json'));
const components = Object.assign({}, ...jsonIn('components').map((f) => flatten(load(`components/${f}`))));
const themes = Object.fromEntries(jsonIn('themes').map((f) => [f.replace('.json', ''), flatten(load(`themes/${f}`))]));

const problems = [];
const problem = (message) => {
  problems.push(message);
};

function resolve(all, key, trail = []) {
  if (trail.includes(key)) return problem(`circular reference: ${[...trail, key].join(' -> ')}`);
  if (!(key in all)) return problem(`unresolved reference {${key}}${trail.length ? ` (from ${trail.at(-1)})` : ''}`);
  const value = all[key];
  const ref = typeof value === 'string' && value.match(/^\{(.+)\}$/);
  return ref ? resolve(all, ref[1], [...trail, key]) : value;
}

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const names = (tokens) => Object.keys(tokens).sort().join('\n');
const reference = Object.keys(themes)[0];
for (const [theme, tokens] of Object.entries(themes)) {
  if (names(tokens) !== names(themes[reference])) problem(`theme "${theme}" defines different token names than "${reference}"`);
}

const statuses = ['info', 'success', 'warning', 'error'];
for (const [theme, tokens] of Object.entries(themes)) {
  const all = { ...primitives, ...tokens, ...components };
  const value = (key) => resolve(all, key);
  const highContrast = theme === 'high-contrast';
  const text = highContrast ? 7 : 4.5;
  const ui = highContrast ? 4.5 : 3;

  const pairs = [
    ['on-surface on surface', 'color.on-surface', 'color.surface', text],
    ['toast.fg on toast.bg', 'toast.fg', 'toast.bg', text],
    ['border on surface', 'color.border', 'color.surface', ui],
    ['focus-ring on surface', 'color.focus-ring', 'color.surface', 3],
    ['toast.focus on toast.bg', 'toast.focus', 'toast.bg', 3],
    ...statuses.flatMap((s) => [
      [`status.${s} on surface`, `color.status.${s}`, 'color.surface', ui],
      [`toast.${s} on toast.bg`, `toast.${s}`, 'toast.bg', ui],
    ]),
  ];
  for (const [label, fg, bg, min] of pairs) {
    const [a, b] = [value(fg), value(bg)];
    if (!a || !b) continue; // already reported as unresolved
    const ratio = contrast(a, b);
    if (ratio < min) problem(`${theme}: ${label} is ${ratio.toFixed(2)}:1, needs ${min}:1 (${fg} ${a} on ${bg} ${b})`);
  }
  for (const key of [...Object.keys(tokens), ...Object.keys(components)]) value(key);
}

if (problems.length) {
  console.error(`Token check failed (${problems.length}):\n${[...new Set(problems)].map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`Token check passed: ${Object.keys(themes).length} themes (${Object.keys(themes).join(', ')}), references resolve, contrast OK`);
