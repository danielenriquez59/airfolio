/**
 * Composable for NACA 4-digit and 5-digit series airfoil generation
 * Implements the NACA airfoil specification mathematics
 */

export interface NACA4Params {
  m: number // Max camber (as fraction of chord, 0-0.095)
  p: number // Position of max camber (as fraction of chord, 0.1-0.9)
  t: number // Max thickness (as fraction of chord, 0.01-0.40)
}

export interface NACA5Params {
  cl: number // Design lift coefficient (0-1.5)
  p: number // Position of max camber (as fraction of chord, 0.05-0.25)
  t: number // Max thickness (as fraction of chord, 0.01-0.40)
  isReflex: boolean // Reflex camber (for future use)
}

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

    const yt = calculateThickness(x, t)
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

const getFiveDigitCoeffs = (pInput: number): { r: number; k1: number } => {
  // Find the closest standard position or interpolate
  const sorted = [...FIVE_DIGIT_TABLE].sort((a, b) => a.p - b.p)

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

export const generateNACA5 = (
  params: NACA5Params,
  numPoints: number = 100
): NACACoordinates => {
  const { cl, p, t } = params

  const upperX: number[] = []
  const upperY: number[] = []
  const lowerX: number[] = []
  const lowerY: number[] = []

  // The standard camber line is designed for a specific Cl (usually 0.3).
  // We need to scale the camber line to match the requested Cl.
  const { r, k1 } = getFiveDigitCoeffs(p)

  // Standard 5-digit assumes the derived k1/r values correspond to a design Cl of 0.3.
  // If the user requests Cl = 0.6, we scale the camber line by 2.
  const designClBase = 0.3
  const scaleFactor = cl / designClBase

  for (let i = 0; i <= numPoints; i++) {
    const beta = (i / numPoints) * Math.PI
    const x = (1 - Math.cos(beta)) / 2

    let ycStandard = 0
    let dycStandard = 0

    if (x < r) {
      // Front section
      // yc = (k1/6) * (x^3 - 3rx^2 + r^2(3-r)x)
      ycStandard =
        (k1 / 6) *
        (Math.pow(x, 3) -
          3 * r * Math.pow(x, 2) +
          Math.pow(r, 2) * (3 - r) * x)
      // dyc/dx = (k1/6) * (3x^2 - 6rx + r^2(3-r))
      dycStandard =
        (k1 / 6) * (3 * Math.pow(x, 2) - 6 * r * x + Math.pow(r, 2) * (3 - r))
    } else {
      // Back section
      // yc = (k1 * r^3 / 6) * (1 - x)
      ycStandard = (k1 * Math.pow(r, 3) / 6) * (1 - x)
      // dyc/dx = - (k1 * r^3 / 6)
      dycStandard = -1 * (k1 * Math.pow(r, 3) / 6)
    }

    const yc = ycStandard * scaleFactor
    const dyc_dx = dycStandard * scaleFactor

    const yt = calculateThickness(x, t)
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
 * Generate NACA designation string from parameters
 */
export const generateNACA4Name = (params: NACA4Params): string => {
  const mInt = Math.round(params.m * 100)
  const pInt = Math.round(params.p * 10)
  const tInt = Math.round(params.t * 100)
  return `NACA ${mInt}${pInt}${tInt.toString().padStart(2, '0')}`
}

export const generateNACA5Name = (params: NACA5Params): string => {
  // 5 Digit Naming: L P Q XX
  // L = Cl * (20/3). Example Cl=0.3 -> L=2.
  const L = Math.round(params.cl * (20 / 3))
  // P = pos * 20. Example 0.15 -> P=3.
  const P = Math.round(params.p * 20)
  // Q = 0 for standard, 1 for reflex
  const Q = params.isReflex ? 1 : 0
  const XX = Math.round(params.t * 100)
    .toString()
    .padStart(2, '0')

  return `NACA ${L}${P}${Q}${XX}`
}

/**
 * Composable function
 */
export const useNACAGenerator = () => {
  return {
    generateNACA4,
    generateNACA5,
    generateNACA4Name,
    generateNACA5Name,
  }
}

