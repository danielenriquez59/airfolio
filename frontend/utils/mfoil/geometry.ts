// TypeScript port of the geometry, paneling and panel-influence functions of mfoil.py
// (backend/mfoil.py), function by function with the Python names and order.
//
// mfoil.py: class and methods for subsonic airfoil analysis (v 2023-06-28)
//
// Copyright (C) 2023 Krzysztof J. Fidkowski
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
// BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Array conventions: see types.ts. A panel Xj (Python X[:, [j, k]], shape [2, 2]) is a
// Float64Array(4) = [x1, x2, z1, z2]; build one with cols().

import type { Mfoil, Panel } from './types.ts'
import { newMfoilState } from './types.ts'
import type { PP } from './linalg.ts'
import { cubicSpline, norm2, ppEval } from './linalg.ts'

// ============ UTILITY ==============

export function sind(alpha: number): number {
  return Math.sin(alpha * Math.PI / 180)
}

export function cosd(alpha: number): number {
  return Math.cos(alpha * Math.PI / 180)
}

export function dist(a: number, b: number): number {
  return Math.sqrt(a * a + b * b)
}

export const atan2 = Math.atan2

// X[:, [j, k]] of a [2, n] array X, as a [2, 2] row-major copy
export function cols(X: Float64Array, n: number, j: number, k: number): Float64Array {
  return Float64Array.of(X[j], X[k], X[n + j], X[n + k])
}

// np.linspace(a, b, num): i*step + a, last point exactly b
export function linspace(a: number, b: number, num: number): Float64Array {
  const y = new Float64Array(num)
  const step = (b - a) / (num - 1)
  for (let i = 0; i < num; i++) y[i] = i * step + a
  y[num - 1] = b
  return y
}

// ============ INVISCID-PANEL HELPERS ==============

export function TE_info(X: Float64Array): [Float64Array, number, number, number, number] {
  const n = X.length / 2
  let t1 = Float64Array.of(X[0] - X[1], X[n] - X[n + 1]) // lower tangent vector
  t1 = t1.map(v => v / norm2(t1))
  let t2 = Float64Array.of(X[n - 1] - X[n - 2], X[2 * n - 1] - X[2 * n - 2]) // upper tangent vector
  t2 = t2.map(v => v / norm2(t2))
  let t = Float64Array.of(0.5 * (t1[0] + t2[0]), 0.5 * (t1[1] + t2[1])) // average tangent; gap bisector
  t = t.map(v => v / norm2(t))
  const s = Float64Array.of(X[n - 1] - X[0], X[2 * n - 1] - X[n]) // lower to upper connector vector
  const hTE = -s[0] * t[1] + s[1] * t[0] // TE gap
  const dtdx = t1[0] * t2[1] - t2[0] * t1[1] // sin(theta between t1,t2) approx dt/dx
  const ns = norm2(s)
  const p = Float64Array.of(s[0] / ns, s[1] / ns) // unit vector along TE panel
  const tcp = Math.abs(t[0] * p[1] - t[1] * p[0])
  const tdp = t[0] * p[0] + t[1] * p[1]
  return [t, hTE, dtdx, tcp, tdp]
}

// returns [t, n, x, z, d, r1, r2, theta1, theta2]
export function panel_info(Xj: Float64Array, xi: ArrayLike<number>): [Float64Array, Float64Array, number, number, number, number, number, number, number] {
  const xj1 = Xj[0]
  const zj1 = Xj[2]
  const xj2 = Xj[1]
  const zj2 = Xj[3]
  const t = Float64Array.of(xj2 - xj1, zj2 - zj1)
  const nt = norm2(t)
  t[0] /= nt
  t[1] /= nt
  const n = Float64Array.of(-t[1], t[0])
  const xz0 = xi[0] - xj1
  const xz1 = xi[1] - zj1
  const x = xz0 * t[0] + xz1 * t[1]
  const z = xz0 * n[0] + xz1 * n[1]
  const d = dist(xj2 - xj1, zj2 - zj1)
  const r1 = dist(x, z)
  const r2 = dist(x - d, z)
  const theta1 = atan2(z, x)
  const theta2 = atan2(z, x - d)
  return [t, n, x, z, d, r1, r2, theta1, theta2]
}

// shortcut: the vdir and onmid=True options are dropped; the solve path only calls (vdir=None, onmid=False)
export function panel_linvortex_velocity(Xj: Float64Array, xi: ArrayLike<number>): [Float64Array, Float64Array] {
  const [t, n, x, z, d, r1, r2, theta1, theta2] = panel_info(Xj, xi)
  let temp1 = (theta2 - theta1) / (2 * Math.PI)
  let temp2 = (2 * z * Math.log(r1 / r2) - 2 * x * (theta2 - theta1)) / (4 * Math.PI * d)
  const ug1 = temp1 + temp2
  const ug2 = -temp2
  temp1 = Math.log(r2 / r1) / (2 * Math.PI)
  temp2 = (x * Math.log(r1 / r2) - d + z * (theta2 - theta1)) / (2 * Math.PI * d)
  const wg1 = temp1 + temp2
  const wg2 = -temp2
  const a = Float64Array.of(ug1 * t[0] + wg1 * n[0], ug1 * t[1] + wg1 * n[1])
  const b = Float64Array.of(ug2 * t[0] + wg2 * n[0], ug2 * t[1] + wg2 * n[1])
  return [a, b]
}

export function panel_linvortex_stream(Xj: Float64Array, xi: ArrayLike<number>): [number, number] {
  const [, , x, z, d, r1, r2, theta1, theta2] = panel_info(Xj, xi)
  const ep = 1e-9
  const logr1 = r1 < ep ? 0 : Math.log(r1)
  const logr2 = r2 < ep ? 0 : Math.log(r2)
  const P1 = (0.5 / Math.PI) * (z * (theta2 - theta1) - d + x * logr1 - (x - d) * logr2)
  const P2 = x * P1 + (0.5 / Math.PI) * (0.5 * r2 ** 2 * logr2 - 0.5 * r1 ** 2 * logr1 - r2 ** 2 / 4 + r1 ** 2 / 4)
  return [P1 - P2 / d, P2 / d]
}

export function panel_constsource_velocity(Xj: Float64Array, xi: ArrayLike<number>, vdir: null): Float64Array
export function panel_constsource_velocity(Xj: Float64Array, xi: ArrayLike<number>, vdir: ArrayLike<number>): number
export function panel_constsource_velocity(Xj: Float64Array, xi: ArrayLike<number>, vdir: ArrayLike<number> | null): Float64Array | number {
  const [t, n, , , , r1, r2, th1, th2] = panel_info(Xj, xi)
  let theta1 = th1
  let theta2 = th2
  const ep = 1e-9
  let logr1 = 0
  if (r1 < ep) {
    theta1 = Math.PI
    theta2 = Math.PI
  }
  else { logr1 = Math.log(r1) }
  let logr2 = 0
  if (r2 < ep) {
    theta1 = 0
    theta2 = 0
  }
  else { logr2 = Math.log(r2) }
  const u = (0.5 / Math.PI) * (logr1 - logr2)
  const w = (0.5 / Math.PI) * (theta2 - theta1)
  const a = Float64Array.of(u * t[0] + w * n[0], u * t[1] + w * n[1])
  return vdir !== null ? a[0] * vdir[0] + a[1] * vdir[1] : a
}

export function panel_constsource_stream(Xj: Float64Array, xi: ArrayLike<number>): number {
  const [, , x, z, d, r1, r2, th1, th2] = panel_info(Xj, xi)
  let theta1 = th1
  let theta2 = th2
  const ep = 1e-9
  let logr1 = 0
  if (r1 < ep) {
    theta1 = Math.PI
    theta2 = Math.PI
  }
  else { logr1 = Math.log(r1) }
  let logr2 = 0
  if (r2 < ep) {
    theta1 = 0
    theta2 = 0
  }
  else { logr2 = Math.log(r2) }
  const P = (x * (theta1 - theta2) + d * theta2 + z * logr1 - z * logr2) / (2 * Math.PI)
  const dP = d // delta psi
  return (theta1 + theta2) > Math.PI ? P - 0.25 * dP : P + 0.75 * dP
}

// shortcut: vdir=None is dropped; the solve path always passes a direction
export function panel_linsource_velocity(Xj: Float64Array, xi: ArrayLike<number>, vdir: ArrayLike<number>): [number, number] {
  const [t, n, x, z, d, r1, r2, theta1, theta2] = panel_info(Xj, xi)
  let temp1 = Math.log(r1 / r2) / (2 * Math.PI)
  let temp2 = (x * Math.log(r1 / r2) - d + z * (theta2 - theta1)) / (2 * Math.PI * d)
  const ug1 = temp1 - temp2
  const ug2 = temp2
  temp1 = (theta2 - theta1) / (2 * Math.PI)
  temp2 = (-z * Math.log(r1 / r2) + x * (theta2 - theta1)) / (2 * Math.PI * d)
  const wg1 = temp1 - temp2
  const wg2 = temp2
  const a = Float64Array.of(ug1 * t[0] + wg1 * n[0], ug1 * t[1] + wg1 * n[1])
  const b = Float64Array.of(ug2 * t[0] + wg2 * n[0], ug2 * t[1] + wg2 * n[1])
  return [a[0] * vdir[0] + a[1] * vdir[1], b[0] * vdir[0] + b[1] * vdir[1]]
}

export function panel_linsource_stream(Xj: Float64Array, xi: ArrayLike<number>): [number, number] {
  const [, , x, z, d, r1, r2, th1, th2] = panel_info(Xj, xi)
  let theta1 = th1 < 0 ? th1 + 2 * Math.PI : th1 // branch cut at theta = 0
  let theta2 = th2 < 0 ? th2 + 2 * Math.PI : th2
  const ep = 1e-9
  let logr1 = 0
  if (r1 < ep) {
    theta1 = Math.PI
    theta2 = Math.PI
  }
  else { logr1 = Math.log(r1) }
  let logr2 = 0
  if (r2 < ep) {
    theta1 = 0
    theta2 = 0
  }
  else { logr2 = Math.log(r2) }
  const P1 = (0.5 / Math.PI) * (x * (theta1 - theta2) + theta2 * d + z * logr1 - z * logr2)
  const P2 = x * P1 + (0.5 / Math.PI) * (0.5 * r2 ** 2 * theta2 - 0.5 * r1 ** 2 * theta1 - 0.5 * z * d)
  return [P1 - P2 / d, P2 / d]
}

// ============ GEOMETRY ==============

export function space_geom(dx0: number, L: number, Np: number): Float64Array {
  if (!(Np > 1))
    throw new Error('Need at least two points for spacing.')
  const N = Np - 1 // number of intervals
  const d = L / dx0
  const a = N * (N - 1) * (N - 2) / 6
  const b = N * (N - 1) / 2
  const c = N - d
  const disc = Math.max(b * b - 4 * a * c, 0)
  let r = 1 + (-b + Math.sqrt(disc)) / (2 * a)
  for (let k = 0; k < 10; k++) {
    const R = r ** N - 1 - d * (r - 1)
    const R_r = N * r ** (N - 1) - d
    const dr = -R / R_r
    if (Math.abs(dr) < 1e-6)
      break
    r -= R / R_r
  }
  const x = new Float64Array(Np)
  for (let i = 0; i < N; i++) x[i + 1] = x[i] + dx0 * r ** i
  return x
}

// X: [2, n] point loop (x row, then z row); copied, flipped to CCW if needed
export function set_coords(M: Mfoil, X: Float64Array): void {
  const n = X.length / 2
  let A = 0
  for (let i = 0; i < n - 1; i++) A += (X[i + 1] - X[i]) * (X[n + i + 1] + X[n + i])
  const Xc = new Float64Array(2 * n)
  for (let i = 0; i < n; i++) {
    const k = A < 0 ? n - 1 - i : i // np.fliplr
    Xc[i] = X[k]
    Xc[n + i] = X[n + k]
  }
  const xs = Xc.subarray(0, n)
  const chord = Math.max(...xs) - Math.min(...xs)
  // closed (or crossed) TE: open it to a 1e-4*chord gap with thickness added linearly in x from the LE,
  // as XFOIL's TGAP; mfoil's no-gap TE path does not converge when coupled (see mfoil.py set_coords)
  const dz = 1e-4 * chord - (Xc[2 * n - 1] - Xc[n]) // gap deficit; points run lower TE -> LE -> upper TE
  if (dz > 0) {
    const ile = xs.indexOf(Math.min(...xs))
    for (let i = 0; i < n; i++) {
      const f = 0.5 * dz * (Xc[i] - Xc[ile]) / chord
      if (i < ile)
        Xc[n + i] -= f
      else if (i > ile)
        Xc[n + i] += f
    }
  }
  M.geom.npoint = n
  M.geom.xpoint = Xc
  M.geom.chord = chord
}

// shortcut: the stgt (target s values) option is dropped; mfoil() always passes None
export function spline_curvature(Xin: Float64Array, N: number, Ufac: number, TEfac: number): [Float64Array, Float64Array, Float64Array] {
  const xs = Xin.subarray(0, Xin.length / 2)
  const xmin = Math.min(...xs)
  const xmax = Math.max(...xs)

  const PP = spline2d(Xin)

  // curvature-based spacing on geom
  const nfine = 501
  let s = linspace(0, PP.X.x[PP.X.x.length - 1], nfine)
  const xyfine = splineval(PP, s)
  const PPfine = spline2d(xyfine)

  s = PPfine.X.x
  const m = nfine - 1
  const cx = PPfine.X.c
  const cy = PPfine.Y.c
  const sk = new Float64Array(nfine)
  const [xq, wq] = quadseg()
  for (let i = 0; i < nfine - 1; i++) {
    const ds = s[i + 1] - s[i]
    let dot = 0
    for (let q = 0; q < 5; q++) {
      const st = xq[q] * ds
      const xss = 6.0 * cx[i] * st + 2.0 * cx[m + i]
      const yss = 6.0 * cy[i] * st + 2.0 * cy[m + i]
      dot += wq[q] * Math.sqrt(xss * xss + yss * yss)
    }
    let skint = 0.01 * Ufac + 0.5 * dot * ds
    // force TE resolution
    const xx = (0.5 * (xyfine[i] + xyfine[i + 1]) - xmin) / (xmax - xmin) // close to 1 means at TE
    skint = skint + TEfac * 0.5 * Math.exp(-100 * (1.0 - xx))
    sk[i + 1] = sk[i] + skint
  }
  // offset by fraction of average to avoid problems with zero curvature
  let sum = 0
  for (let i = 0; i < nfine; i++) sum += sk[i]
  const off = 2.0 * sum / nfine
  for (let i = 0; i < nfine; i++) sk[i] = sk[i] + off
  // arclength values at points (sk is increasing, so min/max are its ends)
  const skl = linspace(sk[0], sk[nfine - 1], N)
  s = ppEval(cubicSpline(sk, s), skl)
  return [splineval(PPfine, s), s, splinetan(PPfine, s)]
}

export interface PP2 { X: PP; Y: PP }

export function spline2d(X: Float64Array): PP2 {
  const N = X.length / 2
  const x = X.subarray(0, N)
  const z = X.subarray(N)
  const S = new Float64Array(N)
  const Snew = new Float64Array(N)
  for (let i = 1; i < N; i++) S[i] = S[i - 1] + dist(X[i] - X[i - 1], X[N + i] - X[N + i - 1])
  let PPX = cubicSpline(S, x)
  let PPY = cubicSpline(S, z)

  // re-integrate to true arclength via several passes
  const [xq, wq] = quadseg()
  const m = N - 1
  for (let ipass = 0; ipass < 10; ipass++) {
    Snew[0] = S[0]
    for (let i = 0; i < N - 1; i++) {
      const ds = S[i + 1] - S[i]
      let sint = 0
      for (let q = 0; q < 5; q++) {
        const st = xq[q] * ds
        const xsv = 3.0 * PPX.c[i] * st * st + 2.0 * PPX.c[m + i] * st + PPX.c[2 * m + i]
        const ysv = 3.0 * PPY.c[i] * st * st + 2.0 * PPY.c[m + i] * st + PPY.c[2 * m + i]
        sint += wq[q] * Math.sqrt(xsv * xsv + ysv * ysv)
      }
      Snew[i + 1] = Snew[i] + sint * ds
    }
    S.set(Snew)
    PPX = cubicSpline(S, x)
    PPY = cubicSpline(S, z)
  }
  return { X: PPX, Y: PPY }
}

// returns [2, len(S)]
export function splineval(PP: PP2, S: ArrayLike<number>): Float64Array {
  const out = new Float64Array(2 * S.length)
  out.set(ppEval(PP.X, S))
  out.set(ppEval(PP.Y, S), S.length)
  return out
}

export function splinetan(PP: PP2, S: ArrayLike<number>): Float64Array {
  const out = new Float64Array(2 * S.length)
  out.set(ppEval(PP.X, S, 1))
  out.set(ppEval(PP.Y, S, 1), S.length)
  return out
}

export function quadseg(): [Float64Array, Float64Array] {
  return [
    Float64Array.of(0.046910077030668, 0.230765344947158, 0.500000000000000, 0.769234655052842, 0.953089922969332),
    Float64Array.of(0.118463442528095, 0.239314335249683, 0.284444444444444, 0.239314335249683, 0.118463442528095),
  ]
}

// ============ PANELING ==============

// clear_solution(M) is not ported: make_panels only runs on a fresh state in newMfoil
export function make_panels(M: Mfoil, npanel: number): void {
  const Ufac = 2 // uniformity factor (higher, more uniform paneling)
  const TEfac = 0.1 // trailing-edge factor (higher, more TE resolution)
  const foil: Panel = M.foil
  ;[foil.x, foil.s, foil.t] = spline_curvature(M.geom.xpoint, npanel + 1, Ufac, TEfac)
  foil.N = foil.s.length
}

// mfoil(coords=X, npanel=npanel): X is the [2, n] point loop, flat row-major
export function newMfoil(coords: Float64Array, npanel = 199): Mfoil {
  const M = newMfoilState()
  set_coords(M, coords)
  make_panels(M, npanel)
  return M
}
