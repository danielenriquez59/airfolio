/**
 * Composable for exporting airfoil polar data to CSV
 */

import type { AirfoilPolarData } from './useCompare'
import { calculateLD } from './useCompare'
import { toCSV, triggerDownload } from './useAirfoilDownload'

/**
 * Format a number value for CSV export
 * Returns "N/A" for non-finite values
 */
function formatCSVValue(value: number): string {
  if (!isFinite(value)) {
    return 'N/A'
  }
  return value.toString()
}

/**
 * Generate timestamp in format: YYYY-MM-DD_HH-mm
 */
function generateTimestamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}_${hours}-${minutes}`
}

/**
 * Export airfoil polar data to CSV in long format
 * Each row represents one data point for one airfoil at one alpha
 * 
 * @param airfoils Array of airfoil polar data to export
 */
export function exportPolarDataCSV(airfoils: AirfoilPolarData[]): void {
  // Handle empty data
  if (!airfoils || airfoils.length === 0) {
    console.warn('No airfoil data to export')
    return
  }

  // CSV headers
  const headers = ['Airfoil Name', 'Alpha (deg)', 'CL', 'CD', 'CM', 'L/D']

  // Build rows: for each airfoil, for each alpha index
  const rows: string[][] = []

  for (const airfoil of airfoils) {
    const { name, alpha, CL, CD, CM } = airfoil

    // Validate array lengths match
    const maxLength = Math.max(
      alpha?.length || 0,
      CL?.length || 0,
      CD?.length || 0,
      CM?.length || 0
    )

    if (maxLength === 0) {
      // Skip airfoils with no data
      continue
    }

    // Calculate L/D for this airfoil
    const LD = calculateLD(CL || [], CD || [])

    // Create a row for each data point
    for (let i = 0; i < maxLength; i++) {
      const alphaValue = alpha?.[i] ?? NaN
      const clValue = CL?.[i] ?? NaN
      const cdValue = CD?.[i] ?? NaN
      const cmValue = CM?.[i] ?? NaN
      const ldValue = LD[i] ?? NaN

      rows.push([
        name || 'Unknown',
        formatCSVValue(alphaValue),
        formatCSVValue(clValue),
        formatCSVValue(cdValue),
        formatCSVValue(cmValue),
        formatCSVValue(ldValue),
      ])
    }
  }

  triggerDownload(toCSV([headers, ...rows]), `airfoil_comparison_data_${generateTimestamp()}.csv`, 'text/csv;charset=utf-8;')
}

