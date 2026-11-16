/**
 * Generated NACA airfoils as ?airfoil= specs: naca4:m,p,t  naca4m:m,p,t,le,xt  naca5:cl,p,t  naca5r:cl,p,t
 * naca16:t,cl  naca6:family,t,cl,a  riblett:series,cusp,t,cl,sharpTE
 * (m = modified thickness, r = reflex; shared links rely on these staying valid)
 */
import type { Database } from '~/types/database.types'
import type { NACA16Params, NACA4Params, NACA5Params, NACA6Family, NACA6Params, RiblettParams } from '../composables/useNACAGenerator.ts'
import { NACA_RANGES } from '../composables/useNACAGenerator.ts'
import { familyDef } from './airfoilFamilies.ts'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

export type NACASpec =
  | { kind: 'naca4'; params: NACA4Params }
  | { kind: 'naca5'; params: NACA5Params }
  | { kind: 'naca16'; params: NACA16Params }
  | { kind: 'naca6'; params: NACA6Params }
  | { kind: 'riblett'; params: RiblettParams }

const SPEC = /^(naca(?:4m?|5r?|16|6)|riblett):(.*)$/
export const NACA_SPEC_PREFIX = /^(?:naca(?:4m?|5r?|16|6)|riblett):/
export const isGeneratedAirfoil = (name: string) => NACA_SPEC_PREFIX.test(name)

/** mfoil run key; Smooth only counts for library airfoils, since generated ones are never smoothed */
export const mfoilRunKey = (conditions: unknown[], smooth: boolean, name: string) =>
  JSON.stringify([...conditions, smooth && !isGeneratedAirfoil(name)])

export const SERIES = { naca4: '4-digit', naca5: '5-digit', naca16: '16-series', naca6: '6-series', riblett: 'riblett' } as const
const FAMILIES: NACA6Family[] = ['63', '64', '65', '66', '67', '63A', '64A', '65A']
const RIBLETT_SERIES = ['30', '35', '37', '40']
const RIBLETT_CUSPS = ['-', 'A']
// Spec code -> kind, label and numeric fields in spec order (naca6 family and riblett series,cusp lead; riblett sharpTE trails)
const CODES = {
  naca4: { kind: 'naca4', label: '4-digit', keys: ['m', 'p', 't'] },
  naca4m: { kind: 'naca4', label: '4-digit modified', keys: ['m', 'p', 't', 'le', 'xt'] },
  naca5: { kind: 'naca5', label: '5-digit', keys: ['cl', 'p', 't'] },
  naca5r: { kind: 'naca5', label: '5-digit reflex', keys: ['cl', 'p', 't'] },
  naca16: { kind: 'naca16', label: '16-series', keys: ['t', 'cl'] },
  naca6: { kind: 'naca6', label: '6-series', keys: ['t', 'cl', 'a'] },
  riblett: { kind: 'riblett', label: 'Riblett GA', keys: ['t', 'cl'] },
} as const
type Code = keyof typeof CODES
const codeOf = ({ kind, params }: NACASpec): Code =>
  kind === 'naca4' && params.modified ? 'naca4m' : kind === 'naca5' && params.isReflex ? 'naca5r' : kind
const range = (code: Code, k: string): readonly [number, number] =>
  code === 'naca5r' && k === 'p' ? NACA_RANGES['5-digit'].pReflex : (NACA_RANGES[SERIES[CODES[code].kind]] as Record<string, readonly [number, number]>)[k]

const round4 = (v: number) => String(Math.round(v * 1e4) / 1e4)

// Parameters that do not change the shape get a fixed value, so one shape has one spec
export function formatNACASpec(spec: NACASpec): string {
  const { kind, params } = spec
  let code = codeOf(spec)
  const nums = CODES[code].keys.map(k => round4((params as unknown as Record<string, number>)[k]))
  if (code === 'naca5r' && nums[0] === '0')
    code = 'naca5' // reflex with cl 0 has no camber: the plain symmetric section
  if ((kind === 'naca4' || kind === 'naca5') && nums[0] === '0')
    nums[1] = String(range(code, 'p')[0]) // no camber: p does nothing
  if (kind === 'naca6' && params.family.endsWith('A'))
    nums[2] = '1' // 6A sections use the fixed modified a = 0.8 mean line
  const all = kind === 'naca6' ? [params.family, ...nums] : kind === 'riblett' ? [params.series, params.cusp, ...nums, params.sharpTE ? '1' : '0'] : nums
  return `${code}:${all.join(',')}`
}

/** null when the string is not a valid spec (unknown prefix, wrong count, bad number, unknown family, out of range) */
export function parseNACASpec(s: string): NACASpec | null {
  const m = SPEC.exec(s)
  if (!m)
    return null
  const code = m[1] as Code
  const kind = CODES[code].kind
  const parts = m[2].split(',')
  const keys = CODES[code].keys
  const head = kind === 'naca6' ? 1 : kind === 'riblett' ? 2 : 0
  if (parts.length !== head + keys.length + (kind === 'riblett' ? 1 : 0))
    return null
  let params: Record<string, unknown>
  if (kind === 'naca6') {
    if (!FAMILIES.includes(parts[0] as NACA6Family))
      return null
    params = { family: parts[0] }
  }
  else if (kind === 'riblett') {
    const sharp = parts[parts.length - 1]
    if (!RIBLETT_SERIES.includes(parts[0]) || !RIBLETT_CUSPS.includes(parts[1]) || (sharp !== '0' && sharp !== '1'))
      return null
    params = { series: parts[0], cusp: parts[1], sharpTE: sharp === '1' }
  }
  else {
    params = code === 'naca4m' ? { modified: true } : kind === 'naca5' ? { isReflex: code === 'naca5r' } : {}
  }
  for (const [i, k] of keys.entries()) {
    const part = parts[head + i]
    const v = part.trim() === '' ? Number.NaN : Number(part)
    const [lo, hi] = range(code, k)
    if (!Number.isFinite(v) || v < lo || v > hi || (k === 'le' && !Number.isInteger(v)))
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
  const [code, ...vals] = formatNACASpec(spec).split(/[:,]/) as [Code, ...string[]]
  const head = spec.kind === 'naca6' ? [vals.shift()] : spec.kind === 'riblett' ? [vals.shift()! + vals.shift()!] : []
  const tail = spec.kind === 'riblett' && spec.params.sharpTE ? ['sharp TE'] : []
  return [CODES[code].label, ...head, ...CODES[code].keys.map((k, i) => `${k} ${vals[i]}`), ...tail].join(' · ')
}

export const nacaDesignation = (spec: NACASpec): string => familyDef(SERIES[spec.kind]).name(spec.params)

// NACA_641412a05, NACA_16212, NACA_0012-64, NACA_2412, GA_35A415, GA_35A_3_5_15 (the generator page's file stems)
export const nacaFileBase = (spec: NACASpec): string => familyDef(SERIES[spec.kind]).fileBase(spec.params)

/** A synthetic library row; the generator gives both surfaces LE->TE, rows hold upper TE->LE, lower LE->TE */
export function nacaSpecAirfoil(spec: NACASpec): Airfoil {
  // 101 cosine-spaced points per surface (6-series: fixed 201 by its tables, Riblett: 27 tabulated stations);
  // mfoil splines and repanels to npanel anyway
  const c = familyDef(SERIES[spec.kind]).generate(spec.params, 100)
  return {
    name: formatNACASpec(spec),
    display_name: nacaDesignation(spec),
    upper_x_coordinates: c.upperX.slice().reverse(),
    upper_y_coordinates: c.upperY.slice().reverse(),
    lower_x_coordinates: c.lowerX,
    lower_y_coordinates: c.lowerY,
  } as Airfoil
}
