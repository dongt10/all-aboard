import { mkdir, rm, copyFile, cp, readdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of await readdir(root)) if (file.endsWith('.html')) await copyFile(new URL(file, root), new URL(file, dist));
for (const dir of ['src', 'assets']) await cp(new URL(dir, root), new URL(dir, dist), { recursive: true });
console.log('Built the static demo in dist/');
