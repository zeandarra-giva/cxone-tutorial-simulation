// Inlines the built JS and CSS into one self-contained HTML file that opens by double-click (file://).
// The output is formatted for reading, and comments from bundled libraries are removed.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { transform } from 'esbuild';
import { format } from 'prettier';

const dist = 'dist';
const assets = join(dist, 'assets');
const files = readdirSync(assets);
const read = (ext) => readFileSync(join(assets, files.find((f) => f.endsWith(ext))), 'utf8');

const { code: stripped } = await transform(read('.js'), { legalComments: 'none', charset: 'utf8' });
const js = await format(stripped, { parser: 'babel' });
const formattedCss = await format(read('.css'), { parser: 'css' });

// The embedded fonts are long base64 text, so they go after the readable CSS.
const fontFaces = [];
const readableCss = formattedCss.replace(/^(?:\/\*[^\n]*\*\/\n)?@font-face \{[\s\S]*?^\}\n+/gm, (block) => {
  fontFaces.push(block.trimEnd());
  return '';
});
const css = `${readableCss.trimEnd()}\n\n/* Embedded Open Sans font files */\n${fontFaces.join('\n')}\n`;

// The JS and CSS stay at column 0 on purpose: indenting would change multi-line strings in the code.
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CXone Training Simulator</title>
    <style>
${css}    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
${js.replace(/<\/script/gi, '<\\/script')}    </script>
  </body>
</html>
`;
writeFileSync('CXone-Training-Simulator.html', html);
console.log(`Wrote CXone-Training-Simulator.html (${(html.length / 1024).toFixed(0)} kB)`);
