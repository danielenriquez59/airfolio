/**
 * Composable for batch job operations
 */
import type { Database } from '~/types/database.types'
import type { AnalysisConditions } from './useAnalysis'

type BatchJob = Database['public']['Tables']['batch_jobs']['Row']
type JobScope = Database['public']['Enums']['job_scope']
type JobStatus = Database['public']['Enums']['job_status']

export interface BatchJobParams {
  scope: JobScope
  airfoilIds?: string[]
  conditions: AnalysisConditions
}

export interface BatchJobResponse {
  job_id: string
  status: JobStatus
  created_at: string
}

export const useBatchJobs = () => {
  const config = useRuntimeConfig()
  const supabase = useSupabaseClient<Database>()
  const backendUrl = config.public.backendUrl || 'http://localhost:8000'

  /**
   * Submit batch job for analysis
   */
  const submitBatchJob = async (params: BatchJobParams): Promise<BatchJobResponse> => {
    const response = await $fetch<BatchJobResponse>('/api/analyze/batch', {
      method: 'POST',
      baseURL: backendUrl,
      body: {
        scope: params.scope,
        airfoil_ids: params.airfoilIds,
        inputs: params.conditions,
      },
    })

    return response
  }

  /**
   * Get batch job status
   */
  const fetchBatchJobStatus = async (jobId: string): Promise<BatchJob | null> => {
    const { data, error } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('job_id', jobId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Job not found
        return null
      }
      console.error('Error fetching batch job status:', error)
      throw error
    }

    return data
  }

  /**
   * List user's batch jobs with optional status filter
   */
  const fetchBatchJobs = async (status?: JobStatus): Promise<BatchJob[]> => {
    let query = supabase
      .from('batch_jobs')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching batch jobs:', error)
      throw error
    }

    return data || []
  }

  /**
   * Get batch job results if status is 'done'
   */
  const fetchBatchJobResults = async (jobId: string) => {
    const job = await fetchBatchJobStatus(jobId)

    if (!job) {
      throw new Error('Batch job not found')
    }

    if (job.status !== 'done') {
      throw new Error(`Job is not complete. Current status: ${job.status}`)
    }

    if (!job.result_location) {
      throw new Error('No result location available for this job')
    }

    // Fetch results from storage or URL
    // This would depend on where results are stored (Supabase Storage, etc.)
    // For now, return the result_location
    return {
      job_id: job.job_id,
      result_location: job.result_location,
      inputs: job.inputs,
    }
  }

  return {
    submitBatchJob,
    fetchBatchJobStatus,
    fetchBatchJobs,
    fetchBatchJobResults,
  }
}

