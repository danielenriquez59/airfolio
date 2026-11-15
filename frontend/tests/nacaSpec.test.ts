// Run: node --test tests/nacaSpec.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalAirfoilName, formatNACASpec, mfoilRunKey, nacaParamText, nacaFileBase, nacaSpecAirfoil, parseNACASpec } from '../utils/nacaSpec.ts'

test('spec round trip for all three kinds', () => {
  for (const s of ['naca4:0.02,0.4,0.12', 'naca5:0.3,0.15,0.12', 'naca6:64,0.12,0.4,0.5', 'naca6:64A,0.1,0.4,1']) {
    const spec = parseNACASpec(s)
    assert.ok(spec, s)
    assert.equal(formatNACASpec(spec), s)
  }
})

test('rejects bad prefix, wrong count, NaN, unknown family, out of range', () => {
  for (const s of ['naca7:0.02,0.4,0.12', 'NACA4:0.02,0.4,0.12', 'naca2412', 'naca4:0.02,0.4', 'naca4:0.02,0.4,0.12,1', 'naca4:0.02,NaN,0.12', 'naca4:0.02,,0.12', 'naca5:0.3,0.15,Infinity', 'naca6:68,0.12,0.4,0.5', 'naca6:0.12,0.4,0.5', 'naca4:0.2,0.4,0.12', 'naca5:0.3,0.3,0.12', 'naca6:64,0.25,0.4,0.5'])
    assert.equal(parseNACASpec(s), null, s)
})

test('zero-camber 4-digit specs canonicalise p', () => {
  for (const s of ['naca4:0,0.4,0.12', 'naca4:0,0.3,0.12'])
    assert.equal(formatNACASpec(parseNACASpec(s)!), 'naca4:0,0.1,0.12')
})

test('formats away slider float noise', () => {
  assert.equal(formatNACASpec({ kind: 'naca5', params: { cl: 0.1 + 0.2, p: 0.15, t: 0.12, isReflex: false } }), 'naca5:0.3,0.15,0.12')
})

test('spec -> row: designation, file base and coordinates in row order', () => {
  const cases = [['naca4:0.02,0.4,0.12', 'NACA 2412', 'NACA_2412'], ['naca5:0.3,0.15,0.12', 'NACA 23012', 'NACA_23012'], ['naca6:64,0.12,0.4,0.5', 'NACA 64(1)-412 a=0.5', 'NACA_641412a05']]
  for (const [s, name, base] of cases) {
    const spec = parseNACASpec(s)!
    const row = nacaSpecAirfoil(spec)
    assert.equal(row.name, s)
    assert.equal(row.display_name, name)
    assert.equal(nacaFileBase(spec), base)
    const [ux, uy, lx, ly] = [row.upper_x_coordinates!, row.upper_y_coordinates!, row.lower_x_coordinates!, row.lower_y_coordinates!]
    assert.ok(ux.length > 0 && ux.length === uy.length && lx.length > 0 && lx.length === ly.length)
    // upper TE -> LE, lower LE -> TE, sharing the LE point
    assert.ok(ux[0] > 0.99 && lx[lx.length - 1] > 0.99 && ux[ux.length - 1] < 1e-9)
    assert.deepEqual([ux[ux.length - 1], uy[uy.length - 1]], [lx[0], ly[0]])
  }
})

test('mfoilRunKey: Smooth only changes the key of library airfoils', () => {
  const c = [1e6, 0, 9, [0, 1], 120]
  assert.equal(mfoilRunKey(c, true, 'naca4:0.02,0.4,0.12'), mfoilRunKey(c, false, 'naca4:0.02,0.4,0.12'))
  assert.notEqual(mfoilRunKey(c, true, 'naca2412'), mfoilRunKey(c, false, 'naca2412'))
})

test('shape-free parameters are canonicalised: 6A a, 5-digit p at cl 0', () => {
  for (const s of ['naca6:64A,0.12,0.2,0.5', 'naca6:64A,0.12,0.2,1'])
    assert.equal(canonicalAirfoilName(s), 'naca6:64A,0.12,0.2,1')
  for (const s of ['naca5:0,0.15,0.12', 'naca5:0,0.2,0.12'])
    assert.equal(canonicalAirfoilName(s), 'naca5:0,0.05,0.12')
  assert.equal(canonicalAirfoilName('naca4:0.020,0.4,0.12'), 'naca4:0.02,0.4,0.12')
  assert.equal(canonicalAirfoilName('naca4:bad'), 'naca4:bad')
  assert.equal(canonicalAirfoilName('naca2412'), 'naca2412')
})

test('5-digit at cl 0 is named and shaped like the symmetric 4-digit section', () => {
  const r5 = nacaSpecAirfoil(parseNACASpec('naca5:0,0.15,0.12')!)
  const r4 = nacaSpecAirfoil(parseNACASpec('naca4:0,0.4,0.12')!)
  assert.equal(r5.display_name, 'NACA 0012')
  assert.equal(r4.display_name, 'NACA 0012')
  assert.deepEqual([r5.upper_y_coordinates, r5.lower_y_coordinates], [r4.upper_y_coordinates, r4.lower_y_coordinates])
})

test('nacaParamText names the kind and values', () => {
  assert.equal(nacaParamText('naca5:0,0.15,0.12'), '5-digit · cl 0 · p 0.05 · t 0.12')
  assert.equal(nacaParamText('naca6:64,0.12,0.4,0.5'), '6-series · 64 · t 0.12 · cl 0.4 · a 0.5')
  assert.equal(nacaParamText('naca2412'), null)
})
