// Run: node --test tests/nacaFamilies.test.ts
// Expected values from the PDAS naca456 sample outputs (0010-64, 16-212, 16-015, 23112, 23012)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateNACA16,
  generateNACA16Name,
  generateNACA4,
  generateNACA4Name,
  generateNACA5Name,
  meanLine5,
  meanLine6,
  sectionPoints,
  thickness4M,
} from '../composables/useNACAGenerator.ts'

const X = [0, 0.005, 0.0075, 0.0125, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1]
const TOL = 2e-6 // outputs carry 6 decimals

const maxErr = (got: number[], want: number[]) => Math.max(...got.map((v, i) => Math.abs(v - want[i])))

test('modified 4-digit thickness matches 0010-64, 16-212 and 16-015', () => {
  const cases: [string, number, number, number, number[]][] = [
    ['0010-64', 0.1, 6, 0.4, [0, 0.00988, 0.011932, 0.015062, 0.020428, 0.027205, 0.031808, 0.035315, 0.040471, 0.044115, 0.046742, 0.048556, 0.049637, 0.05, 0.049634, 0.048547, 0.046751, 0.044261, 0.041091, 0.037254, 0.032764, 0.027634, 0.021879, 0.015513, 0.008548, 0.001]],
    ['16-212', 0.12, 4, 0.5, [0, 0.008256, 0.010073, 0.012924, 0.018067, 0.02512, 0.030342, 0.0346, 0.041389, 0.046671, 0.050877, 0.054203, 0.056746, 0.058551, 0.059636, 0.06, 0.059611, 0.058357, 0.056103, 0.052718, 0.048069, 0.042022, 0.034444, 0.025203, 0.014166, 0.0012]],
    ['16-015', 0.15, 4, 0.5, [0, 0.010321, 0.012591, 0.016155, 0.022584, 0.0314, 0.037927, 0.04325, 0.051736, 0.058339, 0.063597, 0.067754, 0.070932, 0.073189, 0.074545, 0.075, 0.074514, 0.072946, 0.070129, 0.065898, 0.060086, 0.052527, 0.043055, 0.031504, 0.017708, 0.0015]],
  ]
  for (const [name, t, le, xt, want] of cases) {
    const err = maxErr(X.map(x => thickness4M(t, le, xt, x)), want)
    assert.ok(err < TOL, `${name}: ${err}`)
  }
})

test('reflex mean line matches 23112', () => {
  const want = [[0, 0.336391], [0.001639, 0.319453], [0.002428, 0.311132], [0.003942, 0.294786], [0.00738, 0.255649], [0.012865, 0.184778], [0.016701, 0.123778], [0.019136, 0.072648], [0.020788, 0], [0.019794, -0.033165], [0.018035, -0.035389], [0.016272, -0.035079], [0.014532, -0.034502], [0.012827, -0.033658], [0.01117, -0.032546], [0.009576, -0.031168], [0.008058, -0.029522], [0.006629, -0.027608], [0.005302, -0.025428], [0.00409, -0.022981], [0.003008, -0.020266], [0.002068, -0.017284], [0.001284, -0.014035], [0.000669, -0.010519], [0.000237, -0.006735], [0, -0.002685]]
  const m = X.map(x => meanLine5({ cl: 0.3, p: 0.15, t: 0.12, isReflex: true }, x))
  const ey = maxErr(m.map(v => v.y), want.map(w => w[0]))
  const edy = maxErr(m.map(v => v.dy), want.map(w => w[1]))
  assert.ok(ey < TOL && edy < TOL, `y ${ey}, dy ${edy}`)
})

test('non-reflex mean line vs 23012: within 1.2e-5 (y) and 2e-4 (dy)', () => {
  // Not an exact match: the 2002 sample's camber is ~0.06% larger than the k1, r table here and in current naca456 give
  // (its slope at x = p is -0.000093, not 0), so this guards against regressions rather than proving exactness
  const want = [[0, 0.305276], [0.001486, 0.289309], [0.0022, 0.281475], [0.003569, 0.266107], [0.006663, 0.229432], [0.011555, 0.163569], [0.014925, 0.107684], [0.017022, 0.061779], [0.018398, -0.000093], [0.017678, -0.022048], [0.016573, -0.022098], [0.015468, -0.022098], [0.014364, -0.022098], [0.013259, -0.022098], [0.012154, -0.022098], [0.011049, -0.022098], [0.009944, -0.022098], [0.008839, -0.022098], [0.007734, -0.022098], [0.006629, -0.022098], [0.005524, -0.022098], [0.00442, -0.022098], [0.003315, -0.022098], [0.00221, -0.022098], [0.001105, -0.022098], [0, -0.022098]]
  const m = X.map(x => meanLine5({ cl: 0.3, p: 0.15, t: 0.12, isReflex: false }, x))
  const ey = maxErr(m.map(v => v.y), want.map(w => w[0]))
  const edy = maxErr(m.map(v => v.dy), want.map(w => w[1]))
  assert.ok(ey < 1.2e-5 && edy < 2e-4, `y ${ey}, dy ${edy}`)
})

test('16-212 combined surface matches the sample', () => {
  // [x, xupper, yupper, xlower, ylower]
  const rows = [[0.005, 0.004307, 0.008728, 0.005693, -0.007726], [0.05, 0.048824, 0.028252, 0.051176, -0.021933], [0.2, 0.198971, 0.054624, 0.201029, -0.038696], [0.5, 0.5, 0.071032, 0.5, -0.048968], [0.8, 0.800927, 0.049976, 0.799073, -0.034047], [1, 1, 0.0012, 1, -0.0012]]
  const c = sectionPoints(rows.map(r => r[0]), x => thickness4M(0.12, 4, 0.5, x), x => meanLine6(1, 0.2, x))
  rows.forEach(([x, xu, yu, xl, yl], i) => {
    const err = Math.max(Math.abs(c.upperX[i] - xu), Math.abs(c.upperY[i] - yu), Math.abs(c.lowerX[i] - xl), Math.abs(c.lowerY[i] - yl))
    assert.ok(err < TOL, `x=${x}: ${err}`)
  })
  // the generator ends on the same trailing edge
  const g = generateNACA16({ t: 0.12, cl: 0.2 })
  assert.ok(Math.abs(g.upperY.at(-1)! - 0.0012) < TOL && Math.abs(g.lowerY.at(-1)! + 0.0012) < TOL)
  const m = generateNACA4({ m: 0, p: 0.4, t: 0.1, modified: true, le: 6, xt: 0.4 })
  assert.ok(Math.abs(m.upperY.at(-1)! - 0.001) < TOL) // 0010-64 trailing edge
})

test('names of the new families', () => {
  assert.equal(generateNACA4Name({ m: 0, p: 0.4, t: 0.12, modified: true, le: 6, xt: 0.4 }), 'NACA 0012-64')
  assert.equal(generateNACA4Name({ m: 0.02, p: 0.4, t: 0.12, modified: true, le: 3, xt: 0.4 }), 'NACA 2412-34')
  assert.equal(generateNACA5Name({ cl: 0.3, p: 0.15, t: 0.12, isReflex: true }), 'NACA 23112')
  assert.equal(generateNACA5Name({ cl: 0, p: 0.15, t: 0.12, isReflex: true }), 'NACA 0012')
  assert.equal(generateNACA16Name({ t: 0.12, cl: 0.2 }), 'NACA 16-212')
  assert.equal(generateNACA16Name({ t: 0.09, cl: 0 }), 'NACA 16-009')
})

test('modified thickness over le 0..9 and xt 0.2..0.6 (t = 0.12): finite, non-negative, max t/2 at xt', () => {
  const xs = Array.from({ length: 2001 }, (_, i) => i / 2000)
  const failed: string[] = []
  for (let le = 0; le <= 9; le++) {
    for (const xt of [0.2, 0.3, 0.4, 0.5, 0.6]) {
      const y = xs.map(x => thickness4M(0.12, le, xt, x))
      const max = Math.max(...y)
      const at = xs[y.indexOf(max)]
      if (y.some(v => !Number.isFinite(v) || v < 0) || Math.abs(max - 0.06) > 1e-3 || Math.abs(at - xt) > 0.05)
        failed.push(`le ${le} xt ${xt}: max ${max} at ${at}`)
    }
  }
  assert.deepEqual(failed, [])
})
