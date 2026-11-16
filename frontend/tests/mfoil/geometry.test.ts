import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { TE_info, newMfoil } from '../../utils/mfoil/geometry.ts'
import { setoper, solve, surfacesToCoords } from '../../utils/mfoil/index.ts'
import { assertClose, flat, loadFixture } from './helpers.ts'

const CASES = ['naca2412_a2', 'naca2412_a10', 'naca4412_blunt_a4', 'naca2412_a4_M03', 'naca2412_sharp_a4', 'naca2412_closed_a4']

for (const name of CASES) {
  describe(`geometry ${name}`, () => {
    const F = loadFixture(name)
    const g = F.geometry
    const M = newMfoil(flat(F.input.coords), F.case.npanel)

    it('stores the input points and chord', () => {
      assertClose(M.geom.xpoint, flat(g.xpoint), { rtol: 0, atol: 0, label: 'xpoint' })
      assertClose(M.geom.chord, g.chord, { rtol: 1e-15, label: 'chord' })
    })

    it('matches panel nodes, arclength and tangents', (t) => {
      assert.equal(M.foil.N, g.N)
      const e = [
        assertClose(M.foil.x, flat(g.foil_x), { atol: 1e-13, rtol: 0, label: 'foil.x' }),
        assertClose(M.foil.s, flat(g.foil_s), { atol: 1e-13, rtol: 0, label: 'foil.s' }),
        assertClose(M.foil.t, flat(g.foil_t), { atol: 1e-12, rtol: 0, label: 'foil.t' }),
      ]
      t.diagnostic(`worst abs err x/s/t: ${e.map(v => v.toExponential(2)).join(' ')}`)
    })

    it('matches TE info', () => {
      const [t, hTE, dtdx, tcp, tdp] = TE_info(M.foil.x)
      const te = g.te
      assertClose(t, te.t, { atol: 1e-12, label: 'te.t' })
      assertClose([hTE, dtdx, tcp, tdp], [te.hTE, te.dtdx, te.tcp, te.tdp], { atol: 1e-12, label: 'hTE dtdx tcp tdp' })
    })
  })
}

describe('trailing edge closed to roundoff', () => {
  it('solves like the exactly repeated TE point', () => {
    const F = loadFixture('naca2412_closed_a4')
    const X = flat(F.input.coords)
    const n = X.length / 2
    X[2 * n - 1] = -X[n] // upper TE z = -(lower TE z) = -1.7e-17: crossed by roundoff (used to fail 'Wrong wake direction')
    assert.ok(X[2 * n - 1] < X[n])
    const M = newMfoil(X, F.case.npanel)
    setoper(M, { alpha: F.case.alpha, Re: F.case.Re, Ma: F.case.Ma, ncrit: F.case.ncrit })
    solve(M)
    assert.ok(M.glob.conv)
    for (const k of ['cl', 'cd', 'cm'] as const)
      assertClose(M.post[k], F.final[k], { rtol: 1e-8, label: k })
  })
})

describe('surfacesToCoords', () => {
  it('joins database surfaces into one loop with the LE point once', () => {
    const X = surfacesToCoords([1, 0.5, 0], [0, 0.05, 0], [0, 0.5, 1], [0, -0.05, 0])
    assert.deepEqual(Array.from(X), [1, 0.5, 0, 0.5, 1, 0, 0.05, 0, -0.05, 0])
  })
})
