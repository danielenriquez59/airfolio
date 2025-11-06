/**
 * Composable for airfoil comparison functionality
 * Handles filtering, selection, and data normalization for the compare page
 */

export interface AirfoilPolarData {
  name: string
  alpha: number[]
  CL: number[]
  CD: number[]
  CM: number[]
  avg_confidence?: number
  smoothness_CM?: number
  // Optional geometry/metadata
  thickness?: number
  thickness_location?: number
  camber?: number
  camber_location?: number
}

export interface FilterState {
  maxCMRoughness: number | null // smoothness_CM ≤
  minCMAtZero: number | null // Min CM at α = 0°
  minMaxLD: number | null // Min Max L/D
  minCLMax: number | null // Min CL Max
  minCLAtZero: number | null // Min CL at α = 0°
  targetCL: number | null
  targetAOA: number | null
  targetCLTolerance: number // Default ±0.1
  targetAOATolerance: number // Default ±0.5°
  manualExclusions: string[] // Airfoil names to exclude
}

export interface CompareState {
  allAirfoils: Map<string, AirfoilPolarData>
  filteredAirfoils: string[]
  selectedAirfoils: string[]
  filters: FilterState
}

const DEFAULT_FILTERS: FilterState = {
  maxCMRoughness: null,
  minCMAtZero: null,
  minMaxLD: null,
  minCLMax: null,
  minCLAtZero: null,
  targetCL: null,
  targetAOA: null,
  targetCLTolerance: 0.1,
  targetAOATolerance: 0.5,
  manualExclusions: [],
}

/**
 * Calculate L/D ratio from CL and CD arrays
 */
export function calculateLD(CL: number[], CD: number[]): number[] {
  return CL.map((cl, i) => {
    const cd = CD[i]
    if (cd === 0 || !isFinite(cd) || !isFinite(cl)) return 0
    return cl / cd
  })
}

/**
 * Find index closest to target value in array
 */
function findClosestIndex(arr: number[], target: number): number {
  let closestIdx = 0
  let minDiff = Math.abs(arr[0] - target)
  for (let i = 1; i < arr.length; i++) {
    const diff = Math.abs(arr[i] - target)
    if (diff < minDiff) {
      minDiff = diff
      closestIdx = i
    }
  }
  return closestIdx
}

/**
 * Find index where alpha is closest to 0
 */
function findZeroAlphaIndex(alpha: number[]): number {
  return findClosestIndex(alpha, 0)
}

/**
 * Calculate summary metrics for an airfoil
 */
export function calculateSummaryMetrics(airfoil: AirfoilPolarData) {
  const { alpha, CL, CD, CM } = airfoil
  
  // Calculate L/D
  const LD = calculateLD(CL, CD)
  
  // Find zero alpha index
  const zeroAlphaIdx = findZeroAlphaIndex(alpha)
  
  // Max L/D and its alpha
  const maxLD = Math.max(...LD.filter(v => isFinite(v)))
  const maxLDIdx = LD.findIndex(v => v === maxLD)
  const maxLDAlpha = alpha[maxLDIdx]
  
  // CL max and its alpha
  const clMax = Math.max(...CL.filter(v => isFinite(v)))
  const clMaxIdx = CL.findIndex(v => v === clMax)
  const clMaxAlpha = alpha[clMaxIdx]
  
  // CL at alpha = 0°
  const clAtZero = CL[zeroAlphaIdx]
  
  // Min CD
  const minCD = Math.min(...CD.filter(v => isFinite(v) && v > 0))
  
  // CM at alpha = 0°
  const cmAtZero = CM[zeroAlphaIdx]
  
  // L/D at alpha = 0°
  const ldAtZero = LD[zeroAlphaIdx]
  
  return {
    maxLD,
    maxLDAlpha,
    clMax,
    clMaxAlpha,
    clAtZero,
    minCD,
    cmAtZero,
    ldAtZero,
  }
}

/**
 * Check if airfoil passes all filters
 */
function passesFilters(airfoil: AirfoilPolarData, filters: FilterState): boolean {
  const { alpha, CL, CD, CM } = airfoil
  
  // Manual exclusions
  if (filters.manualExclusions.includes(airfoil.name)) {
    return false
  }
  
  // Max CM Roughness (smoothness_CM ≤)
  if (filters.maxCMRoughness !== null) {
    const smoothness = airfoil.smoothness_CM
    if (smoothness === undefined || smoothness > filters.maxCMRoughness) {
      return false
    }
  }
  
  // Min CM at α = 0°
  if (filters.minCMAtZero !== null) {
    const zeroAlphaIdx = findZeroAlphaIndex(alpha)
    const cmAtZero = CM[zeroAlphaIdx]
    if (!isFinite(cmAtZero) || cmAtZero < filters.minCMAtZero) {
      return false
    }
  }
  
  // Min Max L/D
  if (filters.minMaxLD !== null) {
    const LD = calculateLD(CL, CD)
    const maxLD = Math.max(...LD.filter(v => isFinite(v)))
    if (!isFinite(maxLD) || maxLD < filters.minMaxLD) {
      return false
    }
  }
  
  // Min CL Max
  if (filters.minCLMax !== null) {
    const clMax = Math.max(...CL.filter(v => isFinite(v)))
    if (!isFinite(clMax) || clMax < filters.minCLMax) {
      return false
    }
  }
  
  // Min CL at α = 0°
  if (filters.minCLAtZero !== null) {
    const zeroAlphaIdx = findZeroAlphaIndex(alpha)
    const clAtZero = CL[zeroAlphaIdx]
    if (!isFinite(clAtZero) || clAtZero < filters.minCLAtZero) {
      return false
    }
  }
  
  // Target CL and AOA (with tolerances)
  if (filters.targetCL !== null && filters.targetAOA !== null) {
    const targetAlphaIdx = findClosestIndex(alpha, filters.targetAOA)
    const clAtTarget = CL[targetAlphaIdx]
    const alphaAtTarget = alpha[targetAlphaIdx]
    
    const clMatch = Math.abs(clAtTarget - filters.targetCL) <= filters.targetCLTolerance
    const alphaMatch = Math.abs(alphaAtTarget - filters.targetAOA) <= filters.targetAOATolerance
    
    if (!clMatch || !alphaMatch) {
      return false
    }
  }
  
  return true
}

export const useCompare = () => {
  const state = reactive<CompareState>({
    allAirfoils: new Map(),
    filteredAirfoils: [],
    selectedAirfoils: [],
    filters: { ...DEFAULT_FILTERS },
  })

  /**
   * Normalize analysis results into airfoil data map
   * Expects results from backend analysis response
   */
  const normalizeAnalysisResults = (
    results: Record<string, any>,
    airfoilNames: string[]
  ) => {
    const airfoils = new Map<string, AirfoilPolarData>()
    
    // Handle single airfoil result
    if (results.alpha && results.CL && results.CD) {
      // Single airfoil - use first name or generate one
      const name = airfoilNames[0] || 'Airfoil'
      airfoils.set(name, {
        name,
        alpha: results.alpha,
        CL: results.CL,
        CD: results.CD,
        CM: results.CM || [],
        avg_confidence: results.avg_confidence,
        smoothness_CM: results.smoothness_CM,
      })
    } else {
      // Multiple airfoils - results should be keyed by name
      Object.keys(results).forEach((key, idx) => {
        const result = results[key]
        if (result && result.alpha && result.CL && result.CD) {
          const name = airfoilNames[idx] || key
          airfoils.set(name, {
            name,
            alpha: result.alpha,
            CL: result.CL,
            CD: result.CD,
            CM: result.CM || [],
            avg_confidence: result.avg_confidence,
            smoothness_CM: result.smoothness_CM,
          })
        }
      })
    }
    
    state.allAirfoils = airfoils
    applyFilters()
  }

  /**
   * Apply filters to get filtered airfoil list
   */
  const applyFilters = () => {
    const filtered: string[] = []
    
    state.allAirfoils.forEach((airfoil, name) => {
      if (passesFilters(airfoil, state.filters)) {
        filtered.push(name)
      }
    })
    
    state.filteredAirfoils = filtered
    
    // Remove selected airfoils that no longer match filters
    state.selectedAirfoils = state.selectedAirfoils.filter(name =>
      filtered.includes(name)
    )
    
    // If no selection and we have filtered airfoils, select all
    if (state.selectedAirfoils.length === 0 && filtered.length > 0) {
      state.selectedAirfoils = [...filtered]
    }
  }

  /**
   * Update filter value
   */
  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    state.filters[key] = value
    applyFilters()
  }

  /**
   * Set selected airfoils
   */
  const setSelectedAirfoils = (names: string[]) => {
    // Only allow selection from filtered airfoils
    state.selectedAirfoils = names.filter(name =>
      state.filteredAirfoils.includes(name)
    )
  }

  /**
   * Toggle airfoil selection
   */
  const toggleAirfoilSelection = (name: string) => {
    const idx = state.selectedAirfoils.indexOf(name)
    if (idx >= 0) {
      state.selectedAirfoils.splice(idx, 1)
    } else if (state.filteredAirfoils.includes(name)) {
      state.selectedAirfoils.push(name)
    }
  }

  /**
   * Select all filtered airfoils
   */
  const selectAllFiltered = () => {
    state.selectedAirfoils = [...state.filteredAirfoils]
  }

  /**
   * Deselect all airfoils
   */
  const deselectAll = () => {
    state.selectedAirfoils = []
  }

  /**
   * Get selected airfoil data
   */
  const getSelectedAirfoilsData = computed(() => {
    return state.selectedAirfoils
      .map(name => state.allAirfoils.get(name))
      .filter((airfoil): airfoil is AirfoilPolarData => airfoil !== undefined)
  })

  /**
   * Get summary data for selected airfoils
   */
  const getSummaryData = computed(() => {
    return getSelectedAirfoilsData.value.map(airfoil => {
      const metrics = calculateSummaryMetrics(airfoil)
      return {
        name: airfoil.name,
        ...metrics,
        smoothness_CM: airfoil.smoothness_CM,
        avg_confidence: airfoil.avg_confidence,
        thickness: airfoil.thickness,
        thickness_location: airfoil.thickness_location,
        camber: airfoil.camber,
        camber_location: airfoil.camber_location,
      }
    })
  })

  /**
   * Reset filters to defaults
   */
  const resetFilters = () => {
    state.filters = { ...DEFAULT_FILTERS }
    applyFilters()
  }

  return {
    state: readonly(state),
    normalizeAnalysisResults,
    updateFilter,
    setSelectedAirfoils,
    toggleAirfoilSelection,
    selectAllFiltered,
    deselectAll,
    getSelectedAirfoilsData,
    getSummaryData,
    resetFilters,
    applyFilters,
  }
}

