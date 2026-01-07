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
