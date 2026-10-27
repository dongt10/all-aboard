import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serve } from '../server.js';

async function request(method, url) {
  const response = { writeHead(status, headers = {}) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } };
  await serve({ method, url }, response);
  return response;
}

test('HEAD returns file headers without reading its contents', async t => {
  const dir = await mkdtemp(fileURLToPath(new URL('./head-fixture-', import.meta.url)));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = `${dir}/asset.txt`;
  await writeFile(file, 'hello');
  const url = `/tests/${dir.split('/').pop()}/asset.txt`;
  const get = await request('GET', url);
  assert.equal(get.status, 200);
  assert.equal(get.body.toString(), 'hello');
  await chmod(file, 0o000);
  t.after(() => chmod(file, 0o600).catch(() => {}));
  const head = await request('HEAD', url);
  assert.equal(head.status, 200);
  assert.deepEqual(head.headers, get.headers);
  assert.equal(head.headers['Content-Length'], 5);
  assert.equal(head.body, undefined);
  // An unreadable file makes an accidental read observable on non-root systems.
  if (typeof process.getuid === 'function' && process.getuid() !== 0) {
    assert.equal((await request('GET', url)).status, 404);
  }
  assert.equal((await request('HEAD', '/tests/no-such-file')).status, 404);
});
