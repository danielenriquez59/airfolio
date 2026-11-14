// Port of the inviscid solve and viscous-inviscid coupling matrices of mfoil.py
// (backend/mfoil.py, MIT licence, Copyright (C) 2023 Krzysztof J. Fidkowski; full notice in
// geometry.ts). Same function names and order as the Python; conventions in types.ts.

import type { Mfoil, Param } from './types.ts'
import { copyParam } from './types.ts'
import { get_H, get_cf, get_cp, get_rho, get_uk } from './closures.ts'
import { luFactor, luSolve, norm2 } from './linalg.ts'
import { TE_info, cols, cosd, panel_constsource_stream, panel_constsource_velocity, panel_linsource_stream, panel_linsource_velocity, panel_linvortex_stream, panel_linvortex_velocity, sind, space_geom } from './geometry.ts'

// ============ POST-PROCESSING ==============

export function calc_force(M: Mfoil): void {
  const chord = M.geom.chord
  const xref = M.geom.xref
  const alpha = M.oper.alpha
  const N = M.foil.N
  const X = M.foil.x

  // pressure coefficient at each node
  const ue = M.oper.viscous ? M.glob.U.subarray(3 * M.glob.Nsys, 4 * M.glob.Nsys) : get_ueinv(M)
  const cp = new Float64Array(ue.length)
  const cp_ue = new Float64Array(ue.length)
  for (let i = 0; i < ue.length; i++) [cp[i], cp_ue[i]] = get_cp(ue[i], M.param)
  M.post.cp = cp
  M.post.cpi = get_ueinv(M).map(u => get_cp(u, M.param)[0]) // inviscid cp

  // lift, moment, near-field pressure cd by cp integration
  let cl = 0
  const cl_ue = new Float64Array(N)
  let cl_alpha = 0
  let cm = 0
  let cdpi = 0
  for (let i0 = 1; i0 <= N; i0++) {
    const [i, ip] = i0 === N ? [0, N - 1] : [i0, i0 - 1]
    const dxv0 = X[i] - X[ip]
    const dxv1 = X[N + i] - X[N + ip]
    const dx10 = X[ip] - xref[0]
    const dx11 = X[N + ip] - xref[1]
    const dx20 = X[i] - xref[0]
    const dx21 = X[N + i] - xref[1]
    const dx1nds = dxv0 * dx10 + dxv1 * dx11
    const dx2nds = dxv0 * dx20 + dxv1 * dx21
    const dx = -dxv0 * cosd(alpha) - dxv1 * sind(alpha) // minus from CW node ordering
    const dz = dxv1 * cosd(alpha) - dxv0 * sind(alpha) // for drag
    const cp1 = cp[ip]
    const cp2 = cp[i]
    const cpbar = 0.5 * (cp1 + cp2)
    cl = cl + dx * cpbar
    cl_ue[ip] += dx * 0.5 * cp_ue[ip]
    cl_ue[i] += dx * 0.5 * cp_ue[i]
    cl_alpha += cpbar * (sind(alpha) * dxv0 - cosd(alpha) * dxv1) * Math.PI / 180
    cm += cp1 * dx1nds / 3 + cp1 * dx2nds / 6 + cp2 * dx1nds / 6 + cp2 * dx2nds / 3
    cdpi = cdpi + dz * cpbar
  }
  cl /= chord
  cm /= chord ** 2
  cdpi /= chord
  M.post.cl = cl
  M.post.cl_ue = cl_ue
  M.post.cl_alpha = cl_alpha
  M.post.cm = cm
  M.post.cdpi = cdpi

  // viscous contributions
  let cd = 0
  let cdf = 0
  if (M.oper.viscous) {
    const Nsys = M.glob.Nsys
    const U = M.glob.U
    const Ucol = (j: number) => Float64Array.of(U[j], U[Nsys + j], U[2 * Nsys + j], U[3 * Nsys + j])
    const Vinf = M.param.Vinf
    const rho = M.oper.rho
    const qinf = 0.5 * rho * Vinf ** 2 // dynamic pressure

    // Squire-Young relation for total drag (extrapolates theta from end of wake)
    const Iw = M.vsol.Is[2]
    const Ue = Ucol(Iw[Iw.length - 1]) // station at the end of the wake
    const [H, H_U] = get_H(Ue)
    const [uk, uk_ue] = get_uk(Ue[3], M.param)
    cd = 2.0 * Ue[0] * (uk / Vinf) ** ((5 + H) / 2)
    const cd_U = H_U.map(v => 2.0 * Ue[0] * (uk / Vinf) ** ((5 + H) / 2) * Math.log(uk / Vinf) * 0.5 * v)
    cd_U[0] += 2.0 * (uk / Vinf) ** ((5 + H) / 2)
    cd_U[3] += 2.0 * Ue[0] * (5 + H) / 2 * (uk / Vinf) ** ((3 + H) / 2) * (1 / Vinf) * uk_ue
    M.post.cd_U = cd_U

    // skin friction drag
    let Df = 0
    for (let si = 0; si < 2; si++) {
      const Is = M.vsol.Is[si]
      const param = build_param(M, si)
      station_param(M, param, Is[0])
      let cf1 = 0
      let ue1 = 0
      let rho1 = rho
      let x1 = M.isol.xstag
      for (let i = 0; i < Is.length; i++) {
        station_param(M, param, Is[i])
        const Ui = Ucol(Is[i])
        const cf2 = get_cf(Ui, param)[0]
        const ue2 = get_uk(Ui[3], param)[0]
        const rho2 = get_rho(Ui, param)[0]
        const x2 = Float64Array.of(X[Is[i]], X[N + Is[i]])
        const dx = (x2[0] - x1[0]) * cosd(alpha) + (x2[1] - x1[1]) * sind(alpha)
        Df += 0.25 * (rho1 * cf1 * ue1 ** 2 + rho2 * cf2 * ue2 ** 2) * dx
        cf1 = cf2
        ue1 = ue2
        x1 = x2
        rho1 = rho2
      }
    }
    cdf = Df / (qinf * chord)
  }
  M.post.cd = cd
  M.post.cdf = cdf
  M.post.cdp = cd - cdf
}

// copy of M.param for side si: 0 = lower, 1 = upper, 2 = wake
export function build_param(M: Mfoil, si: number): Param {
  const param = copyParam(M.param)
  param.wake = si === 2
  param.turb = param.wake // the wake is fully turbulent
  param.simi = false
  return param
}

// set turb/simi of param for station i
export function station_param(M: Mfoil, param: Param, i: number): void {
  param.turb = M.vsol.turb[i] !== 0
  param.simi = M.isol.Istag.includes(i)
}

// ============ INVISCID FUNCTIONS ==============

export function solve_inviscid(M: Mfoil): void {
  if (!(M.foil.N > 0))
    throw new Error('No panels')
  M.oper.viscous = false
  init_thermo(M)
  M.isol.sgnue = new Float64Array(M.foil.N).fill(1) // do not distinguish sign of ue if inviscid
  build_gamma(M, M.oper.alpha)
  calc_force(M)
  M.glob.conv = true
}

// inviscid ue at airfoil nodes, and wake nodes if viscous with a wake
export function get_ueinv(M: Mfoil): Float64Array {
  if (!(M.isol.gam.length > 0))
    throw new Error('No inviscid solution')
  const c = cosd(M.oper.alpha)
  const s = sind(M.oper.alpha)
  const N = M.foil.N
  const Nw = (M.oper.viscous && M.wake.N > 0) ? M.wake.N : 0
  const ue = new Float64Array(N + Nw)
  const g = M.isol.gamref
  for (let i = 0; i < N; i++) ue[i] = M.isol.sgnue[i] * (g[2 * i] * c + g[2 * i + 1] * s)
  const w = M.isol.uewiref
  for (let i = 0; i < Nw; i++) ue[N + i] = w[2 * i] * c + w[2 * i + 1] * s
  if (Nw > 0)
    ue[N] = ue[N - 1] // continuity of upper surface and wake ue
  return ue
}

export function build_gamma(M: Mfoil, alpha: number): void {
  const N = M.foil.N
  const X = M.foil.x
  const n1 = N + 1
  const A = new Float64Array(n1 * n1) // influence matrix
  const rhs = new Float64Array(n1 * 2) // right-hand sides for 0,90
  const [, hTE, , tcp, tdp] = TE_info(X)
  const nogap = Math.abs(hTE) < 1e-10 * M.geom.chord
  const XTE = cols(X, N, N - 1, 0)

  for (let i = 0; i < N; i++) {
    const xi = [X[i], X[N + i]]
    const r = i * n1
    for (let j = 0; j < N - 1; j++) {
      const [aij, bij] = panel_linvortex_stream(cols(X, N, j, j + 1), xi)
      A[r + j] += aij
      A[r + j + 1] += bij
    }
    A[r + N] = -1 // last unknown = streamfunction value on surf
    rhs[2 * i] = -xi[1]
    rhs[2 * i + 1] = xi[0]
    // TE source influence
    const a = panel_constsource_stream(XTE, xi)
    A[r] += -a * (0.5 * tcp)
    A[r + N - 1] += a * (0.5 * tcp)
    // TE vortex panel
    const [av, bv] = panel_linvortex_stream(XTE, xi)
    A[r] += -(av + bv) * (-0.5 * tdp)
    A[r + N - 1] += (av + bv) * (-0.5 * tdp)
  }

  // special Nth equation (extrapolation of gamma differences) if no gap
  if (nogap) {
    const r = (N - 1) * n1
    A.fill(0, r, r + n1)
    const idx = [0, 1, 2, N - 3, N - 2, N - 1]
    const val = [1, -2, 1, -1, 2, -1]
    idx.forEach((j, k) => (A[r + j] = val[k]))
  }

  // Kutta condition
  A[N * n1] = 1
  A[N * n1 + N - 1] = 1

  M.isol.AIC = A
  M.isol.AIC_lu = luFactor(A, n1)
  const g = luSolve(M.isol.AIC_lu, rhs, 2)
  M.isol.gamref = g.slice(0, 2 * N) // last value is surf streamfunction
  M.isol.gam = new Float64Array(N)
  for (let i = 0; i < N; i++) M.isol.gam[i] = g[2 * i] * cosd(alpha) + g[2 * i + 1] * sind(alpha)
}

// velocity at x due to gamma G on panels X [2, N] plus freestream; with dolin also V_G [2, N]
export function inviscid_velocity(X: Float64Array, G: ArrayLike<number>, Vinf: number, alpha: number, x: ArrayLike<number>, dolin: boolean): [Float64Array, Float64Array | null] {
  const N = X.length / 2
  const V = new Float64Array(2)
  const V_G = dolin ? new Float64Array(2 * N) : null
  const [, , , tcp, tdp] = TE_info(X)
  for (let j = 0; j < N - 1; j++) {
    const [a, b] = panel_linvortex_velocity(cols(X, N, j, j + 1), x)
    V[0] += a[0] * G[j] + b[0] * G[j + 1]
    V[1] += a[1] * G[j] + b[1] * G[j + 1]
    if (V_G) {
      V_G[j] += a[0]
      V_G[N + j] += a[1]
      V_G[j + 1] += b[0]
      V_G[N + j + 1] += b[1]
    }
  }
  const XTE = cols(X, N, N - 1, 0)
  const add = (f1: Float64Array, f2: Float64Array) => {
    V[0] += f1[0] * G[0] + f2[0] * G[N - 1]
    V[1] += f1[1] * G[0] + f2[1] * G[N - 1]
    if (V_G) {
      V_G[0] += f1[0]
      V_G[N] += f1[1]
      V_G[N - 1] += f2[0]
      V_G[2 * N - 1] += f2[1]
    }
  }
  // TE source influence
  const a = panel_constsource_velocity(XTE, x, null)
  add(a.map(v => v * (-0.5 * tcp)), a.map(v => v * 0.5 * tcp))
  // TE vortex influence
  const [av, bv] = panel_linvortex_velocity(XTE, x)
  const ab = Float64Array.of(av[0] + bv[0], av[1] + bv[1])
  add(ab.map(v => v * (0.5 * tdp)), ab.map(v => v * (-0.5 * tdp)))
  // freestream influence
  V[0] += Vinf * cosd(alpha)
  V[1] += Vinf * sind(alpha)
  return [V, V_G]
}

export function build_wake(M: Mfoil): void {
  if (!(M.isol.gam.length > 0))
    throw new Error('No inviscid solution')
  const N = M.foil.N
  const X = M.foil.x
  const Vinf = M.oper.Vinf
  const Nw = Math.ceil(N / 10 + 10 * M.geom.wakelen) // number of points on wake
  const S = M.foil.s
  const ds1 = 0.5 * (S[1] - S[0] + S[N - 1] - S[N - 2]) // first nominal wake panel size
  const sv = space_geom(ds1, M.geom.wakelen * M.geom.chord, Nw)
  const xyw = new Float64Array(2 * Nw)
  const tw = new Float64Array(2 * Nw)
  const n = [X[N - 1] - X[0], X[2 * N - 1] - X[N]]
  const t = [n[1], -n[0]]
  if (!(t[0] > 0))
    throw new Error('Wrong wake direction; ensure airfoil points are CCW')
  xyw[0] = 0.5 * (X[0] + X[N - 1]) + 1e-5 * t[0] * M.geom.chord // first wake point, just behind TE
  xyw[Nw] = 0.5 * (X[N] + X[2 * N - 1]) + 1e-5 * t[1] * M.geom.chord
  const sw = sv.map(v => S[N - 1] + v)

  const vel = (G: ArrayLike<number>, V: number, al: number, i: number) => inviscid_velocity(X, G, V, al, [xyw[i], xyw[Nw + i]], false)[0]
  for (let i = 0; i < Nw - 1; i++) {
    let v1 = vel(M.isol.gam, Vinf, M.oper.alpha, i)
    const n1 = norm2(v1)
    v1 = v1.map(v => v / n1)
    tw[i] = v1[0]
    tw[Nw + i] = v1[1]
    const h = sv[i + 1] - sv[i]
    xyw[i + 1] = xyw[i] + h * v1[0] // forward Euler (predictor) step
    xyw[Nw + i + 1] = xyw[Nw + i] + h * v1[1]
    let v2 = vel(M.isol.gam, Vinf, M.oper.alpha, i + 1)
    const n2 = norm2(v2)
    v2 = v2.map(v => v / n2)
    tw[i + 1] = v2[0]
    tw[Nw + i + 1] = v2[1]
    xyw[i + 1] = xyw[i] + h * 0.5 * (v1[0] + v2[0]) // corrector step
    xyw[Nw + i + 1] = xyw[Nw + i] + h * 0.5 * (v1[1] + v2[1])
  }

  // inviscid ue in the wake, and 0,90deg ref ue too
  const uewi = new Float64Array(Nw)
  const uewiref = new Float64Array(2 * Nw)
  const g0 = M.isol.gamref.filter((_, k) => k % 2 === 0)
  const g90 = M.isol.gamref.filter((_, k) => k % 2 === 1)
  for (let i = 0; i < Nw; i++) {
    const dot = (v: Float64Array) => v[0] * tw[i] + v[1] * tw[Nw + i]
    uewi[i] = dot(vel(M.isol.gam, Vinf, M.oper.alpha, i))
    uewiref[2 * i] = dot(vel(g0, Vinf, 0, i))
    uewiref[2 * i + 1] = dot(vel(g90, Vinf, 90, i))
  }

  M.wake.N = Nw
  M.wake.x = xyw
  M.wake.s = sw
  M.wake.t = tw
  M.isol.uewi = uewi
  M.isol.uewiref = uewiref
}

export function stagpoint_find(M: Mfoil): void {
  if (!(M.isol.gam.length > 0))
    throw new Error('No inviscid solution')
  const N = M.foil.N
  let j = 0
  while (j < N - 1 && !(M.isol.gam[j] > 0)) j++ // for j in range(N): if gam[j] > 0: break
  // j = 0 would make Python index gam[-1]; mfoil never meant that
  if (!(j < N - 1) || j === 0)
    throw new Error('no stagnation point')
  const G = [M.isol.gam[j - 1], M.isol.gam[j]]
  const S = [M.foil.s[j - 1], M.foil.s[j]]
  M.isol.Istag = Int32Array.of(j - 1, j)
  const den = G[1] - G[0]
  const w1 = G[1] / den
  const w2 = -G[0] / den
  M.isol.sstag = w1 * S[0] + w2 * S[1]
  const X = M.foil.x
  M.isol.xstag = Float64Array.of(X[j - 1] * w1 + X[j] * w2, X[N + j - 1] * w1 + X[N + j] * w2)
  const st_g1 = G[1] * (S[0] - S[1]) / (den * den)
  M.isol.sstag_g = Float64Array.of(st_g1, -st_g1)
  M.isol.sgnue = new Float64Array(N).map((_, i) => i >= j ? 1 : -1)
  const xi = new Float64Array(N + M.wake.N)
  for (let i = 0; i < N; i++) xi[i] = Math.abs(M.foil.s[i] - M.isol.sstag)
  for (let i = 0; i < M.wake.N; i++) xi[N + i] = M.wake.s[i] - M.isol.sstag
  M.isol.xi = xi
}

// ============ VISCOUS SETUP ==============

export function calc_ue_m(M: Mfoil): void {
  if (!(M.isol.gam.length > 0))
    throw new Error('No inviscid solution')
  const N = M.foil.N
  const Nw = M.wake.N
  if (!(Nw > 0))
    throw new Error('No wake')
  const X = M.foil.x
  const W = M.wake.x
  const WT = M.wake.t
  const P = N + Nw - 2 // number of panels (sources)

  // Cgam = d(wake uei)/d(gamma) [Nw, N]
  const Cgam = new Float64Array(Nw * N)
  for (let i = 0; i < Nw; i++) {
    const V_G = inviscid_velocity(X, M.isol.gam, 0, 0, [W[i], W[Nw + i]], true)[1]!
    for (let k = 0; k < N; k++) Cgam[i * N + k] = V_G[k] * WT[i] + V_G[N + k] * WT[Nw + i]
  }

  // B = d(airfoil surf streamfunction)/d(source) [N+1, P]
  const B = new Float64Array((N + 1) * P)
  for (let i = 0; i < N; i++) {
    const xi = [X[i], X[N + i]]
    const r = i * P
    for (let j = 0; j < N - 1; j++) B[r + j] = panel_constsource_stream(cols(X, N, j, j + 1), xi)
    for (let j = 0; j < Nw - 1; j++) {
      // left, mid, right coords on wake panel j: [x0, xm, x2, z0, zm, z2]
      const Xj = Float64Array.of(W[j], 0.5 * (W[j] + W[j + 1]), W[j + 1], W[Nw + j], 0.5 * (W[Nw + j] + W[Nw + j + 1]), W[Nw + j + 1])
      if (j === Nw - 2) { // ghost extension at last point
        Xj[2] = 2 * Xj[2] - Xj[1]
        Xj[5] = 2 * Xj[5] - Xj[4]
      }
      let [a, b] = panel_linsource_stream(cols(Xj, 3, 0, 1), xi) // left half panel
      if (j > 0) {
        B[r + N - 1 + j] += 0.5 * a + b
        B[r + N - 1 + j - 1] += 0.5 * a
      }
      else {
        B[r + N - 1 + j] += b
      }
      [a, b] = panel_linsource_stream(cols(Xj, 3, 1, 2), xi) // right half panel
      B[r + N - 1 + j] += a + 0.5 * b
      if (j < Nw - 2)
        B[r + N - 1 + j + 1] += 0.5 * b
      else
        B[r + N - 1 + j] += 0.5 * b
    }
  }

  // Bp = -inv(AIC) * B [N, P] = d(airfoil gamma)/d(source); last row of the solve dropped
  const Bp = luSolve(M.isol.AIC_lu!, B, P).subarray(0, N * P).map(v => -v)

  // Csig = d(wake uei)/d(source) [Nw, P]
  const Csig = new Float64Array(Nw * P)
  const c = 0.5 / Math.PI
  for (let i = 0; i < Nw; i++) {
    const xi = [W[i], W[Nw + i]]
    const ti = [WT[i], WT[Nw + i]]
    const r = i * P
    // first/last airfoil panel effects on i=0 wake point handled separately
    const jstart = i === 0 ? 1 : 0
    const jend = i === 0 ? N - 2 : N - 1
    for (let j = jstart; j < jend; j++) Csig[r + j] = panel_constsource_velocity(cols(X, N, j, j + 1), xi, ti)

    // piecewise linear sources across wake panel halves (else singular)
    for (let j = 0; j < Nw; j++) {
      const I = [Math.max(j - 1, 0), j, Math.min(j + 1, Nw - 1)] // left, self, right
      const Xj = Float64Array.of(W[I[0]], W[I[1]], W[I[2]], W[Nw + I[0]], W[Nw + I[1]], W[Nw + I[2]])
      for (const o of [0, 3]) {
        Xj[o] = 0.5 * (Xj[o] + Xj[o + 1]) // left midpoint
        Xj[o + 2] = 0.5 * (Xj[o + 1] + Xj[o + 2]) // right midpoint
        if (j === Nw - 1)
          Xj[o + 2] = 2 * Xj[o + 1] - Xj[o] // ghost extension at last point
      }
      const d1 = norm2([Xj[1] - Xj[0], Xj[4] - Xj[3]]) // left half-panel length
      const d2 = norm2([Xj[2] - Xj[1], Xj[5] - Xj[4]]) // right half-panel length
      if (i === j) {
        if (j === 0) { // first point: special TE system (three panels meet)
          const dl = norm2([X[1] - X[0], X[N + 1] - X[N]]) // lower surface panel length
          const du = norm2([X[N - 1] - X[N - 2], X[2 * N - 1] - X[2 * N - 2]]) // upper surface panel length
          Csig[r] += c * (Math.log(dl / d2) + 1)
          Csig[r + N - 2] += c * (Math.log(du / d2) + 1)
          Csig[r + N - 1] += -c
        }
        else if (j < Nw - 1) { // last point: no self effect of last panel (ghost extension)
          const aa = (0.25 / Math.PI) * Math.log(d1 / d2)
          Csig[r + N - 1 + j - 1] += aa + c
          Csig[r + N - 1 + j] += aa - c
        }
      }
      else if (j === 0) { // first point only has a half panel on the right
        const [a, b] = panel_linsource_velocity(cols(Xj, 3, 1, 2), xi, ti)
        Csig[r + N - 1] += b // right half panel effect
        Csig[r] += a // lower airfoil panel effect
        Csig[r + N - 2] += a // upper airfoil panel effect
      }
      else if (j === Nw - 1) { // last point has a constant source ghost extension
        Csig[r + N + Nw - 3] += panel_constsource_velocity(cols(Xj, 3, 0, 2), xi, ti)
      }
      else { // half panel on left and right
        const [a1, b1] = panel_linsource_velocity(cols(Xj, 3, 0, 1), xi, ti)
        const [a2, b2] = panel_linsource_velocity(cols(Xj, 3, 1, 2), xi, ti)
        Csig[r + N - 1 + j - 1] += a1 + 0.5 * b1
        Csig[r + N - 1 + j] += 0.5 * a2 + b2
      }
    }
  }

  // ue_sigma = [Bp; Dw] [N+Nw, P], Dw = Cgam*Bp + Csig with first row = TE ue row of Bp
  const ue_sigma = new Float64Array((N + Nw) * P)
  ue_sigma.set(Bp)
  for (let i = 0; i < Nw; i++) {
    const row = ue_sigma.subarray((N + i) * P, (N + i + 1) * P)
    if (i === 0) {
      row.set(Bp.subarray((N - 1) * P))
      continue
    }
    for (let k = 0; k < N; k++) {
      const g = Cgam[i * N + k]
      for (let q = 0; q < P; q++) row[q] += g * Bp[k * P + q]
    }
    for (let q = 0; q < P; q++) row[q] += Csig[i * P + q]
  }
  M.vsol.ue_sigma = ue_sigma

  rebuild_ue_m(M)
}

// sigma_m is stored dense [N+Nw-2, N+Nw] (two nonzeros per row). Cost: O((N+Nw)^2) to fill
// plus O((N+Nw)^2 * 2) for ue_m = diag(sgue) ue_sigma sigma_m, using the two nonzeros per row.
export function rebuild_ue_m(M: Mfoil): void {
  if (!(M.vsol.ue_sigma.length > 0))
    throw new Error('Need ue_sigma to build ue_m')
  const N = M.foil.N
  const Nw = M.wake.N
  const P = N + Nw - 2
  const Ns = N + Nw
  if (M.vsol.sigma_m.length !== P * Ns)
    M.vsol.sigma_m = new Float64Array(P * Ns)
  const sm = M.vsol.sigma_m.fill(0)
  // column pair [c, c+1] of each row's two nonzeros, and their values
  const c0 = new Int32Array(P)
  for (let i = 0; i < N - 1; i++) {
    const ds = M.foil.s[i + 1] - M.foil.s[i]
    // at stagnation: ue = K*s, dstar = const, m = K*s*dstar, sigma = dm/ds = m/s (separate for each side)
    c0[i] = i
    sm[i * Ns + i] = M.isol.sgnue[i] * -1 / ds
    sm[i * Ns + i + 1] = M.isol.sgnue[i + 1] * 1 / ds
  }
  for (let i = 0; i < Nw - 1; i++) {
    const ds = M.wake.s[i + 1] - M.wake.s[i]
    const r = N - 1 + i
    c0[r] = N + i
    sm[r * Ns + N + i] = -1 / ds
    sm[r * Ns + N + i + 1] = 1 / ds
  }

  // ue_m = diag(sgue) * ue_sigma * sigma_m [N+Nw, N+Nw]
  const us = M.vsol.ue_sigma
  const ue_m = new Float64Array(Ns * Ns)
  for (let i = 0; i < Ns; i++) {
    const sg = i < N ? M.isol.sgnue[i] : 1
    for (let r = 0; r < P; r++) {
      const v = sg * us[i * P + r]
      const c = c0[r]
      ue_m[i * Ns + c] += v * sm[r * Ns + c]
      ue_m[i * Ns + c + 1] += v * sm[r * Ns + c + 1]
    }
  }
  M.vsol.ue_m = ue_m
}

export function init_thermo(M: Mfoil): void {
  const p = M.param
  const g = p.gam
  const gmi = g - 1
  const rhoinf = M.oper.rho
  const Vinf = M.oper.Vinf
  p.Vinf = Vinf
  p.muinf = rhoinf * Vinf * M.geom.chord / M.oper.Re
  const Minf = M.oper.Ma
  p.Minf = Minf
  let finf = 1 // incompressible case
  if (Minf > 0) {
    p.KTb = Math.sqrt(1 - Minf ** 2) // Karman-Tsien beta
    p.KTl = Minf ** 2 / (1 + p.KTb) ** 2 // Karman-Tsien lambda
    p.H0 = (1 + 0.5 * gmi * Minf ** 2) * Vinf ** 2 / (gmi * Minf ** 2) // stagnation enthalpy
    const Tr = 1 - 0.5 * Vinf ** 2 / p.H0 // freestream/stagnation temperature ratio
    finf = Tr ** 1.5 * (1 + p.Tsrat) / (Tr + p.Tsrat) // Sutherland's ratio
    p.cps = 2 / (g * Minf ** 2) * (((1 + 0.5 * gmi * Minf ** 2) / (1 + 0.5 * gmi)) ** (g / gmi) - 1)
  }
  p.mu0 = p.muinf / finf
  p.rho0 = rhoinf * (1 + 0.5 * gmi * Minf ** 2) ** (1 / gmi)
}

const range = (a: number, b: number, step = 1) => Int32Array.from({ length: Math.max(0, Math.ceil((b - a) / step)) }, (_, k) => a + k * step)

export function identify_surfaces(M: Mfoil): void {
  M.vsol.Is = [
    range(M.isol.Istag[0], -1, -1),
    range(M.isol.Istag[1], M.foil.N),
    range(M.foil.N, M.foil.N + M.wake.N),
  ]
}

export function set_wake_gap(M: Mfoil): void {
  let [, hTE, dtdx] = TE_info(M.foil.x)
  const flen = 2.5 // length-scale factor
  dtdx = Math.min(Math.max(dtdx, -3 / flen), 3 / flen) // clip TE thickness slope
  const Lw = flen * hTE
  const wgap = new Float64Array(M.wake.N)
  for (let i = 0; i < M.wake.N; i++) {
    const xib = (M.isol.xi[M.foil.N + i] - M.isol.xi[M.foil.N]) / Lw // NaN/Inf for a sharp TE -> 0 gap
    if (xib <= 1)
      wgap[i] = hTE * (1 + (2 + flen * dtdx) * xib) * (1 - xib) ** 2
  }
  M.vsol.wgap = wgap
}
