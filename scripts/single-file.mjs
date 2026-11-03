// Inlines the built JS and CSS into one self-contained HTML file that opens by double-click (file://).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = join(dist, 'assets');
for (const f of readdirSync(assets)) {
  const code = readFileSync(join(assets, f), 'utf8');
  if (f.endsWith('.js')) {
    const re = new RegExp(`<script[^>]*src="[^"]*${f.replace('.', '\\.')}"[^>]*></script>`);
    // inline module scripts run fine from file://; escape any closing script tags in the bundle
    html = html.replace(re, () => `<script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script>`);
  } else if (f.endsWith('.css')) {
    const re = new RegExp(`<link[^>]*href="[^"]*${f.replace('.', '\\.')}"[^>]*>`);
    html = html.replace(re, () => `<style>${code}</style>`);
  }
}
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
writeFileSync('CXone-Training-Simulator.html', html);
console.log(`Wrote CXone-Training-Simulator.html (${(html.length / 1024).toFixed(0)} kB)`);
