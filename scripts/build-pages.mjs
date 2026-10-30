import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
await build({ configFile: fileURLToPath(new URL('vite.pages.config.ts', root)) });
const html = await readFile(new URL('github-pages/index.html', root), 'utf8');
await writeFile(new URL('index.html', root), html.replaceAll('="./assets/', '="./github-pages/assets/'));
await writeFile(new URL('.nojekyll', root), '');
console.log('GitHub Pages ready: publish the repository root with index.html and github-pages/.');
