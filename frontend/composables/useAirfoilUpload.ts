/**
 * Composable for airfoil upload functionality
 * Handles validation, state management, and data persistence for upload flow
 */

import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

interface CoordinatePair {
  x: number
  y: number
}

interface UploadData {
  name: string
  description?: string
  upperSurface: CoordinatePair[]
  lowerSurface: CoordinatePair[]
  sourceUrl?: string
}

interface ValidationError {
  field: string
  message: string
}

/**
 * Check if x-coordinates are monotonic (either all increasing or all decreasing)
 */
function validateMonotonic(xCoords: number[]): { valid: boolean; message?: string } {
  if (xCoords.length < 2) {
    return { valid: true }
  }

  let isIncreasing = true
  let isDecreasing = true

  for (let i = 1; i < xCoords.length; i++) {
    if (xCoords[i] <= xCoords[i - 1]) {
      isIncreasing = false
    }
    if (xCoords[i] >= xCoords[i - 1]) {
      isDecreasing = false
    }
  }

  if (!isIncreasing && !isDecreasing) {
    return {
      valid: false,
      message: 'X-coordinates must be monotonic (either all increasing or all decreasing)',
    }
  }

  return { valid: true }
}

/**
 * Validate airfoil name format (alphanumeric, spaces, and hyphens only, max 12 characters)
 */
function validateNameFormat(name: string): { valid: boolean; message?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, message: 'Airfoil name is required' }
  }

  const trimmedName = name.trim()
  
  if (trimmedName.length > 12) {
    return {
      valid: false,
      message: 'Airfoil name must be 12 characters or less',
    }
  }

  if (!/^[a-zA-Z0-9\s-]+$/.test(trimmedName)) {
    return {
      valid: false,
      message: 'Airfoil name can only contain letters, numbers, spaces, and hyphens',
    }
  }

  return { valid: true }
}

/**
 * Extract x-coordinates from coordinate pairs
 */
function extractXCoordinates(coords: CoordinatePair[]): number[] {
  return coords.map(c => {
    const x = typeof c.x === 'string' ? parseFloat(c.x) : c.x
    return x
  })
}

/**
 * Check if all values are finite numbers
 */
function allFinite(coords: CoordinatePair[]): boolean {
  return coords.every(c => {
    const x = typeof c.x === 'string' ? parseFloat(c.x) : c.x
    const y = typeof c.y === 'string' ? parseFloat(c.y) : c.y
    return !isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)
  })
}

export const useAirfoilUpload = () => {
  const supabase = useSupabaseClient<Database>()

  /**
   * Validate monotonic x-coordinates for both surfaces
   */
  const validateCoordinates = (
    upper: CoordinatePair[],
    lower: CoordinatePair[]
  ): { valid: boolean; errors: ValidationError[] } => {
    const errors: ValidationError[] = []

    // Check point counts (minimum 10 points per surface)
    const MIN_POINTS = 10
    if (upper.length < MIN_POINTS) {
      errors.push({ field: 'upperSurface', message: `Upper surface requires at least ${MIN_POINTS} points (currently ${upper.length})` })
    }
    if (lower.length < MIN_POINTS) {
      errors.push({ field: 'lowerSurface', message: `Lower surface requires at least ${MIN_POINTS} points (currently ${lower.length})` })
    }

    // Check finite values
    if (upper.length > 0 && !allFinite(upper)) {
      errors.push({ field: 'upperSurface', message: 'Upper surface contains invalid coordinates' })
    }
    if (lower.length > 0 && !allFinite(lower)) {
      errors.push({ field: 'lowerSurface', message: 'Lower surface contains invalid coordinates' })
    }

    // Check monotonic x-coordinates
    if (upper.length > 0) {
      const upperXCheck = validateMonotonic(extractXCoordinates(upper))
      if (!upperXCheck.valid) {
        errors.push({ field: 'upperSurface', message: upperXCheck.message || 'Invalid x-coordinates' })
      }
    }

    if (lower.length > 0) {
      const lowerXCheck = validateMonotonic(extractXCoordinates(lower))
      if (!lowerXCheck.valid) {
        errors.push({ field: 'lowerSurface', message: lowerXCheck.message || 'Invalid x-coordinates' })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Validate airfoil name (format and uniqueness)
   */
  const validateAirfoilName = async (name: string): Promise<{ valid: boolean; message?: string }> => {
    // Validate format first
    const formatCheck = validateNameFormat(name)
    if (!formatCheck.valid) {
      return formatCheck
    }

    const trimmedName = name.trim()

    // Check against database for uniqueness
    const { data, error } = await supabase
      .from('airfoils')
      .select('id')
      .eq('name', trimmedName)
      .single()

    if (error && error.code === 'PGRST116') {
      // No rows found - name is unique
      return { valid: true }
    }

    if (data) {
      return { valid: false, message: 'An airfoil with this name already exists' }
    }

    if (error) {
      return { valid: false, message: 'Error checking name availability' }
    }

    return { valid: true }
  }

  /**
   * Generate a hash for the upload data
   */
  const generateDataHash = (data: UploadData): string => {
    const json = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Store temporary upload data in sessionStorage
   */
  const storeTemporaryData = (hash: string, data: UploadData): void => {
    if (process.client) {
      sessionStorage.setItem(`airfoil_upload_${hash}`, JSON.stringify(data))
    }
  }

  /**
   * Retrieve temporary upload data from sessionStorage
   */
  const retrieveTemporaryData = (hash: string): UploadData | null => {
    if (!process.client) {
      return null
    }

    const stored = sessionStorage.getItem(`airfoil_upload_${hash}`)
    if (!stored) {
      return null
    }

    try {
      return JSON.parse(stored) as UploadData
    } catch {
      return null
    }
  }

  /**
   * Clear temporary data from sessionStorage
   */
  const clearTemporaryData = (hash: string): void => {
    if (process.client) {
      sessionStorage.removeItem(`airfoil_upload_${hash}`)
    }
  }

  /**
   * Detect delimiter (comma or space) in a line
   */
  function detectDelimiter(line: string): ',' | ' ' {
    const commaCount = (line.match(/,/g) || []).length
    const spaceCount = (line.match(/\s+/g) || []).length
    return commaCount >= spaceCount ? ',' : ' '
  }

  /**
   * Parse CSV/DAT content with format: airfoil name header, upper/lower surface points
   * Supports:
   * - Comma or space-separated values
   * - File extensions: .csv, .txt, .dat
   * - First line: airfoil name
   * - Optional blank line separator between upper and lower surfaces
   * - Automatic detection of upper/lower split point using leading edge
   */
  const parseCSV = (csvContent: string): { upper: CoordinatePair[]; lower: CoordinatePair[]; airfoilName?: string; error?: string } => {
    const allLines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    if (allLines.length < 2) {
      return {
        upper: [],
        lower: [],
        error: 'File must contain airfoil name and coordinate data',
      }
    }
    
    // Extract airfoil name from first line
    const airfoilName = allLines[0]
    
    // Detect delimiter from first data line (line 1, skipping header)
    let delimiter = ','
    if (allLines.length > 1) {
      delimiter = detectDelimiter(allLines[1])
    }
    
    // Parse all coordinate pairs starting from line 1
    const allCoords: CoordinatePair[] = []
    let hasBlankLineSeparator = false
    let blankLineIndex = -1
    
    for (let i = 1; i < allLines.length; i++) {
      const line = allLines[i]
      
      // Check for blank line separator (already filtered by filter above, but keep logic for future)
      if (line.length === 0) {
        if (allCoords.length > 0 && !hasBlankLineSeparator) {
          hasBlankLineSeparator = true
          blankLineIndex = allCoords.length
        }
        continue
      }
      
      // Split by detected delimiter (handle multiple spaces as single delimiter)
      let parts: string[]
      if (delimiter === ' ') {
        parts = line.split(/\s+/).map(p => p.trim())
      } else {
        parts = line.split(',').map(p => p.trim())
      }
      
      if (parts.length < 2) {
        continue
      }
      
      const x = parseFloat(parts[0])
      const y = parseFloat(parts[1])
      
      if (isFinite(x) && isFinite(y)) {
        allCoords.push({ x, y })
      }
    }
    
    if (allCoords.length < 2) {
      return {
        upper: [],
        lower: [],
        error: 'File must contain at least 2 coordinate pairs',
      }
    }
    
    let upper: CoordinatePair[] = []
    let lower: CoordinatePair[] = []
    
    // Strategy 1: Use blank line separator if found
    if (hasBlankLineSeparator && blankLineIndex > 0) {
      upper = allCoords.slice(0, blankLineIndex)
      lower = allCoords.slice(blankLineIndex)
    } else {
      // Strategy 2: Find the leading edge (minimum x or x=0 transition)
      let leIndex = -1
      
      // Find minimum x value index
      let minX = Infinity
      let minXIndex = 0
      for (let i = 0; i < allCoords.length; i++) {
        if (allCoords[i].x < minX) {
          minX = allCoords[i].x
          minXIndex = i
        }
      }
      
      // Check if there's a clear transition (x starts increasing after decreasing)
      for (let i = 1; i < allCoords.length - 1; i++) {
        const prevX = allCoords[i - 1].x
        const currX = allCoords[i].x
        const nextX = allCoords[i + 1].x
        
        // Found leading edge: x was decreasing, now increasing
        if (prevX > currX && nextX > currX) {
          leIndex = i
          break
        }
      }
      
      // If no clear transition found, use the minimum x index
      if (leIndex === -1) {
        leIndex = minXIndex
      }
      
      // Split at leading edge
      upper = allCoords.slice(0, leIndex + 1)
      lower = allCoords.slice(leIndex + 1)
    }
    
    if (upper.length === 0 || lower.length === 0) {
      return {
        upper: [],
        lower: [],
        error: 'Could not automatically split upper and lower surfaces. Please add a blank line between them.',
      }
    }
    
    return { upper, lower, airfoilName }
  }

  return {
    validateCoordinates,
    validateAirfoilName,
    validateMonotonic,
    generateDataHash,
    storeTemporaryData,
    retrieveTemporaryData,
    clearTemporaryData,
    parseCSV,
  }
}

