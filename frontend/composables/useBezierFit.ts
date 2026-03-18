/**
 * Composable for Bezier curve fitting operations
 */

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
  upper_sse: number
  lower_sse: number
}

export interface ReparametrizedPoints {
  upper: { x: number[]; y: number[] }
  lower: { x: number[]; y: number[] }
}

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

function evaluateBezierCurve(
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
        binomialCoeff(n, i) * Math.pow(t, n - i) * Math.pow(1 - t, i)
      x += controlPoints.x[i] * basis
      y += controlPoints.y[i] * basis
    }
    xOut.push(x)
    yOut.push(y)
  }

  return { x: xOut, y: yOut }
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
