import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { newMfoil } from '../../utils/mfoil/geometry.ts'
import { luSolve } from '../../utils/mfoil/linalg.ts'
import { build_wake, calc_force, calc_ue_m, identify_surfaces, init_thermo, set_wake_gap, solve_inviscid, stagpoint_find } from '../../utils/mfoil/inviscid.ts'
import { assertClose, flat, loadFixture } from './helpers.ts'

const CASES = ['naca2412_a2', 'naca2412_a10', 'naca4412_blunt_a4', 'naca2412_a4_M03', 'naca2412_sharp_a4', 'naca2412_closed_a4']
const worst: Record<string, number> = {}
function check(label: string, a: number | ArrayLike<number>, e: number | ArrayLike<number>, tol: number, atol = tol) {
  const err = assertClose(a, e, { atol, rtol: tol, label })
  worst[label] = Math.max(worst[label] ?? 0, err)
}

// same call sequence as the fixture exporter (mf.solve_viscous up to calc_ue_m)
function setup(F: any) {
  const t0 = performance.now()
  const M = newMfoil(flat(F.input.coords), F.case.npanel)
  M.param.ncrit = F.case.ncrit
  Object.assign(M.oper, { alpha: F.case.alpha, Re: F.case.Re, Ma: F.case.Ma, viscous: true })
  solve_inviscid(M)
  const inv = { gamref: M.isol.gamref, gam: M.isol.gam, cl: M.post.cl, cm: M.post.cm, cdpi: M.post.cdpi, cp: M.post.cp, cpi: M.post.cpi }
  M.oper.viscous = true
  init_thermo(M)
  build_wake(M)
  stagpoint_find(M)
  identify_surfaces(M)
  set_wake_gap(M)
  calc_ue_m(M)
  return { M, inv, ms: performance.now() - t0 }
}

for (const name of CASES) {
  describe(`inviscid + coupling ${name}`, () => {
    const F = loadFixture(name)
    // near-closed TE (gap 1.2e-4, or 1e-4 after set_coords opens the closed case): perturbing mfoil.py's
    // panel nodes by 4e-15 moves its own gamref by ~2e-10 (the port's nodes differ by 6e-15), so these
    // cases get 10x looser tolerances
    const f = (name === 'naca2412_sharp_a4' || name === 'naca2412_closed_a4') ? 10 : 1
    const chk = (l: string, a: number | ArrayLike<number>, e: number | ArrayLike<number>, tol: number, atol = tol) => check(l, a, e, tol * f, atol * f)
    const { M, inv, ms } = setup(F)

    it('matches the inviscid solution', (t) => {
      t.diagnostic(`geometry + inviscid + coupling setup ${ms.toFixed(0)} ms`)
      const I = F.inviscid
      chk('gamref', inv.gamref, flat(I.gamref), 3e-11)
      chk('gam', inv.gam, I.gam, 1e-11)
      chk('cl', inv.cl, I.cl, 1e-12)
      chk('cm', inv.cm, I.cm, 1e-12)
      chk('cdpi', inv.cdpi, I.cdpi, 1e-12)
      chk('cp', inv.cp, I.cp, 1e-11)
      chk('cpi', inv.cpi, I.cpi, 1e-11)
    })

    it('matches param after init_thermo', () => {
      for (const [k, v] of Object.entries(F.param))
        chk(`param.${k}`, (M.param as any)[k], v as number, 1e-15)
    })

    it('matches wake, stagnation and surface data', () => {
      const C = F.coupling
      assert.equal(M.wake.N, C.wake_N)
      chk('wake.x', M.wake.x, flat(C.wake_x), 1e-11)
      chk('wake.s', M.wake.s, C.wake_s, 1e-11)
      chk('wake.t', M.wake.t, flat(C.wake_t), 1e-11)
      chk('uewi', M.isol.uewi, flat(C.uewi), 1e-11)
      chk('uewiref', M.isol.uewiref, flat(C.uewiref), 1e-11)
      chk('sstag', M.isol.sstag, C.sstag, 1e-12)
      chk('sstag_g', M.isol.sstag_g, C.sstag_g, 1e-10)
      chk('xstag', M.isol.xstag, C.xstag, 1e-12)
      chk('xi', M.isol.xi, C.xi, 1e-11)
      chk('wgap', M.vsol.wgap, C.wgap, 1e-11)
      assert.deepEqual(Array.from(M.isol.Istag), C.Istag)
      assert.deepEqual(Array.from(M.isol.sgnue), C.sgnue)
      assert.deepEqual(M.vsol.Is.map(v => Array.from(v)), C.Is)
    })

    it('calc_force viscous branch reproduces the final forces from the converged state', () => {
      const R = F.final
      const N = M.foil.N
      M.glob.Nsys = N + M.wake.N
      M.glob.U = flat(R.U)
      M.vsol.turb = Int32Array.from(R.turb)
      M.vsol.Is = R.Is.map((v: number[]) => Int32Array.from(v))
      M.isol.Istag = Int32Array.from(R.Istag)
      M.isol.sstag = R.sstag
      M.isol.sgnue = new Float64Array(N).map((_, i) => i <= R.Istag[0] ? -1 : 1)
      // xstag is not exported; stagpoint_move's weights satisfy w1 + w2 = 1, so recover them from sstag
      const [i0, i1] = R.Istag
      const w2 = (R.sstag - M.foil.s[i0]) / (M.foil.s[i1] - M.foil.s[i0])
      const X = M.foil.x
      M.isol.xstag = Float64Array.of(X[i0] * (1 - w2) + X[i1] * w2, X[N + i0] * (1 - w2) + X[N + i1] * w2)
      calc_force(M)
      chk('final cl', M.post.cl, R.cl, 1e-12)
      chk('final cm', M.post.cm, R.cm, 1e-12)
      chk('final cdpi', M.post.cdpi, R.cdpi, 1e-12)
      chk('final cd', M.post.cd, R.cd, 1e-12)
      chk('final cdf', M.post.cdf, R.cdf, 1e-12)
      chk('final cdp', M.post.cdp, R.cdp, 1e-12)
      chk('final cp', M.post.cp, R.post.cp, 1e-12)
      chk('final cpi', M.post.cpi, R.post.cpi, 1e-11)
    })

    if (F.matrices) {
      it('matches AIC, ue_sigma, sigma_m and ue_m', () => {
        const X = F.matrices
        const n = M.foil.N + 1
        const A = flat(X.AIC)
        chk('AIC', M.isol.AIC, A, 1e-12)
        // stored factors invert the reference AIC: solve A x = A * 1 and expect x = 1
        const b = new Float64Array(n)
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) b[i] += A[i * n + j]
        chk('AIC_lu solve', luSolve(M.isol.AIC_lu!, b), new Float64Array(n).fill(1), 1e-10)
        chk('sigma_m', M.vsol.sigma_m, flat(X.sigma_m), 1e-13)
        // Noise floor of the reference itself: perturbing mfoil.py's panel nodes by 1e-16 (relative)
        // moves its gamref by ~7e-12, ue_sigma by ~8e-11 and ue_m by ~1.5e-8 (AIC cond1 ~4e5, and
        // ue_m differences ue_sigma columns over ds ~3e-3 near the stagnation point).
        chk('ue_sigma', M.vsol.ue_sigma, flat(X.ue_sigma), 1e-10, 2e-10)
        chk('ue_m', M.vsol.ue_m, flat(X.ue_m), 1e-10, 3e-8)
      })
    }
  })
}

describe('worst errors', () => {
  it('prints the worst abs error per quantity', (t) => {
    t.diagnostic(Object.entries(worst).map(([k, v]) => `${k}: ${v.toExponential(2)}`).join('\n'))
  })
})
