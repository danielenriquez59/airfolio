import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { residual_station, residual_transition, stagnation_state, thwaites_init } from '../../utils/mfoil/residuals.ts'
import type { Mfoil, Param } from '../../utils/mfoil/types.ts'
import { copyParam, newMfoilState, newParam } from '../../utils/mfoil/types.ts'
import { fdCheck } from './fd.ts'
import { assertClose, flat, loadFixture } from './helpers.ts'

type Vec = Float64Array
const fx = loadFixture('closures')
const toParam = (p: any): Param => Object.assign(newParam(), p)
const worst: Record<string, number> = {}

// minScale: residuals of converged states are roundoff-sized differences of O(1) log terms,
// so R is judged against 1e-14 absolute rather than against its own (tiny) size
function close(name: string, got: ArrayLike<number> | number, exp: any, minScale = 0) {
  const ev = flat(exp)
  const scale = Math.max(minScale, ...Array.from(ev, Math.abs))
  const err = assertClose(got, ev, { rtol: 1e-12, atol: 1e-14 * scale, label: name })
  worst[name] = Math.max(worst[name] ?? 0, err / scale)
}

// station-major [U1, U2] -> row-major [4, 2], and back
const rowMajor = (v: Vec) => Float64Array.of(v[0], v[4], v[1], v[5], v[2], v[6], v[3], v[7])
const stationMajor = (U: Vec) => Float64Array.of(U[0], U[2], U[4], U[6], U[1], U[3], U[5], U[7])
// [R_U | R_x] as one [m, 10] Jacobian over v = [U1, U2, x1, x2]
const hcat = (A: Vec, B: Vec, m: number) => Float64Array.from({ length: m * 10 }, (_, k) => (k % 10 < 8 ? A[Math.floor(k / 10) * 8 + k % 10] : B[Math.floor(k / 10) * 2 + k % 10 - 8]))

// M for residual_transition: its residuals use build_param(M, 0), i.e. M.param with the station flags cleared
function mfoilFor(c: any): Mfoil {
  const M = newMfoilState()
  M.param = { ...toParam(c.param), simi: false, turb: false, wake: false }
  return M
}

describe('residual_station', () => {
  for (const c of fx.residual_station) {
    it(`${c.case} ${c.label}`, () => {
      const p = toParam(c.param)
      const before = copyParam(p)
      const U = flat(c.U)
      const Uc = Float64Array.from(U)
      const [R, R_U, R_x] = residual_station(p, flat(c.x), U, flat(c.Aux))
      close('residual_station R', R, c.R, 1)
      close('residual_station R_U', R_U, c.R_U)
      close('residual_station R_x', R_x, c.R_x)
      assert.deepEqual(p, before)
      assert.deepEqual(U, Uc)

      // FD over [U1, U2, x1, x2]; a similarity station has U1 = U2 and x1 = x2, so ping both together
      const f = (v: Vec) => residual_station(toParam(c.param), v.subarray(8), rowMajor(v), flat(c.Aux))[0]
      const v0 = Float64Array.of(...stationMajor(U), ...flat(c.x))
      if (c.param.simi) {
        const g = (w: Vec) => f(Float64Array.of(...w.subarray(0, 4), ...w.subarray(0, 4), w[4], w[4]))
        const J = Float64Array.from({ length: 15 }, (_, k) => {
          const r = Math.floor(k / 5)
          const j = k % 5
          return j < 4 ? R_U[r * 8 + j] + R_U[r * 8 + 4 + j] : R_x[r * 2] + R_x[r * 2 + 1]
        })
        const r = fdCheck(g, Float64Array.of(...v0.subarray(0, 4), v0[8]), J, `simi ${c.case}`)
        worst['residual_station FD'] = Math.max(worst['residual_station FD'] ?? 0, r.err)
      }
      else {
        const r = fdCheck(f, v0, hcat(R_U, R_x, 3), `${c.case} ${c.label}`)
        worst['residual_station FD'] = Math.max(worst['residual_station FD'] ?? 0, r.err)
      }
    })
  }
})

describe('residual_transition', () => {
  for (const c of fx.residual_transition) {
    it(`${c.case} ${c.label}`, () => {
      const M = mfoilFor(c)
      const p = toParam(c.param)
      const before = copyParam(p)
      const [R, R_U, R_x] = residual_transition(M, p, flat(c.x), flat(c.U), flat(c.Aux))
      close('residual_transition R', R, c.R, 1)
      close('residual_transition R_U', R_U, c.R_U)
      close('residual_transition R_x', R_x, c.R_x)
      close('residual_transition xt', M.vsol.xt, c.xt)
      assert.deepEqual(p, before)

      // xt comes from an inner Newton stopped at |Rxt| < 1e-10; the analytic xt_U assumes an exact root, so
      // a step-independent mismatch remains (~3e-7 for naca2412_a4_M03, which stops at |Rxt| = 5e-11)
      const f = (v: Vec) => residual_transition(mfoilFor(c), toParam(c.param), v.subarray(8), rowMajor(v), flat(c.Aux))[0]
      const r = fdCheck(f, Float64Array.of(...stationMajor(flat(c.U)), ...flat(c.x)), hcat(R_U, R_x, 3), `${c.case} ${c.label}`)
      worst['residual_transition FD'] = Math.max(worst['residual_transition FD'] ?? 0, r.err)
    })
  }
})

describe('stagnation_state', () => {
  for (const c of fx.stagnation_state) {
    it(c.case, () => {
      const [Ust, Ust_U, Ust_x, xst] = stagnation_state(flat(c.U), flat(c.x))
      close('stagnation_state Ust', Ust, c.Ust)
      close('stagnation_state Ust_U', Ust_U, c.Ust_U)
      close('stagnation_state Ust_x', Ust_x, c.Ust_x)
      assert.equal(xst, c.xst)
      const f = (v: Vec) => stagnation_state(rowMajor(v), v.subarray(8))[0]
      const r = fdCheck(f, Float64Array.of(...stationMajor(flat(c.U)), ...flat(c.x)), hcat(Ust_U, Ust_x, 4), c.case)
      worst['stagnation_state FD'] = Math.max(worst['stagnation_state FD'] ?? 0, r.err)
    })
  }
  it('thwaites_init', () => {
    const [th, ds] = thwaites_init(2, 1e-6)
    assertClose(th, Math.sqrt(0.45e-6 / 12), { rtol: 1e-15 })
    assertClose(ds, 2.2 * th, { rtol: 1e-15 })
  })
  it('report', t => t.diagnostic(`residuals: worst abs error / max|expected|, and worst normalized FD error ${JSON.stringify(worst)}`))
})
