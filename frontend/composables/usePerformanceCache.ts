/**
 * Composable for performance cache operations
 * Loads comparison results through the backend and reads saved results for one airfoil
 */
import type { Database } from '~/types/database.types'
import type { AnalysisConditions } from '~/composables/useAnalysis'

type PerformanceCache = Database['public']['Tables']['performance_cache']['Row']

export interface CachedPerformanceData {
  airfoilId: string
  airfoilName: string
  conditions: AnalysisConditions
  data: {
    alpha: number[]
    CL: number[]
    CD: number[]
    CM?: number[]
    avg_confidence?: number
    smoothness_CM?: number
  }
}

export const usePerformanceCache = () => {
  const supabase = useSupabaseClient<Database>()
  const { submitAnalysis } = useAnalysis()

  /**
   * Get performance data for all requested airfoils; the backend returns saved results and analyses the rest
   */
  const runAnalysisIfNeeded = async (
    airfoilIds: string[],
    airfoilNames: string[],
    conditions: AnalysisConditions,
    onProgress?: (message: string) => void
  ): Promise<CachedPerformanceData[]> => {
    const results: CachedPerformanceData[] = []

    // 200 per request: the backend cannot look up thousands of IDs at once
    for (let i = 0; i < airfoilIds.length; i += 200) {
      const chunk = airfoilIds.slice(i, i + 200)
      onProgress?.(`Loading results… ${i.toLocaleString()} of ${airfoilIds.length.toLocaleString()} airfoils`)
      const { results: chunkResults } = await submitAnalysis(chunk, conditions)
      if (!chunkResults) continue
      // Backend keys results by airfoil name, except for a single airfoil, where it returns the polar itself
      const inOrder = Object.values(chunkResults)
      chunk.forEach((id, k) => {
        const name = airfoilNames[i + k] || `Airfoil_${id.substring(0, 8)}`
        const result: any = chunk.length === 1 ? chunkResults : (chunkResults[airfoilNames[i + k]] || inOrder[k])
        if (!result) return
        results.push({
          airfoilId: id,
          airfoilName: name,
          conditions,
          data: {
            alpha: result.alpha || [],
            CL: result.CL || [],
            CD: result.CD || [],
            CM: result.CM || [],
            avg_confidence: result.avg_confidence,
            smoothness_CM: result.smoothness_CM,
          },
        })
      })
    }

    return results
  }

  /**
   * Fetch all cached entries for a single airfoil
   */
  const fetchAllCachedEntries = async (
    airfoilId: string
  ): Promise<PerformanceCache[]> => {
    try {
      const { data, error } = await supabase
        .from('performance_cache')
        .select('*')
        .eq('airfoil_id', airfoilId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return data || []
    } catch (err: any) {
      console.error('Error fetching cached entries:', err)
      return []
    }
  }

  return {
    runAnalysisIfNeeded,
    fetchAllCachedEntries,
  }
}

