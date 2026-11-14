// Boundary-layer station residuals of mfoil (backend/mfoil.py), same names as the Python.
// Two-station states U are [4, 2] row-major: U[k*2 + j] is component k (th, ds, sa, ue) of station j.
// Jacobians w.r.t. U are [r, 8] row-major with columns [U1 (4), U2 (4)].

import type { Mfoil, Param } from './types.ts'
import { copyParam } from './types.ts'
import { get_H, get_Hk, get_Hs, get_Hss, get_Hw, get_Mach2, get_Ret, get_Us, get_cDixt, get_cf, get_cfxt, get_cteq, get_cttr, get_damp, get_de, get_uk, get_upw, get_uq, upwind } from './closures.ts'

type Vec = Float64Array

function V(f: (i: number) => number, n = 4): Vec {
  const r = new Float64Array(n)
  for (let i = 0; i < n; i++) r[i] = f(i)
  return r
}

const col = (U: Vec, j: number): Vec => Float64Array.of(U[j], U[2 + j], U[4 + j], U[6 + j])
const stack = (a: Vec, b: Vec): Vec => Float64Array.of(a[0], b[0], a[1], b[1], a[2], b[2], a[3], b[3])
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]

// -------------------------------------------------------------------------------
// Returns [Ust (4), Ust_U [4, 8], Ust_x [4, 2], xst]. Inputs are not modified.
export function stagnation_state(U: Vec, x: Vec): [Vec, Vec, Vec, number] {
  const U1 = col(U, 0)
  const U2 = col(U, 1)
  const x1 = x[0]
  const x2 = x[1]
  const dx = x2 - x1
  const dx_x = [-1, 1]
  const rx = x2 / x1
  const rx_x = [-rx / x1, 1 / x1]

  // linear extrapolation weights and stagnation state
  const w1 = x2 / dx
  const w1_x = V(j => -w1 / dx * dx_x[j] + [0, 1][j] / dx, 2)
  const w2 = -x1 / dx
  const w2_x = V(j => -w2 / dx * dx_x[j] + [-1, 0][j] / dx, 2)
  const Ust = V(i => U1[i] * w1 + U2[i] * w2)

  // quadratic extrapolation of the edge velocity for better slope, ue=K*x
  const wk1 = rx / dx
  const wk1_x = V(j => rx_x[j] / dx - wk1 / dx * dx_x[j], 2)
  const wk2 = -1 / (rx * dx)
  const wk2_x = V(j => -wk2 * (rx_x[j] / rx + dx_x[j] / dx), 2)
  const K = wk1 * U1[3] + wk2 * U2[3]
  const K_x = V(j => U1[3] * wk1_x[j] + U2[3] * wk2_x[j], 2)

  // stagnation coord cannot be zero, but must be small
  const xst = 1e-6
  Ust[3] = K * xst // linear dep of ue on x near stagnation
  const Ust_U = new Float64Array(32)
  for (let i = 0; i < 3; i++) {
    Ust_U[i * 8 + i] = w1
    Ust_U[i * 8 + 4 + i] = w2
  }
  Ust_U[24 + 3] = wk1 * xst
  Ust_U[24 + 7] = wk2 * xst
  const Ust_x = new Float64Array(8)
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) Ust_x[i * 2 + j] = U1[i] * w1_x[j] + U2[i] * w2_x[j]
  Ust_x[6] = K_x[0] * xst
  Ust_x[7] = K_x[1] * xst
  return [Ust, Ust_U, Ust_x, xst]
}

// -------------------------------------------------------------------------------
// Thwaites stagnation-point initialization: returns [th, ds].
export function thwaites_init(K: number, nu: number): [number, number] {
  const th = Math.sqrt(0.45 * nu / (6 * K)) // momentum thickness
  return [th, 2.2 * th] // ds = Hstag*th
}

// -------------------------------------------------------------------------------
// Combined laminar + turbulent residual over a transition interval: [R (3), R_U [3, 8], R_x [3, 2]].
// Reads M.param (the residuals use a fresh copy of it, like build_param(M, 0)) and writes M.vsol.xt.
// param (laminar side) supplies ncrit and the amplification closures; it is not modified.
export function residual_transition(M: Mfoil, param: Param, x: Vec, U: Vec, Aux: Vec): [Vec, Vec, Vec] {
  const U1 = col(U, 0)
  const U2 = col(U, 1)
  const sa = [U[4], U[5]]

  // interval
  const x1 = x[0]
  const x2 = x[1]
  const dx = x2 - x1

  // determine transition location (xt) using amplification equation
  let xt = x1 + 0.5 * dx // guess
  const ncrit = param.ncrit // critical amp factor
  const nNewton = 20
  let w1 = 0
  let w2 = 0
  let Ut = new Float64Array(4)
  let Ut_xt = new Float64Array(4)
  let damp1 = 0
  let damp1_U1 = new Float64Array(4)
  let dampt = 0
  let dampt_Ut = new Float64Array(4)
  let Rxt_xt = 0
  for (let iNewton = 0; iNewton < nNewton; iNewton++) {
    w2 = (xt - x1) / dx
    w1 = 1 - w2 // weights
    Ut = V(i => w1 * U1[i] + w2 * U2[i]) // state at xt
    Ut_xt = V(i => (U2[i] - U1[i]) / dx)
    Ut[2] = ncrit // amplification at transition
    Ut_xt[2] = 0
    ;[damp1, damp1_U1] = get_damp(U1, param)
    ;[dampt, dampt_Ut] = get_damp(Ut, param)
    dampt_Ut[2] = 0
    const Rxt = ncrit - sa[0] - 0.5 * (xt - x1) * (damp1 + dampt)
    Rxt_xt = -0.5 * (damp1 + dampt) - 0.5 * (xt - x1) * dot(dampt_Ut, Ut_xt)
    let dxt = -Rxt / Rxt_xt
    const dmax = 0.2 * dx * (1.1 - iNewton / nNewton)
    if (Math.abs(dxt) > dmax)
      dxt = dxt * dmax / Math.abs(dxt)
    if (Math.abs(Rxt) < 1e-10)
      break
    xt += dxt // without a break, xt moves past the state the derivatives below use (as in the Python)
  }
  M.vsol.xt = xt // save transition location

  // prepare for xt linearizations
  const Rxt_U = V(i => -0.5 * (xt - x1) * (i < 4 ? damp1_U1[i] + dampt_Ut[i] * w1 : dampt_Ut[i - 4] * w2), 8)
  Rxt_U[2] -= 1
  const Ut_x1 = V(i => (U2[i] - U1[i]) * (w2 - 1) / dx) // at fixed xt
  const Ut_x2 = V(i => (U2[i] - U1[i]) * (-w2) / dx)
  Ut_x1[2] = 0 // amp at xt is always ncrit
  Ut_x2[2] = 0
  const Rxt_x1 = 0.5 * (damp1 + dampt) - 0.5 * (xt - x1) * dot(dampt_Ut, Ut_x1)
  const Rxt_x2 = -0.5 * (xt - x1) * dot(dampt_Ut, Ut_x2)

  // sensitivity of xt w.r.t. U,x from Rxt(xt,U,x) = 0 constraint
  const xt_U = V(i => -Rxt_U[i] / Rxt_xt, 8)
  const xt_U1 = xt_U.subarray(0, 4)
  const xt_U2 = xt_U.subarray(4, 8)
  const xt_x1 = -Rxt_x1 / Rxt_xt
  const xt_x2 = -Rxt_x2 / Rxt_xt

  // include derivatives w.r.t. xt in Ut_x1 and Ut_x2
  for (let i = 0; i < 4; i++) {
    Ut_x1[i] += Ut_xt[i] * xt_x1
    Ut_x2[i] += Ut_xt[i] * xt_x2
  }

  // sensitivity of Ut w.r.t. U1 and U2 ([4, 4] row-major)
  const Ut_U1 = V(k => (Math.floor(k / 4) === k % 4 ? w1 : 0) + (U2[Math.floor(k / 4)] - U1[Math.floor(k / 4)]) * xt_U1[k % 4] / dx, 16)
  const Ut_U2 = V(k => (Math.floor(k / 4) === k % 4 ? w2 : 0) + (U2[Math.floor(k / 4)] - U1[Math.floor(k / 4)]) * xt_U2[k % 4] / dx, 16)

  // laminar and turbulent states at transition
  const Utl = Float64Array.from(Ut)
  const Utl_U1 = Float64Array.from(Ut_U1)
  const Utl_U2 = Float64Array.from(Ut_U2)
  const Utl_x1 = Float64Array.from(Ut_x1)
  const Utl_x2 = Float64Array.from(Ut_x2)
  Utl[2] = ncrit
  Utl_U1.fill(0, 8, 12)
  Utl_U2.fill(0, 8, 12)
  Utl_x1[2] = 0
  Utl_x2[2] = 0
  const Utt = Float64Array.from(Ut)
  const Utt_U1 = Float64Array.from(Ut_U1)
  const Utt_U2 = Float64Array.from(Ut_U2)
  const Utt_x1 = Float64Array.from(Ut_x1)
  const Utt_x2 = Float64Array.from(Ut_x2)

  // parameter structure: build_param(M, 0)
  const p = copyParam(M.param)
  p.wake = false
  p.turb = false
  p.simi = false

  // set turbulent shear coefficient, sa, in Utt
  p.turb = true
  const [cttr, cttr_Ut] = get_cttr(Ut, p)
  Utt[2] = cttr
  for (let j = 0; j < 4; j++) {
    Utt_U1[8 + j] = cttr_Ut[0] * Ut_U1[j] + cttr_Ut[1] * Ut_U1[4 + j] + cttr_Ut[2] * Ut_U1[8 + j] + cttr_Ut[3] * Ut_U1[12 + j]
    Utt_U2[8 + j] = cttr_Ut[0] * Ut_U2[j] + cttr_Ut[1] * Ut_U2[4 + j] + cttr_Ut[2] * Ut_U2[8 + j] + cttr_Ut[3] * Ut_U2[12 + j]
  }
  Utt_x1[2] = dot(cttr_Ut, Ut_x1)
  Utt_x2[2] = dot(cttr_Ut, Ut_x2)

  // laminar/turbulent residuals and linearizations
  p.turb = false
  const [Rl, Rl_U, Rl_x] = residual_station(p, Float64Array.of(x1, xt), stack(U1, Utl), Aux)
  p.turb = true
  const [Rt, Rt_U, Rt_x] = residual_station(p, Float64Array.of(xt, x2), stack(Utt, U2), Aux)

  // combined residual and linearization; A_B(r, j) = sum_k A[r, 4+k or k] * B[k, j]
  const R = V(r => Rl[r] + Rt[r], 3)
  const mul = (A: Vec, off: number, B: Vec, r: number, j: number) =>
    A[r * 8 + off] * B[j] + A[r * 8 + off + 1] * B[4 + j] + A[r * 8 + off + 2] * B[8 + j] + A[r * 8 + off + 3] * B[12 + j]
  const mulv = (A: Vec, off: number, b: Vec, r: number) =>
    A[r * 8 + off] * b[0] + A[r * 8 + off + 1] * b[1] + A[r * 8 + off + 2] * b[2] + A[r * 8 + off + 3] * b[3]
  const R_U = new Float64Array(24)
  const R_x = new Float64Array(6)
  for (let r = 0; r < 3; r++) {
    for (let j = 0; j < 4; j++) {
      R_U[r * 8 + j] = Rl_U[r * 8 + j] + mul(Rl_U, 4, Utl_U1, r, j) + Rl_x[r * 2 + 1] * xt_U1[j] + mul(Rt_U, 0, Utt_U1, r, j) + Rt_x[r * 2] * xt_U1[j]
      R_U[r * 8 + 4 + j] = mul(Rl_U, 4, Utl_U2, r, j) + Rl_x[r * 2 + 1] * xt_U2[j] + mul(Rt_U, 0, Utt_U2, r, j) + Rt_U[r * 8 + 4 + j] + Rt_x[r * 2] * xt_U2[j]
    }
    R_x[r * 2] = Rl_x[r * 2] + Rl_x[r * 2 + 1] * xt_x1 + Rt_x[r * 2] * xt_x1 + mulv(Rl_U, 4, Utl_x1, r) + mulv(Rt_U, 0, Utt_x1, r)
    R_x[r * 2 + 1] = Rt_x[r * 2 + 1] + Rl_x[r * 2 + 1] * xt_x2 + Rt_x[r * 2] * xt_x2 + mulv(Rl_U, 4, Utl_x2, r) + mulv(Rt_U, 0, Utt_x2, r)
  }
  return [R, R_U, R_x]
}

// -------------------------------------------------------------------------------
// Residual at one non-transition station: [R (3), R_U [3, 8], R_x [3, 2]].
// Inputs (param, x, Uin, Aux) are not modified.
export function residual_station(param: Param, x: Vec, Uin: Vec, Aux: Vec): [Vec, Vec, Vec] {
  // so that we do not overwrite Uin
  const U = Float64Array.from(Uin)

  // modify ds to take out wake gap (in Aux) for all calculations below
  U[2] -= Aux[0]
  U[3] -= Aux[1]

  // states
  const U1 = col(U, 0)
  const U2 = col(U, 1)
  const Um = V(i => 0.5 * (U1[i] + U2[i]))
  const th = [U[0], U[1]]
  const ds = [U[2], U[3]]
  const sa = [U[4], U[5]]

  // speed needs compressibility correction
  const [uk1, uk1_u] = get_uk(U1[3], param)
  const [uk2, uk2_u] = get_uk(U2[3], param)

  // log changes
  let thlog = Math.log(th[1] / th[0])
  let thlog_U = Float64Array.of(-1 / th[0], 0, 0, 0, 1 / th[1], 0, 0, 0)
  let uelog = Math.log(uk2 / uk1)
  let uelog_U = Float64Array.of(0, 0, 0, -uk1_u / uk1, 0, 0, 0, uk2_u / uk2)
  let xlog = Math.log(x[1] / x[0])
  let xlog_x = Float64Array.of(-1 / x[0], 1 / x[1])
  let dx = x[1] - x[0]
  let dx_x = Float64Array.of(-1, 1)

  // upwinding factor
  const [upw, upw_U] = get_upw(U1, U2, param)

  // shape parameter
  const [H1, H1_U1] = get_H(U1)
  const [H2, H2_U2] = get_H(U2)
  const H = 0.5 * (H1 + H2)
  const H_U = V(i => 0.5 * (i < 4 ? H1_U1[i] : H2_U2[i - 4]), 8)

  // Hstar = KE shape parameter, averaged
  const [Hs1, Hs1_U1] = get_Hs(U1, param)
  const [Hs2, Hs2_U2] = get_Hs(U2, param)
  const [Hs, Hs_U] = upwind(0.5, 0, Hs1, Hs1_U1, Hs2, Hs2_U2)

  // log change in Hstar
  let Hslog = Math.log(Hs2 / Hs1)
  let Hslog_U = V(i => (i < 4 ? -1 / Hs1 * Hs1_U1[i] : 1 / Hs2 * Hs2_U2[i - 4]), 8)

  // similarity station is special: U1 = U2, x1 = x2
  if (param.simi) {
    thlog = 0
    thlog_U = new Float64Array(8)
    Hslog = 0
    Hslog_U = new Float64Array(8)
    uelog = 1
    uelog_U = new Float64Array(8)
    xlog = 1
    xlog_x = Float64Array.of(0, 0)
    dx = 0.5 * (x[0] + x[1])
    dx_x = Float64Array.of(0.5, 0.5)
  }

  // Hw = wake shape parameter
  const [Hw1, Hw1_U1] = get_Hw(U1, Aux[0])
  const [Hw2, Hw2_U2] = get_Hw(U2, Aux[1])
  const Hw = 0.5 * (Hw1 + Hw2)
  const Hw_U = V(i => 0.5 * (i < 4 ? Hw1_U1[i] : Hw2_U2[i - 4]), 8)

  // set up shear lag or amplification factor equation
  let Rlag: number
  let Rlag_U: Vec
  let Rlag_x: Vec
  if (param.turb) {
    // log change of root shear stress coeff
    const salog = Math.log(sa[1] / sa[0])
    const salog_U = Float64Array.of(0, 0, -1 / sa[0], 0, 0, 0, 1 / sa[1], 0)

    // BL thickness measure, averaged
    const [de1, de1_U1] = get_de(U1, param)
    const [de2, de2_U2] = get_de(U2, param)
    const [de, de_U] = upwind(0.5, 0, de1, de1_U1, de2, de2_U2)

    // normalized slip velocity, averaged
    const [Us1, Us1_U1] = get_Us(U1, param)
    const [Us2, Us2_U2] = get_Us(U2, param)
    const [Us, Us_U] = upwind(0.5, 0, Us1, Us1_U1, Us2, Us2_U2)

    // Hk, upwinded
    const [Hk1, Hk1_U1] = get_Hk(U1, param)
    const [Hk2, Hk2_U2] = get_Hk(U2, param)
    const [Hk, Hk_U] = upwind(upw, upw_U, Hk1, Hk1_U1, Hk2, Hk2_U2)

    // Re_theta, averaged
    const [Ret1, Ret1_U1] = get_Ret(U1, param)
    const [Ret2, Ret2_U2] = get_Ret(U2, param)
    const [Ret, Ret_U] = upwind(0.5, 0, Ret1, Ret1_U1, Ret2, Ret2_U2)

    // skin friction, upwinded
    const [cf1, cf1_U1] = get_cf(U1, param)
    const [cf2, cf2_U2] = get_cf(U2, param)
    const [cf, cf_U] = upwind(upw, upw_U, cf1, cf1_U1, cf2, cf2_U2)

    // displacement thickness, averaged
    const dsa = 0.5 * (ds[0] + ds[1])
    const dsa_U = Float64Array.of(0, 0.5, 0, 0, 0, 0.5, 0, 0)

    // uq = equilibrium 1/ue * due/dx
    const [uq, uq_U] = get_uq(dsa, dsa_U, cf, cf_U, Hk, Hk_U, Ret, Ret_U, param)

    // cteq = root equilibrium wake layer shear coeficient: (ctau eq)^.5
    const [cteq1, cteq1_U1] = get_cteq(U1, param)
    const [cteq2, cteq2_U2] = get_cteq(U2, param)
    const [cteq, cteq_U] = upwind(upw, upw_U, cteq1, cteq1_U1, cteq2, cteq2_U2)

    // root of shear coefficient (a state), upwinded
    const e2 = Float64Array.of(0, 0, 1, 0)
    const [saa, saa_U] = upwind(upw, upw_U, sa[0], e2, sa[1], e2)

    // lag coefficient
    const Klag = param.SlagK
    const beta = param.GB
    const Clag = Klag / beta * 1 / (1 + Us)
    const Clag_U = V(i => -Clag / (1 + Us) * Us_U[i], 8)

    // extra dissipation in wake
    const ald = param.wake ? param.Dlr : 1.0

    // shear lag equation
    Rlag = Clag * (cteq - ald * saa) * dx - 2 * de * salog + 2 * de * (uq * dx - uelog) * param.Cuq
    Rlag_U = V(i => Clag_U[i] * (cteq - ald * saa) * dx + Clag * (cteq_U[i] - ald * saa_U[i]) * dx
      - 2 * de_U[i] * salog - 2 * de * salog_U[i]
      + 2 * de_U[i] * (uq * dx - uelog) * param.Cuq + 2 * de * (uq_U[i] * dx - uelog_U[i]) * param.Cuq, 8)
    Rlag_x = V(j => Clag * (cteq - ald * saa) * dx_x[j] + 2 * de * uq * dx_x[j], 2)
  }
  else if (param.simi) {
    // laminar similarity station: no amplification
    Rlag = sa[0] + sa[1]
    Rlag_U = Float64Array.of(0, 0, 1, 0, 0, 0, 1, 0)
    Rlag_x = Float64Array.of(0, 0)
  }
  else {
    // laminar, amplification factor equation; amplification rate, averaged
    const [damp1, damp1_U1] = get_damp(U1, param)
    const [damp2, damp2_U2] = get_damp(U2, param)
    const [damp, damp_U] = upwind(0.5, 0, damp1, damp1_U1, damp2, damp2_U2)
    Rlag = sa[1] - sa[0] - damp * dx
    Rlag_U = V(i => [0, 0, -1, 0, 0, 0, 1, 0][i] - damp_U[i] * dx, 8)
    Rlag_x = V(j => -damp * dx_x[j], 2)
  }

  // squared mach number, symmetrical average
  const [Ms1, Ms1_U1] = get_Mach2(U1, param)
  const [Ms2, Ms2_U2] = get_Mach2(U2, param)
  const [Ms, Ms_U] = upwind(0.5, 0, Ms1, Ms1_U1, Ms2, Ms2_U2)

  // skin friction * x/theta, symmetrical average
  const [cfxt1, cfxt1_U1, cfxt1_x1] = get_cfxt(U1, x[0], param)
  const [cfxt2, cfxt2_U2, cfxt2_x2] = get_cfxt(U2, x[1], param)
  const [cfxtm, cfxtm_Um, cfxtm_xm] = get_cfxt(Um, 0.5 * (x[0] + x[1]), param)
  const cfxt = 0.25 * cfxt1 + 0.5 * cfxtm + 0.25 * cfxt2
  const cfxt_U = V(i => 0.25 * (i < 4 ? cfxt1_U1[i] + cfxtm_Um[i] : cfxtm_Um[i - 4] + cfxt2_U2[i - 4]), 8)
  const cfxt_x = Float64Array.of(0.25 * (cfxt1_x1 + cfxtm_xm), 0.25 * (cfxtm_xm + cfxt2_x2))

  // momentum equation
  const Rmom = thlog + (2 + H + Hw - Ms) * uelog - 0.5 * xlog * cfxt
  const Rmom_U = V(i => thlog_U[i] + (H_U[i] + Hw_U[i] - Ms_U[i]) * uelog + (2 + H + Hw - Ms) * uelog_U[i] - 0.5 * xlog * cfxt_U[i], 8)
  const Rmom_x = V(j => -0.5 * xlog_x[j] * cfxt - 0.5 * xlog * cfxt_x[j], 2)

  // dissipation function times x/theta: cDi = (2*cD/H*)*x/theta, upwinded
  const [cDixt1, cDixt1_U1, cDixt1_x1] = get_cDixt(U1, x[0], param)
  const [cDixt2, cDixt2_U2, cDixt2_x2] = get_cDixt(U2, x[1], param)
  const [cDixt, cDixt_U] = upwind(upw, upw_U, cDixt1, cDixt1_U1, cDixt2, cDixt2_U2)
  const cDixt_x = Float64Array.of((1 - upw) * cDixt1_x1, upw * cDixt2_x2)

  // cf*x/theta, upwinded
  const [cfxtu, cfxtu_U] = upwind(upw, upw_U, cfxt1, cfxt1_U1, cfxt2, cfxt2_U2)
  const cfxtu_x = Float64Array.of((1 - upw) * cfxt1_x1, upw * cfxt2_x2)

  // Hss = density shape parameter, averaged
  const [Hss1, Hss1_U1] = get_Hss(U1, param)
  const [Hss2, Hss2_U2] = get_Hss(U2, param)
  const [Hss, Hss_U] = upwind(0.5, 0, Hss1, Hss1_U1, Hss2, Hss2_U2)

  const Rshape = Hslog + (2 * Hss / Hs + 1 - H - Hw) * uelog + xlog * (0.5 * cfxtu - cDixt)
  const Rshape_U = V(i => Hslog_U[i] + (2 * Hss_U[i] / Hs - 2 * Hss / Hs ** 2 * Hs_U[i] - H_U[i] - Hw_U[i]) * uelog
    + (2 * Hss / Hs + 1 - H - Hw) * uelog_U[i] + xlog * (0.5 * cfxtu_U[i] - cDixt_U[i]), 8)
  const Rshape_x = V(j => xlog_x[j] * (0.5 * cfxtu - cDixt) + xlog * (0.5 * cfxtu_x[j] - cDixt_x[j]), 2)

  // put everything together
  const R_U = new Float64Array(24)
  R_U.set(Rmom_U, 0)
  R_U.set(Rshape_U, 8)
  R_U.set(Rlag_U, 16)
  const R_x = Float64Array.of(Rmom_x[0], Rmom_x[1], Rshape_x[0], Rshape_x[1], Rlag_x[0], Rlag_x[1])
  return [Float64Array.of(Rmom, Rshape, Rlag), R_U, R_x]
}
