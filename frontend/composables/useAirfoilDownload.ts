import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

/**
 * Format a number to fixed-width string (8 characters, 6 decimal places)
 */
const formatCoord = (num: number): string => {
  return num.toFixed(6).padStart(8, ' ')
}

/**
 * Trigger browser download for a text file
 */
const triggerDownload = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain' })
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
 * Generate filename-safe string from airfoil name
 */
const sanitizeFilename = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export const useAirfoilDownload = () => {
  /**
   * Download airfoil in Lednicer format
   * Format:
   * {AIRFOIL_NAME}
   * {upper_count}.  {lower_count}.
   * {upper coordinates - ascending X (LE to TE)}
   * {blank line}
   * {lower coordinates - ascending X (LE to TE)}
   */
  const downloadLednicer = (airfoil: Airfoil) => {
    if (
      !airfoil.upper_x_coordinates ||
      !airfoil.upper_y_coordinates ||
      !airfoil.lower_x_coordinates ||
      !airfoil.lower_y_coordinates
    ) {
      throw new Error('Airfoil geometry data is missing')
    }

    if (
      !airfoil.upper_surface_nodes ||
      !airfoil.lower_surface_nodes
    ) {
      throw new Error('Surface node counts are missing')
    }

    // Sort coordinates and remove duplicates
    // Both surfaces: ascending X (LE to TE)
    const upperCoordsSorted = sortLowerCoordinates(
      airfoil.upper_x_coordinates,
      airfoil.upper_y_coordinates
    )
    const lowerCoordsSorted = sortLowerCoordinates(
      airfoil.lower_x_coordinates,
      airfoil.lower_y_coordinates
    )

    // Remove duplicates from both surfaces
    const upperCoords = removeDuplicates(upperCoordsSorted)
    const lowerCoords = removeDuplicates(lowerCoordsSorted)

    // Build file content
    const lines: string[] = []

    // Airfoil name
    lines.push(airfoil.name.toUpperCase())

    // Upper and lower counts (with periods and spacing as shown in example)
    // Format: number + period should total 8 characters (right-aligned)
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
    const filename = `${sanitizeFilename(airfoil.name)}_lednicer.dat`
    triggerDownload(content, filename)
  }

  /**
   * Download airfoil in Selig format
   * Format:
   * {AIRFOIL_NAME}
   * {empty line}
   * {all coordinates - upper TE to LE, then lower LE to TE}
   * Points ordered from upper trailing edge wrapping to leading edge to lower trailing edge
   */
  const downloadSelig = (airfoil: Airfoil) => {
    if (
      !airfoil.upper_x_coordinates ||
      !airfoil.upper_y_coordinates ||
      !airfoil.lower_x_coordinates ||
      !airfoil.lower_y_coordinates
    ) {
      throw new Error('Airfoil geometry data is missing')
    }

    // Sort coordinates and remove duplicates
    // Upper: descending X (TE to LE)
    // Lower: ascending X (LE to TE)
    const upperCoordsSorted = sortUpperCoordinates(
      airfoil.upper_x_coordinates,
      airfoil.upper_y_coordinates
    )
    const lowerCoordsSorted = sortLowerCoordinates(
      airfoil.lower_x_coordinates,
      airfoil.lower_y_coordinates
    )

    // Remove duplicates from both surfaces
    const upperCoords = removeDuplicates(upperCoordsSorted)
    const lowerCoords = removeDuplicates(lowerCoordsSorted)

    // Build file content
    const lines: string[] = []

    // Airfoil name
    lines.push(airfoil.name)

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
    const filename = `${sanitizeFilename(airfoil.name)}_selig.dat`
    triggerDownload(content, filename)
  }

  /**
   * Check if airfoil is symmetric by comparing upper and lower Y coordinates
   * Returns true if the airfoil appears symmetric (within tolerance)
   */
  const isSymmetric = (
    upperX: number[],
    upperY: number[],
    lowerX: number[],
    lowerY: number[]
  ): boolean => {
    // If counts don't match, likely not symmetric
    if (upperX.length !== lowerX.length) return false
    
    const tolerance = 1e-4
    
    // Create sorted pairs for both surfaces
    const upperPairs = upperX.map((x, i) => [x, upperY[i]] as [number, number])
      .sort((a, b) => a[0] - b[0])
    const lowerPairs = lowerX.map((x, i) => [x, lowerY[i]] as [number, number])
      .sort((a, b) => a[0] - b[0])
    
    // Check if corresponding X values match and Y values are negatives
    for (let i = 0; i < upperPairs.length; i++) {
      const [upperXVal, upperYVal] = upperPairs[i]
      const [lowerXVal, lowerYVal] = lowerPairs[i]
      
      // Check if X values match
      if (Math.abs(upperXVal - lowerXVal) > tolerance) {
        return false
      }
      
      // Check if Y values are approximately negatives
      if (Math.abs(upperYVal + lowerYVal) > tolerance) {
        return false
      }
    }
    
    return true
  }

  /**
   * Download airfoil in OpenVSP AF format
   * Format:
   * {AIRFOIL_NAME} GEOM AIRFOIL FILE
   * {description or name}
   * {sym_flag}	Sym Flag (0 - No, 1 - Yes)
   * {num_upper}	Num Pnts Upper
   * {num_lower}	Num Pnts Lower
   * {upper coordinates - LE to TE}
   * {empty line}
   * {lower coordinates - LE to TE}
   */
  const downloadOpenVSP = (airfoil: Airfoil) => {
    if (
      !airfoil.upper_x_coordinates ||
      !airfoil.upper_y_coordinates ||
      !airfoil.lower_x_coordinates ||
      !airfoil.lower_y_coordinates
    ) {
      throw new Error('Airfoil geometry data is missing')
    }

    if (
      !airfoil.upper_surface_nodes ||
      !airfoil.lower_surface_nodes
    ) {
      throw new Error('Surface node counts are missing')
    }

    // Sort coordinates: LE to TE for both surfaces
    // Upper: ascending X (LE to TE)
    // Lower: ascending X (LE to TE)
    const upperCoords = sortLowerCoordinates(
      airfoil.upper_x_coordinates,
      airfoil.upper_y_coordinates
    )
    const lowerCoords = sortLowerCoordinates(
      airfoil.lower_x_coordinates,
      airfoil.lower_y_coordinates
    )

    // Check if symmetric
    const symFlag = isSymmetric(
      airfoil.upper_x_coordinates,
      airfoil.upper_y_coordinates,
      airfoil.lower_x_coordinates,
      airfoil.lower_y_coordinates
    ) ? 1 : 0

    // Build file content
    const lines: string[] = []
    
    // Header: "{name} GEOM AIRFOIL FILE"
    lines.push(`${airfoil.name.toUpperCase()} GEOM AIRFOIL FILE`)
    
    // Description or name (use display_name if available, otherwise name)
    const displayName = airfoil.display_name || airfoil.name
    lines.push(displayName)
    
    // Symmetry flag
    lines.push(`${symFlag}\tSym Flag (0 - No, 1 - Yes)`)
    
    // Point counts
    lines.push(`${airfoil.upper_surface_nodes}\tNum Pnts Upper`)
    lines.push(`${airfoil.lower_surface_nodes}\tNum Pnts Lower`)
    
    // Upper surface coordinates (LE to TE)
    upperCoords.forEach(([x, y]) => {
      lines.push(`${x.toFixed(6)}  ${y.toFixed(6)}`)
    })
    
    // Empty line
    lines.push('')
    
    // Lower surface coordinates (LE to TE)
    lowerCoords.forEach(([x, y]) => {
      lines.push(`${x.toFixed(6)}  ${y.toFixed(6)}`)
    })

    const content = lines.join('\n')
    const filename = `${sanitizeFilename(airfoil.name)}.af`
    triggerDownload(content, filename)
  }

  return {
    downloadLednicer,
    downloadSelig,
    downloadOpenVSP,
  }
}

