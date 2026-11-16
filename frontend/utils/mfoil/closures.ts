// Boundary-layer closures of mfoil (references/mfoil/mfoil.py, "GET FUNCTIONS"), same names and order.
// U is one station state Float64Array(4) = [th, ds, sa, ue]; each returns [value, value_U, ...].
// Derivative vectors take the length of their inputs (4, or 8 for [U1, U2] linearizations).

import type { Param } from './types.ts'
import { copyParam } from './types.ts'

type Vec = Float64Array

// elementwise vector from an index expression, so the Python vector formulas port verbatim
function V(f: (i: number) => number, n = 4): Vec {
  const r = new Float64Array(n)
  for (let i = 0; i < n; i++) r[i] = f(i)
  return r
}

function cat(a: Vec, b: Vec): Vec {
  const r = new Float64Array(a.length + b.length)
  r.set(a)
  r.set(b, a.length)
  return r
}

const zeros = (n = 4): Vec => new Float64Array(n)
const E0 = Float64Array.of(1, 0, 0, 0)

// -------------------------------------------------------------------------------
export function get_upw(U1: Vec, U2: Vec, param: Param): [number, Vec] {
  const [Hk1, Hk1_U1] = get_Hk(U1, param)
  const [Hk2, Hk2_U2] = get_Hk(U2, param)
  const Z = zeros(Hk1_U1.length)
  const Hut = 1 // triggering constant for upwinding
  const C = param.wake ? 1 : 5
  const Huc = C * Hut / Hk2 ** 2 // only depends on U2
  const Huc_U = cat(Z, V(i => -2 * Huc / Hk2 * Hk2_U2[i]))
  const aa = (Hk2 - 1) / (Hk1 - 1)
  const sga = Math.sign(aa)
  const la = Math.log(sga * aa)
  const la_U = cat(V(i => -1 / (Hk1 - 1) * Hk1_U1[i]), V(i => 1 / (Hk2 - 1) * Hk2_U2[i]))
  let Hls = la ** 2
  let Hls_U = V(i => 2 * la * la_U[i], 8)
  if (Hls > 15) {
    Hls = 15
    Hls_U = zeros(8)
  }
  const upw = 1 - 0.5 * Math.exp(-Hls * Huc)
  const upw_U = V(i => -0.5 * Math.exp(-Hls * Huc) * (-Hls_U[i] * Huc - Hls * Huc_U[i]), 8)
  return [upw, upw_U]
}

// -------------------------------------------------------------------------------
// upw_U is a vector over [U1, U2], or a constant (0) as in the Python's upwind(0.5, 0, ...)
export function upwind(upw: number, upw_U: Vec | number, f1: number, f1_U1: Vec, f2: number, f2_U2: Vec): [number, Vec] {
  const f = (1 - upw) * f1 + upw * f2
  const g = cat(V(i => (1 - upw) * f1_U1[i], f1_U1.length), V(i => upw * f2_U2[i], f2_U2.length))
  const f_U = V((i) => {
    const u = typeof upw_U === 'number' ? upw_U : upw_U[i]
    return (-u) * f1 + u * f2 + g[i]
  }, g.length)
  return [f, f_U]
}

// -------------------------------------------------------------------------------
export function get_uq(ds: number, ds_U: Vec, cf: number, cf_U: Vec, Hk: number, Hk_U: Vec, Ret: number, Ret_U: Vec, param: Param): [number, Vec] {
  const n = Hk_U.length
  const beta = param.GB
  let A = param.GA
  let C = param.GC
  if (param.wake) {
    A = A * param.Dlr
    C = 0
  }
  // limit Hk (TODO smooth/eliminate)
  if (param.wake && Hk < 1.00005) {
    Hk = 1.00005
    Hk_U = zeros(n)
  }
  if (!param.wake && Hk < 1.05) {
    Hk = 1.05
    Hk_U = zeros(n)
  }
  let Hkc = Hk - 1 - C / Ret
  let Hkc_U = V(i => Hk_U[i] + C / Ret ** 2 * Ret_U[i], n)
  if (Hkc < 0.01) {
    Hkc = 0.01
    Hkc_U = zeros(n)
  }
  const ut = 0.5 * cf - (Hkc / (A * Hk)) ** 2
  const ut_U = V(i => 0.5 * cf_U[i] - 2 * (Hkc / (A * Hk)) * (Hkc_U[i] / (A * Hk) - Hkc / (A * Hk ** 2) * Hk_U[i]), n)
  const uq = ut / (beta * ds)
  const uq_U = V(i => ut_U[i] / (beta * ds) - uq / ds * ds_U[i], n)
  return [uq, uq_U]
}

// -------------------------------------------------------------------------------
// Mutates param: sets param.wake = false (as the Python does on the caller's object).
export function get_cttr(U: Vec, param: Param): [number, Vec] {
  param.wake = false // transition happens just before the wake starts
  const [cteq, cteq_U] = get_cteq(U, param)
  let [Hk, Hk_U] = get_Hk(U, param)
  if (Hk < 1.05) {
    Hk = 1.05
    Hk_U = zeros()
  }
  const C = param.CtauC
  const E = param.CtauE
  const c = C * Math.exp(-E / (Hk - 1))
  const c_U = V(i => c * E / (Hk - 1) ** 2 * Hk_U[i])
  const cttr = c * cteq
  const cttr_U = V(i => c_U[i] * cteq + c * cteq_U[i])
  return [cttr, cttr_U]
}

// -------------------------------------------------------------------------------
export function get_cteq(U: Vec, param: Param): [number, Vec] {
  const CC = 0.5 / (param.GA ** 2 * param.GB)
  const C = param.GC
  let [Hk, Hk_U] = get_Hk(U, param)
  const [Hs, Hs_U] = get_Hs(U, param)
  const [H, H_U] = get_H(U)
  const [Ret, Ret_U] = get_Ret(U, param)
  const [Us, Us_U] = get_Us(U, param)
  let Hkc: number
  let Hkc_U: Vec
  if (param.wake) {
    if (Hk < 1.00005) {
      Hk = 1.00005
      Hk_U = zeros()
    }
    Hkc = Hk - 1
    Hkc_U = Hk_U
  }
  else {
    // Python typo assigns HK_U, so Hk_U is NOT zeroed here; kept for fidelity
    if (Hk < 1.05)
      Hk = 1.05
    Hkc = Hk - 1 - C / Ret
    Hkc_U = V(i => Hk_U[i] + C / Ret ** 2 * Ret_U[i])
    if (Hkc < 0.01) {
      Hkc = 0.01
      Hkc_U = zeros()
    }
  }
  const num = CC * Hs * (Hk - 1) * Hkc ** 2
  const num_U = V(i => CC * (Hs_U[i] * (Hk - 1) * Hkc ** 2 + Hs * Hk_U[i] * Hkc ** 2 + Hs * (Hk - 1) * 2 * Hkc * Hkc_U[i]))
  const den = (1 - Us) * H * Hk ** 2
  const den_U = V(i => (-Us_U[i]) * H * Hk ** 2 + (1 - Us) * H_U[i] * Hk ** 2 + (1 - Us) * H * 2 * Hk * Hk_U[i])
  const cteq = Math.sqrt(num / den)
  const cteq_U = V(i => 0.5 / cteq * (num_U[i] / den - num / den ** 2 * den_U[i]))
  return [cteq, cteq_U]
}

// -------------------------------------------------------------------------------
export function get_Hs(U: Vec, param: Param): [number, Vec] {
  let [Hk, Hk_U] = get_Hk(U, param)

  // limit Hk (TODO smooth/eliminate)
  if (param.wake && Hk < 1.00005) {
    Hk = 1.00005
    Hk_U = zeros()
  }
  if (!param.wake && Hk < 1.05) {
    Hk = 1.05
    Hk_U = zeros()
  }

  let Hs: number
  let Hs_U: Vec
  if (param.turb) { // turbulent
    const Hsmin = 1.5
    const dHsinf = 0.015
    const [Ret, Ret_U] = get_Ret(U, param)
    // limit Re_theta and dependence
    let Ho = 4
    let Ho_U = zeros()
    if (Ret > 400) {
      Ho = 3 + 400 / Ret
      Ho_U = V(i => -400 / Ret ** 2 * Ret_U[i])
    }
    let Reb = Ret
    let Reb_U = Ret_U
    if (Ret < 200) {
      Reb = 200
      Reb_U = zeros()
    }
    if (Hk < Ho) { // attached branch
      const Hr = (Ho - Hk) / (Ho - 1)
      const Hr_U = V(i => (Ho_U[i] - Hk_U[i]) / (Ho - 1) - (Ho - Hk) / (Ho - 1) ** 2 * Ho_U[i])
      const aa = (2 - Hsmin - 4 / Reb) * Hr ** 2
      const aa_U = V(i => (4 / Reb ** 2 * Reb_U[i]) * Hr ** 2 + (2 - Hsmin - 4 / Reb) * 2 * Hr * Hr_U[i])
      Hs = Hsmin + 4 / Reb + aa * 1.5 / (Hk + 0.5)
      Hs_U = V(i => -4 / Reb ** 2 * Reb_U[i] + aa_U[i] * 1.5 / (Hk + 0.5) - aa * 1.5 / (Hk + 0.5) ** 2 * Hk_U[i])
    }
    else { // separated branch
      const lrb = Math.log(Reb)
      const lrb_U = V(i => 1 / Reb * Reb_U[i])
      const aa = Hk - Ho + 4 / lrb
      const aa_U = V(i => Hk_U[i] - Ho_U[i] - 4 / lrb ** 2 * lrb_U[i])
      const bb = 0.007 * lrb / aa ** 2 + dHsinf / Hk
      const bb_U = V(i => 0.007 * (lrb_U[i] / aa ** 2 - 2 * lrb / aa ** 3 * aa_U[i]) - dHsinf / Hk ** 2 * Hk_U[i])
      Hs = Hsmin + 4 / Reb + (Hk - Ho) ** 2 * bb
      Hs_U = V(i => -4 / Reb ** 2 * Reb_U[i] + 2 * (Hk - Ho) * (Hk_U[i] - Ho_U[i]) * bb + (Hk - Ho) ** 2 * bb_U[i])
    }
    // slight Mach number correction
    const [M2, M2_U] = get_Mach2(U, param) // squared edge Mach number
    const den = 1 + 0.014 * M2
    const den_M2 = 0.014
    Hs = (Hs + 0.028 * M2) / den
    const Hs1 = Hs
    const Hs_U0 = Hs_U
    Hs_U = V(i => (Hs_U0[i] + 0.028 * M2_U[i]) / den - Hs1 / den * den_M2 * M2_U[i])
  }
  else { // laminar
    const a = Hk - 4.35
    let Hs_Hk: number
    if (Hk < 4.35) {
      const num = 0.0111 * a ** 2 - 0.0278 * a ** 3
      Hs = num / (Hk + 1) + 1.528 - 0.0002 * (a * Hk) ** 2
      Hs_Hk = (0.0111 * 2 * a - 0.0278 * 3 * a ** 2) / (Hk + 1) - num / (Hk + 1) ** 2 - 0.0002 * 2 * a * Hk * (Hk + a)
    }
    else {
      Hs = 0.015 * a ** 2 / Hk + 1.528
      Hs_Hk = 0.015 * 2 * a / Hk - 0.015 * a ** 2 / Hk ** 2
    }
    const Hk_U0 = Hk_U
    Hs_U = V(i => Hs_Hk * Hk_U0[i])
  }
  return [Hs, Hs_U]
}

// -------------------------------------------------------------------------------
export function get_cp(u: number, param: Param): [number, number] {
  const Vinf = param.Vinf
  let cp = 1 - (u / Vinf) ** 2
  let cp_u = -2 * u / Vinf ** 2
  if (param.Minf > 0) {
    const l = param.KTl
    const b = param.KTb
    const den = b + 0.5 * l * (1 + b) * cp
    const den_cp = 0.5 * l * (1 + b)
    cp /= den
    cp_u *= (1 - cp * den_cp) / den
  }
  return [cp, cp_u]
}

// -------------------------------------------------------------------------------
export function get_uk(u: number, param: Param): [number, number] {
  if (param.Minf > 0) {
    const l = param.KTl
    const Vinf = param.Vinf
    const den = 1 - l * (u / Vinf) ** 2
    const den_u = -2 * l * u / Vinf ** 2
    const uk = u * (1 - l) / den
    const uk_u = (1 - l) / den - (uk / den) * den_u
    return [uk, uk_u]
  }
  return [u, 1]
}

// -------------------------------------------------------------------------------
export function get_Mach2(U: Vec, param: Param): [number, Vec] {
  if (param.Minf > 0) {
    const H0 = param.H0
    const g = param.gam
    const [uk, uk_u] = get_uk(U[3], param)
    const c2 = (g - 1) * (H0 - 0.5 * uk ** 2) // squared speed of sound
    const c2_uk = (g - 1) * (-uk)
    const M2 = uk ** 2 / c2
    const M2_uk = 2 * uk / c2 - M2 / c2 * c2_uk
    return [M2, Float64Array.of(0, 0, 0, M2_uk * uk_u)]
  }
  return [0, zeros()]
}

// -------------------------------------------------------------------------------
export function get_H(U: Vec): [number, Vec] {
  const H = U[1] / U[0]
  return [H, Float64Array.of(-H / U[0], 1 / U[0], 0, 0)]
}

// -------------------------------------------------------------------------------
export function get_Hw(U: Vec, wgap: number): [number, Vec] {
  const Hw = wgap / U[0] // wgap/th
  return [Hw, Float64Array.of(-Hw / U[0], 0, 0, 0)]
}

// -------------------------------------------------------------------------------
export function get_Hk(U: Vec, param: Param): [number, Vec] {
  const [H, H_U] = get_H(U)
  if (param.Minf > 0) {
    const [M2, M2_U] = get_Mach2(U, param) // squared edge Mach number
    const den = 1 + 0.113 * M2
    const den_M2 = 0.113
    const Hk = (H - 0.29 * M2) / den
    return [Hk, V(i => (H_U[i] - 0.29 * M2_U[i]) / den - Hk / den * den_M2 * M2_U[i])]
  }
  return [H, H_U]
}

// -------------------------------------------------------------------------------
export function get_Hss(U: Vec, param: Param): [number, Vec] {
  const [M2, M2_U] = get_Mach2(U, param) // squared edge Mach number
  const [Hk, Hk_U] = get_Hk(U, param)
  const num = 0.064 / (Hk - 0.8) + 0.251
  const num_U = V(i => -0.064 / (Hk - 0.8) ** 2 * Hk_U[i])
  return [M2 * num, V(i => M2_U[i] * num + M2 * num_U[i])]
}

// -------------------------------------------------------------------------------
export function get_de(U: Vec, param: Param): [number, Vec] {
  const [Hk, Hk_U] = get_Hk(U, param)
  const aa = 3.15 + 1.72 / (Hk - 1)
  const aa_U = V(i => -1.72 / (Hk - 1) ** 2 * Hk_U[i])
  const de = U[0] * aa + U[1]
  const de_U = V(i => [aa, 1, 0, 0][i] + U[0] * aa_U[i])
  const dmx = 12.0
  if (de > dmx * U[0])
    return [dmx * U[0], Float64Array.of(dmx, 0, 0, 0)]
  return [de, de_U]
}

// -------------------------------------------------------------------------------
export function get_rho(U: Vec, param: Param): [number, Vec] {
  if (param.Minf > 0) {
    const [M2, M2_U] = get_Mach2(U, param) // squared edge Mach number
    const gmi = param.gam - 1
    const den = 1 + 0.5 * gmi * M2
    const den_M2 = 0.5 * gmi
    const rho = param.rho0 / den ** (1 / gmi)
    return [rho, V(i => (-1 / gmi) * rho / den * den_M2 * M2_U[i])]
  }
  return [param.rho0, zeros()]
}

// -------------------------------------------------------------------------------
export function get_Ret(U: Vec, param: Param): [number, Vec] {
  if (param.Minf > 0) {
    const [M2, M2_U] = get_Mach2(U, param) // squared edge Mach number
    const [uk, uk_u] = get_uk(U[3], param) // corrected speed
    const H0 = param.H0
    const gmi = param.gam - 1
    const Ts = param.Tsrat
    const Tr = 1 - 0.5 * uk ** 2 / H0 // edge/stagnation temperature ratio
    const Tr_uk = -uk / H0
    const f = Tr ** 1.5 * (1 + Ts) / (Tr + Ts) // Sutherland's ratio
    const f_Tr = 1.5 * f / Tr - f / (Tr + Ts)
    const mu = param.mu0 * f // local dynamic viscosity
    const mu_uk = param.mu0 * f_Tr * Tr_uk
    const den = 1 + 0.5 * gmi * M2
    const den_M2 = 0.5 * gmi
    const rho = param.rho0 / den ** (1 / gmi) // density
    const rho_U = V(i => (-1 / gmi) * rho / den * den_M2 * M2_U[i])
    const Ret = rho * uk * U[0] / mu
    const e3 = Float64Array.of(0, 0, 0, uk_u)
    return [Ret, V(i => rho_U[i] * uk * U[0] / mu + (rho * U[0] / mu - Ret / mu * mu_uk) * e3[i] + rho * uk / mu * E0[i])]
  }
  const Ret = param.rho0 * U[0] * U[3] / param.mu0
  return [Ret, V(i => [U[3], 0, 0, U[0]][i] / param.mu0)]
}

// -------------------------------------------------------------------------------
export function get_cf(U: Vec, param: Param): [number, Vec] {
  if (param.wake)
    return [0, zeros()] // zero cf in wake
  const [Hk, Hk_U] = get_Hk(U, param)
  const [Ret, Ret_U] = get_Ret(U, param)

  if (param.turb) { // turbulent cf
    const [M2, M2_U] = get_Mach2(U, param) // squared edge Mach number
    const Fc = Math.sqrt(1 + 0.5 * (param.gam - 1) * M2)
    const Fc_U = V(i => 0.5 / Fc * 0.5 * (param.gam - 1) * M2_U[i])
    let aa = -1.33 * Hk
    let aa_U = V(i => -1.33 * Hk_U[i])
    // smooth limiting of aa
    if (aa < -17) {
      aa = -20 + 3 * Math.exp((aa + 17) / 3)
      const aa_U0 = aa_U
      aa_U = V(i => (aa + 20) / 3 * aa_U0[i])
    }
    let bb = Math.log(Ret / Fc)
    let bb_U = V(i => Ret_U[i] / Ret - Fc_U[i] / Fc)
    if (bb < 3) {
      bb = 3
      bb_U = zeros()
    }
    bb /= Math.log(10)
    const bb_U0 = bb_U
    bb_U = V(i => bb_U0[i] / Math.log(10))
    const cc = -1.74 - 0.31 * Hk
    const cc_U = V(i => -0.31 * Hk_U[i])
    const dd = Math.tanh(4.0 - Hk / 0.875)
    const dd_U = V(i => (1 - dd ** 2) * (-Hk_U[i] / 0.875))
    const cf0 = 0.3 * Math.exp(aa) * bb ** cc
    const cf0_U = V(i => cf0 * aa_U[i] + 0.3 * Math.exp(aa) * cc * bb ** (cc - 1) * bb_U[i] + cf0 * Math.log(bb) * cc_U[i])
    const cf = (cf0 + 1.1e-4 * (dd - 1)) / Fc
    return [cf, V(i => (cf0_U[i] + 1.1e-4 * dd_U[i]) / Fc - cf / Fc * Fc_U[i])]
  }
  // laminar cf
  let num: number
  let num_Hk: number
  if (Hk < 5.5) {
    num = 0.0727 * (5.5 - Hk) ** 3 / (Hk + 1) - 0.07
    num_Hk = 0.0727 * (3 * (5.5 - Hk) ** 2 / (Hk + 1) * (-1) - (5.5 - Hk) ** 3 / (Hk + 1) ** 2)
  }
  else {
    num = 0.015 * (1 - 1 / (Hk - 4.5)) ** 2 - 0.07
    num_Hk = 0.015 * 2 * (1 - 1 / (Hk - 4.5)) / (Hk - 4.5) ** 2
  }
  const cf = num / Ret
  return [cf, V(i => num_Hk / Ret * Hk_U[i] - num / Ret ** 2 * Ret_U[i])]
}

// -------------------------------------------------------------------------------
export function get_cfxt(U: Vec, x: number, param: Param): [number, Vec, number] {
  const [cf, cf_U] = get_cf(U, param)
  const cfxt = cf * x / U[0]
  const cfxt_U = V(i => cf_U[i] * x / U[0])
  cfxt_U[0] = cfxt_U[0] - cfxt / U[0]
  return [cfxt, cfxt_U, cf / U[0]]
}

// -------------------------------------------------------------------------------
export function get_cDixt(U: Vec, x: number, param: Param): [number, Vec, number] {
  const [cDi, cDi_U] = get_cDi(U, param)
  const cDixt = cDi * x / U[0]
  const cDixt_U = V(i => cDi_U[i] * x / U[0])
  cDixt_U[0] = cDixt_U[0] - cDixt / U[0]
  return [cDixt, cDixt_U, cDi / U[0]]
}

// -------------------------------------------------------------------------------
export function get_cDi(U: Vec, param: Param): [number, Vec] {
  if (!param.turb)
    return get_cDi_lam(U, param) // just laminar dissipation

  // turbulent includes wake: sum the needed components
  let cDi = 0
  let cDi_U = zeros()
  const add = ([c, c_U]: [number, Vec]) => {
    cDi = cDi + c
    cDi_U = V(i => cDi_U[i] + c_U[i])
  }
  let cDil: number
  let cDil_U: Vec
  if (!param.wake) {
    add(get_cDi_turbwall(U, param)) // turbulent wall contribution (0 in the wake)
    ;[cDil, cDil_U] = get_cDi_lam(U, param) // for max check
  }
  else {
    [cDil, cDil_U] = get_cDi_lamwake(U, param) // for max check
  }
  add(get_cDi_outer(U, param)) // outer layer contribution
  add(get_cDi_lamstress(U, param)) // laminar stress contribution

  // maximum check
  if (cDil > cDi) {
    cDi = cDil
    cDi_U = cDil_U
  }
  // double dissipation in the wake
  if (param.wake) {
    cDi = 2 * cDi
    const c_U = cDi_U
    cDi_U = V(i => 2 * c_U[i])
  }
  return [cDi, cDi_U]
}

// -------------------------------------------------------------------------------
export function get_cDi_turbwall(U: Vec, param: Param): [number, Vec] {
  if (param.wake)
    return [0, zeros()]

  const [cf, cf_U] = get_cf(U, param)
  const [Hk, Hk_U] = get_Hk(U, param)
  const [Hs, Hs_U] = get_Hs(U, param)
  const [Us, Us_U] = get_Us(U, param)
  const [Ret, Ret_U] = get_Ret(U, param)

  const lr = Math.log(Ret)
  const lr_U = V(i => Ret_U[i] / Ret)
  const Hmin = 1 + 2.1 / lr
  const Hmin_U = V(i => -2.1 / lr ** 2 * lr_U[i])
  const aa = Math.tanh((Hk - 1) / (Hmin - 1))
  const fac = 0.5 + 0.5 * aa
  const fac_U = V(i => 0.5 * (1 - aa ** 2) * (Hk_U[i] / (Hmin - 1) - (Hk - 1) / (Hmin - 1) ** 2 * Hmin_U[i]))

  const cDi = 0.5 * cf * Us * (2 / Hs) * fac
  return [cDi, V(i => cf_U[i] * Us / Hs * fac + cf * Us_U[i] / Hs * fac - cDi / Hs * Hs_U[i] + cf * Us / Hs * fac_U[i])]
}

// -------------------------------------------------------------------------------
export function get_cDi_lam(U: Vec, param: Param): [number, Vec] {
  const [Hk, Hk_U] = get_Hk(U, param)
  const [Ret, Ret_U] = get_Ret(U, param)
  let num: number
  let num_Hk: number
  if (Hk < 4) {
    num = 0.00205 * (4 - Hk) ** 5.5 + 0.207
    num_Hk = 0.00205 * 5.5 * (4 - Hk) ** 4.5 * (-1)
  }
  else {
    const Hk1 = Hk - 4
    num = -0.0016 * Hk1 ** 2 / (1 + 0.02 * Hk1 ** 2) + 0.207
    num_Hk = -0.0016 * (2 * Hk1 / (1 + 0.02 * Hk1 ** 2) - Hk1 ** 2 / (1 + 0.02 * Hk1 ** 2) ** 2 * 0.02 * 2 * Hk1)
  }
  const cDi = num / Ret
  return [cDi, V(i => num_Hk / Ret * Hk_U[i] - num / Ret ** 2 * Ret_U[i])]
}

// -------------------------------------------------------------------------------
// Works on a copy of paramin (forced laminar); paramin is not modified.
export function get_cDi_lamwake(U: Vec, paramin: Param): [number, Vec] {
  const param = copyParam(paramin)
  param.turb = false // force laminar

  const [Hk, Hk_U] = get_Hk(U, param)
  const [Hs, Hs_U] = get_Hs(U, param)
  const [Ret, Ret_U] = get_Ret(U, param)
  const HsRet = Hs * Ret
  const HsRet_U = V(i => Hs_U[i] * Ret + Hs * Ret_U[i])

  const num = 2 * 1.1 * (1 - 1 / Hk) ** 2 * (1 / Hk)
  const num_Hk = 2 * 1.1 * (2 * (1 - 1 / Hk) * (1 / Hk ** 2) * (1 / Hk) + (1 - 1 / Hk) ** 2 * (-1 / Hk ** 2))
  const cDi = num / HsRet
  return [cDi, V(i => num_Hk * Hk_U[i] / HsRet - num / HsRet ** 2 * HsRet_U[i])]
}

// -------------------------------------------------------------------------------
export function get_cDi_outer(U: Vec, param: Param): [number, Vec] {
  if (!param.turb)
    return [0, zeros()] // for pinging

  const [Hs, Hs_U] = get_Hs(U, param)
  const [Us, Us_U] = get_Us(U, param)

  // shear stress: note, state stores ct^.5
  const ct = U[2] ** 2
  const ct_U = Float64Array.of(0, 0, 2 * U[2], 0)

  const cDi = ct * (0.995 - Us) * 2 / Hs
  return [cDi, V(i => ct_U[i] * (0.995 - Us) * 2 / Hs + ct * (-Us_U[i]) * 2 / Hs - ct * (0.995 - Us) * 2 / Hs ** 2 * Hs_U[i])]
}

// -------------------------------------------------------------------------------
export function get_cDi_lamstress(U: Vec, param: Param): [number, Vec] {
  const [Hs, Hs_U] = get_Hs(U, param)
  const [Us, Us_U] = get_Us(U, param)
  const [Ret, Ret_U] = get_Ret(U, param)
  const HsRet = Hs * Ret
  const HsRet_U = V(i => Hs_U[i] * Ret + Hs * Ret_U[i])

  const num = 0.15 * (0.995 - Us) ** 2 * 2
  const num_Us = 0.15 * 2 * (0.995 - Us) * (-1) * 2
  const cDi = num / HsRet
  return [cDi, V(i => num_Us * Us_U[i] / HsRet - num / HsRet ** 2 * HsRet_U[i])]
}

// -------------------------------------------------------------------------------
export function get_Us(U: Vec, param: Param): [number, Vec] {
  const [Hs, Hs_U] = get_Hs(U, param)
  let [Hk, Hk_U] = get_Hk(U, param)
  const [H, H_U] = get_H(U)

  // limit Hk (TODO smooth/eliminate)
  if (param.wake && Hk < 1.00005) {
    Hk = 1.00005
    Hk_U = zeros()
  }
  if (!param.wake && Hk < 1.05) {
    Hk = 1.05
    Hk_U = zeros()
  }

  const beta = param.GB
  const bi = 1 / beta
  let Us = 0.5 * Hs * (1 - bi * (Hk - 1) / H)
  let Us_U = V(i => 0.5 * Hs_U[i] * (1 - bi * (Hk - 1) / H) + 0.5 * Hs * (-bi * (Hk_U[i]) / H + bi * (Hk - 1) / H ** 2 * H_U[i]))
  // limits
  if (!param.wake && Us > 0.95) {
    Us = 0.98
    Us_U = zeros()
  }
  if (!param.wake && Us > 0.99995) {
    Us = 0.99995
    Us_U = zeros()
  }
  return [Us, Us_U]
}

// -------------------------------------------------------------------------------
export function get_damp(U: Vec, param: Param): [number, Vec] {
  let [Hk, Hk_U] = get_Hk(U, param)
  const [Ret, Ret_U] = get_Ret(U, param)
  const th = U[0]

  // limit Hk (TODO smooth/eliminate)
  if (Hk < 1.05) {
    Hk = 1.05
    Hk_U = zeros()
  }

  const Hmi = 1 / (Hk - 1)
  const Hmi_U = V(i => -(Hmi ** 2) * Hk_U[i])
  const aa = 2.492 * Hmi ** 0.43
  const aa_U = V(i => 0.43 * aa / Hmi * Hmi_U[i])
  const bb = Math.tanh(14 * Hmi - 9.24)
  const bb_U = V(i => (1 - bb ** 2) * 14 * Hmi_U[i])
  const lrc = aa + 0.7 * (bb + 1)
  const lrc_U = V(i => aa_U[i] + 0.7 * bb_U[i])
  const lten = Math.log(10)
  const lr = Math.log(Ret) / lten
  const lr_U = V(i => (1 / Ret) * Ret_U[i] / lten)
  const dl = 0.1 // changed from .08 to make smoother
  let damp = 0 // default no amplification
  let damp_U = zeros(U.length)
  if (lr >= lrc - dl) {
    const rn = (lr - (lrc - dl)) / (2 * dl)
    const rn_U = V(i => (lr_U[i] - lrc_U[i]) / (2 * dl))
    let rf: number
    let rf_U: Vec
    if (rn >= 1) {
      rf = 1
      rf_U = zeros(U.length)
    }
    else {
      rf = 3 * rn ** 2 - 2 * rn ** 3
      rf_U = V(i => (6 * rn - 6 * rn ** 2) * rn_U[i])
    }
    const ar = 3.87 * Hmi - 2.52
    const ar_U = V(i => 3.87 * Hmi_U[i])
    const ex = Math.exp(-(ar ** 2))
    const ex_U = V(i => ex * (-2 * ar * ar_U[i]))
    const da = 0.028 * (Hk - 1) - 0.0345 * ex
    const da_U = V(i => 0.028 * Hk_U[i] - 0.0345 * ex_U[i])
    const af = -0.05 + 2.7 * Hmi - 5.5 * Hmi ** 2 + 3 * Hmi ** 3 + 0.1 * Math.exp(-20 * Hmi)
    const af_U = V(i => (2.7 - 11 * Hmi + 9 * Hmi ** 2 - 2 * Math.exp(-20 * Hmi)) * Hmi_U[i]) // corrected -2 (reference fix)
    damp = rf * af * da / th
    const d = damp
    damp_U = V(i => (rf_U[i] * af * da + rf * af_U[i] * da + rf * af * da_U[i]) / th - d / th * E0[i])
  }

  // extra amplification to ensure dn/dx > 0 near ncrit
  const ncrit = param.ncrit
  const Cea = 5
  const nx = Cea * (U[2] - ncrit)
  const nx_U = Float64Array.of(0, 0, Cea, 0)
  const eex = 1 + Math.tanh(nx)
  const eex_U = V(i => (1 - Math.tanh(nx) ** 2) * nx_U[i])

  const ed = eex * 0.001 / th
  const ed_U = V(i => eex_U[i] * 0.001 / th - ed / th * E0[i])
  const d_U = damp_U
  return [damp + ed, V(i => d_U[i] + ed_U[i])]
}
