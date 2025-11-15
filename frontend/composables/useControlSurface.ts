/**
 * Composable for control surface analysis operations
 */
import type { AnalysisConditions } from './useAnalysis'

export interface FlapConfig {
  deflection: number // degrees
  hinge_point: number // fraction of chord (0.5 to 0.9)
}

export interface ControlSurfaceRequest {
  airfoil_id: string
  conditions: AnalysisConditions
  flap_configs: FlapConfig[]
}

export interface ControlSurfaceGeometry {
  upper_x: number[]
  upper_y: number[]
  lower_x: number[]
  lower_y: number[]
}

export interface ControlSurfaceResult {
  deflection: number
  hinge_point: number
  geometry: ControlSurfaceGeometry
  performance: {
    alpha: number[]
    CL: number[]
    CD: number[]
    CM?: number[]
  }
}

export interface ControlSurfaceResponse {
  original_airfoil_id: string
  results: ControlSurfaceResult[]
}

export const useControlSurface = () => {
  const config = useRuntimeConfig()
  const backendUrl = config.public.backendUrl || 'http://localhost:8000'

  /**
   * Submit control surface analysis request
   */
  const submitControlSurfaceAnalysis = async (
    request: ControlSurfaceRequest
  ): Promise<ControlSurfaceResponse> => {
    const response = await $fetch<ControlSurfaceResponse>('/api/control-surface/analyze', {
      method: 'POST',
      baseURL: backendUrl,
      body: request,
    })

    return response
  }

  return {
    submitControlSurfaceAnalysis,
  }
}

