/**
 * Composable for airfoil analysis operations
 */
import type { Database } from '~/types/database.types'

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

export interface JobStatus {
  job_id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  progress: number
  result_location: string | null
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

  /**
   * Submit comparison analysis for multiple airfoils
   * Alias for submitAnalysis with multiple airfoils
   */
  const submitComparisonAnalysis = async (
    airfoilIds: string[],
    conditions: AnalysisConditions
  ): Promise<AnalysisResponse> => {
    return submitAnalysis(airfoilIds, conditions)
  }

  /**
   * Get analysis job status
   */
  const fetchJobStatus = async (jobId: string): Promise<JobStatus> => {
    const response = await $fetch<JobStatus>(`/api/jobs/${jobId}`, {
      method: 'GET',
      baseURL: backendUrl,
    })

    return response
  }

  /**
   * Get cached analysis results from performance_cache table
   */
  const fetchAnalysisResults = async (
    airfoilId: string,
    conditionHash: string
  ) => {
    const supabase = useSupabaseClient<Database>()

    const { data, error } = await supabase
      .from('performance_cache')
      .select('outputs, inputs, created_at')
      .eq('airfoil_id', airfoilId)
      .eq('cond_hash', conditionHash)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No results found
        return null
      }
      console.error('Error fetching analysis results:', error)
      throw error
    }

    return data
  }

  return {
    submitAnalysis,
    submitComparisonAnalysis,
    fetchJobStatus,
    fetchAnalysisResults,
  }
}

