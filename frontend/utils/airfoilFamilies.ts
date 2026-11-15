/**
 * One entry per generator family: tab label, default parameters, designation, coordinates, download file stem
 * and the family rows of the parameter CSV. The generator page, its editor, nacaSpec and the exports look up here.
 */
import type { NACA16Params, NACA4Params, NACA5Params, NACA6Params, NACACoordinates, PARSECParams, RiblettParams } from '../composables/useNACAGenerator.ts'
import type { CSTParameters } from '../composables/useCSTParameters.ts'
import { compactNACA6Name, generateNACA16, generateNACA16Name, generateNACA4, generateNACA4Name, generateNACA5, generateNACA5Name, generateNACA6, generateNACA6Name, generatePARSEC, generateRiblett, generateRiblettName } from '../composables/useNACAGenerator.ts'
import { generateCSTCoordinates } from '../composables/useCSTParameters.ts'
import { sanitizeFilename } from '../composables/useAirfoilDownload.ts'

export interface FamilyParams {
  '4-digit': NACA4Params
  '5-digit': NACA5Params
  '16-series': NACA16Params
  '6-series': NACA6Params
  'riblett': RiblettParams
  'cst': CSTParameters
  'parsec': PARSECParams
}
export type Family = keyof FamilyParams

interface FamilyDef<P> {
  label: string
  defaults: P
  name: (p: P) => string
  generate: (p: P, numPoints: number) => NACACoordinates // 6-series and Riblett have fixed points
  fileBase: (p: P) => string
  csvRows?: (p: P) => string[] // family rows of the NACA parameter CSV; CST has its own CSV
}

const num = (v: number) => v.toFixed(6)

/** Default CST weights for a given order (the last weight is 0) */
export const defaultCSTWeights = (n: number) => {
  const upperWeights: number[] = []
  const lowerWeights: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    upperWeights.push(parseFloat((0.2 * Math.pow(1 - t, 2) + 0.4 * t * (1 - t)).toFixed(3)))
    lowerWeights.push(parseFloat((-0.2 * Math.pow(1 - t, 2) - 0.15 * t * (1 - t)).toFixed(3)))
  }
  upperWeights[n] = 0
  lowerWeights[n] = 0
  return { upperWeights, lowerWeights }
}

export const AIRFOIL_FAMILIES: { [F in Family]: FamilyDef<FamilyParams[F]> } = {
  '4-digit': {
    label: '4-digit',
    // le, xt only count when modified
    defaults: { m: 0.02, p: 0.4, t: 0.12, modified: false, le: 6, xt: 0.3 },
    name: generateNACA4Name,
    generate: generateNACA4,
    fileBase: p => sanitizeFilename(generateNACA4Name(p)),
    csvRows: p => [
      `max_camber_m,${num(p.m)}`,
      `camber_position_p,${num(p.p)}`,
      `max_thickness_t,${num(p.t)}`,
      `max_camber_percent,${num(p.m * 100)}`,
      `camber_position_percent,${num(p.p * 100)}`,
      `max_thickness_percent,${num(p.t * 100)}`,
      `modified_thickness,${!!p.modified}`,
      ...(p.modified ? [`leading_edge_radius_index,${p.le}`, `max_thickness_position_xt,${num(p.xt!)}`] : []),
    ],
  },
  '5-digit': {
    label: '5-digit',
    defaults: { cl: 0.3, p: 0.15, t: 0.12, isReflex: false },
    name: generateNACA5Name,
    generate: generateNACA5,
    fileBase: p => sanitizeFilename(generateNACA5Name(p)),
    csvRows: p => [
      `design_lift_coefficient_cl,${num(p.cl)}`,
      `camber_position_p,${num(p.p)}`,
      `max_thickness_t,${num(p.t)}`,
      `is_reflex,${p.isReflex}`,
      `camber_position_percent,${num(p.p * 100)}`,
      `max_thickness_percent,${num(p.t * 100)}`,
    ],
  },
  '16-series': {
    label: '16-series',
    defaults: { t: 0.12, cl: 0.2 },
    name: generateNACA16Name,
    generate: generateNACA16,
    fileBase: p => generateNACA16Name(p).replace(' ', '_').replace('-', ''), // NACA 16-212 -> NACA_16212
    csvRows: p => [
      `max_thickness_t,${num(p.t)}`,
      `design_lift_coefficient_cl,${num(p.cl)}`,
      // fixed by the series: modified 4-digit thickness and the a = 1 mean line
      'leading_edge_radius_index,4',
      `max_thickness_position_xt,${num(0.5)}`,
      `loading_extent_a,${num(1)}`,
      `max_thickness_percent,${num(p.t * 100)}`,
    ],
  },
  '6-series': {
    label: '6-series',
    defaults: { family: '64', t: 0.12, cl: 0.2, a: 1 },
    name: generateNACA6Name,
    generate: p => generateNACA6(p),
    fileBase: p => `NACA_${compactNACA6Name(p)}`, // names hold brackets, spaces and =
    csvRows: p => [
      `family,${p.family}`,
      `max_thickness_t,${num(p.t)}`,
      `design_lift_coefficient_cl,${num(p.cl)}`,
      // 6A sections always use the modified a = 0.8 mean line
      `loading_extent_a,${num(p.family.endsWith('A') ? 0.8 : p.a)}`,
      `max_thickness_percent,${num(p.t * 100)}`,
    ],
  },
  'riblett': {
    label: 'Riblett GA',
    defaults: { series: '35', cusp: 'A', cl: 0.4, t: 0.15, sharpTE: false },
    name: generateRiblettName,
    generate: p => generateRiblett(p), // 27 tabulated stations
    fileBase: p => sanitizeFilename(generateRiblettName(p)),
    csvRows: p => [
      `thickness_series,${p.series}`,
      `cusp,${p.cusp === 'A' ? 'reduced' : 'standard'}`,
      `design_lift_coefficient_cl,${num(p.cl)}`,
      `max_thickness_t,${num(p.t)}`,
      `sharp_te,${p.sharpTE}`,
      `max_thickness_percent,${num(p.t * 100)}`,
    ],
  },
  'cst': {
    label: 'CST',
    // LE/TE values of the legacy DAE-11 preset; order 3 shows as 4 weights
    defaults: { ...defaultCSTWeights(3), leWeight: 0.5035, teThickness: 0.0001, order: 3 },
    name: () => 'CST Airfoil',
    generate: (p, n) => generateCSTCoordinates(p.upperWeights, p.lowerWeights, p.leWeight, p.teThickness, p.order, n),
    fileBase: () => 'CST_Airfoil',
  },
  'parsec': {
    label: 'PARSEC',
    // Best max-deviation fit to the NACA 2412 surfaces, rounded (12% thick, within 0.0045 chord of 2412);
    // matching only the 2412 crest values gave a wavy lower surface
    defaults: { rLE: 0.012, xUp: 0.31, zUp: 0.079, zxxUp: -0.55, xLo: 0.22, zLo: -0.042, zxxLo: 0.43, zTE: 0, dzTE: 0, alphaTE: 0, betaTE: 11 },
    name: () => 'PARSEC',
    generate: generatePARSEC,
    fileBase: () => 'parsec',
    // Sobieczky's 11 parameters in their object order; alphaTE and betaTE in degrees
    csvRows: p => Object.entries(p).map(e => `${e[0]},${num(e[1])}`),
  },
}

export const FAMILY_KEYS = Object.keys(AIRFOIL_FAMILIES) as Family[]

/** Untyped view for lookups where the family is only known at run time */
export const familyDef = (f: Family) => AIRFOIL_FAMILIES[f] as unknown as FamilyDef<any>

/** A typed value clamped to [min, max] and snapped to the slider grid min + k * step */
export const snapToStep = (v: number, min: number, max: number, step: number) => {
  const clamp = (x: number) => Math.min(max, Math.max(min, x))
  return clamp(+(min + Math.round((clamp(v) - min) / step) * step).toFixed(6))
}
