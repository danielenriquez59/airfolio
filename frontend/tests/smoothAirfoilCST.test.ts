// Run: node --test tests/smoothAirfoilCST.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { smoothAirfoilCST } from '../composables/useCSTParameters.ts'

// NACA 4-digit in database ordering (upper TE→LE, lower LE→TE); a4 = -0.1036 closes the TE, -0.1015 leaves it blunt
function naca4(m: number, p: number, t: number, n: number, a4: number) {
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const x = (1 - Math.cos((i / n) * Math.PI)) / 2
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 + a4 * x ** 4)
    const yc = m === 0 ? 0 : x < p ? m / p ** 2 * (2 * p * x - x * x) : m / (1 - p) ** 2 * (1 - 2 * p + 2 * p * x - x * x)
    const th = m === 0 ? 0 : Math.atan(2 * m / (x < p ? p ** 2 : (1 - p) ** 2) * (p - x))
    return { xu: x - yt * Math.sin(th), yu: yc + yt * Math.cos(th), xl: x + yt * Math.sin(th), yl: yc - yt * Math.cos(th) }
  })
  return {
    upperX: pts.map(q => q.xu).reverse(),
    upperY: pts.map(q => q.yu).reverse(),
    lowerX: pts.map(q => q.xl),
    lowerY: pts.map(q => q.yl),
  }
}

// Linear interpolation of a surface (x ascending after sort) at x
function interp(xs: number[], ys: number[], x: number) {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b])
  for (let k = 1; k < idx.length; k++) {
    const [i, j] = [idx[k - 1], idx[k]]
    if (x <= xs[j])
      return ys[i] + (ys[j] - ys[i]) * (x - xs[i]) / (xs[j] - xs[i] || 1)
  }
  return ys[idx[idx.length - 1]]
}

// RMS distance in y between the smoothed airfoil and reference y at the given input x stations
// (xFrom skips the nose, where linear interpolation of the output polyline is itself inaccurate)
function rmsVs(s: ReturnType<typeof smoothAirfoilCST>, ref: ReturnType<typeof naca4>, xFrom = -Infinity) {
  const d = [
    ...ref.upperX.map((x, i) => interp(s.upperX, s.upperY, x) - ref.upperY[i]).filter((_, i) => ref.upperX[i] >= xFrom),
    ...ref.lowerX.map((x, i) => interp(s.lowerX, s.lowerY, x) - ref.lowerY[i]).filter((_, i) => ref.lowerX[i] >= xFrom),
  ]
  return Math.sqrt(d.reduce((a, v) => a + v * v, 0) / d.length)
}

const close = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) < tol, `${what} ${a} vs ${b}`)

test('smoothAirfoilCST: 200 panels, database ordering, picks the lowest-error order', () => {
  const s = smoothAirfoilCST(...Object.values(naca4(0.02, 0.4, 0.12, 80, -0.1036)) as [number[], number[], number[], number[]])
  for (const a of [s.upperX, s.upperY, s.lowerX, s.lowerY]) assert.equal(a.length, 101)
  close(s.upperX[0], 1, 1e-6) // upper starts at TE
  close(s.upperX[100], 0, 1e-3) // and ends at the (refined) LE
  close(s.lowerX[100], 1, 1e-6)
  assert.equal(s.upperX[100], s.lowerX[0]) // shared LE point
  assert.equal(s.upperY[100], s.lowerY[0])
  assert.equal(s.rms.length, 3)
  assert.equal(s.weights, 6 + s.rms.indexOf(Math.min(...s.rms)))
})

// RMS at the input points is ~3e-5 for 0012 and ~5e-5 for 4415 (max point error ~1.2e-4 for both)
test('smoothAirfoilCST: reproduces smooth symmetric and cambered NACA sections', () => {
  for (const a of [naca4(0, 0, 0.12, 80, -0.1036), naca4(0.04, 0.4, 0.15, 80, -0.1015)]) {
    const s = smoothAirfoilCST(a.upperX, a.upperY, a.lowerX, a.lowerY)
    assert.ok(Math.min(...s.rms) < 1e-4, `rms ${s.rms}`)
    assert.ok(rmsVs(s, a, 0.01) < 1e-4, `polyline rms ${rmsVs(s, a, 0.01)}`)
  }
})

test('smoothAirfoilCST: reduces digitising noise', () => {
  const clean = naca4(0, 0, 0.12, 80, -0.1036)
  let seed = 1
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2e-3 // ±0.001
  const noisy = { ...clean, upperY: clean.upperY.map(y => y + rand()), lowerY: clean.lowerY.map(y => y + rand()) }
  const s = smoothAirfoilCST(noisy.upperX, noisy.upperY, noisy.lowerX, noisy.lowerY)
  const noise = rmsVs({ ...clean, weights: 0, rms: [] }, noisy) // RMS of the added noise
  assert.ok(rmsVs(s, clean) < 0.5 * noise, `${rmsVs(s, clean)} vs ${noise}`)
})

test('smoothAirfoilCST: keeps a blunt trailing edge', () => {
  const a = naca4(0, 0, 0.12, 80, -0.1015)
  const s = smoothAirfoilCST(a.upperX, a.upperY, a.lowerX, a.lowerY)
  const te = a.upperY[0] - a.lowerY[80]
  assert.ok(te > 0.002)
  close(s.upperY[0] - s.lowerY[100], te, 1e-4, 'TE gap')
})

test('smoothAirfoilCST: output sits where a shifted, scaled and rotated input sits', () => {
  const a = naca4(0.04, 0.4, 0.15, 80, -0.1015)
  const [c, s5] = [2 * Math.cos(0.09), 2 * Math.sin(0.09)] // scale 2, rotate ~5 deg, then shift (3, -1)
  const mx = (x: number[], y: number[]) => x.map((v, i) => 3 + c * v - s5 * y[i])
  const my = (x: number[], y: number[]) => x.map((v, i) => -1 + s5 * v + c * y[i])
  const ref = smoothAirfoilCST(a.upperX, a.upperY, a.lowerX, a.lowerY)
  const out = smoothAirfoilCST(mx(a.upperX, a.upperY), my(a.upperX, a.upperY), mx(a.lowerX, a.lowerY), my(a.lowerX, a.lowerY))
  assert.equal(out.weights, ref.weights)
  const ex = [...mx(ref.upperX, ref.upperY), ...mx(ref.lowerX, ref.lowerY)]
  const ey = [...my(ref.upperX, ref.upperY), ...my(ref.lowerX, ref.lowerY)]
  ;[...out.upperX, ...out.lowerX].forEach((x, i) => close(x, ex[i], 1e-9, `x[${i}]`))
  ;[...out.upperY, ...out.lowerY].forEach((y, i) => close(y, ey[i], 1e-9, `y[${i}]`))
  // TE midpoint stays put, up to the input TE's skew from the chord normal (the CST TE is square to the chord)
  close((out.upperX[0] + out.lowerX[100]) / 2, 3 + c, 1e-3, 'TE x')
  close((out.upperY[0] + out.lowerY[100]) / 2, -1 + s5, 1e-3, 'TE y')
})
