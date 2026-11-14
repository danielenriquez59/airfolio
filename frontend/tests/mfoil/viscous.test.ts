import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Mfoil } from '../../utils/mfoil/types.ts'
import type { MfoilPoint } from '../../utils/mfoil/index.ts'
import { newMfoil, setoper, solve, solvePolar } from '../../utils/mfoil/index.ts'
import { build_wake, calc_force, calc_ue_m, get_ueinv, identify_surfaces, init_thermo, set_wake_gap, solve_inviscid, stagpoint_find } from '../../utils/mfoil/inviscid.ts'
import { luFactor, luSolve } from '../../utils/mfoil/linalg.ts'
import { build_glob_sys, get_distributions, init_boundary_layer, solve_V, solve_coupled, solve_glob, stagpoint_move } from '../../utils/mfoil/viscous.ts'
import { assertClose, flat, loadFixture } from './helpers.ts'

const CASES = ['naca2412_a2', 'naca2412_a10', 'naca4412_blunt_a4', 'naca2412_a4_M03', 'naca2412_sharp_a4', 'naca2412_closed_a4']
const worst: Record<string, number> = {}
function check(label: string, a: number | ArrayLike<number>, e: number | ArrayLike<number>, rtol: number, atol = rtol) {
  const err = assertClose(a, e, { atol, rtol, label })
  worst[label] = Math.max(worst[label] ?? 0, err)
}
const maxAbs = (a: ArrayLike<number>) => Array.from(a).reduce((m, v) => Math.max(m, Math.abs(v)), 0)
// U [4, n] compared per component, absolute tolerance relative to that component's largest value
// (amplification grows from exactly 0, so the relative error of its first nonzero values is meaningless)
function checkU(label: string, a: Float64Array, e: Float64Array, rtol: number) {
  const n = a.length / 4
  for (let k = 0; k < 4; k++) {
    const ek = e.subarray(k * n, (k + 1) * n)
    check(`${label}[${k}]`, a.subarray(k * n, (k + 1) * n), ek, rtol, rtol * maxAbs(ek))
  }
}
// Central differences at a 1e-6 relative step resolve the analytic Jacobian to ~1e-7 of a row's largest
// term (roundoff where a residual is a difference of much larger terms). In the initial wake Hk - 1 is
// ~3e-3 and cteq ~ (Hk - 1)^(3/2): the step is 5e-4 of (Hk - 1), so truncation reaches ~2e-6 there
// (drops to 2e-7 at a 1e-7 step). Transition rows: xt comes from a Newton solve stopped at
// |Rxt| < 1e-10, which adds ~3e-7.
const TOL_FD = 3e-6
const TOL_FD_TRAN = 1e-6

// Nodes whose (th, ds, sa) columns, and whose ue columns, may be nonzero in each node's 3 rows of R_U.
// BL rows: own and previous node on the surface; first (similarity) node: own and next;
// a node landing on the stagnation point (i0 = 1): nodes 0, 1, 2; first wake node: both TE nodes.
// ue columns additionally at the two stagnation-panel nodes (R_x*x_st*st_ue chain rule), on every row.
function allowedNodes(M: Mfoil): Set<number>[] {
  const allowed: Set<number>[] = Array.from({ length: M.glob.Nsys }, () => new Set())
  for (let si = 0; si < 3; si++) {
    const Is = M.vsol.Is[si]
    const i0 = (si < 2 && M.isol.xi[Is[0]] < 1e-8 * M.isol.xi[Is[Is.length - 1]]) ? 1 : 0
    if (si < 2) {
      allowed[Is[i0]] = new Set([Is[i0], Is[i0 + 1]])
      if (i0 === 1)
        allowed[Is[0]] = new Set([Is[0], Is[1], Is[2]])
    }
    else {
      allowed[Is[0]] = new Set([M.vsol.Is[0].at(-1)!, M.vsol.Is[1].at(-1)!, Is[0]])
    }
    for (let i = i0 + 1; i < Is.length; i++) allowed[Is[i]] = new Set([Is[i - 1], Is[i]])
  }
  return allowed
}

// Directional derivatives of the global residual vs central differences, at the current state.
// dU moves the state (xi follows through stagpoint_move, as in R_U's chain rule); dx moves xi alone.
// Returns the worst |fd - J*d| over the largest single term of J*d in a row, for ordinary rows and
// transition rows, and the number of rows skipped for mfoil's get_cteq typo (see below).
function fdDirections(M: Mfoil, seed: number) {
  const n = M.glob.Nsys
  const U0 = M.glob.U.slice()
  const xi0 = M.isol.xi.slice()
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1
  const R_at = (U: Float64Array, xi: Float64Array | null) => {
    M.glob.U = U.slice()
    if (xi)
      M.isol.xi = xi.slice()
    else
      stagpoint_move(M)
    build_glob_sys(M)
    return M.glob.R.slice()
  }
  const h = 1e-6
  // perturbations relative to each variable's size (amp is 0 at the stagnation stations: absolute 1e-3 there)
  const dU = Float64Array.from(U0, v => rnd() * (Math.abs(v) || 1e-3))
  const dx = Float64Array.from(xi0, v => rnd() * Math.abs(v))
  const fpU = R_at(U0.map((v, i) => v + h * dU[i]), null)
  const fmU = R_at(U0.map((v, i) => v - h * dU[i]), null)
  const fpx = R_at(U0, xi0.map((v, i) => v + h * dx[i]))
  const fmx = R_at(U0, xi0.map((v, i) => v - h * dx[i]))
  R_at(U0, null) // restore the base state and its Jacobians

  // mfoil's get_cteq assigns HK_U (typo) instead of zeroing Hk_U when it clamps Hk < 1.05 on the
  // airfoil, so its derivative is wrong there (reproduced from the Python, which shows the same
  // mismatch); skip rows that read a turbulent airfoil node with Hk < 1.05
  const N = M.foil.N
  const lowHk = (j: number) => j < N && M.vsol.turb[j] !== 0 && M.glob.U[n + j] / M.glob.U[j] < 1.05
  const allowed = allowedNodes(M)
  const out = { maxU: 0, maxx: 0, tranU: 0, tranx: 0, skipped: 0 }
  const W = 4 * n
  for (let r = 0; r < 3 * n; r++) {
    const j = Math.floor(r / 3)
    if ([...allowed[j]].some(lowHk)) {
      out.skipped++
      continue
    }
    let JdU = 0
    let SU = 0
    for (let c = 0; c < W; c++) {
      const t = M.glob.R_U[r * W + c] * dU[(c % 4) * n + Math.floor(c / 4)]
      JdU += t
      SU = Math.max(SU, Math.abs(t))
    }
    let Jdx = 0
    let Sx = 0
    for (let c = 0; c < n; c++) {
      const t = M.glob.R_x[r * n + c] * dx[c]
      Jdx += t
      Sx = Math.max(Sx, Math.abs(t))
    }
    const tran = [...allowed[j]].some(i => M.vsol.turb[i] !== M.vsol.turb[j]) && j < N
    const eU = SU > 0 ? Math.abs((fpU[r] - fmU[r]) / (2 * h) - JdU) / SU : 0
    const ex = Sx > 0 ? Math.abs((fpx[r] - fmx[r]) / (2 * h) - Jdx) / Sx : 0
    if (tran) {
      out.tranU = Math.max(out.tranU, eU)
      out.tranx = Math.max(out.tranx, ex)
    }
    else {
      out.maxU = Math.max(out.maxU, eU)
      out.maxx = Math.max(out.maxx, ex)
    }
  }
  return out
}

function sparsityViolations(M: Mfoil): string[] {
  const n = M.glob.Nsys
  const W = 4 * n
  const allowed = allowedNodes(M)
  const bad: string[] = []
  for (let j = 0; j < n; j++) {
    for (let r = 3 * j; r < 3 * j + 3; r++) {
      for (let c = 0; c < W; c++) {
        if (M.glob.R_U[r * W + c] === 0)
          continue
        const node = Math.floor(c / 4)
        const ok = allowed[j].has(node) || (c % 4 === 3 && M.isol.Istag.includes(node))
        if (!ok)
          bad.push(`row node ${j} -> col node ${node} var ${c % 4}`)
      }
    }
  }
  return bad
}

// a fixture case up to init_boundary_layer: the same call sequence as the fixture exporter
// (= solve_viscous with captures)
function initViscous(F: any): Mfoil {
  const c = F.case
  const M = newMfoil(flat(F.input.coords), c.npanel)
  setoper(M, { alpha: c.alpha, Re: c.Re, Ma: c.Ma, ncrit: c.ncrit })
  solve_inviscid(M)
  M.oper.viscous = true
  init_thermo(M)
  build_wake(M)
  stagpoint_find(M)
  identify_surfaces(M)
  set_wake_gap(M)
  calc_ue_m(M)
  init_boundary_layer(M)
  return M
}

// R_V and the right-hand side solve_glob solves at the current state (R_V is left in M.glob.R_V;
// the ue-equation residual is rebuilt as in solve_glob)
function systemV(M: Mfoil) {
  solve_glob(M)
  const n = M.glob.Nsys
  const U = M.glob.U
  const R = new Float64Array(4 * n)
  R.set(M.glob.R)
  const ueinv = get_ueinv(M)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let j = 0; j < n; j++) s += M.vsol.ue_m[i * n + j] * (U[n + j] * U[3 * n + j])
    R[3 * n + i] = U[3 * n + i] - (ueinv[i] + s)
  }
  const dense = luSolve(luFactor(M.glob.R_V, 4 * n), R)
  return { RV: M.glob.R_V, R, dense }
}

// worst |a - e| per state component (th, ds, sa, ue) over that component's largest |e|, dV ordered by node
function relDiffV(a: Float64Array, e: Float64Array): number[] {
  return [0, 1, 2, 3].map((k) => {
    let d = 0
    let m = 0
    for (let i = k; i < e.length; i += 4) {
      d = Math.max(d, Math.abs(a[i] - e[i]))
      m = Math.max(m, Math.abs(e[i]))
    }
    return d / m
  })
}

for (const name of CASES) {
  describe(`viscous ${name}`, () => {
    const F = loadFixture(name)
    const M = initViscous(F)
    const initBl = { U: M.glob.U.slice(), turb: M.vsol.turb.slice(), Xt: M.vsol.Xt.slice() }
    stagpoint_move(M)
    build_glob_sys(M)
    const first = { U: M.glob.U.slice(), xi: M.isol.xi.slice(), Istag: Array.from(M.isol.Istag), Is: M.vsol.Is.map(v => Array.from(v)), R: M.glob.R.slice() }
    const sparseFirst = sparsityViolations(M)
    const fd = [1, 2, 3].map(seed => fdDirections(M, seed))
    const t0 = performance.now()
    const hist = solve_coupled(M)
    const ms = performance.now() - t0
    const sparseFinal = sparsityViolations(M) // last build_glob_sys: converged state, with transition intervals
    calc_force(M)
    get_distributions(M)

    it('matches the state after init_boundary_layer', () => {
      const I = F.init_bl
      // marched with the inviscid ue only (ue_m not involved): a few ulps of the inviscid solution
      checkU('init_bl U', initBl.U, flat(I.U), 1e-9)
      assert.deepEqual(Array.from(initBl.turb), I.turb)
      check('init_bl Xt', initBl.Xt, flat(I.Xt), 1e-10, 1e-12)
    })

    it('matches the first global system', () => {
      const G = F.first_glob
      checkU('first U', first.U, flat(G.U), 1e-9)
      check('first xi', first.xi, G.xi, 1e-10, 1e-13)
      assert.deepEqual(first.Istag, G.Istag)
      assert.deepEqual(first.Is, G.Is)
      const Rmax = maxAbs(G.R)
      check('first R', first.R, G.R, 1e-9, 1e-10 * Rmax)
      check('first Rnorm', hist[0], G.Rnorm, 1e-10)
    })

    it('R_U and R_x match central differences of the global residual', (t) => {
      const e = (k: 'maxU' | 'maxx' | 'tranU' | 'tranx') => fd.map(f => f[k].toExponential(1)).join(' ')
      t.diagnostic(`worst row error / largest term, 3 directions: R_U ${e('maxU')}, R_x ${e('maxx')}; transition rows R_U ${e('tranU')}, R_x ${e('tranx')}; rows skipped (Hk < 1.05) ${fd[0].skipped}`)
      for (const f of fd) {
        assert.ok(f.maxU < TOL_FD && f.maxx < TOL_FD, `directional derivative error ${f.maxU} ${f.maxx}`)
        assert.ok(f.tranU < TOL_FD_TRAN && f.tranx < TOL_FD_TRAN, `transition-row derivative error ${f.tranU} ${f.tranx}`)
      }
    })

    it('R_U has the station-block sparsity used for elimination', () => {
      assert.deepEqual(sparseFirst, [])
      assert.deepEqual(sparseFinal, [])
    })

    it('converges like the Python', (t) => {
      const R = F.final
      t.diagnostic(`${hist.length - 1} Newton iterations, ${ms.toFixed(0)} ms; Rnorm rel. diff per iteration: ${hist.map((v, k) => (v / R.rnorm_history[k] - 1).toExponential(0)).join(' ')}`)
      assert.equal(M.glob.conv, R.converged)
      assert.equal(hist.length - 1, R.newton_iterations)
      // Same path while the residual is large: the ue_m noise floor (1e-8) is amplified by the iterations,
      // and naca2412_a4_M03 passes a residual spike (Rnorm 8e3 at iteration 15) that turns 1e-8 into 1e-4;
      // perturbing mfoil.py's own ue_m by 1e-13 shows the same amplification there.
      for (let k = 0; k < Math.min(10, hist.length); k++)
        check('Rnorm history (first 10)', hist[k], R.rnorm_history[k], 1e-7, 0)
    })

    it('matches the converged solution', () => {
      const R = F.final
      // both sides converge the same equations to Rnorm < 1e-10 (observed: 1e-10 relative or better)
      for (const k of ['cl', 'cd', 'cm', 'cdf', 'cdp', 'cdpi'] as const)
        check(`final ${k}`, M.post[k], R[k], 1e-9, 1e-12)
      check('final Xt', M.vsol.Xt, flat(R.Xt), 1e-9, 1e-12)
      assert.deepEqual(Array.from(M.vsol.turb), R.turb)
      assert.deepEqual(Array.from(M.isol.Istag), R.Istag)
      checkU('final U', M.glob.U, flat(R.U), 1e-9)
      for (const [k, v] of Object.entries<number[]>(R.post))
        check(`post ${k}`, (M.post as any)[k], v, 1e-9, 1e-9 * maxAbs(v))
    })
  })
}

describe('solve_V (block elimination) against the dense LU of R_V', () => {
  for (const name of CASES) {
    it(`${name}: first and 8th Newton iteration`, (t) => {
      const M = initViscous(loadFixture(name))
      stagpoint_move(M)
      const diag: string[] = []
      for (const iter of [0, 8]) {
        if (iter > 0) {
          M.param.niglob = iter
          solve_coupled(M)
        }
        build_glob_sys(M)
        const { RV, R, dense } = systemV(M)
        const dV = solve_V(M, RV, R) // must not throw: the structured path itself is checked
        const err = relDiffV(dV, dense)
        diag.push(`iteration ${iter}: ${err.map(v => v.toExponential(1)).join(' ')}`)
        assert.ok(Math.max(...err) < 1e-9, `iteration ${iter}: ${err}`)
        // solve_glob took the structured path: its dU is -dV, by node
        const n = M.glob.Nsys
        for (let j = 0; j < n; j++) for (let k = 0; k < 4; k++) assert.equal(M.glob.dU[k * n + j], -dV[4 * j + k])
      }
      t.diagnostic(`worst |dV - dense| / max |dense| (th ds sa ue): ${diag.join('; ')}`)
    })
  }

  it('falls back to the dense LU when a BL row reads a station downstream of it', () => {
    const M = initViscous(loadFixture('naca2412_a2'))
    stagpoint_move(M)
    build_glob_sys(M)
    const Is = M.vsol.Is[0]
    M.glob.R_U[(3 * Is[5]) * 4 * M.glob.Nsys + 4 * Is[10]] = 0.3 // row of station 5 reads th of station 10
    const { RV, R, dense } = systemV(M)
    assert.throws(() => solve_V(M, RV, R), /marched after it/)
    const n = M.glob.Nsys
    const dV = new Float64Array(4 * n)
    for (let j = 0; j < n; j++) for (let k = 0; k < 4; k++) dV[4 * j + k] = -M.glob.dU[k * n + j]
    assert.ok(Math.max(...relDiffV(dV, dense)) < 1e-14)
  })
})

// mfoil's NACA 4-digit points (naca_points), symmetric sections only
function naca00(tmax: number): Float64Array {
  const N = 100
  const te = 1.5
  const x = Array.from({ length: N + 1 }, (_, i) => {
    const f = i / N
    return 1 - (te + 1) * f * (1 - f) ** te - (1 - f) ** (te + 1)
  })
  const t = x.map(v => (0.2969 * Math.sqrt(v) - 0.126 * v - 0.3516 * v ** 2 + 0.2843 * v ** 3 - 0.1015 * v ** 4) * tmax / 0.2)
  const xs = [...x.slice().reverse(), ...x.slice(1)]
  const zs = [...t.slice().reverse().map(v => -v), ...t.slice(1)]
  return Float64Array.from([...xs, ...zs])
}

describe('viscous physics checks', () => {
  it('symmetric airfoil at alpha 0 gives cl = cm = 0', () => {
    // npanel=121: with 120 the LE node sits exactly on the stagnation point and Newton stalls at Rnorm ~5e-9
    const M = newMfoil(naca00(0.12), 121)
    setoper(M, { alpha: 0, Re: 1e6, Ma: 0 })
    solve(M)
    assert.ok(M.glob.conv)
    assert.ok(Math.abs(M.post.cl) < 1e-8 && Math.abs(M.post.cm) < 1e-8, `cl ${M.post.cl} cm ${M.post.cm}`)
    check('symmetric Xt', M.vsol.Xt[1], M.vsol.Xt[3], 1e-6, 0)
  })

  it('mirrored airfoil at -alpha gives -cl, -cm and the same cd', () => {
    const F = loadFixture('naca2412_a2')
    const X = flat(F.input.coords)
    const n = X.length / 2
    for (let i = n; i < 2 * n; i++) X[i] = -X[i] // also reverses the orientation, exercising set_coords' flip
    const M = newMfoil(X, 120)
    setoper(M, { alpha: -2, Re: 1e6, Ma: 0, ncrit: 9 })
    solve(M)
    assert.ok(M.glob.conv)
    check('mirror cl', M.post.cl, -F.final.cl, 1e-6, 0)
    check('mirror cm', M.post.cm, -F.final.cm, 1e-6, 0)
    check('mirror cd', M.post.cd, F.final.cd, 1e-6, 0)
  })
})

describe('warm-started sweep (initbl=false after a converged point)', () => {
  const F = loadFixture('naca2412_sweep')
  const M = newMfoil(flat(F.input.coords), F.case.npanel)
  setoper(M, { Re: F.case.Re, Ma: 0, ncrit: F.case.ncrit })
  for (const p of F.points) {
    it(`alpha ${p.alpha}`, () => {
      setoper(M, { alpha: p.alpha })
      M.vsol.Xt.fill(0)
      const hist = solve(M)
      M.oper.initbl = !M.glob.conv
      assert.equal(M.glob.conv, p.converged)
      assert.equal(hist.length - 1, p.newton_iterations)
      for (const k of ['cl', 'cd', 'cm'] as const)
        check(`sweep ${k}`, M.post[k], p[k], 1e-9, 1e-12)
      check('sweep Xt', M.vsol.Xt, flat(p.Xt), 1e-9, 1e-12)
    })
  }
})

describe('solvePolar', () => {
  it('marches from zero, matches the warm-started Python sweep and maps the surfaces', () => {
    const F = loadFixture('naca2412_sweep')
    const X = flat(F.input.coords) // lower TE -> LE -> upper TE
    const n = X.length / 2
    const le = (n - 1) / 2
    const row = (r: number) => Array.from(X.subarray(r * n, (r + 1) * n))
    const [x, z] = [row(0), row(1)]
    const input = {
      upperX: x.slice(le).reverse(),
      upperY: z.slice(le).reverse(),
      lowerX: x.slice(0, le + 1).reverse(),
      lowerY: z.slice(0, le + 1).reverse(),
      reynolds: F.case.Re,
      mach: 0,
      ncrit: F.case.ncrit,
      alphas: [-2, 0, 2, 4, 6, 8],
      npanel: F.case.npanel,
    }
    const pts: MfoilPoint[] = []
    solvePolar(input, p => pts.push(structuredClone(p)))
    assert.deepEqual(pts.map(p => p.alpha), [0, 2, 4, 6, 8, -2])
    for (const ref of F.points) {
      const p = pts.find(q => q.alpha === ref.alpha)!
      assert.ok(p.converged && p.reason === undefined)
      for (const k of ['cl', 'cd', 'cm'] as const)
        check(`polar ${k}`, p[k], ref[k], 1e-9, 1e-12)
      const Xt = flat(ref.Xt)
      check('polar xtr', [p.xtrLower, p.xtrUpper], [Xt[0] > 0 ? Xt[1] : p.lower.x.at(-1)!, Xt[2] > 0 ? Xt[3] : p.upper.x.at(-1)!], 1e-9, 1e-12)
    }
    const p = pts[0]
    assert.equal(p.x.length, p.cp.length)
    assert.ok(p.x[0] > 0.99 && p.x.at(-1)! > 0.99 && Math.min(...p.x) < 1e-3) // lower TE -> LE -> upper TE
    for (const s of [p.upper, p.lower]) {
      assert.ok(s.x[0] < 0.01 && s.x.at(-1)! > 0.99) // stagnation -> TE
      assert.ok([s.cf, s.ds, s.th, s.hk, s.ue].every(a => a.length === s.x.length))
    }
    assert.ok(pts[4].xtrLower > 0.99) // lower surface laminar to the TE at 8 deg
  })
})

describe('worst errors', () => {
  it('prints the worst abs error per quantity', (t) => {
    t.diagnostic(Object.entries(worst).map(([k, v]) => `${k}: ${v.toExponential(2)}`).join('\n'))
  })
})
