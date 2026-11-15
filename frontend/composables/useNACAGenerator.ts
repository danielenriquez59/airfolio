/**
 * Composable for NACA 4-digit (and modified), 5-digit (and reflex), 16-series and 6-series airfoil generation
 * Implements the NACA airfoil specification mathematics
 */

import { NACA6_TABLES, type NACA6Family } from '../utils/naca6Tables.ts'
import { RIBLETT_MEANLINES, RIBLETT_STATIONS, RIBLETT_THICKNESS, type RiblettCusp, type RiblettSeries } from '../utils/riblettTables.ts'

export type { NACA6Family }

export interface RiblettParams {
  series: RiblettSeries // Max thickness position, percent chord
  cusp: RiblettCusp // '-' standard cusp, 'A' reduced cusp
  cl: number // Design lift coefficient of the mean line (0-0.6)
  t: number // Max thickness (fraction of chord)
  sharpTE: boolean // Close the trailing edge to zero thickness
}

export interface NACA4Params {
  m: number // Max camber (as fraction of chord, 0-0.095)
  p: number // Position of max camber (as fraction of chord, 0.1-0.9)
  t: number // Max thickness (as fraction of chord, 0.01-0.40)
  modified?: boolean // Modified 4-digit thickness (NACA 0012-64)
  le?: number // Leading-edge radius index, 0-9 (modified only; 6 = the plain 4-digit radius)
  xt?: number // Position of max thickness, 0.2-0.6 (modified only)
}

export interface NACA16Params {
  t: number // Max thickness (fraction of chord, 0.06-0.21)
  cl: number // Design lift coefficient of the a = 1 mean line
}

export interface NACA5Params {
  cl: number // Design lift coefficient (0-1.5)
  p: number // Position of max camber (as fraction of chord, 0.05-0.25)
  t: number // Max thickness (as fraction of chord, 0.01-0.40)
  isReflex: boolean // Reflex mean line (p 0.10-0.25)
}

export interface NACA6Params {
  family: NACA6Family
  t: number // Max thickness (fraction of chord, 0.06-0.21)
  cl: number // Design lift coefficient of the mean line
  a: number // Chordwise extent of uniform loading (ignored for A families)
}

// Parameter ranges of the generator UI; specs outside them are rejected
export const NACA_RANGES = {
  '4-digit': { m: [0, 0.095], p: [0.1, 0.9], t: [0.01, 0.4], le: [0, 9], xt: [0.2, 0.6] },
  '5-digit': { cl: [0, 1.5], p: [0.05, 0.25], t: [0.01, 0.4], pReflex: [0.1, 0.25] }, // the reflex table starts at 0.10
  '16-series': { t: [0.06, 0.21], cl: [0, 1] },
  '6-series': { t: [0.06, 0.21], cl: [0, 1], a: [0, 1] },
  'riblett': { cl: [0, 0.6], t: [0.06, 0.24] },
} as const

export interface NACACoordinates {
  upperX: number[]
  upperY: number[]
  lowerX: number[]
  lowerY: number[]
}

// Constants for thickness distribution
const A0 = 0.2969
const A1 = -0.1260
const A2 = -0.3516
const A3 = 0.2843
const A4 = -0.1015 // Closed trailing edge constant

/**
 * Calculate Half Thickness (yt) at position x for a given max thickness t
 */
const calculateThickness = (x: number, t: number): number => {
  const term1 = A0 * Math.sqrt(x)
  const term2 = A1 * x
  const term3 = A2 * Math.pow(x, 2)
  const term4 = A3 * Math.pow(x, 3)
  const term5 = A4 * Math.pow(x, 4)
  return 5 * t * (term1 + term2 + term3 + term4 + term5)
}

/**
 * Modified 4-digit half thickness (PDAS naca456 Thickness4M): le = leading-edge radius index, xt = position of max thickness
 */
export const thickness4M = (t: number, le: number, xt: number, x: number): number => {
  const d1 = (((-10.420597 * xt + 19.961478) * xt - 10.127712) * xt + 2.3076628) * xt + 3.48e-5 // trailing-edge half angle fit
  const rle = (1.1019 / 36) * (t * le) ** 2
  const a0 = (0.2 / t) * Math.sqrt(2 * rle)
  const om = 1 - xt
  const a3 = 0.1 / xt ** 3 + (d1 * om - 0.294) / (xt * om * om) - (3 / 8) * a0 / xt ** 2.5
  const a2 = -0.1 / (xt * xt) + (0.5 * a0) / xt ** 1.5 - 2 * a3 * xt
  const a1 = (-0.5 * a0) / Math.sqrt(xt) - 2 * a2 * xt - 3 * a3 * xt * xt
  const d3 = (3 * d1 - 0.588 / om) / (3 * om * om)
  const d2 = -1.5 * om * d3 - (0.5 * d1) / om
  const u = 1 - x
  const y = x < xt ? a0 * Math.sqrt(x) + x * (a1 + x * (a2 + x * a3)) : 0.002 + u * (d1 + u * (d2 + u * d3))
  return 5 * t * y
}

const cosineX = (n: number) => Array.from({ length: n + 1 }, (_, i) => (1 - Math.cos((i / n) * Math.PI)) / 2)

/**
 * Thickness laid perpendicular to the mean line at each x, both surfaces LE to TE
 */
export const sectionPoints = (xs: number[], thickness: (x: number) => number, mean: (x: number) => { y: number; dy: number }): NACACoordinates => {
  const c: NACACoordinates = { upperX: [], upperY: [], lowerX: [], lowerY: [] }
  for (const x of xs) {
    const yt = thickness(x)
    const { y, dy } = mean(x)
    const theta = Math.atan(dy)
    c.upperX.push(x - yt * Math.sin(theta))
    c.upperY.push(y + yt * Math.cos(theta))
    c.lowerX.push(x + yt * Math.sin(theta))
    c.lowerY.push(y - yt * Math.cos(theta))
  }
  return c
}

/**
 * NACA 4-Digit Series Calculation
 */
export const generateNACA4 = (
  params: NACA4Params,
  numPoints: number = 100
): NACACoordinates => {
  const { m, p, t } = params

  const upperX: number[] = []
  const upperY: number[] = []
  const lowerX: number[] = []
  const lowerY: number[] = []

  for (let i = 0; i <= numPoints; i++) {
    // Cosine spacing for better density at leading/trailing edges
    const beta = (i / numPoints) * Math.PI
    const x = (1 - Math.cos(beta)) / 2

    let yc = 0
    let dyc_dx = 0

    if (p === 0 || m === 0) {
      // Symmetric airfoil
      yc = 0
      dyc_dx = 0
    } else {
      if (x < p) {
        yc = (m / Math.pow(p, 2)) * (2 * p * x - Math.pow(x, 2))
        dyc_dx = (2 * m / Math.pow(p, 2)) * (p - x)
      } else {
        yc = (m / Math.pow(1 - p, 2)) * ((1 - 2 * p) + 2 * p * x - Math.pow(x, 2))
        dyc_dx = (2 * m / Math.pow(1 - p, 2)) * (p - x)
      }
    }

    const yt = params.modified ? thickness4M(t, params.le!, params.xt!, x) : calculateThickness(x, t)
    const theta = Math.atan(dyc_dx)

    const xu = x - yt * Math.sin(theta)
    const yu = yc + yt * Math.cos(theta)
    const xl = x + yt * Math.sin(theta)
    const yl = yc - yt * Math.cos(theta)

    upperX.push(xu)
    upperY.push(yu)
    lowerX.push(xl)
    lowerY.push(yl)
  }

  return { upperX, upperY, lowerX, lowerY }
}

/**
 * NACA 5-Digit Series Calculation
 * Based on standard 5-digit series (23012 etc.)
 */
interface FiveDigitCoeffs {
  p: number // Position
  r: number // m equivalent
  k1: number // k1 constant
}

// Table for standard 5-digit camber lines (Ref: Theory of Wing Sections)
const FIVE_DIGIT_TABLE: FiveDigitCoeffs[] = [
  { p: 0.05, r: 0.0580, k1: 361.400 },
  { p: 0.10, r: 0.1260, k1: 51.640 },
  { p: 0.15, r: 0.2025, k1: 15.957 },
  { p: 0.20, r: 0.2900, k1: 6.643 },
  { p: 0.25, r: 0.3910, k1: 3.230 },
]

// NACA Report 537 / naca456 GetRk1k2; the reflex table has no 0.05 entry
const REFLEX_TABLE: FiveDigitCoeffs[] = [
  { p: 0.10, r: 0.130, k1: 51.990 },
  { p: 0.15, r: 0.217, k1: 15.793 },
  { p: 0.20, r: 0.318, k1: 6.520 },
  { p: 0.25, r: 0.441, k1: 3.191 },
]

const getFiveDigitCoeffs = (pInput: number, sorted: FiveDigitCoeffs[]): { r: number; k1: number } => {
  // Clamp to the table ends, else interpolate linearly
  if (pInput <= sorted[0].p) return { r: sorted[0].r, k1: sorted[0].k1 }
  if (pInput >= sorted[sorted.length - 1].p)
    return { r: sorted[sorted.length - 1].r, k1: sorted[sorted.length - 1].k1 }

  for (let i = 0; i < sorted.length - 1; i++) {
    if (pInput >= sorted[i].p && pInput <= sorted[i + 1].p) {
      const t = (pInput - sorted[i].p) / (sorted[i + 1].p - sorted[i].p)
      const r = sorted[i].r + t * (sorted[i + 1].r - sorted[i].r)
      const k1 = sorted[i].k1 + t * (sorted[i + 1].k1 - sorted[i].k1)
      return { r, k1 }
    }
  }

  return { r: 0.0580, k1: 361.400 } // Default fallback
}

/**
 * 5-digit mean line: the tabulated k1, r are for design cl = 0.3, so the line scales by cl / 0.3.
 * Reflex (naca456 MeanLine3Reflex) bends the line back up behind x = r so the moment goes to about zero.
 */
export const meanLine5 = ({ cl, p, isReflex }: NACA5Params, x: number): { y: number; dy: number } => {
  const { r, k1 } = getFiveDigitCoeffs(p, isReflex ? REFLEX_TABLE : FIVE_DIGIT_TABLE)
  const s = (k1 / 6) * (cl / 0.3)
  if (isReflex) {
    const k2 = (3 * (r - p) ** 2 - r ** 3) / (1 - r) ** 3 // the formula, not the misprinted TM 4741 table
    const r3 = r ** 3
    const mr3 = (1 - r) ** 3
    const c = x < r ? 1 : k2
    return { y: s * (c * (x - r) ** 3 - k2 * mr3 * x - x * r3 + r3), dy: s * (3 * c * (x - r) ** 2 - k2 * mr3 - r3) }
  }
  if (x < r) return { y: s * (x ** 3 - 3 * r * x * x + r * r * (3 - r) * x), dy: s * (3 * x * x - 6 * r * x + r * r * (3 - r)) }
  return { y: s * r ** 3 * (1 - x), dy: -s * r ** 3 }
}

export const generateNACA5 = (params: NACA5Params, numPoints: number = 100): NACACoordinates =>
  sectionPoints(cosineX(numPoints), x => calculateThickness(x, params.t), x => meanLine5(params, x))

/**
 * NACA 16-series: modified 4-digit thickness with le = 4, xt = 0.5, and the a = 1 mean line
 */
export const generateNACA16 = ({ t, cl }: NACA16Params, numPoints: number = 100): NACACoordinates =>
  sectionPoints(cosineX(numPoints), x => thickness4M(t, 4, 0.5, x), x => meanLine6(1, cl, x))

/**
 * NACA 6- and 6A-series, following PDAS naca456 (SetSixDigitPoints, MeanLine6, MeanLine6M)
 */
const EPS = 1e-7

/**
 * Half-thickness points from the conformal mapping of a circle; spacing is fixed by the tables (201 points, LE to TE)
 */
export const naca6ThicknessPoints = (family: NACA6Family, t: number): { x: number[]; y: number[] } => {
  const { eps, psi, scale } = NACA6_TABLES[family]
  const sf = scale.reduceRight((acc, c) => acc * t + c, 0)
  // z' = z*exp((psi - psi0) - i*eps) = exp(psi + i*(phi - eps)), so zeta = z' + 1/z' splits into real and imaginary parts directly
  const re: number[] = []
  const im: number[] = []
  for (let k = 0; k <= 200; k++) {
    const r = Math.exp(sf * psi[k])
    const th = (Math.PI * k) / 200 - sf * eps[k]
    re.push((r + 1 / r) * Math.cos(th))
    im.push((r - 1 / r) * Math.sin(th))
  }
  const len = Math.hypot(re[200] - re[0], im[200] - im[0])
  return { x: re.map((v) => (re[0] - v) / len), y: im.map((v) => (v - im[0]) / len) }
}

// Abbott & von Doenhoff eq. 4-26/4-27 before the cl scaling; needs 0 < x < 1 and a < 1
const meanLineCore = (a: number, x: number) => {
  const oma = 1 - a
  const omx = 1 - x
  const g = a < EPS ? -0.25 : -(a * a * (0.5 * Math.log(a) - 0.25) + 0.25) / oma
  const h = a < EPS ? -0.5 : g + (0.5 * oma * oma * Math.log(oma) - 0.25 * oma * oma) / oma
  const amx = a - x
  const atA = Math.abs(amx) < EPS
  const term1 = atA ? 0 : amx * amx * (2 * Math.log(Math.abs(amx)) - 1)
  const term1p = atA ? 0 : -amx * Math.log(Math.abs(amx))
  const term2 = omx * omx * (1 - 2 * Math.log(omx))
  const term2p = omx * Math.log(omx)
  return {
    y: (0.25 * (term1 + term2)) / oma - x * Math.log(x) + g - h * x,
    dy: (term1p + term2p) / oma - 1 - Math.log(x) - h,
  }
}

/**
 * 6-series mean line with uniform loading up to x = a
 */
export const meanLine6 = (a: number, cl: number, x: number): { y: number; dy: number } => {
  if (x < EPS || 1 - x < EPS) return { y: 0, dy: 0 }
  if (Math.abs(1 - a) < EPS) {
    const k = cl / (4 * Math.PI)
    return { y: -k * ((1 - x) * Math.log(1 - x) + x * Math.log(x)), dy: k * (Math.log(1 - x) - Math.log(x)) }
  }
  const { y, dy } = meanLineCore(a, x)
  const k = cl / (2 * Math.PI * (a + 1))
  return { y: k * y, dy: k * dy }
}

/**
 * Modified a = 0.8 mean line of the 6A series (NACA Report 903): straight from x = 0.86 to the trailing edge
 */
export const meanLine6M = (cl: number, x: number): { y: number; dy: number } => {
  const teSlope = -0.24521 * cl
  if (x > 0.86) return { y: teSlope * (x - 1), dy: teSlope }
  if (x < EPS) return { y: 0, dy: 0 }
  const { y, dy } = meanLineCore(0.8, x)
  const k = (cl * 0.97948) / (2 * Math.PI * 1.8)
  return { y: k * y, dy: k * dy }
}

export const generateNACA6 = (params: NACA6Params): NACACoordinates => {
  const { family, t, cl, a } = params
  const { x, y: thickness } = naca6ThicknessPoints(family, t)
  const isA = family.endsWith('A')

  const upperX: number[] = []
  const upperY: number[] = []
  const lowerX: number[] = []
  const lowerY: number[] = []

  x.forEach((xi, i) => {
    const { y: yc, dy } = isA ? meanLine6M(cl, xi) : meanLine6(a, cl, xi)
    const yt = thickness[i]
    const theta = Math.atan(dy)
    upperX.push(xi - yt * Math.sin(theta))
    upperY.push(yc + yt * Math.cos(theta))
    lowerX.push(xi + yt * Math.sin(theta))
    lowerY.push(yc - yt * Math.cos(theta))
  })

  return { upperX, upperY, lowerX, lowerY }
}

// Riblett GA: tabulated mean line (linearly blended between tables) ± thickness table scaled from 15%
export const generateRiblett = ({ series, cusp, cl, t, sharpTE }: RiblettParams): NACACoordinates => {
  const camber = cl * 10
  const keys = Object.keys(RIBLETT_MEANLINES).map(Number).sort((a, b) => a - b)
  const hi = keys.find(k => k >= camber) ?? keys[keys.length - 1]
  const lo = [...keys].reverse().find(k => k <= camber) ?? keys[0]
  const w = hi === lo ? 0 : (hi - camber) / (hi - lo)
  const mean = RIBLETT_MEANLINES[lo].map((y, i) => w * y + (1 - w) * RIBLETT_MEANLINES[hi][i])
  const half = RIBLETT_THICKNESS[`${series}${cusp}`].map(d => (t * 100 / 15) * d)

  let upper = mean.map((m, i) => m + half[i])
  let lower = mean.map((m, i) => m - half[i])
  if (sharpTE) {
    const last = RIBLETT_STATIONS.length - 1
    const uTE = upper[last]
    const lTE = lower[last]
    upper = upper.map((y, i) => y - uTE * RIBLETT_STATIONS[i] / 100)
    lower = lower.map((y, i) => y - lTE * RIBLETT_STATIONS[i] / 100)
  }

  const x = RIBLETT_STATIONS.map(s => s / 100)
  return { upperX: x, upperY: upper.map(y => y / 100), lowerX: [...x], lowerY: lower.map(y => y / 100) }
}

// Riblett style: GA 35A415; fractional values go in brackets, GA 35A[3.5]15
export const generateRiblettName = ({ series, cusp, cl, t }: RiblettParams): string => {
  const fmt = (v: number, width: number) => {
    const r = Math.round(v)
    return Math.abs(v - r) < 1e-6 ? r.toString().padStart(width, '0') : `[${+v.toFixed(2)}]`
  }
  return `GA ${series}${cusp}${fmt(cl * 10, 1)}${fmt(t * 100, 2)}`
}

/**
 * Generate NACA designation string from parameters
 */
export const generateNACA4Name = (params: NACA4Params): string => {
  const mInt = Math.round(params.m * 100)
  const pInt = mInt === 0 ? 0 : Math.round(params.p * 10) // symmetric sections are 00xx
  const tInt = Math.round(params.t * 100)
  const base = `NACA ${mInt}${pInt}${tInt.toString().padStart(2, '0')}`
  // Modified: -IX, leading-edge radius index then max thickness position in tenths (0012-64)
  return params.modified ? `${base}-${Math.round(params.le!)}${Math.round(params.xt! * 10)}` : base
}

export const generateNACA16Name = ({ t, cl }: NACA16Params): string =>
  `NACA 16-${Math.round(cl * 10)}${Math.round(t * 100).toString().padStart(2, '0')}`

export const generateNACA5Name = (params: NACA5Params): string => {
  // 5 Digit Naming: L P Q XX
  // L = Cl * (20/3). Example Cl=0.3 -> L=2.
  const L = Math.round(params.cl * (20 / 3))
  // No camber: the shape is the symmetric 4-digit section, and L = 0 has no 5-digit meaning
  if (L === 0) return `NACA 00${Math.round(params.t * 100).toString().padStart(2, '0')}`
  // P = pos * 20. Example 0.15 -> P=3.
  const P = Math.round(params.p * 20)
  // Q = 0 for standard, 1 for reflex
  const Q = params.isReflex ? 1 : 0
  const XX = Math.round(params.t * 100)
    .toString()
    .padStart(2, '0')

  return `NACA ${L}${P}${Q}${XX}`
}

export const generateNACA6Name = ({ family, t, cl, a }: NACA6Params): string => {
  const tPercent = Math.round(t * 100)
  // Low-drag-range subscript, written in parentheses: 64(1)-212
  const range = Math.min(4, Math.max(0, Math.round((tPercent - 9) / 3)))
  const series = family.slice(0, 2) + (range ? `(${range})` : '')
  const digits = `${Math.round(cl * 10)}${tPercent.toString().padStart(2, '0')}`
  if (family.endsWith('A')) return `NACA ${series}A${digits}`
  return `NACA ${series}-${digits}${Math.abs(a - 1) > EPS ? ` a=${a}` : ''}`
}

// Designation run together for filenames: NACA 64(1)-412 a=0.5 -> 641412a05
export const compactNACA6Name = (params: NACA6Params): string =>
  generateNACA6Name(params).slice(5).replace(/[^0-9A-Za-z]/g, '')

/**
 * Composable function
 */
export const useNACAGenerator = () => {
  return {
    generateNACA4,
    generateNACA5,
    generateNACA6,
    generateNACA4Name,
    generateNACA5Name,
    generateNACA6Name,
    compactNACA6Name,
    generateNACA16,
    generateNACA16Name,
    generateRiblett,
    generateRiblettName,
  }
}

