// Run: node --test tests/mfoilRuns.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { needsRun, useMfoilRuns } from '../composables/useMfoilRuns.ts'

test('useMfoilRuns: refuses past the max and duplicates', () => {
  const { slots, add } = useMfoilRuns(3, async () => null)
  assert.ok(add('a') && add('b') && add('c'))
  assert.equal(add('d'), false)
  assert.equal(slots.value.length, 3)
  const r = useMfoilRuns(3, async () => null)
  r.add('a')
  assert.equal(r.add('a'), false)
})

test('useMfoilRuns: colours stay put after a remove and the freed index is reused', () => {
  const { slots, add, remove } = useMfoilRuns(3, async () => null)
  add('a'); add('b'); add('c')
  remove(slots.value[1].id)
  assert.deepEqual(slots.value.map(s => s.colorIndex), [0, 2])
  add('d')
  assert.deepEqual(slots.value.map(s => s.colorIndex), [0, 2, 1])
})

test('needsRun: skip a finished slot with the same key only', () => {
  assert.equal(needsRun('done', 'k1', 'k1'), false)
  assert.equal(needsRun('done', 'k1', 'k2'), true)
  assert.equal(needsRun('stopped', 'k1', 'k1'), true)
  assert.equal(needsRun('idle', null, 'k1'), true)
})
