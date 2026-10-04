import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function setup() {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const { outputText } = ts.transpileModule(readFileSync(new URL('../services/movieService.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  });
  const service = await import(`data:text/javascript;base64,${Buffer.from(outputText + `\n// ${Math.random()}`).toString('base64')}`);
  service.setScriptUrl('https://example.test/api');
  let calls = [];
  let movies = [{ title: 'Amélie', support: 'DVD' }, { title: 'The Matrix', support: 'Blu-Ray' }];
  globalThis.fetch = async url => {
    const params = new URL(url).searchParams;
    calls.push(params.get('action'));
    if (params.get('action') === 'add') movies.push({ title: params.get('title'), support: params.get('support') });
    if (params.get('action') === 'edit') movies = movies.map(m => m.title === params.get('oldTitle') ? { ...m, title: params.get('newTitle') } : m);
    if (params.get('action') === 'delete') movies = movies.filter(m => m.title !== params.get('title'));
    const data = params.get('action') === 'search' ? movies.filter(m => m.title.toLowerCase().includes(params.get('query').toLowerCase())) : movies;
    return { ok: true, json: async () => ({ status: 'success', data: data.map(m => ({ ...m })) }) };
  };
  return { ...service, calls };
}

test('repeated title searches reuse one collection request, including no matches', async () => {
  const { movieService, calls } = await setup();
  assert.deepEqual((await movieService.search('matrix')).data, [{ title: 'The Matrix', support: 'Blu-Ray' }]);
  assert.deepEqual((await movieService.search('missing')).data, []);
  await movieService.getAll();
  assert.deepEqual(calls, ['getAll']);
});

test('title search ignores accents and surrounding spaces', async () => {
  const { movieService } = await setup();
  assert.equal((await movieService.search('  amelie ')).data[0]?.title, 'Amélie');
});

test('simultaneous collection reads share the same request', async () => {
  const { movieService, calls } = await setup();
  await Promise.all([movieService.getAll(), movieService.search('matrix'), movieService.getAll()]);
  assert.deepEqual(calls, ['getAll']);
});

test('successful writes invalidate cached collection', async () => {
  const { movieService } = await setup();
  await movieService.getAll();
  await movieService.add('Alien', 'DVD');
  assert.equal((await movieService.search('alien')).data.length, 1);
  await movieService.edit('Alien', 'Aliens', 'DVD');
  assert.equal((await movieService.search('aliens')).data.length, 1);
  await movieService.delete('Aliens', 'DVD');
  assert.equal((await movieService.search('aliens')).data.length, 0);
});

test('force refresh and configuration changes bypass previous cache', async () => {
  const { movieService, setScriptUrl, calls } = await setup();
  await movieService.getAll();
  await movieService.getAll(true);
  setScriptUrl('https://other.test/api');
  await movieService.getAll();
  assert.deepEqual(calls, ['getAll', 'getAll', 'getAll']);
});

test('network errors are retried rather than cached as an empty collection', async () => {
  const { movieService } = await setup();
  const workingFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal((await movieService.getAll()).status, 'error');
  globalThis.fetch = workingFetch;
  assert.equal((await movieService.search('matrix')).data.length, 1);
});

test('expired cache reloads externally modified collection', async () => {
  const { movieService, calls } = await setup();
  const now = Date.now;
  try {
    await movieService.getAll();
    Date.now = () => now() + 6 * 60 * 1000;
    await movieService.getAll();
    assert.deepEqual(calls, ['getAll', 'getAll']);
  } finally {
    Date.now = now;
  }
});

test('an old in-flight response cannot restore a cache invalidated by a write', async () => {
  const { movieService } = await setup();
  const workingFetch = globalThis.fetch;
  let release;
  globalThis.fetch = () => new Promise(resolve => { release = resolve; });
  const oldRead = movieService.getAll();
  globalThis.fetch = workingFetch;
  await movieService.add('Alien', 'DVD');
  release({ ok: true, json: async () => ({ status: 'success', data: [] }) });
  await oldRead;
  assert.equal((await movieService.search('Alien')).data.length, 1);
});

test('200-film collection supports repeated searches without further network requests', async () => {
  const { movieService } = await setup();
  const movies = Array.from({ length: 200 }, (_, i) => ({ title: `Film ${i}`, support: 'DVD' }));
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return { ok: true, json: async () => ({ status: 'success', data: movies }) };
  };
  await movieService.getAll();
  const started = performance.now();
  for (let i = 0; i < 200; i++) {
    const response = await movieService.search(`Film ${i}`);
    assert.ok(response.data.some(m => m.title === `Film ${i}`));
  }
  console.log(`200 searches in a 200-film collection: ${(performance.now() - started).toFixed(1)} ms; ${requests} collection request`);
  assert.equal(requests, 1);
});
