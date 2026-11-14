// Port of the viscous (coupled boundary-layer) solve of mfoil.py (backend/mfoil.py, MIT licence,
// Copyright (C) 2023 Krzysztof J. Fidkowski; full notice in geometry.ts). Same function names and
// order as the Python; conventions in types.ts. Alpha is always prescribed: the cl-target path
// (givencl, clalpha_residual, dalpha, rebuild_isol) is not ported.
//
// Global Jacobians are dense, row-major Float64Arrays (scipy sparse in the Python):
//   glob.R_U [3*Nsys, 4*Nsys]: row 3*j + r is BL equation r (0..2) of node j; column 4*j + k is
//     state k (th, ds, sa, ue) of node j. This matches glob.U's global ordering in solve_glob.
//   glob.R_x [3*Nsys, Nsys]: d(R)/d(xi) at each node.
//   glob.R_V [4*Nsys, 4*Nsys]: the augmented system of solve_glob; rows 0..3*Nsys-1 are R_U, row
//     3*Nsys + i is the ue equation of node i. Same column ordering.
// The 3-row block of node j only has nonzeros in the column blocks of the nodes its residual reads
// (previous and current node on its surface, the stagnation pair, the two TE nodes for the first
// wake node) plus the ue columns of the stagnation pair (the R_x * x_st * st_ue chain rule); the
// sparsity test in tests/mfoil/viscous.test.ts pins this down, and solve_V's block elimination
// relies on it (it checks, and solve_glob falls back to the dense LU).

import type { Mfoil, Param } from './types.ts'
import { get_Hk, get_Ret, get_cf, get_cttr, get_damp, get_uk, upwind } from './closures.ts'
import { TE_info } from './geometry.ts'
import { build_param, build_wake, calc_force, calc_ue_m, get_ueinv, identify_surfaces, init_thermo, rebuild_ue_m, set_wake_gap, solve_inviscid, stagpoint_find, station_param } from './inviscid.ts'
import { luFactor, luSolve, norm2, solve } from './linalg.ts'
import { residual_station, residual_transition, stagnation_state, thwaites_init } from './residuals.ts'

type Vec = Float64Array

// state of node j from glob.U [4, Nsys] (a copy)
function ucol(M: Mfoil, j: number): Vec {
  const n = M.glob.Nsys
  const U = M.glob.U
  return Float64Array.of(U[j], U[n + j], U[2 * n + j], U[3 * n + j])
}

function setcol(M: Mfoil, j: number, u: Vec): void {
  const n = M.glob.Nsys
  for (let k = 0; k < 4; k++) M.glob.U[k * n + j] = u[k]
}

// two station states -> [4, 2] row-major, as np.stack((U1, U2), axis=-1)
const stack = (a: Vec, b: Vec): Vec => Float64Array.of(a[0], b[0], a[1], b[1], a[2], b[2], a[3], b[3])

// ============ VISCOUS FUNCTIONS ==============

// moves the LE stagnation point on the airfoil using the global solution ue
export function stagpoint_move(M: Mfoil): void {
  const N = M.foil.N
  const I = M.isol.Istag // modified in place, as the Python's alias
  const ue = M.glob.U.subarray(3 * M.glob.Nsys, 4 * M.glob.Nsys) // view, sign flips land in U

  let newpanel = true
  if (ue[I[1]] < 0) {
    // move stagnation point up (larger s, new panel)
    let j = I[1]
    while (j < N - 1 && !(ue[j] > 0)) j++ // Python for/break: j = N-1 without a break
    const I1 = j
    for (let k = I[1]; k < I1; k++) ue[k] *= -1
    I[0] = I1 - 1
    I[1] = I1
  }
  else if (ue[I[0]] < 0) {
    // move stagnation point down (smaller s, new panel)
    let j = I[0]
    while (j > 0 && !(ue[j] > 0)) j--
    if (!(j > 0))
      throw new Error('no stagnation point')
    const I0 = j
    for (let k = I0 + 1; k <= I[0]; k++) ue[k] *= -1
    I[0] = I0
    I[1] = I0 + 1
  }
  else {
    newpanel = false
  }

  // move point along panel
  const ues = [ue[I[0]], ue[I[1]]]
  const S = [M.foil.s[I[0]], M.foil.s[I[1]]]
  if (!(ues[0] > 0 && ues[1] > 0))
    throw new Error('stagpoint_move: velocity error')
  const den = ues[0] + ues[1]
  const w1 = ues[1] / den
  const w2 = ues[0] / den
  M.isol.sstag = w1 * S[0] + w2 * S[1]
  const X = M.foil.x
  M.isol.xstag = Float64Array.of(X[I[0]] * w1 + X[I[1]] * w2, X[N + I[0]] * w1 + X[N + I[1]] * w2)
  M.isol.sstag_ue = Float64Array.of(ues[1] * (S[1] - S[0]) / (den * den), -ues[0] * (S[1] - S[0]) / (den * den))

  // new xi coordinates for every point
  const xi = new Float64Array(N + M.wake.N)
  for (let i = 0; i < N; i++) xi[i] = Math.abs(M.foil.s[i] - M.isol.sstag)
  for (let i = 0; i < M.wake.N; i++) xi[N + i] = M.wake.s[i] - M.isol.sstag
  M.isol.xi = xi

  // matrices need to be recalculated if on a new panel
  if (newpanel) {
    for (let i = 0; i < N; i++) M.isol.sgnue[i] = i <= I[0] ? -1 : 1
    identify_surfaces(M)
    rebuild_ue_m(M)
  }
}

// solves the viscous system (BL + outer flow concurrently); returns solve_coupled's residual history
export function solve_viscous(M: Mfoil): number[] {
  solve_inviscid(M)
  M.oper.viscous = true
  init_thermo(M)
  build_wake(M)
  stagpoint_find(M) // from the inviscid solution
  identify_surfaces(M)
  set_wake_gap(M) // blunt TE dead air extent in wake
  calc_ue_m(M)
  init_boundary_layer(M) // initialize boundary layer from ue
  stagpoint_move(M) // move stag point, using viscous solution
  const hist = solve_coupled(M)
  calc_force(M)
  get_distributions(M)
  return hist
}

// Newton solve of the coupled system; returns the residual norm of every iteration.
// The Python's per-iteration calc_force is dropped: it only feeds the cl-target mode.
export function solve_coupled(M: Mfoil): number[] {
  const hist: number[] = []
  M.glob.conv = false
  for (let iNewton = 0; iNewton < M.param.niglob; iNewton++) {
    build_glob_sys(M)
    const Rnorm = norm2(M.glob.R)
    hist.push(Rnorm)
    if (Rnorm < M.param.rtol) {
      M.glob.conv = true
      break
    }
    solve_glob(M)
    update_state(M)
    stagpoint_move(M) // Newton still OK; had R_x effects in R_U
    update_transition(M)
  }
  return hist
}

// U += omega*dU, with omega limiting big or unphysical changes; then fixes bad Hk and negative ctau
export function update_state(M: Mfoil): void {
  const n = M.glob.Nsys
  const U = M.glob.U
  const dU = M.glob.dU
  const turb = M.vsol.turb

  // max ctau
  const It: number[] = []
  for (let i = 0; i < n; i++) {
    if (turb[i])
      It.push(i)
  }
  let ctmax = -Infinity
  for (const i of It) ctmax = Math.max(ctmax, U[2 * n + i])

  let omega = 1.0

  // first limit theta and delta*: prevent big decreases
  for (let k = 0; k < 2; k++) {
    let fmin = Infinity
    for (let i = 0; i < n; i++) fmin = Math.min(fmin, dU[k * n + i] / U[k * n + i])
    const om = fmin < -0.5 ? Math.abs(0.5 / fmin) : 1
    if (om < omega)
      omega = om
  }

  // limit negative amp/ctau
  const o2 = 2 * n
  for (let i = 0; i < n; i++) {
    const u = U[o2 + i]
    const du = dU[o2 + i]
    if (!turb[i] && u < 0.2)
      continue // do not limit very small amp (too restrictive)
    if (turb[i] && u < 0.1 * ctmax)
      continue // do not limit small ctau
    if (u === 0 || du === 0)
      continue
    if (u + du < 0) {
      const om = 0.8 * Math.abs(u / du)
      if (om < omega)
        omega = om
    }
  }

  // prevent big changes in amp, and in ctau
  let dlam = 0
  let dturb = 0
  for (let i = 0; i < n; i++) {
    if (turb[i])
      dturb = Math.max(dturb, Math.abs(dU[o2 + i]))
    else
      dlam = Math.max(dlam, Math.abs(dU[o2 + i]))
  }
  let om = dlam > 0 ? Math.abs(2 / dlam) : 1
  if (om < omega)
    omega = om
  om = dturb > 0 ? Math.abs(0.05 / dturb) : 1
  if (om < omega)
    omega = om

  // prevent large ue changes
  let fmax = 0
  for (let i = 0; i < n; i++) fmax = Math.max(fmax, Math.abs(dU[3 * n + i]) / M.oper.Vinf)
  om = fmax > 0 ? 0.2 / fmax : 1
  if (om < omega)
    omega = om

  // take the update
  for (let i = 0; i < 4 * n; i++) U[i] += omega * dU[i]

  // fix bad Hk after the update
  for (let si = 0; si < 3; si++) {
    const Hkmin = si === 2 ? 1.00005 : 1.02
    const param = build_param(M, si)
    for (const j of M.vsol.Is[si]) {
      station_param(M, param, j)
      const [Hk] = get_Hk(ucol(M, j), param)
      if (Hk < Hkmin)
        U[n + j] += 2 * (Hkmin - Hk) * U[n + j]
    }
  }

  // fix negative ctau after the update
  for (const i of It) {
    if (U[o2 + i] < 0)
      U[o2 + i] = 0.1 * ctmax
  }
}

// solves the augmented global system (fourth residual = ue equation) for M.glob.dU
export function solve_glob(M: Mfoil): void {
  const n = M.glob.Nsys
  const U = M.glob.U
  const ue = U.subarray(3 * n, 4 * n) // view: clamped in place, as in the Python
  const ds = U.subarray(n, 2 * n)
  let uemax = 0
  for (let i = 0; i < n; i++) uemax = Math.max(uemax, Math.abs(ue[i]))
  for (let i = 0; i < n; i++) ue[i] = Math.max(ue[i], 1e-10 * uemax) // avoid 0/negative ue

  const ueinv = get_ueinv(M)
  const NN = 4 * n
  const R = new Float64Array(NN)
  R.set(M.glob.R)
  const m = new Float64Array(n) // mass defect ds*ue
  for (let j = 0; j < n; j++) m[j] = ds[j] * ue[j]

  // R_V rows 0..3n-1 are R_U (same layout); row 3n+i is the ue equation of node i
  if (M.glob.R_V.length !== NN * NN)
    M.glob.R_V = new Float64Array(NN * NN)
  const RV = M.glob.R_V
  RV.set(M.glob.R_U)
  const ue_m = M.vsol.ue_m
  for (let i = 0; i < n; i++) {
    const r = (3 * n + i) * NN
    let s = 0
    for (let j = 0; j < n; j++) {
      const a = ue_m[i * n + j]
      s += a * m[j]
      RV[r + 4 * j] = 0
      RV[r + 4 * j + 1] = -a * ue[j]
      RV[r + 4 * j + 2] = 0
      RV[r + 4 * j + 3] = -a * ds[j]
    }
    RV[r + 4 * i + 3] += 1
    R[3 * n + i] = ue[i] - (ueinv[i] + s)
  }

  let dV: Vec
  try {
    dV = solve_V(M, RV, R)
  }
  catch {
    dV = luSolve(luFactor(RV, NN), R) // dense LU of [4n, 4n], ~40x the flops
  }

  // dU [4, n] from dV ordered by node (Python reshape order='F')
  const dU = new Float64Array(NN)
  for (let j = 0; j < n; j++) for (let k = 0; k < 4; k++) dU[k * n + j] = -dV[4 * j + k]
  M.glob.dU = dU
}

// Solves R_V dV = R (R_V as built in solve_glob) by block elimination. With z = (th, ds, sa) and
// u = ue: [A B; C D] [dz; du] = [r; s]. A (BL rows, z columns) is block lower-triangular when the
// stations are marched as in M.vsol.Is, and B is sparse, so Y = C A^-1 (a backward march) and the
// Schur complement S = D - Y B cost O(n^2); the n x n LU of S is the only O(n^3) step, (2/3)n^3
// flops against ~43n^3 for the dense LU of R_V. Then du = S^-1 (s - Y r) and dz = A^-1 (r - B du).
// Throws (solve_glob then uses the dense LU) if a BL row reads a z column of a station marched
// after it, a station block is singular, or the iterative refinement below does not converge.
export function solve_V(M: Mfoil, RV: Vec, R: Vec): Vec {
  const n = M.glob.Nsys
  const NN = 4 * n
  // march order: the first 3 stations of each airfoil surface are solved together (similarity
  // pair, or the node-on-stagnation triple); every other station alone, after its upstream nodes
  const groups: number[][] = []
  for (let si = 0; si < 3; si++) {
    const Is = M.vsol.Is[si]
    const g0 = si < 2 ? Math.min(3, Is.length) : 1
    groups.push(Array.from(Is.subarray(0, g0)))
    for (let i = g0; i < Is.length; i++) groups.push([Is[i]])
  }
  const rank = new Int32Array(n).fill(-1) // group of each node
  groups.forEach((g, ig) => g.forEach(j => (rank[j] = ig)))
  if (rank.includes(-1))
    throw new Error('solve_V: M.vsol.Is does not cover every node')

  // LU of each diagonal block of A and of its transpose
  const lu = groups.map((g) => {
    const m = 3 * g.length
    const A = new Float64Array(m * m)
    const At = new Float64Array(m * m)
    for (let a = 0; a < m; a++) {
      for (let b = 0; b < m; b++)
        A[a * m + b] = At[b * m + a] = RV[(3 * g[Math.floor(a / 3)] + a % 3) * NN + 4 * g[Math.floor(b / 3)] + b % 3]
    }
    return [luFactor(A, m), luFactor(At, m)]
  })

  // nonzeros as flat (row q, column, value) triples: of B (column = ue node), and of A outside its
  // diagonal blocks (column p = 3*node + k), listed by the group of the row and of the column
  const Bnz: number[] = []
  const byRow: number[][] = groups.map(() => [])
  const byCol: number[][] = groups.map(() => [])
  for (let q = 0; q < 3 * n; q++) {
    const gq = rank[Math.floor(q / 3)]
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < 4; k++) {
        const v = RV[q * NN + 4 * j + k]
        if (v === 0)
          continue
        if (k === 3) {
          Bnz.push(q, j, v)
        }
        else if (rank[j] !== gq) {
          if (rank[j] > gq)
            throw new Error('solve_V: BL row reads a station marched after it')
          byRow[gq].push(q, 3 * j + k, v)
          byCol[rank[j]].push(q, 3 * j + k, v)
        }
      }
    }
  }

  // backward march for Z = Y^T [3n, n], from C^T: A_gg^T Y_g^T = C_g^T - sum (A_hg^T Y_h^T, h downstream)
  const Z = new Float64Array(3 * n * n)
  for (let i = 0; i < n; i++) for (let p = 0; p < 3 * n; p++) Z[p * n + i] = RV[(3 * n + i) * NN + 4 * Math.floor(p / 3) + p % 3]
  for (let ig = groups.length - 1; ig >= 0; ig--) {
    const e = byCol[ig]
    for (let t = 0; t < e.length; t += 3) {
      const q = e[t] * n
      const p = e[t + 1] * n
      const v = e[t + 2]
      for (let i = 0; i < n; i++) Z[p + i] -= v * Z[q + i]
    }
    const g = groups[ig]
    const T = new Float64Array(3 * g.length * n)
    g.forEach((j, a) => T.set(Z.subarray(3 * j * n, (3 * j + 3) * n), 3 * a * n))
    const Yg = luSolve(lu[ig][1], T, n)
    g.forEach((j, a) => Z.set(Yg.subarray(3 * a * n, (3 * a + 3) * n), 3 * j * n))
  }

  // Schur complement S = D - Y B (built transposed: row c of St is ue column c)
  const St = new Float64Array(n * n)
  for (let i = 0; i < n; i++) for (let c = 0; c < n; c++) St[c * n + i] = RV[(3 * n + i) * NN + 4 * c + 3]
  for (let t = 0; t < Bnz.length; t += 3) {
    const q = Bnz[t] * n
    const c = Bnz[t + 1] * n
    const v = Bnz[t + 2]
    for (let i = 0; i < n; i++) St[c + i] -= v * Z[q + i]
  }
  const S = new Float64Array(n * n)
  for (let i = 0; i < n; i++) for (let c = 0; c < n; c++) S[i * n + c] = St[c * n + i]
  const Slu = luFactor(S, n)

  // solution for a right-hand side [r; s], all O(n^2)
  const apply = (b: Vec): Vec => {
    const sr = b.slice(3 * n) // s - Y r
    for (let q = 0; q < 3 * n; q++) for (let i = 0; i < n; i++) sr[i] -= Z[q * n + i] * b[q]
    const du = luSolve(Slu, sr)
    // forward march for dz = A^-1 (r - B du)
    const rb = b.slice(0, 3 * n)
    for (let t = 0; t < Bnz.length; t += 3) rb[Bnz[t]] -= Bnz[t + 2] * du[Bnz[t + 1]]
    const dz = new Float64Array(3 * n)
    groups.forEach((g, ig) => {
      const e = byRow[ig]
      for (let t = 0; t < e.length; t += 3) rb[e[t]] -= e[t + 2] * dz[e[t + 1]]
      const T = new Float64Array(3 * g.length)
      g.forEach((j, a) => T.set(rb.subarray(3 * j, 3 * j + 3), 3 * a))
      const x = luSolve(lu[ig][0], T)
      g.forEach((j, a) => dz.set(x.subarray(3 * a, 3 * a + 3), 3 * j))
    })
    const x = new Float64Array(NN)
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < 3; k++) x[4 * j + k] = dz[3 * j + k]
      x[4 * j + 3] = du[j]
    }
    return x
  }

  // Iterative refinement against the full R_V. Eliminating (th, ds, sa) at fixed ue is XFOIL's direct
  // mode, near-singular close to separation: the first solution can have a backward error of 1e-6
  // where the dense LU has 1e-15 (naca2412_a4_M03); each refinement step squares that.
  const Rmax = R.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  const dV = apply(R)
  for (let it = 0; ; it++) {
    const r = new Float64Array(NN)
    let rmax = 0
    for (let i = 0; i < NN; i++) {
      const row = RV.subarray(i * NN, (i + 1) * NN)
      let v = R[i]
      for (let j = 0; j < NN; j++) v -= row[j] * dV[j]
      r[i] = v
      rmax = Math.max(rmax, Math.abs(v))
    }
    if (rmax <= 1e-13 * Rmax)
      return dV
    if (it === 3)
      throw new Error('solve_V: iterative refinement did not converge')
    const d = apply(r)
    for (let i = 0; i < NN; i++) dV[i] += d[i]
  }
}

// builds the global residual M.glob.R and its linearizations M.glob.R_U, M.glob.R_x (dense)
export function build_glob_sys(M: Mfoil): void {
  const Nsys = M.glob.Nsys
  const W = 4 * Nsys // R_U row width
  M.glob.R = new Float64Array(3 * Nsys)
  if (M.glob.R_U.length !== 3 * Nsys * W)
    M.glob.R_U = new Float64Array(3 * Nsys * W)
  if (M.glob.R_x.length !== 3 * Nsys * Nsys)
    M.glob.R_x = new Float64Array(3 * Nsys * Nsys)
  const R = M.glob.R
  const R_U = M.glob.R_U.fill(0)
  const R_x = M.glob.R_x.fill(0)
  // R_U[3*row + r, 4*col + k] += A[r, a0 + k] for a [3, ac] block A
  const addU = (row: number, col: number, A: Vec, ac: number, a0: number, sgn = 1) => {
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) R_U[(3 * row + r) * W + 4 * col + k] += sgn * A[r * ac + a0 + k]
  }

  for (let si = 0; si < 3; si++) {
    const Is = M.vsol.Is[si]
    const N = Is.length
    const xi = Float64Array.from(Is, j => M.isol.xi[j])
    const Ucol = (i: number) => ucol(M, Is[i]) // glob.U is not changed while building
    const Aux = si === 2 ? M.vsol.wgap : new Float64Array(N)
    const param = build_param(M, si)

    // special case of tiny first xi -- will set to stagnation state later
    const i0 = (si < 2 && xi[0] < 1e-8 * xi[N - 1]) ? 1 : 0

    let R1: Vec
    let R1_U: Vec // [3, 4*len(J)]
    let R1_x: Vec | null = null // [3, 2]
    let J: number[]
    if (si < 2) {
      // stagnation state, a function of U1 and U2
      const [Ust, Ust_U, Ust_x, xst] = stagnation_state(stack(Ucol(i0), Ucol(i0 + 1)), Float64Array.of(xi[i0], xi[i0 + 1]))
      param.turb = false
      param.simi = true // similarity station flag
      const [Rs, R1_Ut] = residual_station(param, Float64Array.of(xst, xst), stack(Ust, Ust), Float64Array.of(Aux[i0], Aux[i0]))
      param.simi = false
      R1 = Rs
      R1_U = new Float64Array(24)
      R1_x = new Float64Array(6)
      for (let r = 0; r < 3; r++) {
        for (let k = 0; k < 4; k++) {
          const a = R1_Ut[r * 8 + k] + R1_Ut[r * 8 + 4 + k] // R1_Ust
          for (let c = 0; c < 8; c++) R1_U[r * 8 + c] += a * Ust_U[k * 8 + c]
          for (let c = 0; c < 2; c++) R1_x[r * 2 + c] += a * Ust_x[k * 2 + c]
        }
      }
      J = [Is[i0], Is[i0 + 1]]

      if (i0 === 1) {
        // i0=0 point landed right on stagnation: set value to Ust
        const g = 3 * Is[0]
        const U0 = Ucol(0)
        for (let r = 0; r < 3; r++) {
          R[g + r] = U0[r] - Ust[r]
          R_U[(g + r) * W + 4 * Is[0] + r] += 1
          R_x[(g + r) * Nsys + J[0]] = -Ust_x[r * 2]
          R_x[(g + r) * Nsys + J[1]] = -Ust_x[r * 2 + 1]
        }
        addU(Is[0], J[0], Ust_U, 8, 0, -1)
        addU(Is[0], J[1], Ust_U, 8, 4, -1)
      }
    }
    else {
      // wake initialization
      [R1, R1_U, J] = wake_sys(M, param)
      param.turb = true // force turbulent in wake if still laminar
      param.wake = true
    }

    // store first point system in global residual, Jacobian (the Python's 1e-15 lil-allocation hacks are dropped)
    const g1 = 3 * Is[i0]
    for (let r = 0; r < 3; r++) R[g1 + r] = R1[r]
    for (let j = 0; j < J.length; j++) {
      addU(Is[i0], J[j], R1_U, 4 * J.length, 4 * j)
      if (R1_x)
        for (let r = 0; r < 3; r++) R_x[(g1 + r) * Nsys + J[j]] += R1_x[r * 2 + j]
    }

    // march over rest of points
    for (let i = i0 + 1; i < N; i++) {
      const tran = (M.vsol.turb[Is[i - 1]] ^ M.vsol.turb[Is[i]]) !== 0 // transition flag
      const x2 = Float64Array.of(xi[i - 1], xi[i])
      const U2 = stack(Ucol(i - 1), Ucol(i))
      const A2 = Float64Array.of(Aux[i - 1], Aux[i])
      let Ri: Vec, Ri_U: Vec, Ri_x: Vec
      if (tran) {
        [Ri, Ri_U, Ri_x] = residual_transition(M, param, x2, U2, A2)
        store_transition(M, si, i)
      }
      else {
        [Ri, Ri_U, Ri_x] = residual_station(param, x2, U2, A2)
      }
      const g = 3 * Is[i]
      for (let r = 0; r < 3; r++) {
        R[g + r] += Ri[r]
        R_x[(g + r) * Nsys + Is[i - 1]] += Ri_x[r * 2]
        R_x[(g + r) * Nsys + Is[i]] += Ri_x[r * 2 + 1]
      }
      addU(Is[i], Is[i - 1], Ri_U, 8, 0)
      addU(Is[i], Is[i], Ri_U, 8, 4)
      if (tran)
        param.turb = true // following transition, all stations will be turbulent
    }
  }

  // include effects of R_x into R_U: R_ue += R_x*x_st*st_ue (ue moves the stagnation point, which moves xi)
  const N = M.foil.N
  const Ist = M.isol.Istag
  const st_ue = M.isol.sstag_ue
  for (let row = 0; row < 3 * Nsys; row++) {
    let R_st = 0
    for (let j = 0; j < Nsys; j++) R_st += R_x[row * Nsys + j] * (j < N ? -M.isol.sgnue[j] : -1) // wake same sens as upper surface
    R_U[row * W + 4 * Ist[0] + 3] += R_st * st_ue[0]
    R_U[row * W + 4 * Ist[1] + 3] += R_st * st_ue[1]
  }
}

// wake initialization residual: [R (3), R_U [3, 12] = blocks (lower TE, upper TE, first wake), J]
// Mutates param (turb = true, wake = false), as the Python.
export function wake_sys(M: Mfoil, param: Param): [Vec, Vec, number[]] {
  const Is = M.vsol.Is
  const il = Is[0][Is[0].length - 1]
  const Ul = ucol(M, il) // lower surface TE index, state
  const iu = Is[1][Is[1].length - 1]
  const Uu = ucol(M, iu) // upper surface TE index, state
  const iw = Is[2][0]
  const Uw = ucol(M, iw) // first wake index, state
  const hTE = TE_info(M.foil.x)[1] // trailing-edge gap

  // obtain wake shear stress from upper/lower; transition if not turb
  param.turb = true
  param.wake = false // calculating turbulent quantities right before wake
  const e2 = Float64Array.of(0, 0, 1, 0)
  const [ctl, ctl_Ul] = M.vsol.turb[il] ? [Ul[2], e2] : get_cttr(Ul, param)
  const [ctu, ctu_Uu] = M.vsol.turb[iu] ? [Uu[2], e2] : get_cttr(Uu, param)
  const thsum = Ul[0] + Uu[0]
  const ctw = (ctl * Ul[0] + ctu * Uu[0]) / thsum // theta-average
  const ctw_Ul = ctl_Ul.map((v, k) => (v * Ul[0] + (k === 0 ? ctl - ctw : 0)) / thsum)
  const ctw_Uu = ctu_Uu.map((v, k) => (v * Uu[0] + (k === 0 ? ctu - ctw : 0)) / thsum)

  // residual; note, delta star in wake includes the TE gap, hTE
  const R = Float64Array.of(Uw[0] - (Ul[0] + Uu[0]), Uw[1] - (Ul[1] + Uu[1] + hTE), Uw[2] - ctw)
  const R_U = new Float64Array(36)
  for (let r = 0; r < 2; r++) {
    R_U[r * 12 + r] = -1
    R_U[r * 12 + 4 + r] = -1
    R_U[r * 12 + 8 + r] = 1
  }
  for (let k = 0; k < 4; k++) {
    R_U[24 + k] = -ctw_Ul[k]
    R_U[24 + 4 + k] = -ctw_Uu[k]
  }
  R_U[24 + 8 + 2] = 1
  return [R, R_U, [il, iu, iw]]
}

// first wake state from the wake system; also written into M.glob.U (the Python works on a view)
export function wake_init(M: Mfoil, ue: number): Vec {
  const iw = M.vsol.Is[2][0]
  const Uw = ucol(M, iw)
  const [R] = wake_sys(M, M.param) // mutates M.param.turb/wake, as the Python
  for (let k = 0; k < 3; k++) Uw[k] -= R[k]
  Uw[3] = ue
  setcol(M, iw, Uw)
  return Uw
}

// initializes the BL on foil and wake by marching with the inviscid ue
export function init_boundary_layer(M: Mfoil): void {
  const Hmaxl = 3.8 // above this shape param value, laminar separation occurs
  const Hmaxt = 2.5 // above this shape param value, turbulent separation occurs
  const ueinv = get_ueinv(M)
  const Nsys = M.foil.N + M.wake.N
  M.glob.Nsys = Nsys

  // warm start: keep the current BL state and turb flags, only set the new edge velocity
  if (!M.oper.initbl && M.glob.U.length === 4 * Nsys) {
    M.glob.U.set(ueinv, 3 * Nsys)
    return
  }
  M.glob.U = new Float64Array(4 * Nsys)
  M.vsol.turb = new Int32Array(Nsys)

  for (let si = 0; si < 3; si++) {
    const Is = M.vsol.Is[si]
    const xi = Float64Array.from(Is, j => M.isol.xi[j])
    const ue = Float64Array.from(Is, j => ueinv[j])
    const N = Is.length
    const U = Array.from({ length: N }, () => new Float64Array(4)) // station states
    const Aux = si === 2 ? M.vsol.wgap : new Float64Array(N)

    // ensure edge velocities are not tiny
    let uemax = 0
    for (let i = 0; i < N; i++) uemax = Math.max(uemax, Math.abs(ue[i]))
    for (let i = 0; i < N; i++) ue[i] = Math.max(ue[i], 1e-8 * uemax)

    const param = build_param(M, si)

    // initialize state at first point
    let i0 = 0
    if (si < 2) {
      // solve for the stagnation state (Thwaites initialization + Newton)
      const hitstag = xi[0] < 1e-8 * xi[N - 1]
      const K = hitstag ? ue[1] / xi[1] : ue[0] / xi[0]
      const [th, ds] = thwaites_init(K, param.mu0 / param.rho0)
      const xst = 1e-6 // small but nonzero
      let Ust = Float64Array.of(th, ds, 0, K * xst)
      for (let iNewton = 0; iNewton < 20; iNewton++) {
        param.turb = false
        param.simi = true // similarity station flag
        const [R, R_U] = residual_station(param, Float64Array.of(xst, xst), stack(Ust, Ust), new Float64Array(2))
        param.simi = false
        if (norm2(R) < 1e-10)
          break
        const A = new Float64Array(9)
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) A[r * 3 + c] = R_U[r * 8 + 4 + c] + R_U[r * 8 + c]
        const dU = new Float64Array(4)
        dU.set(solve(A, R.map(v => -v), 3))
        // under-relaxation
        const dm = Math.max(Math.abs(dU[0] / Ust[0]), Math.abs(dU[1] / Ust[1]))
        const omega = dm < 0.2 ? 1 : 0.2 / dm
        Ust = Ust.map((v, k) => v + dU[k] * omega)
      }

      // store stagnation state in first one (rarely two) points
      if (hitstag) {
        U[0].set(Ust)
        U[0][3] = ue[0]
        i0 = 1
      }
      U[i0].set(Ust)
      U[i0][3] = ue[i0]
    }
    else { // wake
      U[0] = wake_init(M, ue[0]) // initialize wake state properly
      param.turb = true // force turbulent in wake if still laminar
      M.vsol.turb[Is[0]] = 1 // wake starts turbulent
    }

    // march over rest of points
    let tran = false // flag indicating that we are at transition
    let i = i0 + 1
    while (i < N) {
      const x2 = Float64Array.of(xi[i - 1], xi[i])
      const A2 = Float64Array.of(Aux[i - 1], Aux[i])
      U[i].set(U[i - 1])
      U[i][3] = ue[i] // guess = same state, new ue
      let ct = 0
      if (tran) { // set shear stress at transition interval
        ct = get_cttr(U[i], param)[0]
        U[i][2] = ct
      }
      M.vsol.turb[Is[i]] = (tran || param.turb) ? 1 : 0 // flag node i as turbulent
      let direct = true // default is direct mode
      const nNewton = 30
      const iNswitch = 12
      let Hktgt = 0
      let iNewton = 0
      for (; iNewton < nNewton; iNewton++) {
        // residual at this station
        let R: Vec, R_U: Vec
        if (tran) {
          try {
            [R, R_U] = residual_transition(M, param, x2, stack(U[i - 1], U[i]), A2)
          }
          catch {
            // transition calculation failed in BL init: continue (the Python sets R = 0, which breaks)
            M.vsol.xt = 0.5 * (xi[i - 1] + xi[i])
            U[i].set(U[i - 1])
            U[i][3] = ue[i]
            U[i][2] = ct
            break
          }
        }
        else {
          [R, R_U] = residual_station(param, x2, stack(U[i - 1], U[i]), A2)
        }
        if (norm2(R) < 1e-10)
          break

        let dU: Vec
        if (direct) { // ue is prescribed => solve for th, ds, sa
          const A = new Float64Array(9)
          for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) A[r * 3 + c] = R_U[r * 8 + 4 + c]
          dU = new Float64Array(4)
          dU.set(solve(A, R.map(v => -v), 3))
        }
        else { // inverse mode => Hk is prescribed
          const [Hk, Hk_U] = get_Hk(U[i], param)
          const A = new Float64Array(16)
          for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) A[r * 4 + c] = R_U[r * 8 + 4 + c]
          A.set(Hk_U, 12)
          dU = solve(A, Float64Array.of(-R[0], -R[1], -R[2], Hktgt - Hk), 4)
        }

        // under-relaxation
        const Up = U[i - 1]
        let dm = Math.max(Math.abs(dU[0] / Up[0]), Math.abs(dU[1] / Up[1]))
        if (!direct)
          dm = Math.max(dm, Math.abs(dU[3] / Up[3]))
        if (param.turb)
          dm = Math.max(dm, Math.abs(dU[2] / Up[2]))
        else if (direct)
          dm = Math.max(dm, Math.abs(dU[2] / 10))
        const omega = dm > 0.3 ? 0.3 / dm : 1

        // trial update
        const Ui = U[i].map((v, k) => v + dU[k] * omega)

        // clip extreme values
        if (param.turb)
          Ui[2] = Math.max(Math.min(Ui[2], 0.3), 1e-7)

        // check if about to separate
        const Hmax = param.turb ? Hmaxt : Hmaxl
        const [Hk] = get_Hk(Ui, param)

        if (direct && (Hk > Hmax || iNewton > iNswitch)) {
          // no update; need to switch to inverse mode: prescribe Hk
          direct = false
          const [Hkp] = get_Hk(Up, param)
          const Hkr = (xi[i] - xi[i - 1]) / Up[0]
          if (param.wake) {
            let H2 = Hkp
            for (let k = 0; k < 6; k++) H2 -= (H2 + 0.03 * Hkr * (H2 - 1) ** 3 - Hkp) / (1 + 0.09 * Hkr * (H2 - 1) ** 2)
            Hktgt = Math.max(H2, 1.01)
          }
          else if (param.turb) {
            Hktgt = Hkp - 0.15 * Hkr // turb: decrease in Hk
          }
          else {
            Hktgt = Hkp + 0.03 * Hkr // lam: increase in Hk
          }
          if (!param.wake)
            Hktgt = Math.max(Hktgt, Hmax)
          if (iNewton > iNswitch) { // reinit
            U[i].set(U[i - 1])
            U[i][3] = ue[i]
          }
        }
        else {
          U[i] = Ui // take the update
        }
      }

      // as the Python, this also fires when the last allowed iteration converged
      if (iNewton >= nNewton - 1) {
        // extrapolate values (the Python's else-branch for si >= 3 is unreachable)
        U[i].set(U[i - 1])
        U[i][3] = ue[i]
        U[i][0] = U[i - 1][0] * (xi[i] / xi[i - 1]) ** 0.5
        U[i][1] = U[i - 1][1] * (xi[i] / xi[i - 1]) ** 0.5
      }

      // check for transition
      if (!param.turb && !tran && U[i][2] > param.ncrit) {
        tran = true
        continue // redo station with transition
      }

      if (tran) {
        store_transition(M, si, i) // store transition location
        param.turb = true // turbulent after transition
        tran = false
      }

      i++
    }

    // store states
    for (let k = 0; k < N; k++) setcol(M, Is[k], U[k])
  }
}

// stores xi and x transition locations using current M.vsol.xt
export function store_transition(M: Mfoil, si: number, i: number): void {
  const xt = M.vsol.xt
  const i0 = M.vsol.Is[si][i - 1]
  const i1 = M.vsol.Is[si][i] // pre/post transition nodes
  const xi0 = M.isol.xi[i0]
  const xi1 = M.isol.xi[i1]
  if (!(i0 < M.foil.N && i1 < M.foil.N))
    throw new Error('Can only store transition on airfoil')
  const x0 = M.foil.x[i0]
  const x1 = M.foil.x[i1]
  // the Python warns (only) when xt lies outside [xi0, xi1]
  M.vsol.Xt[si * 2] = xt
  M.vsol.Xt[si * 2 + 1] = x0 + (xt - xi0) / (xi1 - xi0) * (x1 - x0)
}

// updates transition location (turb flags, and amp/ctau in U) using the current state
export function update_transition(M: Mfoil): void {
  const n = M.glob.Nsys
  const U = M.glob.U
  for (let si = 0; si < 2; si++) {
    const Is = M.vsol.Is[si]
    const N = Is.length
    const param = build_param(M, si)

    // current last laminar station (N-1 if all laminar, as the Python's for/break)
    let ilam0 = 0
    while (ilam0 < N - 1 && !M.vsol.turb[Is[ilam0]]) ilam0++
    if (M.vsol.turb[Is[ilam0]])
      ilam0--

    // current amp/ctau solution (so we do not change it unnecessarily)
    const sa = Float64Array.from(Is, j => U[2 * n + j])

    // march amplification equation to get new last laminar station
    const ilam = march_amplification(M, si)

    if (ilam === ilam0) {
      Is.forEach((j, k) => (U[2 * n + j] = sa[k])) // no change
      continue
    }

    if (ilam < ilam0) {
      // transition is now earlier: fill in turb between [ilam+1, ilam0]
      param.turb = true
      const [sa0] = get_cttr(ucol(M, Is[ilam + 1]), param)
      const sa1 = ilam0 < N - 1 ? U[2 * n + Is[ilam0 + 1]] : sa0
      const xi = Float64Array.from(Is, j => M.isol.xi[j])
      const dx = xi[Math.min(ilam0 + 1, N - 1)] - xi[ilam + 1]
      for (let i = ilam + 1; i <= ilam0; i++) {
        let f = (dx === 0 || i === ilam + 1) ? 0 : (xi[i] - xi[ilam + 1]) / dx
        if (ilam + 1 === ilam0)
          f = 1
        U[2 * n + Is[i]] = sa0 + f * (sa1 - sa0)
        if (!(U[2 * n + Is[i]] > 0))
          throw new Error('negative ctau in update_transition')
        M.vsol.turb[Is[i]] = 1
      }
    }
    else {
      // transition is now later: lam already filled in; leave turb alone
      // (ilam0 = -1 would make the Python touch Is[-1]; .at() keeps that)
      for (let i = ilam0; i <= ilam; i++) M.vsol.turb[Is.at(i)!] = 0
    }
  }
}

// marches the amplification equation on surface si; returns the last laminar station
// and stores the amplification of the (new) laminar stations in M.glob.U
export function march_amplification(M: Mfoil, si: number): number {
  const Is = M.vsol.Is[si]
  const N = Is.length
  const param = build_param(M, si)
  const U = Array.from(Is, j => ucol(M, j)) // a copy (fancy index in the Python)
  const turb = Int32Array.from(Is, j => M.vsol.turb[j])

  U[0][2] = 0 // no amplification at first station (in the copy only, as in the Python)
  param.turb = false
  param.wake = false
  let i = 1
  while (i < N) {
    const U1 = U[i - 1]
    const U2 = Float64Array.from(U[i])
    if (turb[i])
      U2[2] = U1[2] * 1.01 // initialize amp if turb
    const dx = M.isol.xi[Is[i]] - M.isol.xi[Is[i - 1]] // interval length

    // Newton iterations, only needed if adding extra amplification in damp
    const nNewton = 20
    for (let iNewton = 0; iNewton < nNewton; iNewton++) {
      // amplification rate, averaged
      const [damp1, damp1_U1] = get_damp(U1, param)
      const [damp2, damp2_U2] = get_damp(U2, param)
      const [damp, damp_U] = upwind(0.5, 0, damp1, damp1_U1, damp2, damp2_U2)
      const Ramp = U2[2] - U1[2] - damp * dx
      if (Math.abs(Ramp) < 1e-12)
        break // converged
      const Ramp_U6 = 1 - damp_U[6] * dx
      const dU = -Ramp / Ramp_U6
      const dmax = 0.5 * (1.01 - iNewton / nNewton)
      const omega = Math.abs(dU) > dmax ? dmax / Math.abs(dU) : 1
      U2[2] += omega * dU
    }

    // check for transition
    if (U2[2] > param.ncrit)
      break
    M.glob.U[2 * M.glob.Nsys + Is[i]] = U2[2] // store amplification in M.glob.U
    U[i][2] = U2[2]
    i++
  }
  return i - 1
}

// ============ POST-PROCESSING ==============

// distributions at nodes (M.post): th, ds, sa, ue, uei, cf, Ret, Hk
export function get_distributions(M: Mfoil): void {
  const n = M.glob.Nsys
  const U = M.glob.U
  M.post.th = U.slice(0, n)
  M.post.ds = U.slice(n, 2 * n)
  M.post.sa = U.slice(2 * n, 3 * n)
  M.post.ue = U.slice(3 * n, 4 * n).map(u => get_uk(u, M.param)[0]) // compressible edge velocity
  M.post.uei = get_ueinv(M) // compressible inviscid edge velocity

  const cf = new Float64Array(n)
  const Ret = new Float64Array(n)
  const Hk = new Float64Array(n)
  for (let si = 0; si < 3; si++) {
    const param = build_param(M, si)
    for (const j of M.vsol.Is[si]) {
      const Uj = ucol(M, j)
      station_param(M, param, j)
      const [uk] = get_uk(Uj[3], param) // corrected edge speed
      const [cfloc] = get_cf(Uj, param) // local skin friction coefficient
      cf[j] = cfloc * uk * uk / (param.Vinf * param.Vinf) // free-stream-based cf
      Ret[j] = get_Ret(Uj, param)[0] // Re_theta
      Hk[j] = get_Hk(Uj, param)[0] // kinematic shape factor
    }
  }
  M.post.cf = cf
  M.post.Ret = Ret
  M.post.Hk = Hk
}
