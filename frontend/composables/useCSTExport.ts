import type { CSTParameters } from './useCSTParameters'
import { sanitizeFilename, triggerDownload } from './useAirfoilDownload'

/**
 * Format number for CSV (with sufficient precision)
 */
const formatNumber = (num: number): string => {
  return num.toFixed(6)
}

/**
 * Export CST parameters to CSV format
 * @param parameters CST parameters to export
 * @param airfoilName Name of the airfoil (for filename)
 */
export const exportCSTParameters = (
  parameters: CSTParameters,
  airfoilName: string = 'airfoil'
) => {
  const lines: string[] = []

  // Header row
  lines.push('parameter_name,value')

  // Metadata
  lines.push(`airfoil_name,${airfoilName}`)
  lines.push(`order,${parameters.order}`)
  lines.push(`timestamp,${new Date().toISOString()}`)
  lines.push('') // Empty line separator

  // Leading edge weight
  lines.push(`leading_edge_weight,${formatNumber(parameters.leWeight)}`)

  // Trailing edge thickness
  lines.push(`trailing_edge_thickness,${formatNumber(parameters.teThickness)}`)

  lines.push('') // Empty line separator

  // Upper surface weights
  lines.push('upper_surface_weights')
  parameters.upperWeights.forEach((weight, index) => {
    lines.push(`A_upper_${index},${formatNumber(weight)}`)
  })

  lines.push('') // Empty line separator

  // Lower surface weights
  lines.push('lower_surface_weights')
  parameters.lowerWeights.forEach((weight, index) => {
    lines.push(`A_lower_${index},${formatNumber(weight)}`)
  })

  const content = lines.join('\n')
  const filename = `${sanitizeFilename(airfoilName)}_cst_parameters.csv`

  triggerDownload(content, filename)
}
