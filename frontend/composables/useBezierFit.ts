/**
 * Composable for Bezier curve fitting operations
 */
import { removeDuplicates, sortLowerCoordinates, sortUpperCoordinates } from '~/composables/useAirfoilDownload'

export interface BezierControlPoints {
  x: number[]
  y: number[]
}

export interface BezierCurveData {
  x: number[]
  y: number[]
}

export interface BezierFitRequest {
  upper_x: number[]
  upper_y: number[]
  lower_x: number[]
  lower_y: number[]
  order: number
}

export interface BezierFitResponse {
  upper_control_points: BezierControlPoints
  lower_control_points: BezierControlPoints
  upper_curve: BezierCurveData
  lower_curve: BezierCurveData
  order: number
  upper_max_error_pct: number
  lower_max_error_pct: number
}

export interface ReparametrizedPoints {
  upper: { x: number[]; y: number[] }
  lower: { x: number[]; y: number[] }
}

const CURVE_SAMPLE_COUNT = 200

function binomialCoeff(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  let result = 1
  for (let i = 0; i < Math.min(k, n - k); i++) {
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

function generateCosineSpacing(numPoints: number): number[] {
  const t: number[] = []
  for (let i = 0; i < numPoints; i++) {
    const theta = (i / (numPoints - 1)) * Math.PI
    t.push((1 - Math.cos(theta)) / 2)
  }
  return t
}

function generateUniformSpacing(numPoints: number): number[] {
  if (numPoints <= 1)
    return [0]
  return Array.from({ length: numPoints }, (_, i) => i / (numPoints - 1))
}

/** Evaluate a Bezier curve at the given parameter values. */
export function evaluateBezierCurve(
  controlPoints: BezierControlPoints,
  tValues: number[]
): { x: number[]; y: number[] } {
  const n = controlPoints.x.length - 1
  const xOut: number[] = []
  const yOut: number[] = []

  for (const t of tValues) {
    let x = 0
    let y = 0
    for (let i = 0; i <= n; i++) {
      const basis =
        binomialCoeff(n, i) * Math.pow(t, i) * Math.pow(1 - t, n - i)
      x += controlPoints.x[i] * basis
      y += controlPoints.y[i] * basis
    }
    xOut.push(x)
    yOut.push(y)
  }

  return { x: xOut, y: yOut }
}

/** Rebuild fitted curve samples from control points (matches backend sample count). */
export function regenerateFittedCurve(controlPoints: BezierControlPoints): BezierCurveData {
  return evaluateBezierCurve(controlPoints, generateUniformSpacing(CURVE_SAMPLE_COUNT))
}

export function reparametrizeBezierPoints(
  fitResponse: BezierFitResponse,
  numPoints: number
): ReparametrizedPoints {
  const tValues = generateCosineSpacing(numPoints)
  return {
    upper: evaluateBezierCurve(fitResponse.upper_control_points, tValues),
    lower: evaluateBezierCurve(fitResponse.lower_control_points, tValues),
  }
}

export interface CurvatureData {
  x: number[]
  k: number[]
}

/** Scaled forward differences: control points of a degree-n Bezier's derivative. */
function derivativeControlPoints(cp: BezierControlPoints): BezierControlPoints {
  const n = cp.x.length - 1
  return {
    x: cp.x.slice(1).map((x, i) => n * (x - cp.x[i])),
    y: cp.y.slice(1).map((y, i) => n * (y - cp.y[i])),
  }
}

/**
 * Exact curvature of a fitted Bezier surface, sampled with cosine spacing.
 * Sign: positive where the surface bulges outward (convex), for both surfaces.
 */
export function bezierCurvature(
  cp: BezierControlPoints,
  surface: 'upper' | 'lower',
  numPoints: number = CURVE_SAMPLE_COUNT,
): CurvatureData {
  const t = generateCosineSpacing(numPoints)
  const p = evaluateBezierCurve(cp, t)
  const d1cp = derivativeControlPoints(cp)
  const d1 = evaluateBezierCurve(d1cp, t)
  const d2 = evaluateBezierCurve(derivativeControlPoints(d1cp), t)
  // Signed curvature depends on travel direction; normalise so convex is positive.
  const dir = Math.sign(cp.x[cp.x.length - 1] - cp.x[0]) || 1
  const s = (surface === 'upper' ? -1 : 1) * dir
  const k = t.map((_, i) => {
    const speed = Math.hypot(d1.x[i], d1.y[i])
    return s * (d1.x[i] * d2.y[i] - d1.y[i] * d2.x[i]) / speed ** 3
  })
  return { x: p.x, k }
}

/**
 * Discrete curvature of raw points (circle through each point and its neighbours).
 * Walks the closed loop upper TE->LE->lower TE (counter-clockwise), so convex is positive
 * and the leading-edge point gets a value. The two trailing-edge ends have none.
 */
export function discreteCurvature(
  upperX: number[],
  upperY: number[],
  lowerX: number[],
  lowerY: number[],
): { upper: CurvatureData; lower: CurvatureData } {
  const upper = sortUpperCoordinates(upperX, upperY)
  const loop = removeDuplicates([...upper, ...sortLowerCoordinates(lowerX, lowerY)])
  const upperEnd = removeDuplicates(upper).length // index after the leading-edge point
  const result = { upper: { x: [] as number[], k: [] as number[] }, lower: { x: [] as number[], k: [] as number[] } }

  for (let i = 1; i < loop.length - 1; i++) {
    const [ax, ay] = loop[i - 1]
    const [bx, by] = loop[i]
    const [cx, cy] = loop[i + 1]
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx)
    const k = 2 * cross / (Math.hypot(bx - ax, by - ay) * Math.hypot(cx - bx, cy - by) * Math.hypot(cx - ax, cy - ay))
    const target = i < upperEnd ? result.upper : result.lower
    target.x.push(bx)
    target.k.push(k)
  }
  return result
}

export const useBezierFit = () => {
  const config = useRuntimeConfig()
  const backendUrl = config.public.backendUrl || 'http://localhost:8000'

  /**
   * Submit Bezier curve fitting request
   */
  const submitBezierFit = async (
    request: BezierFitRequest
  ): Promise<BezierFitResponse> => {
    const response = await $fetch<BezierFitResponse>('/api/bezier-fit', {
      method: 'POST',
      baseURL: backendUrl,
      body: request,
    })

    return response
  }

  return {
    submitBezierFit,
  }
}
