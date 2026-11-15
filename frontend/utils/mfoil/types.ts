// State containers of the mfoil port, mirroring the Python classes in references/mfoil/mfoil.py
// (same field names and defaults; plotting/verbosity-only fields dropped).
//
// Conventions used by every mfoil module:
// - vectors are Float64Array; index lists and integer flags are Int32Array (0-based);
// - a Python 2-D array of shape [r, c] is a flat row-major Float64Array of length r*c, with
//   [i, j] at i*c + j: foil.x [2, N] has x at j and z at N + j; glob.U [4, Nsys] has U[k*Nsys + j];
// - one station state is a Float64Array(4) = [th, ds, sa, ue];
// - Python functions returning (value, derivative, ...) return a tuple [value, derivative, ...]
//   in the same order.

import type { LU } from './linalg.ts'

export interface Geom {
  chord: number // chord length
  wakelen: number // wake extent length, in chords
  npoint: number // number of geometry representation points
  name: string // airfoil name
  xpoint: Float64Array // point coordinates [2, npoint]
  xref: Float64Array // moment reference point
}

export interface Panel {
  N: number // number of nodes
  x: Float64Array // node coordinates [2, N]
  s: Float64Array // arclength values at nodes
  t: Float64Array // dx/ds, dz/ds tangents at nodes [2, N]
}

export interface Oper {
  Vinf: number
  alpha: number // degrees
  rho: number
  initbl: boolean
  viscous: boolean
  Re: number
  Ma: number
}

export interface Isol {
  AIC: Float64Array // aero influence coefficient matrix [N+1, N+1]
  AIC_lu: LU | null // port addition: LU factors of AIC, reused by calc_ue_m
  gamref: Float64Array // 0,90-deg alpha vortex strengths [N, 2]
  gam: Float64Array // vortex strengths at the current alpha [N]
  sstag: number
  sstag_g: Float64Array // [2]
  sstag_ue: Float64Array // [2]
  Istag: Int32Array // [2] node indices before/after stagnation
  sgnue: Float64Array // +/- 1 on upper/lower surface nodes [N]
  xi: Float64Array // distance from stagnation at all points [Nsys]
  xstag: Float64Array // [2] stagnation point coordinates (set by stagpoint_find)
  uewi: Float64Array // inviscid edge velocity in wake [Nw] (Python [Nw, 1])
  uewiref: Float64Array // 0,90-deg alpha inviscid ue in wake [Nw, 2]
}

export interface Vsol {
  th: Float64Array
  ds: Float64Array
  Is: Int32Array[] // 3 index lists: lower, upper, wake
  wgap: Float64Array // wake gap over wake points
  ue_m: Float64Array // d(ue)/d(mass), dense [Nsys, Nsys]
  sigma_m: Float64Array // d(source)/d(mass), dense [N+Nw-2, Nsys]
  ue_sigma: Float64Array // d(ue)/d(source), dense [Nsys, N+Nw-2]
  turb: Int32Array // 0 = laminar, 1 = turbulent, per node
  xt: number
  Xt: Float64Array // transition xi/x for lower and upper surfaces [2, 2]
}

export interface Glob {
  Nsys: number
  U: Float64Array // [4, Nsys]
  dU: Float64Array
  conv: boolean
  R: Float64Array // [3*Nsys]
  // Jacobians: sparse in Python, dense row-major here; layout documented at the top of viscous.ts
  R_U: Float64Array
  R_x: Float64Array
  R_V: Float64Array
}

export interface Post {
  cp: Float64Array
  cpi: Float64Array
  cl: number
  cm: number
  cdpi: number
  cd: number
  cdf: number
  cdp: number
  th: Float64Array
  ds: Float64Array
  sa: Float64Array
  ue: Float64Array
  uei: Float64Array
  cf: Float64Array
  Ret: Float64Array
  Hk: Float64Array
}

export interface Param {
  rtol: number
  niglob: number
  ncrit: number
  Cuq: number
  Dlr: number
  SlagK: number
  CtauC: number
  CtauE: number
  GA: number
  GB: number
  GC: number
  Minf: number
  Vinf: number
  muinf: number
  mu0: number
  rho0: number
  H0: number
  Tsrat: number
  gam: number
  KTb: number
  KTl: number
  cps: number
  simi: boolean
  turb: boolean
  wake: boolean
}

export interface Mfoil {
  geom: Geom
  foil: Panel
  wake: Panel
  oper: Oper
  isol: Isol
  vsol: Vsol
  glob: Glob
  post: Post
  param: Param
}

const empty = () => new Float64Array(0)

export function newGeom(): Geom {
  return { chord: 1, wakelen: 1, npoint: 1, name: 'noname', xpoint: empty(), xref: Float64Array.of(0.25, 0) }
}

export function newPanel(): Panel {
  return { N: 0, x: empty(), s: empty(), t: empty() }
}

export function newOper(): Oper {
  return { Vinf: 1, alpha: 0, rho: 1, initbl: true, viscous: false, Re: 1e5, Ma: 0 }
}

export function newIsol(): Isol {
  return {
    AIC: empty(),
    AIC_lu: null,
    gamref: empty(),
    gam: empty(),
    sstag: 0,
    sstag_g: new Float64Array(2),
    sstag_ue: new Float64Array(2),
    Istag: new Int32Array(2),
    sgnue: empty(),
    xi: empty(),
    xstag: new Float64Array(2),
    uewi: empty(),
    uewiref: empty(),
  }
}

export function newVsol(): Vsol {
  return { th: empty(), ds: empty(), Is: [], wgap: empty(), ue_m: empty(), sigma_m: empty(), ue_sigma: empty(), turb: new Int32Array(0), xt: 0, Xt: new Float64Array(4) }
}

export function newGlob(): Glob {
  return { Nsys: 0, U: empty(), dU: empty(), conv: true, R: empty(), R_U: empty(), R_x: empty(), R_V: empty() }
}

export function newPost(): Post {
  return {
    cp: empty(),
    cpi: empty(),
    cl: 0,
    cm: 0,
    cdpi: 0,
    cd: 0,
    cdf: 0,
    cdp: 0,
    th: empty(),
    ds: empty(),
    sa: empty(),
    ue: empty(),
    uei: empty(),
    cf: empty(),
    Ret: empty(),
    Hk: empty(),
  }
}

export function newParam(): Param {
  return {
    rtol: 1e-10,
    niglob: 50,
    ncrit: 9.0,
    Cuq: 1.0,
    Dlr: 0.9,
    SlagK: 5.6,
    CtauC: 1.8,
    CtauE: 3.3,
    GA: 6.7,
    GB: 0.75,
    GC: 18.0,
    Minf: 0,
    Vinf: 0,
    muinf: 0,
    mu0: 0,
    rho0: 1,
    H0: 0,
    Tsrat: 0.35,
    gam: 1.4,
    KTb: 1,
    KTl: 0,
    cps: 0,
    simi: false,
    turb: false,
    wake: false,
  }
}

// copy.deepcopy(param): every Param field is a scalar, so a shallow copy is a deep copy
export function copyParam(p: Param): Param {
  return { ...p }
}

export function newMfoilState(): Mfoil {
  return { geom: newGeom(), foil: newPanel(), wake: newPanel(), oper: newOper(), isol: newIsol(), vsol: newVsol(), glob: newGlob(), post: newPost(), param: newParam() }
}
