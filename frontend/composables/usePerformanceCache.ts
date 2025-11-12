/**
 * Composable for performance cache operations
 * Handles checking cache and running analysis if needed
 */
import type { Database } from '~/types/database.types'
import type { AnalysisConditions } from '~/composables/useAnalysis'

type PerformanceCache = Database['public']['Tables']['performance_cache']['Row']

/**
 * Check if conditions match (for cache lookup)
 */
function conditionsMatch(inputs: any, conditions: AnalysisConditions): boolean {
  if (!inputs || typeof inputs !== 'object') return false

  // Check Re
  if (Math.abs((inputs.Re ?? 0) - conditions.Re) > 0.01) return false

  // Check Mach
  if (Math.abs((inputs.Mach ?? 0) - (conditions.Mach ?? 0)) > 0.01) return false

  // Check alpha_range
  if (!inputs.alpha_range || !Array.isArray(inputs.alpha_range) || inputs.alpha_range.length !== 3) {
    return false
  }
  if (
    Math.abs(inputs.alpha_range[0] - conditions.alpha_range[0]) > 0.01 ||
    Math.abs(inputs.alpha_range[1] - conditions.alpha_range[1]) > 0.01 ||
    Math.abs(inputs.alpha_range[2] - conditions.alpha_range[2]) > 0.01
  ) {
    return false
  }

  // Check n_crit (default to 9.0 if not specified)
  const inputNcrit = inputs.n_crit ?? 9.0
  const conditionNcrit = conditions.n_crit ?? 9.0
  if (Math.abs(inputNcrit - conditionNcrit) > 0.01) return false

  // Check control surface params (default to 0)
  const inputCsFrac = inputs.control_surface_fraction ?? 0
  const conditionCsFrac = conditions.control_surface_fraction ?? 0
  if (Math.abs(inputCsFrac - conditionCsFrac) > 0.01) return false

  const inputCsDef = inputs.control_surface_deflection ?? 0
  const conditionCsDef = conditions.control_surface_deflection ?? 0
  if (Math.abs(inputCsDef - conditionCsDef) > 0.01) return false

  return true
}

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
  cached: boolean
}

export const usePerformanceCache = () => {
  const supabase = useSupabaseClient<Database>()
  const { submitAnalysis } = useAnalysis()

  /**
   * Check if performance data exists in cache for given airfoil and conditions
   */
  const fetchCachedData = async (
    airfoilId: string,
    conditions: AnalysisConditions
  ): Promise<PerformanceCache | null> => {
    try {
      // Fetch all cache entries for this airfoil
      const { data, error } = await supabase
        .from('performance_cache')
        .select('*')
        .eq('airfoil_id', airfoilId)

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        return null
      }

      // Find matching entry by comparing conditions
      const matching = data.find(entry => {
        const inputs = entry.inputs as any
        return conditionsMatch(inputs, conditions)
      })

      return matching || null
    } catch (err: any) {
      console.error('Error fetching cached data:', err)
      return null
    }
  }

  /**
   * Run analysis for airfoils if not cached, otherwise return cached data
   * Returns performance data for all requested airfoils
   */
  const runAnalysisIfNeeded = async (
    airfoilIds: string[],
    airfoilNames: string[],
    conditions: AnalysisConditions
  ): Promise<CachedPerformanceData[]> => {
    const results: CachedPerformanceData[] = []

    // Check cache for each airfoil
    const cacheChecks = await Promise.all(
      airfoilIds.map(id => fetchCachedData(id, conditions))
    )

    // Determine which airfoils need analysis
    const needsAnalysis: string[] = []
    const cachedResults: Map<string, PerformanceCache> = new Map()

    airfoilIds.forEach((id, idx) => {
      const cached = cacheChecks[idx]
      if (cached) {
        cachedResults.set(id, cached)
      } else {
        needsAnalysis.push(id)
      }
    })

    // Run analysis for airfoils not in cache
    let analysisResults: Record<string, any> = {}
    if (needsAnalysis.length > 0) {
      try {
        const response = await submitAnalysis(needsAnalysis, conditions)
        if (response.results) {
          // Backend returns results keyed by airfoil name
          analysisResults = response.results
        }
      } catch (err: any) {
        console.error('Error running analysis:', err)
        throw err
      }
    }

    // Combine cached and new results
    airfoilIds.forEach((id, idx) => {
      const name = airfoilNames[idx] || `Airfoil_${id.substring(0, 8)}`
      const cached = cachedResults.get(id)

      if (cached) {
        const outputs = cached.outputs as any
        results.push({
          airfoilId: id,
          airfoilName: name,
          conditions,
          data: {
            alpha: outputs.alpha || [],
            CL: outputs.CL || [],
            CD: outputs.CD || [],
            CM: outputs.CM || [],
            avg_confidence: outputs.avg_confidence,
            smoothness_CM: outputs.smoothness_CM,
          },
          cached: true,
        })
      } else {
        // Find result in analysis response (keyed by name)
        const result = analysisResults[name] || Object.values(analysisResults)[idx]
        if (result) {
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
            cached: false,
          })
        }
      }
    })

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
    fetchCachedData,
    runAnalysisIfNeeded,
    fetchAllCachedEntries,
  }
}

