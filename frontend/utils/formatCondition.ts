/** Flap deflection of a performance_cache.inputs row; control-surface runs store `deflection`, older rows `control_surface_deflection`. */
export function flapDeflection(inputs: any): number | null {
  if (!inputs)
    return null
  return inputs.deflection ?? inputs.control_surface_deflection ?? null
}

/** Format performance_cache.inputs into a readable run label. */
export function formatCondition(inputs: any): string {
  if (!inputs || typeof inputs !== 'object')
    return 'Unknown conditions'

  const parts: string[] = []

  if (inputs.Re !== undefined && inputs.Re !== null) {
    const re = inputs.Re
    parts.push(re >= 1000 ? `Re ${(re / 1000).toFixed(0)}k` : `Re ${re.toFixed(0)}`)
  }
  if (inputs.Mach !== undefined && inputs.Mach !== null)
    parts.push(`Mach ${inputs.Mach.toFixed(1)}`)
  if (inputs.n_crit !== undefined && inputs.n_crit !== null)
    parts.push(`Ncrit ${inputs.n_crit.toFixed(0)}`)
  if (Array.isArray(inputs.alpha_range) && inputs.alpha_range.length === 3) {
    const [start, end] = inputs.alpha_range
    parts.push(`AoA Range [${start.toFixed(0)}, ${end.toFixed(0)}]`)
  }

  const csDef = flapDeflection(inputs) ?? 0
  if (csDef !== 0) {
    const csFrac = inputs.flap_fraction ?? inputs.control_surface_fraction ?? 0
    parts.push(`Flap Fraction ${csFrac.toFixed(2)}`)
    parts.push(`Flap Deflection ${csDef.toFixed(1)}°`)
  }

  return parts.join(', ')
}
