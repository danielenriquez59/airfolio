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
   * {upper coordinates - descending X}
   * {lower coordinates - ascending X}
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

    // Sort coordinates
    const upperCoords = sortUpperCoordinates(
      airfoil.upper_x_coordinates,
      airfoil.upper_y_coordinates
    )
    const lowerCoords = sortLowerCoordinates(
      airfoil.lower_x_coordinates,
      airfoil.lower_y_coordinates
    )

    // Build file content
    const lines: string[] = []
    
    // Airfoil name
    lines.push(airfoil.name.toUpperCase())
    
    // Upper and lower counts (with periods and spacing as shown in example)
    // Format: number + period should total 8 characters (right-aligned)
    // Example: "19" -> "      19." (7 chars: 6 spaces + "19" + ".")
    const upperCountStr = (airfoil.upper_surface_nodes.toString() + '.').padStart(8)
    const lowerCountStr = (airfoil.lower_surface_nodes.toString() + '.').padStart(8)
    lines.push(`${upperCountStr}  ${lowerCountStr}`)
    
    // Upper surface coordinates (descending X)
    upperCoords.forEach(([x, y]) => {
      lines.push(`${formatCoord(x)}  ${formatCoord(y)}`)
    })
    
    // Lower surface coordinates (ascending X)
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

    // Sort coordinates
    // Upper: descending X (TE to LE)
    // Lower: ascending X (LE to TE)
    const upperCoords = sortUpperCoordinates(
      airfoil.upper_x_coordinates,
      airfoil.upper_y_coordinates
    )
    const lowerCoords = sortLowerCoordinates(
      airfoil.lower_x_coordinates,
      airfoil.lower_y_coordinates
    )

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

  return {
    downloadLednicer,
    downloadSelig,
  }
}

