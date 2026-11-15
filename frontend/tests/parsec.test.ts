// Run: node --test tests/parsec.test.ts
// Reference coefficients from dqsis/parsec-airfoils parseccoef.py (pcoef, xte = 1) on its sample parameters
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NACA_RANGES, type PARSECParams, generatePARSEC, parsecCoefficients, parsecZ, surfacesCross } from '../composables/useNACAGenerator.ts'

const close = (a: number[], b: number[], tol: number) =>
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < tol, `coef ${i}: ${v} vs ${b[i]}`))

test('PARSEC coefficients match parseccoef.py on the sample parameters', () => {
  // sample: suction TE angle -6 deg, pressure 0.05 deg, so alpha + beta/2 = 6 and alpha - beta/2 = -0.05
  const { upper, lower } = parsecCoefficients({
    rLE: 0.01, xUp: 0.35, zUp: 0.055, zxxUp: -0.35, xLo: 0.45, zLo: -0.006, zxxLo: -0.2,
    zTE: 0, dzTE: 0, alphaTE: 2.975, betaTE: 6.05,
  })
  close(upper, [0.1414213562373095, -0.15174881255780526, 0.04966215811442872, 0.010223707730635927, -0.16444118549420847, 0.1148827759696395], 1e-9)
  close(lower, [-0.1414213562373095, 0.8537486918527835, -1.9981632558727689, 1.9983976925190154, -0.711066268491835, -0.001495503769886145], 1e-9)
})

// the generator page's defaults
const DEFAULTS: PARSECParams = { rLE: 0.012, xUp: 0.31, zUp: 0.079, zxxUp: -0.55, xLo: 0.22, zLo: -0.042, zxxLo: 0.43, zTE: 0, dzTE: 0, alphaTE: 0, betaTE: 11 }

test('PARSEC defaults satisfy the six conditions on each surface and do not cross', () => {
  const p = DEFAULTS
  const { upper, lower } = parsecCoefficients(p)
  const dz = (a: number[], x: number) => a.reduce((s, an, i) => s + an * (i + 0.5) * x ** (i - 0.5), 0)
  const d2z = (a: number[], x: number) => a.reduce((s, an, i) => s + an * (i + 0.5) * (i - 0.5) * x ** (i - 1.5), 0)
  const deg = Math.PI / 180
  for (const [a, xc, zc, zxx, zte, ang, sign] of [
    [upper, p.xUp, p.zUp, p.zxxUp, p.zTE + p.dzTE / 2, p.alphaTE + p.betaTE / 2, 1],
    [lower, p.xLo, p.zLo, p.zxxLo, p.zTE - p.dzTE / 2, p.alphaTE - p.betaTE / 2, -1],
  ] as [number[], number, number, number, number, number, number][]) {
    assert.ok(Math.abs(a[0] - sign * Math.sqrt(2 * p.rLE)) < 1e-12)
    assert.ok(Math.abs(parsecZ(a, 1) - zte) < 1e-9)
    assert.ok(Math.abs(parsecZ(a, xc) - zc) < 1e-9)
    assert.ok(Math.abs(dz(a, 1) - Math.tan(-ang * deg)) < 1e-9)
    assert.ok(Math.abs(dz(a, xc)) < 1e-9)
    assert.ok(Math.abs(d2z(a, xc) - zxx) < 1e-9)
  }
  const c = generatePARSEC(p, 200)
  assert.equal(surfacesCross(c), false)
  const t = Math.max(...c.upperY.map((y, i) => y - c.lowerY[i]))
  assert.ok(t > 0.11 && t < 0.13, `thickness ${t}`)
  // one crest per surface: no wavy lower surface
  const turns = (Y: number[]) => Y.slice(2, -1).filter((y, i) => Math.sign(y - Y[i + 1]) !== Math.sign(Y[i + 3] - y)).length
  assert.equal(turns(c.upperY), 1)
  assert.equal(turns(c.lowerY), 1)
  for (const [k, v] of Object.entries(p)) {
    const [lo, hi] = NACA_RANGES.parsec[k as keyof PARSECParams]
    assert.ok(v >= lo && v <= hi, `${k} default outside its slider range`)
  }
})

test('surfacesCross flags an upper crest below the lower one', () => {
  assert.equal(surfacesCross(generatePARSEC({ ...DEFAULTS, zUp: 0.01, zLo: 0.03, zxxLo: -0.5 }, 100)), true)
})
