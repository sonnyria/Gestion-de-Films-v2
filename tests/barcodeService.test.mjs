import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function setup(body, status = 200) {
  const storage = new Map([['movieApp_barcodeProxyKey', 'test-key']]);
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const { outputText } = ts.transpileModule(readFileSync(new URL('../services/barcodeService.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  });
  const module = await import(`data:text/javascript;base64,${Buffer.from(outputText + `\n// ${Math.random()}`).toString('base64')}`);
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(url);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { ...module, requests, storage };
}

const inception = { code: 'OK', items: [{ upc: '883929106646', ean: '0883929106646', title: 'Inception (Blu-ray) [Blu-ray]', category: 'Media > DVDs & Videos' }] };

test('uses authenticated proxy with encoded target URL and resolves the film title', async () => {
  const { barcodeService, requests } = await setup(inception);
  assert.equal(await barcodeService.getProductTitle('883929106646'), 'Inception');
  const proxy = new URL(requests[0]);
  assert.equal(proxy.searchParams.get('key'), 'test-key');
  assert.equal(new URL(proxy.searchParams.get('url')).searchParams.get('upc'), '883929106646');
});

test('retains meaningful subtitles and parenthetical text', async () => {
  const { barcodeService } = await setup({ code: 'OK', items: [{ ean: '0883929106646', title: 'Blade Runner: The Final Cut (Director’s Version) [Blu-ray]', category: 'Media > DVDs & Videos' }] });
  assert.equal(await barcodeService.getProductTitle('883929106646'), 'Blade Runner: The Final Cut (Director’s Version)');
});

test('does not accept a product whose barcode differs from the scanned code', async () => {
  const { barcodeService } = await setup({ code: 'OK', items: [{ ean: '0031398140573', title: 'Amelie [Blu-ray]', category: 'Media > DVDs & Videos' }] });
  assert.equal(await barcodeService.getProductTitle('883929106646'), null);
});

test('does not interpret a non-film product as a film', async () => {
  const { barcodeService } = await setup({ code: 'OK', items: [{ upc: '883929106646', title: 'Chocolate', category: 'Food, Beverages & Tobacco' }] });
  assert.equal(await barcodeService.getProductTitle('883929106646'), null);
});

test('does not reinterpret an edition or collector word within a film title', async () => {
  const { barcodeService } = await setup({ code: 'OK', items: [{ upc: '883929106646', title: 'The Collector [DVD]', category: 'Media > DVDs & Videos' }] });
  assert.equal(await barcodeService.getProductTitle('883929106646'), 'The Collector');
});

test('missing configuration stops before making a misleading lookup', async () => {
  const { barcodeService, storage, requests } = await setup(inception);
  storage.clear();
  assert.equal((await barcodeService.lookup('883929106646')).status, 'unconfigured');
  assert.equal(requests.length, 0);
});

test('invalid scanned content is not sent to the provider', async () => {
  const { barcodeService, requests } = await setup(inception);
  assert.equal((await barcodeService.lookup('https://example.test/film')).status, 'invalid');
  assert.equal(requests.length, 0);
});

test('unknown barcode differs from an inaccessible Internet service', async () => {
  const { barcodeService } = await setup({ code: 'NOT_FOUND' }, 404);
  assert.equal((await barcodeService.lookup('883929106646')).status, 'not-found');
  globalThis.fetch = async () => { throw new Error('Failed to fetch'); };
  assert.equal((await barcodeService.lookup('883929106646')).status, 'unavailable');
});

test('rejected credentials and rate limits produce an actionable failure', async () => {
  for (const status of [403, 429]) {
    const { barcodeService } = await setup({}, status);
    const result = await barcodeService.lookup('883929106646');
    assert.equal(result.status, 'unavailable');
    assert.match(result.message, status === 403 ? /403/ : /limite/);
  }
});


test('403 reports provider restrictions without accusing a correctly entered key', async () => {
  const { barcodeService } = await setup({ error: { status: 403, message: 'This domain is not allowed' } }, 403);
  const result = await barcodeService.lookup('883929106646');
  assert.match(result.message, /This domain is not allowed/);
  assert.doesNotMatch(result.message, /Vérifiez votre clé/);
});

test('provider diagnostics redact credentials even when echoed in an error', async () => {
  const { barcodeService } = await setup({ error: { message: 'Blocked key=test-key URL https://corsproxy.io/?key=test-key' } }, 403);
  const result = await barcodeService.lookup('883929106646');
  assert.doesNotMatch(result.message, /test-key/);
});

test('HTML refusal is explained as an access block rather than a parsing or key failure', async () => {
  const { barcodeService } = await setup({});
  globalThis.fetch = async () => new Response('<html><body>Access denied by upstream</body></html>', { status: 403 });
  const result = await barcodeService.lookup('883929106646');
  assert.match(result.message, /Access denied by upstream/);
  assert.doesNotMatch(result.message, /Vérifiez votre clé/);
});

test('connection test isolates a working proxy from a blocked catalogue', async () => {
  const { barcodeService } = await setup({});
  globalThis.fetch = async url => {
    const target = new URL(url).searchParams.get('url');
    return target.includes('jsonplaceholder')
      ? new Response(JSON.stringify({ id: 1 }), { status: 200 })
      : new Response(JSON.stringify({ error: { message: 'Upstream access denied' } }), { status: 403 });
  };
  const result = await barcodeService.testConnection('test-key');
  assert.match(result, /CorsProxy : OK/);
  assert.match(result, /Upstream access denied/);
});
