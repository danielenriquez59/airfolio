// Run: node --test tests/useSortedRows.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sortRows, useSortedRows } from '../composables/useSortedRows.ts'
import { toCSV } from '../composables/useAirfoilDownload.ts'

const rows = [{ v: 2 }, { v: null }, { v: 1 }, { v: Infinity }, { v: 3 }]
const get = (r: { v: number | null }) => r.v

test('sortRows: numbers asc/desc, N/A always last, no column keeps order', () => {
  assert.deepEqual(sortRows(rows, get, 'v', 'asc').map(r => r.v), [1, 2, 3, null, Infinity])
  assert.deepEqual(sortRows(rows, get, 'v', 'desc').map(r => r.v), [3, 2, 1, null, Infinity])
  assert.equal(sortRows(rows, get, null, 'asc'), rows)
})

test('useSortedRows: new column asc, then desc, then unsorted', () => {
  const { sortColumn, sortDirection, sortedData, handleSort } = useSortedRows(() => rows, get, null, 'asc')
  handleSort('v')
  assert.deepEqual([sortColumn.value, sortDirection.value], ['v', 'asc'])
  assert.equal(sortedData.value[0].v, 1)
  handleSort('v')
  assert.deepEqual([sortColumn.value, sortDirection.value], ['v', 'desc'])
  assert.equal(sortedData.value[0].v, 3)
  handleSort('v')
  assert.deepEqual([sortColumn.value, sortDirection.value], [null, 'asc'])
  assert.equal(sortedData.value, rows)
})

test('toCSV: quotes every cell, joins rows with \\n', () => {
  assert.equal(toCSV([['a', 'b'], [1, 'N/A']]), '"a","b"\n"1","N/A"')
})
