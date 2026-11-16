// Run: node --test tests/aircraftAdmin.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aircraftKey, ilikeAny, sortAssignments, sourceLinks } from '../utils/aircraftAdmin.ts'

test('aircraftKey: strips accents, case and anything not a letter or digit', () => {
  assert.equal(aircraftKey('Göppingen Gö 3 Minimoa'), 'goppingengo3minimoa')
  assert.equal(aircraftKey('Cessna 172-SP (Skyhawk)'), 'cessna172spskyhawk')
  assert.equal(aircraftKey('Ｆ－１６'), 'f16') // NFKD folds full-width forms
  assert.equal(aircraftKey('  '), '')
})

test('ilikeAny: quotes the value so commas and brackets do not break the filter', () => {
  assert.equal(ilikeAny(['name', 'display_name'], 'a,b'), 'name.ilike."%a,b%",display_name.ilike."%a,b%"')
  assert.equal(ilikeAny(['name'], 'say "hi" \\'), 'name.ilike."%say \\"hi\\" \\\\%"')
})

test('sortAssignments: known surfaces in order, unknown after, then position order', () => {
  const rows = [
    { surface: 'tail', position: 'all' },
    { surface: 'zzz', position: 'all' },
    { surface: 'wing', position: 'tip' },
    { surface: 'aaa', position: 'all' },
    { surface: 'wing', position: 'root' },
    { surface: 'wing', position: 'unspecified' },
    { surface: 'wing', position: 'mid' },
  ]
  assert.deepEqual(sortAssignments(rows).map(r => `${r.surface}/${r.position}`),
    ['wing/root', 'wing/mid', 'wing/tip', 'wing/unspecified', 'tail/all', 'aaa/all', 'zzz/all'])
  assert.equal(rows[0].surface, 'tail') // input untouched
})

test('sourceLinks: labels known sources and keeps only http(s) links', () => {
  assert.deepEqual(sourceLinks([
    { name: 'lednicer', url: 'https://l' },
    { name: 'other', url: 'http://o' },
    { name: 'x', url: 'javascript:alert(1)' },
    { name: 'y' },
  ]), [{ label: 'Lednicer', url: 'https://l' }, { label: 'other', url: 'http://o' }])
  assert.deepEqual(sourceLinks(null), [])
})
