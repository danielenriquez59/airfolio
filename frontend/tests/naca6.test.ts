// Run: node --test tests/naca6.test.ts
// Expected values from the PDAS naca456 sample outputs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compactNACA6Name, generateNACA4Name, generateNACA6Name, meanLine6, meanLine6M, naca6ThicknessPoints } from '../composables/useNACAGenerator.ts'
import type { NACA6Family } from '../utils/naca6Tables.ts'

const FAMILIES: NACA6Family[] = ['63', '64', '65', '66', '67', '63A', '64A', '65A']

// Cubic Lagrange through the 4 mapped points around x
function interp(xs: number[], ys: number[], x: number) {
  const j = Math.min(Math.max(xs.findIndex((v) => v >= x) - 2, 0), xs.length - 4)
  let sum = 0
  for (let i = j; i < j + 4; i++) {
    let w = 1
    for (let k = j; k < j + 4; k++) if (k !== i) w *= (x - xs[k]) / (xs[i] - xs[k])
    sum += w * ys[i]
  }
  return sum
}

test('meanLine6M matches 64A410 mean line (cl = 0.4)', () => {
  const rows = [[0.005, 0.001124, 0.190157], [0.1, 0.011921, 0.082474], [0.5, 0.026601, 0.00243], [0.8, 0.018694, -0.072138], [0.9, 0.009808, -0.098084], [1, 0, -0.098084]]
  for (const [x, y, dy] of rows) {
    const m = meanLine6M(0.4, x)
    assert.ok(Math.abs(m.y - y) < 2e-6 && Math.abs(m.dy - dy) < 2e-6, `x=${x}: ${m.y}, ${m.dy}`)
  }
})

test('meanLine6 a = 1 matches 16-212 mean line (cl = 0.2)', () => {
  const rows = [[0, 0, 0], [0.005, 0.000501, 0.084246], [0.25, 0.00895, 0.017485], [0.5, 0.011032, 0], [0.95, 0.003159, -0.046862], [1, 0, 0]]
  for (const [x, y, dy] of rows) {
    const m = meanLine6(1, 0.2, x)
    assert.ok(Math.abs(m.y - y) < 2e-6 && Math.abs(m.dy - dy) < 2e-6, `x=${x}: ${m.y}, ${m.dy}`)
  }
})

test('meanLine6 handles a = 0 and x = a', () => {
  for (const a of [0, 0.5]) {
    for (const x of [0.25, 0.5, 0.75]) {
      const { y, dy } = meanLine6(a, 0.4, x)
      assert.ok(Number.isFinite(y) && Number.isFinite(dy) && y > 0, `a=${a} x=${x}`)
    }
  }
})

const thicknessCases: Array<[string, NACA6Family, number, number[][]]> = [
  ['64-010', '64', 0.1, [[0.005, 0.008165], [0.025, 0.016991], [0.1, 0.032186], [0.4, 0.0498], [0.7, 0.028252], [0.95, 0.00247]]],
  ['63-021', '63', 0.21, [[0.005, 0.015829], [0.025, 0.035525], [0.1, 0.070744], [0.35, 0.104911], [0.7, 0.052835], [0.95, 0.003924]]],
  ['65A010', '65A', 0.1, [[0.005, 0.007753], [0.025, 0.016303], [0.1, 0.030429], [0.4, 0.049938], [0.7, 0.034298], [0.95, 0.006033]]],
]

for (const [name, family, t, rows] of thicknessCases) {
  test(`thickness matches ${name}`, () => {
    const { x, y } = naca6ThicknessPoints(family, t)
    for (const [xi, yi] of rows) {
      const got = interp(x, y, xi)
      assert.ok(Math.abs(got - yi) < 2e-4, `x=${xi}: ${got} vs ${yi}`)
    }
  })
}

test('every family maps to a valid section with the requested thickness', () => {
  for (const family of FAMILIES) {
    for (const t of [0.06, 0.12, 0.21]) {
      const { x, y } = naca6ThicknessPoints(family, t)
      assert.equal(x.length, 201)
      assert.ok(Math.abs(x[0]) < 1e-12 && Math.abs(x[200] - 1) < 1e-12, `${family} ${t} ends`)
      for (let k = 1; k <= 200; k++) assert.ok(x[k] > x[k - 1], `${family} ${t} x[${k}]`)
      assert.ok(y.every((v) => v >= -1e-12), `${family} ${t} y >= 0`)
      assert.ok(Math.abs(2 * Math.max(...y) - t) < 1e-3, `${family} ${t}: ${2 * Math.max(...y)}`)
    }
  }
})

test('generateNACA6Name adds the low-drag-range subscript', () => {
  const base = { family: '64' as NACA6Family, cl: 0.2, a: 1 }
  assert.equal(generateNACA6Name({ ...base, t: 0.12 }), 'NACA 64(1)-212')
  assert.equal(generateNACA6Name({ ...base, t: 0.12, a: 0.5 }), 'NACA 64(1)-212 a=0.5')
  assert.equal(generateNACA6Name({ ...base, family: '64A', t: 0.12 }), 'NACA 64(1)A212')
  assert.equal(generateNACA6Name({ ...base, t: 0.1 }), 'NACA 64-210')
  assert.equal(generateNACA6Name({ ...base, t: 0.21 }), 'NACA 64(4)-221')
})

test('compactNACA6Name runs the designation together for filenames', () => {
  const base = { family: '64' as NACA6Family, cl: 0.4, t: 0.12, a: 1 }
  assert.equal(compactNACA6Name({ ...base, a: 0.5 }), '641412a05')
  assert.equal(compactNACA6Name(base), '641412')
  assert.equal(compactNACA6Name({ ...base, cl: 0.2, t: 0.1 }), '64210')
  assert.equal(compactNACA6Name({ ...base, family: '64A', cl: 0.2 }), '641A212')
  assert.equal(compactNACA6Name({ ...base, t: 0.15, a: 0 }), '642415a0')
})

test('generateNACA4Name: zero camber is 00xx', () => {
  assert.equal(generateNACA4Name({ m: 0, p: 0.4, t: 0.12 }), 'NACA 0012')
  assert.equal(generateNACA4Name({ m: 0.02, p: 0.4, t: 0.12 }), 'NACA 2412')
})
