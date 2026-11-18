/**
 * Composable for airfoil analysis operations
 */
export interface AnalysisConditions {
  Re: number
  Mach?: number
  alpha_range: [number, number, number] // [start, end, step]
  n_crit?: number
  control_surface_fraction?: number
  control_surface_deflection?: number
}

export interface AnalysisResponse {
  job_id: string | null
  cached: boolean
  results?: {
    alpha: number[]
    CL: number[]
    CD: number[]
    CM?: number[]
  }
}

export const useAnalysis = () => {
  const config = useRuntimeConfig()
  const backendUrl = config.public.backendUrl || 'http://localhost:8000'

  /**
   * Submit analysis job for single or multiple airfoils
   * Uses the unified /api/analyze endpoint
   */
  const submitAnalysis = async (
    airfoilIds: string[],
    conditions: AnalysisConditions
  ): Promise<AnalysisResponse> => {
    const response = await $fetch<AnalysisResponse>('/api/analyze', {
      method: 'POST',
      baseURL: backendUrl,
      body: {
        airfoil_ids: airfoilIds,
        conditions,
      },
    })

    return response
  }

  return {
    submitAnalysis,
  }
}

