// Run: node --test tests/mfoilSummary.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { MfoilPoint } from '../utils/mfoil/index.ts'
import { summarizePolar } from '../composables/useMfoil.ts'

const pt = (alpha: number, cl: number, cd: number, converged = true) => ({ alpha, cl, cd, converged }) as MfoilPoint

test('summarizePolar: linear fit, zero-lift angle and extremes', () => {
  // CL = 0.1 (alpha + 2) inside the fit window; a stalled point and a failed point outside it
  const pts = [-4, -2, 0, 2, 4].map(a => pt(a, 0.1 * (a + 2), 0.01 + 0.001 * a * a))
  pts.push(pt(10, 1.3, 0.02), pt(12, 5, 0.001, false))
  const s = summarizePolar(pts)
  assert.ok(Math.abs(s.liftSlope! - 0.1) < 1e-12)
  assert.ok(Math.abs(s.alphaZeroLift! + 2) < 1e-12)
  assert.deepEqual(s.clMax, { value: 1.3, alpha: 10 }) // non-converged point ignored
  assert.deepEqual(s.cdMin, { value: 0.01, alpha: 0 })
  assert.equal(s.ldMax!.alpha, 10)
})

test('summarizePolar: not enough data gives nulls', () => {
  const s = summarizePolar([pt(0, 0.2, 0.01), pt(1, 0.3, 0.01)])
  assert.equal(s.liftSlope, null)
  assert.equal(s.alphaZeroLift, null)
  assert.equal(summarizePolar([]).clMax, null)
})
