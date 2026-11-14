// Public API of the mfoil port: build with newMfoil(coords, npanel), set conditions, solve.
// Results are in M.post (cl, cd, cm, cdf, cdp, distributions) and M.vsol.Xt; M.glob.conv flags convergence.

import type { Mfoil } from './types.ts'
import { newMfoil } from './geometry.ts'
import { solve_inviscid } from './inviscid.ts'
import { solve_viscous } from './viscous.ts'

export { newMfoil }
export type { Mfoil } from './types.ts'

export interface MfoilInput {
  upperX: number[] // TE -> LE, as stored in the database
  upperY: number[]
  lowerX: number[] // LE -> TE
  lowerY: number[]
  reynolds: number
  mach: number
  ncrit: number
  alphas: number[] // degrees
  npanel: 120 | 199
}
/** One boundary-layer surface, ordered stagnation -> trailing edge */
export interface MfoilSurface {
  x: number[]
  cf: number[]
  ds: number[]
  th: number[]
  hk: number[]
  ue: number[]
}
export interface MfoilPoint {
  alpha: number
  converged: boolean
  reason?: string // why a point did not converge
  cl: number
  cd: number
  cm: number
  cdf: number
  cdp: number
  xtrUpper: number // transition x/c; the TE x when laminar to the trailing edge
  xtrLower: number
  x: number[] // airfoil surface nodes, lower TE -> LE -> upper TE (empty when the solve threw)
  cp: number[]
  cpi: number[]
  upper: MfoilSurface
  lower: MfoilSurface
}

// Database surfaces (upper TE -> LE, lower LE -> TE, each including the LE) -> the coords loop for newMfoil:
// upper TE -> LE -> lower TE with the shared LE point once (a repeated point breaks the spline). A sharp TE
// (both surfaces ending on one point) is fine: set_coords opens it. No normalisation is needed.
export function surfacesToCoords(ux: number[], uy: number[], lx: number[], ly: number[]): Float64Array {
  const k = (lx[0] === ux[ux.length - 1] && ly[0] === uy[uy.length - 1]) ? 1 : 0
  return Float64Array.from([...ux, ...lx.slice(k), ...uy, ...ly.slice(k)])
}

// mfoil.setoper for a prescribed alpha (degrees); giving Re makes the solve viscous; ncrit is M.param.ncrit
export function setoper(M: Mfoil, op: { alpha?: number; Re?: number; Ma?: number; ncrit?: number }): void {
  if (op.alpha !== undefined)
    M.oper.alpha = op.alpha
  if (op.Re !== undefined) {
    M.oper.Re = op.Re
    M.oper.viscous = true
  }
  if (op.Ma !== undefined)
    M.oper.Ma = op.Ma
  if (op.ncrit !== undefined)
    M.param.ncrit = op.ncrit
}

// mfoil.solve: solves the current point; returns the Newton residual history (empty when inviscid)
export function solve(M: Mfoil): number[] {
  if (M.oper.viscous)
    return solve_viscous(M)
  solve_inviscid(M)
  return []
}

// Residual below which a Newton run that stalls (e.g. stagnation point on a node) still counts as converged
const STALL_RNORM = 1e-7

interface BLState { U: Float64Array; turb: Int32Array }

const snapshot = (M: Mfoil): BLState => ({ U: M.glob.U.slice(), turb: M.vsol.turb.slice() })

// One solve at alpha, warm-started from a converged state, or cold (initbl) when from is null
function attempt(M: Mfoil, alpha: number, from: BLState | null): boolean {
  if (from) {
    M.glob.U = from.U.slice()
    M.vsol.turb = from.turb.slice()
  }
  M.oper.initbl = !from
  setoper(M, { alpha })
  M.vsol.Xt.fill(0) // mfoil never resets Xt: a surface laminar to the TE would keep the previous point's value
  const hist = solve(M)
  return M.glob.conv || (hist.length >= 5 && Math.max(...hist.slice(-5)) < STALL_RNORM)
}

function toPoint(M: Mfoil, alpha: number, reason?: string, stale = false): MfoilPoint {
  // stale: the last solve threw, so M.post may hold another angle's results; report no values
  const N = M.foil.N
  const X = M.foil.x
  const P = M.post
  const pick = (I: Int32Array, a: Float64Array) => (stale ? [] : Array.from(I, j => a[j]))
  const surface = (si: number): MfoilSurface => {
    const I = M.vsol.Is[si]
    return { x: pick(I, X), cf: pick(I, P.cf), ds: pick(I, P.ds), th: pick(I, P.th), hk: pick(I, P.Hk), ue: pick(I, P.ue) }
  }
  const xtr = (si: number, xTE: number) => (stale ? NaN : M.vsol.Xt[2 * si] > 0 ? M.vsol.Xt[2 * si + 1] : xTE)
  const v = (a: number) => (stale ? NaN : a)
  const nodes = (a: Float64Array) => (stale ? [] : Array.from(a.subarray(0, N)))
  return {
    alpha,
    converged: reason === undefined,
    ...(reason === undefined ? {} : { reason }),
    cl: v(P.cl),
    cd: v(P.cd),
    cm: v(P.cm),
    cdf: v(P.cdf),
    cdp: v(P.cdp),
    xtrUpper: xtr(1, X[N - 1]),
    xtrLower: xtr(0, X[0]),
    x: nodes(X),
    cp: nodes(P.cp),
    cpi: nodes(P.cpi),
    upper: surface(1),
    lower: surface(0),
  }
}

// Viscous polar on one Mfoil, calling onPoint as each angle finishes. Angles march outward from the one
// nearest zero (up, then down from that start point), each warm-started from the last converged state.
// A point that fails gets a half step from that state, then a cold restart; then it is reported as not
// converged with a reason. Errors building the airfoil (bad geometry) throw.
export function solvePolar(input: MfoilInput, onPoint: (p: MfoilPoint) => void): void {
  const M = newMfoil(surfacesToCoords(input.upperX, input.upperY, input.lowerX, input.lowerY), input.npanel)
  // mfoil's spline paneling folds back on itself near the LE for some coordinate sets (Python too);
  // every solve would then fail, so fail the run instead
  const N = M.foil.N
  const X = M.foil.x
  for (let i = 1; i < N - 1; i++) {
    if ((X[i] - X[i - 1]) * (X[i + 1] - X[i]) + (X[N + i] - X[N + i - 1]) * (X[N + i + 1] - X[N + i]) < 0)
      throw new Error(`The ${input.npanel}-panel paneling of this airfoil folds back near x/c = ${X[i].toFixed(3)}; try the other panel count.`)
  }
  setoper(M, { Re: input.reynolds, Ma: input.mach, ncrit: input.ncrit })
  const alphas = [...new Set(input.alphas)].sort((a, b) => a - b)
  const i0 = alphas.reduce((k, a, i) => (Math.abs(a) < Math.abs(alphas[k]) ? i : k), 0)
  let startState: BLState | null = null
  for (const branch of [alphas.slice(i0), alphas.slice(0, i0).reverse()]) {
    let last = startState // the upward branch starts cold, the downward one from the start point
    let lastAlpha = alphas[i0]
    for (const alpha of branch) {
      const from = last
      const steps = from
        ? [
            () => attempt(M, alpha, from),
            () => attempt(M, (alpha + lastAlpha) / 2, from) && attempt(M, alpha, snapshot(M)),
            () => attempt(M, alpha, null),
          ]
        : [() => attempt(M, alpha, null)]
      let reason: string | undefined
      let stale = false
      for (const step of steps) {
        try {
          stale = false
          if (step()) {
            reason = undefined
            break
          }
          reason = 'Did not converge'
        }
        catch (e) {
          reason = e instanceof Error ? e.message : String(e)
          stale = true
        }
      }
      onPoint(toPoint(M, alpha, reason, stale))
      if (reason === undefined) {
        last = snapshot(M)
        lastAlpha = alpha
        if (alpha === alphas[i0])
          startState = last
      }
    }
  }
}
