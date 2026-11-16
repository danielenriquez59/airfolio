// Run: node --test tests/airfoilFamilies.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AIRFOIL_FAMILIES, FAMILY_KEYS, familyDef, snapToStep } from '../utils/airfoilFamilies.ts'
import { generateNACA4 } from '../composables/useNACAGenerator.ts'

test('every family has a label, name, file stem and finite equal-length coordinates; all but CST have CSV rows', () => {
  assert.deepEqual(FAMILY_KEYS, ['4-digit', '5-digit', '16-series', '6-series', 'riblett', 'cst', 'parsec'])
  for (const f of FAMILY_KEYS) {
    const def = familyDef(f)
    const p = AIRFOIL_FAMILIES[f].defaults
    assert.ok(def.label && def.name(p) && def.fileBase(p), f)
    if (f !== 'cst')
      assert.ok(def.csvRows!(p).length > 0, f)
    const c = def.generate(p, 50)
    const n = c.upperX.length
    assert.ok(n > 2, f)
    for (const a of [c.upperX, c.upperY, c.lowerX, c.lowerY]) {
      assert.equal(a.length, n, f)
      assert.ok(a.every(Number.isFinite), f)
    }
  }
})

test('snapToStep clamps and snaps to min + k * step without float noise', () => {
  assert.equal(snapToStep(0.0123, 0, 0.095, 0.001), 0.012)
  assert.equal(snapToStep(0.31, 0, 1.5, 0.15), 0.3)
  assert.equal(snapToStep(0.4, 0, 1.5, 0.15), 0.45)
  assert.equal(snapToStep(7.4, 0, 9, 1), 7)
  assert.equal(snapToStep(0.17, 0.1, 0.25, 0.05), 0.15) // relative to min
  assert.equal(snapToStep(-0.0424, -0.2, 0.05, 0.001), -0.042)
  assert.equal(snapToStep(3, 0, 1.5, 0.15), 1.5)
  assert.equal(snapToStep(-1, 0.01, 0.4, 0.01), 0.01)
  // every slider position stays where it is: 5-digit cl in 0.15 steps
  for (let k = 0; k <= 10; k++)
    assert.equal(snapToStep(k * 0.15, 0, 1.5, 0.15), +(k * 0.15).toFixed(6))
})

test('generateNACA4 cambered and modified-cambered points match the previous loop implementation', () => {
  const pick = (p: Parameters<typeof generateNACA4>[0]) => {
    const c = generateNACA4(p, 100)
    return [10, 60].map(i => [c.upperX[i], c.upperY[i], c.lowerX[i], c.lowerY[i]])
  }
  assert.deepEqual(pick({ m: 0.02, p: 0.4, t: 0.12 }), [
    [0.022051466716221498, 0.028152268116615916, 0.02689201698862497, -0.023407636283454183],
    [0.655665126789387, 0.05730246896870921, 0.6533518675855604, -0.02449964398433436],
  ])
  assert.deepEqual(pick({ m: 0.04, p: 0.3, t: 0.15, modified: true, le: 3, xt: 0.4 }), [
    [0.019547736728104732, 0.026364671877458994, 0.029395746976741736, -0.013845401688870286],
    [0.6580423553176911, 0.09079674117371528, 0.6509746390572564, -0.03131531661504115],
  ])
})
