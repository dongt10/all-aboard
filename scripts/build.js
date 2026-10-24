import { mkdir, rm, copyFile, cp } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyFile(new URL('index.html', root), new URL('index.html', dist));
for (const dir of ['src', 'assets']) await cp(new URL(dir, root), new URL(dir, dist), { recursive: true });
console.log('Built the static demo in dist/');
