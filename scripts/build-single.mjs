// Inline the Vite build into one self-contained HTML file that runs from file://.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = readdirSync(join(dist, 'assets'));

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/assets\/([^"]+)"[^>]*>/g, (_, file) => {
  const css = readFileSync(join(dist, 'assets', file), 'utf8');
  return `<style>\n${css}\n</style>`;
});
html = html.replace(/<script type="module"[^>]*src="\.\/assets\/([^"]+)"[^>]*><\/script>/g, (_, file) => {
  const js = readFileSync(join(dist, 'assets', file), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">\n${js}\n</script>`;
});
html = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');

const leftover = assets.filter((f) => html.includes(`assets/${f}`));
if (leftover.length) throw new Error(`Not inlined: ${leftover.join(', ')}`);
const out = join(dist, 'lifesim-ultra.html');
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
