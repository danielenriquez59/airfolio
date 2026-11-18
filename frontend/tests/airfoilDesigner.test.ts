// Run: node --test tests/airfoilDesigner.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reactive } from 'vue'
import { MAX_SNAPSHOTS, addSnapshot, angleCount, blendCST, isUnsaved, parseSavedDesign, polarStats, runKey } from '../utils/airfoilDesigner.ts'

const params = { upperWeights: [0.2, 0.1, 0], lowerWeights: [-0.2, -0.1, 0], leWeight: 0.5, teThickness: 0.001, order: 2 }

test('addSnapshot: freezes a copy, reuses a freed colour, stops at the limit', () => {
  const live = structuredClone(params)
  let list = addSnapshot([], live)!
  live.upperWeights[0] = 9 // later edits must not reach the snapshot
  assert.equal(list[0].params.upperWeights[0], 0.2)
  assert.deepEqual([list[0].id, list[0].name, list[0].colorIndex], [1, 'Snapshot 1', 0])

  list = addSnapshot(addSnapshot(list, params)!, params)!
  list = list.filter(s => s.id !== 2) // free colour 1
  list = addSnapshot(list, params)!
  assert.deepEqual(list.map(s => [s.id, s.colorIndex]), [[1, 0], [3, 2], [4, 1]])

  while (list.length < MAX_SNAPSHOTS)
    list = addSnapshot(list, params)!
  assert.equal(addSnapshot(list, params), null)
})

test('addSnapshot: takes an optional name', () => {
  const list = addSnapshot(addSnapshot([], params, 'NACA0012 / NACA4412 50%')!, params)!
  assert.deepEqual(list.map(s => s.name), ['NACA0012 / NACA4412 50%', 'Snapshot 2'])
})

test('addSnapshot: copies a Vue reactive object (structuredClone throws on it)', () => {
  const live = reactive(structuredClone(params))
  assert.throws(() => structuredClone(live))
  const snap = addSnapshot([], live)![0].params
  live.upperWeights[0] = 9
  assert.deepEqual(snap, params)
  assert.doesNotThrow(() => structuredClone(snap)) // a plain object, not a proxy
})

test('isUnsaved: only when the design matches no snapshot', () => {
  const snapshots = addSnapshot([], params)!
  assert.equal(isUnsaved(params, []), true)
  assert.equal(isUnsaved(structuredClone(params), snapshots), false)
  assert.equal(isUnsaved({ ...params, leWeight: 0.6 }, snapshots), true)
})

test('angleCount: start to end inclusive', () => {
  const c = { reynolds: 100, mach: 0, alphaStart: -5, alphaEnd: 20, alphaStep: 0.5, nCrit: 9 }
  assert.equal(angleCount(c), 51)
  assert.equal(angleCount({ ...c, alphaStart: -10, alphaEnd: 10, alphaStep: 0.1 }), 201)
})

test('runKey: changes with the shape, the solver and the conditions', () => {
  const c = { reynolds: 100, mach: 0 }
  const base = runKey(params, 'neural', c)
  assert.equal(runKey(structuredClone(params), 'neural', { ...c }), base)
  assert.notEqual(runKey({ ...params, leWeight: 0.6 }, 'neural', c), base)
  assert.notEqual(runKey(params, 'mfoil', c), base)
  assert.notEqual(runKey(params, 'neural', { ...c, mach: 0.1 }), base)
})

test('parseSavedDesign: round trip, and bad data is refused or dropped', () => {
  const snapshots = addSnapshot([], params)!
  assert.deepEqual(parseSavedDesign(JSON.stringify({ params, snapshots })), { params, snapshots })
  assert.equal(parseSavedDesign(null), null)
  assert.equal(parseSavedDesign('not json'), null)
  assert.equal(parseSavedDesign(JSON.stringify({ params: { ...params, upperWeights: [1] }, snapshots: [] })), null)
  const mixed = [...snapshots, { id: 2, name: 'bad', colorIndex: 1, visible: true, params: { ...params, leWeight: null } }]
  assert.deepEqual(parseSavedDesign(JSON.stringify({ params, snapshots: mixed }))!.snapshots, snapshots)
})

test('parseSavedDesign: flow conditions kept when valid, dropped when not', () => {
  const conditions = { reynolds: 200, mach: 0.1, alphaStart: -4, alphaEnd: 12, alphaStep: 1, nCrit: 7 }
  assert.deepEqual(parseSavedDesign(JSON.stringify({ params, snapshots: [], conditions })), { params, snapshots: [], conditions })
  assert.deepEqual(parseSavedDesign(JSON.stringify({ params, snapshots: [] })), { params, snapshots: [] })
  assert.deepEqual(parseSavedDesign(JSON.stringify({ params, snapshots: [], conditions: { ...conditions, mach: '' } })), { params, snapshots: [] })
})

test('blendCST: t=0 is a, t=1 is b, t=0.5 the midpoint', () => {
  const b = { upperWeights: [0.4, 0.3, 0.2], lowerWeights: [0, 0.1, 0.2], leWeight: -0.5, teThickness: 0.003, order: 2 }
  assert.deepEqual(blendCST(params, b, 0), params)
  assert.deepEqual(blendCST(params, b, 1), b)
  const mid = blendCST(reactive(structuredClone(params)), b, 0.5)
  assert.doesNotThrow(() => structuredClone(mid)) // plain object even from a proxy
  const close = (x: number[], y: number[]) => x.forEach((v, i) => assert.ok(Math.abs(v - y[i]) < 1e-12))
  close(mid.upperWeights, [0.3, 0.2, 0.1])
  close(mid.lowerWeights, [-0.1, 0, 0.1])
  close([mid.leWeight, mid.teThickness], [0, 0.002])
  assert.equal(mid.order, 2)
})

test('polarStats: extremes with their angles', () => {
  const s = polarStats({ alpha: [0, 5, 10], CL: [0.2, 0.8, 1.2], CD: [0.01, 0.008, 0.03], CM: [0, 0, 0] })
  assert.deepEqual(s.clMax, { value: 1.2, alpha: 10 })
  assert.deepEqual(s.ldMax, { value: 100, alpha: 5 })
  assert.deepEqual(s.cdMin, { value: 0.008, alpha: 5 })
})
