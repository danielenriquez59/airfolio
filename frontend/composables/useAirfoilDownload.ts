import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

/**
 * Format a number to fixed-width string (8 characters, 6 decimal places)
 */
export const formatCoord = (num: number): string => {
  return num.toFixed(6).padStart(8, ' ')
}

/**
 * Trigger browser download for a text file
 */
export const triggerDownload = (content: string, filename: string) => {
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
 * Remove adjacent duplicate points from coordinate array
 * Two points are duplicates if both x and y are within tolerance of the previous kept point
 */
export const removeDuplicates = (
  coords: Array<[number, number]>,
  tolerance: number = 5e-5
): Array<[number, number]> => {
  const result: Array<[number, number]> = []

  for (const coord of coords) {
    const prev = result[result.length - 1]
    const isDuplicate = prev && Math.abs(prev[0] - coord[0]) < tolerance && Math.abs(prev[1] - coord[1]) < tolerance
    if (!isDuplicate)
      result.push(coord)
  }

  return result
}

/**
 * Upper surface coordinates ordered TE to LE
 */
export const sortUpperCoordinates = (
  upperX: number[],
  upperY: number[]
): Array<[number, number]> => {
  const coords = upperX.map((x, i) => [x, upperY[i]] as [number, number])
  // Orient only: sorting by x scrambles the points of a nose that reaches x < 0
  return coords.length > 1 && coords[0][0] < coords[coords.length - 1][0] ? coords.reverse() : coords
}

/**
 * Lower surface coordinates ordered LE to TE
 */
export const sortLowerCoordinates = (
  lowerX: number[],
  lowerY: number[]
): Array<[number, number]> => {
  const coords = lowerX.map((x, i) => [x, lowerY[i]] as [number, number])
  // Orient only: sorting by x scrambles the points of a nose that reaches x < 0
  return coords.length > 1 && coords[0][0] > coords[coords.length - 1][0] ? coords.reverse() : coords
}

/**
 * Generate filename-safe string from airfoil name
 */
export const sanitizeFilename = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Build Selig format string from raw coordinate arrays.
 * Upper: TE to LE (descending X), Lower: LE to TE (ascending X).
 */
export const buildSeligString = (
  name: string,
  upperX: number[],
  upperY: number[],
  lowerX: number[],
  lowerY: number[]
): string => {
  // Dedupe the joined loop so the shared leading-edge point is written once
  const coords = removeDuplicates([
    ...sortUpperCoordinates(upperX, upperY),
    ...sortLowerCoordinates(lowerX, lowerY),
  ])

  const lines: string[] = [name, '']
  coords.forEach(([x, y]) => {
    lines.push(`${formatCoord(x)}  ${formatCoord(y)}`)
  })
  return lines.join('\n')
}

/**
 * Build Lednicer format string from raw coordinate arrays.
 * Both surfaces: LE to TE (ascending X), separated by blank line, with point counts header.
 */
export const buildLednicerString = (
  name: string,
  upperX: number[],
  upperY: number[],
  lowerX: number[],
  lowerY: number[]
): string => {
  const upperCoords = removeDuplicates(sortLowerCoordinates(upperX, upperY))
  const lowerCoords = removeDuplicates(sortLowerCoordinates(lowerX, lowerY))

  const upperCountStr = (upperCoords.length.toString() + '.').padStart(8)
  const lowerCountStr = (lowerCoords.length.toString() + '.').padStart(8)

  const lines: string[] = [name.toUpperCase(), `${upperCountStr}  ${lowerCountStr}`, '']
  upperCoords.forEach(([x, y]) => {
    lines.push(`${formatCoord(x)}  ${formatCoord(y)}`)
  })
  lines.push('')
  lowerCoords.forEach(([x, y]) => {
    lines.push(`${formatCoord(x)}  ${formatCoord(y)}`)
  })
  return lines.join('\n')
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

    const content = buildLednicerString(
      airfoil.name,
      airfoil.upper_x_coordinates,
      airfoil.upper_y_coordinates,
      airfoil.lower_x_coordinates,
      airfoil.lower_y_coordinates
    )
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

    const content = buildSeligString(
      airfoil.name,
      airfoil.upper_x_coordinates,
      airfoil.upper_y_coordinates,
      airfoil.lower_x_coordinates,
      airfoil.lower_y_coordinates
    )
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

    // Both surfaces LE to TE (ascending X), adjacent duplicates removed
    const upperCoords = removeDuplicates(sortLowerCoordinates(
      airfoil.upper_x_coordinates,
      airfoil.upper_y_coordinates
    ))
    const lowerCoords = removeDuplicates(sortLowerCoordinates(
      airfoil.lower_x_coordinates,
      airfoil.lower_y_coordinates
    ))

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
    lines.push(`${upperCoords.length}\tNum Pnts Upper`)
    lines.push(`${lowerCoords.length}\tNum Pnts Lower`)
    
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

