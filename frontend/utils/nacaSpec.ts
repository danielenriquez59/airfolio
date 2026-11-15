/**
 * Generated NACA airfoils as ?airfoil= specs: naca4:m,p,t  naca5:cl,p,t  naca6:family,t,cl,a
 */
import type { Database } from '~/types/database.types'
import type { NACA4Params, NACA5Params, NACA6Family, NACA6Params } from '../composables/useNACAGenerator.ts'
import { NACA_RANGES, compactNACA6Name, generateNACA4, generateNACA4Name, generateNACA5, generateNACA5Name, generateNACA6, generateNACA6Name } from '../composables/useNACAGenerator.ts'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

export type NACASpec =
  | { kind: 'naca4'; params: NACA4Params }
  | { kind: 'naca5'; params: NACA5Params }
  | { kind: 'naca6'; params: NACA6Params }

export const NACA_SPEC_PREFIX = /^naca[456]:/
export const isGeneratedAirfoil = (name: string) => NACA_SPEC_PREFIX.test(name)

/** mfoil run key; Smooth only counts for library airfoils, since generated ones are never smoothed */
export const mfoilRunKey = (conditions: unknown[], smooth: boolean, name: string) =>
  JSON.stringify([...conditions, smooth && !isGeneratedAirfoil(name)])

export const SERIES = { naca4: '4-digit', naca5: '5-digit', naca6: '6-series' } as const
const FAMILIES: NACA6Family[] = ['63', '64', '65', '66', '67', '63A', '64A', '65A']
// [key, [min, max]] in spec order
const fields = (kind: NACASpec['kind']) => Object.entries(NACA_RANGES[SERIES[kind]]) as [string, readonly [number, number]][]

const round4 = (v: number) => String(Math.round(v * 1e4) / 1e4)

// Parameters that do not change the shape get a fixed value, so one shape has one spec
export function formatNACASpec({ kind, params }: NACASpec): string {
  const nums = fields(kind).map(([k]) => round4((params as unknown as Record<string, number>)[k]))
  if ((kind === 'naca4' || kind === 'naca5') && nums[0] === '0')
    nums[1] = String(NACA_RANGES[SERIES[kind]].p[0]) // no camber: p does nothing
  if (kind === 'naca6' && params.family.endsWith('A'))
    nums[2] = '1' // 6A sections use the fixed modified a = 0.8 mean line
  return `${kind}:${(kind === 'naca6' ? [(params as NACA6Params).family, ...nums] : nums).join(',')}`
}

/** null when the string is not a valid spec (unknown prefix, wrong count, bad number, unknown family, out of range) */
export function parseNACASpec(s: string): NACASpec | null {
  const m = /^(naca[456]):(.*)$/.exec(s)
  if (!m)
    return null
  const kind = m[1] as NACASpec['kind']
  const parts = m[2].split(',')
  const family = kind === 'naca6' ? parts.shift() as NACA6Family : undefined
  if (family !== undefined && !FAMILIES.includes(family))
    return null
  const fs = fields(kind)
  if (parts.length !== fs.length)
    return null
  const params: Record<string, unknown> = family ? { family } : kind === 'naca5' ? { isReflex: false } : {}
  for (const [i, [k, [lo, hi]]] of fs.entries()) {
    const v = parts[i].trim() === '' ? Number.NaN : Number(parts[i])
    if (!Number.isFinite(v) || v < lo || v > hi)
      return null
    params[k] = v
  }
  return { kind, params } as NACASpec
}

/** Generated names in canonical form, so the same shape is one slot; anything else unchanged */
export function canonicalAirfoilName(name: string): string {
  const spec = parseNACASpec(name)
  return spec ? formatNACASpec(spec) : name
}

/** Kind and parameter values, e.g. 5-digit · cl 0 · p 0.05 · t 0.12; tells apart sections whose names round alike */
export function nacaParamText(name: string): string | null {
  const spec = parseNACASpec(name)
  if (!spec)
    return null
  const vals = formatNACASpec(spec).split(/[:,]/).slice(1)
  const family = spec.kind === 'naca6' ? [vals.shift()] : []
  return [SERIES[spec.kind], ...family, ...fields(spec.kind).map(([k], i) => `${k} ${vals[i]}`)].join(' · ')
}

export function nacaDesignation({ kind, params }: NACASpec): string {
  return kind === 'naca4' ? generateNACA4Name(params) : kind === 'naca5' ? generateNACA5Name(params) : generateNACA6Name(params)
}

export function nacaFileBase(spec: NACASpec): string {
  return spec.kind === 'naca6' ? `NACA_${compactNACA6Name(spec.params)}` : nacaDesignation(spec).replace(' ', '_')
}

/** A synthetic library row; the generator gives both surfaces LE->TE, rows hold upper TE->LE, lower LE->TE */
export function nacaSpecAirfoil(spec: NACASpec): Airfoil {
  // 101 cosine-spaced points per surface (6-series: fixed 201 by its tables); mfoil repanels to npanel anyway
  const c = spec.kind === 'naca4' ? generateNACA4(spec.params, 100) : spec.kind === 'naca5' ? generateNACA5(spec.params, 100) : generateNACA6(spec.params)
  return {
    name: formatNACASpec(spec),
    display_name: nacaDesignation(spec),
    upper_x_coordinates: c.upperX.slice().reverse(),
    upper_y_coordinates: c.upperY.slice().reverse(),
    lower_x_coordinates: c.lowerX,
    lower_y_coordinates: c.lowerY,
  } as Airfoil
}
