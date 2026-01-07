import type { NACACoordinates, NACA4Params, NACA5Params } from './useNACAGenerator'

/**
 * Generate filename-safe string from airfoil name
 */
const sanitizeFilename = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Trigger browser download for a file
 */
const triggerDownload = (content: string, filename: string, type: string = 'text/csv') => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Format number for CSV (with sufficient precision)
 */
const formatNumber = (num: number): string => {
  return num.toFixed(6)
}

/**
 * Export NACA parameters to CSV format
 * @param seriesType '4-digit' or '5-digit'
 * @param naca4Params 4-digit parameters (if applicable)
 * @param naca5Params 5-digit parameters (if applicable)
 * @param airfoilName Name of the airfoil (for filename)
 */
export const exportNACAParameters = (
  seriesType: '4-digit' | '5-digit',
  naca4Params: NACA4Params | null,
  naca5Params: NACA5Params | null,
  airfoilName: string = 'NACA_Airfoil'
) => {
  const lines: string[] = []

  // Header row
  lines.push('parameter_name,value')

  // Metadata
  lines.push(`airfoil_name,${airfoilName}`)
  lines.push(`series_type,${seriesType}`)
  lines.push(`timestamp,${new Date().toISOString()}`)
  lines.push('') // Empty line separator

  if (seriesType === '4-digit' && naca4Params) {
    lines.push(`max_camber_m,${formatNumber(naca4Params.m)}`)
    lines.push(`camber_position_p,${formatNumber(naca4Params.p)}`)
    lines.push(`max_thickness_t,${formatNumber(naca4Params.t)}`)
    lines.push(`max_camber_percent,${formatNumber(naca4Params.m * 100)}`)
    lines.push(`camber_position_percent,${formatNumber(naca4Params.p * 100)}`)
    lines.push(`max_thickness_percent,${formatNumber(naca4Params.t * 100)}`)
  } else if (seriesType === '5-digit' && naca5Params) {
    lines.push(`design_lift_coefficient_cl,${formatNumber(naca5Params.cl)}`)
    lines.push(`camber_position_p,${formatNumber(naca5Params.p)}`)
    lines.push(`max_thickness_t,${formatNumber(naca5Params.t)}`)
    lines.push(`is_reflex,${naca5Params.isReflex}`)
    lines.push(`camber_position_percent,${formatNumber(naca5Params.p * 100)}`)
    lines.push(`max_thickness_percent,${formatNumber(naca5Params.t * 100)}`)
  }

  const content = lines.join('\n')
  const filename = `${sanitizeFilename(airfoilName)}_naca_parameters.csv`

  triggerDownload(content, filename)
}

/**
 * Format a number to fixed-width string (8 characters, 6 decimal places)
 */
const formatCoord = (num: number): string => {
  return num.toFixed(6).padStart(8, ' ')
}

/**
 * Remove duplicate points from coordinate array
 * Two points are considered duplicates if both x and y are within tolerance
 */
const removeDuplicates = (
  coords: Array<[number, number]>,
  tolerance: number = 5e-5
): Array<[number, number]> => {
  const result: Array<[number, number]> = []

  for (const coord of coords) {
    const isDuplicate = result.some(existing =>
      Math.abs(existing[0] - coord[0]) < tolerance &&
      Math.abs(existing[1] - coord[1]) < tolerance
    )

    if (!isDuplicate) {
      result.push(coord)
    }
  }

  return result
}

/**
 * Sort upper surface coordinates by X descending (TE to LE)
 */
const sortUpperCoordinates = (
  upperX: number[],
  upperY: number[]
): Array<[number, number]> => {
  const coords = upperX.map((x, i) => [x, upperY[i]] as [number, number])
  return coords.sort((a, b) => b[0] - a[0]) // Descending X
}

/**
 * Sort lower surface coordinates by X ascending (LE to TE)
 */
const sortLowerCoordinates = (
  lowerX: number[],
  lowerY: number[]
): Array<[number, number]> => {
  const coords = lowerX.map((x, i) => [x, lowerY[i]] as [number, number])
  return coords.sort((a, b) => a[0] - b[0]) // Ascending X
}

/**
 * Export NACA-generated coordinates in Lednicer format
 * @param coordinates NACA coordinates
 * @param airfoilName Name for the exported file
 */
export const exportNACALednicer = (
  coordinates: NACACoordinates,
  airfoilName: string = 'NACA_Airfoil'
) => {
  // Sort coordinates and remove duplicates
  // Both surfaces: ascending X (LE to TE)
  const upperCoordsSorted = sortLowerCoordinates(coordinates.upperX, coordinates.upperY)
  const lowerCoordsSorted = sortLowerCoordinates(coordinates.lowerX, coordinates.lowerY)

  // Remove duplicates from both surfaces
  const upperCoords = removeDuplicates(upperCoordsSorted)
  const lowerCoords = removeDuplicates(lowerCoordsSorted)

  // Build file content
  const lines: string[] = []

  // Airfoil name
  lines.push(airfoilName.toUpperCase())

  // Upper and lower counts (with periods and spacing)
  // Use actual counts after duplicate removal
  const upperCountStr = (upperCoords.length.toString() + '.').padStart(8)
  const lowerCountStr = (lowerCoords.length.toString() + '.').padStart(8)
  lines.push(`${upperCountStr}  ${lowerCountStr}`)

  // Upper surface coordinates (ascending X, LE to TE)
  upperCoords.forEach(([x, y]) => {
    lines.push(`${formatCoord(x)}  ${formatCoord(y)}`)
  })

  // Blank line between upper and lower surfaces
  lines.push('')

  // Lower surface coordinates (ascending X, LE to TE)
  lowerCoords.forEach(([x, y]) => {
    lines.push(`${formatCoord(x)}  ${formatCoord(y)}`)
  })

  const content = lines.join('\n')
  const filename = `${sanitizeFilename(airfoilName)}_naca_lednicer.dat`
  triggerDownload(content, filename, 'text/plain')
}

/**
 * Export NACA-generated coordinates in Selig format
 * @param coordinates NACA coordinates
 * @param airfoilName Name for the exported file
 */
export const exportNACASelig = (
  coordinates: NACACoordinates,
  airfoilName: string = 'NACA_Airfoil'
) => {
  // Sort coordinates and remove duplicates
  // Upper: descending X (TE to LE)
  // Lower: ascending X (LE to TE)
  const upperCoordsSorted = sortUpperCoordinates(coordinates.upperX, coordinates.upperY)
  const lowerCoordsSorted = sortLowerCoordinates(coordinates.lowerX, coordinates.lowerY)

  // Remove duplicates from both surfaces
  const upperCoords = removeDuplicates(upperCoordsSorted)
  const lowerCoords = removeDuplicates(lowerCoordsSorted)

  // Build file content
  const lines: string[] = []

  // Airfoil name
  lines.push(airfoilName)

  // Empty line
  lines.push('')

  // Upper surface coordinates (TE to LE) - already sorted descending
  upperCoords.forEach(([x, y]) => {
    lines.push(`${formatCoord(x)}  ${formatCoord(y)}`)
  })

  // Lower surface coordinates (LE to TE) - already sorted ascending
  lowerCoords.forEach(([x, y]) => {
    lines.push(`${formatCoord(x)}  ${formatCoord(y)}`)
  })

  const content = lines.join('\n')
  const filename = `${sanitizeFilename(airfoilName)}_naca_selig.dat`
  triggerDownload(content, filename, 'text/plain')
}

/**
 * Composable function
 */
export const useNACAExport = () => {
  return {
    exportNACAParameters,
    exportNACALednicer,
    exportNACASelig,
  }
}

