import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function setup() {
  const rows = [['LASERDISC', 'DVD', 'Blu-Ray', 'à acheter'], ['Titanic', 'Inception', 'The Matrix', 'Interstellar']];
  const sheet = {
    getLastRow: () => rows.reduce((last, row, i) => row.some(v => v !== '') ? i + 1 : last, 0),
    getRange: (r, c, height = 1, width = 1) => ({
      getValues: () => Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => rows[r - 1 + y]?.[c - 1 + x] ?? '')),
      setValue(value) { rows[r - 1] ??= ['', '', '', '']; rows[r - 1][c - 1] = value; },
      clearContent() { for (let y = 0; y < height; y++) { rows[r - 1 + y] ??= ['', '', '', '']; for (let x = 0; x < width; x++) rows[r - 1 + y][c - 1 + x] = ''; } },
      setValues(values) { values.forEach((row, y) => { rows[r - 1 + y] ??= ['', '', '', '']; row.forEach((value, x) => { rows[r - 1 + y][c - 1 + x] = value; }); }); },
    }),
  };
  const context = vm.createContext({
    SpreadsheetApp: { openById: id => { assert.equal(id, 'test-spreadsheet'); return { getSheetByName: name => name === 'Films' ? sheet : null }; } },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: json => ({ setMimeType: () => JSON.parse(json) }) },
  });
  vm.runInContext(readFileSync(new URL('../Code.gs', import.meta.url), 'utf8'), context);
  context.SPREADSHEET_ID = 'test-spreadsheet';
  return { context, rows, call: params => context.doGet({ parameter: params }) };
}

test('example reads all four support columns while ignoring headers', () => {
  const { call } = setup();
  assert.deepEqual(call({ action: 'getAll' }).data, [
    { title: 'Titanic', support: 'LASERDISC' }, { title: 'Inception', support: 'DVD' },
    { title: 'The Matrix', support: 'Blu-Ray' }, { title: 'Interstellar', support: 'à acheter' },
  ]);
});

test('example adds, edits and deletes a film in its support column', () => {
  const { call } = setup();
  assert.equal(call({ action: 'add', title: 'Alien', support: 'DVD' }).status, 'success');
  assert.equal(call({ action: 'edit', oldTitle: 'Alien', newTitle: 'Aliens', support: 'DVD' }).status, 'success');
  assert.equal(call({ action: 'search', query: 'aliens' }).data[0].title, 'Aliens');
  assert.equal(call({ action: 'delete', title: 'Aliens', support: 'DVD' }).status, 'success');
  assert.equal(call({ action: 'search', query: 'aliens' }).data.length, 0);
  assert.equal(call({ action: 'getAll' }).data.length, 4);
});

test('example rejects unsupported formats and missing configuration', () => {
  const { call, context } = setup();
  assert.equal(call({ action: 'add', title: 'Alien', support: 'Unknown' }).status, 'error');
  context.SPREADSHEET_ID = 'REMPLACEZ_PAR_IDENTIFIANT_DU_CLASSEUR';
  assert.equal(call({ action: 'getAll' }).status, 'error');
});
