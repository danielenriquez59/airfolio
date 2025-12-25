import type { WingParameters, SchrenkPoint, CombinedLoadPoint, CalculationResult } from '~/types/schrenk.types'

// Helper for linear interpolation space
const linspace = (start: number, stop: number, num: number): number[] => {
  const step = (stop - start) / (num - 1)
  return Array.from({ length: num }, (_, i) => start + (step * i))
}

export const calculateWingData = (params: WingParameters): CalculationResult => {
  const {
    span_ft,
    wing_area_sqft,
    taper_ratio,
    max_weight_lb,
    load_factor_n,
    tail_lift_lb,
    wing_weight_per_side_lb,
    pointmass_weight_lb,
    pointmass_station_in,
    wing_root_station_in
  } = params

  // Derived Geometry
  const semi_span_ft = span_ft / 2
  const semi_span_in = semi_span_ft * 12

  // Lift Calculations
  const factor = 1 //max_weight_lb < 1500 ? 1.05 : 1.10
  const lift_lb = factor * load_factor_n * max_weight_lb - tail_lift_lb
  const qCL = lift_lb / wing_area_sqft

  // Root Chord calculation
  const root_chord = (2 * wing_area_sqft) / (span_ft * (1 + taper_ratio))
  const tip_chord = root_chord * taper_ratio
  const ellipse_height_cl = (4 * wing_area_sqft) / (Math.PI * span_ft)

  // --- 1. Generate Stations ---
  // Create stations from root (0) to tip. Python uses 18 stations.
  let rawStations = linspace(0.0, semi_span_in, 50)
  
  // Ensure critical stations are included
  rawStations.push(wing_root_station_in)
  rawStations.push(pointmass_station_in)

  // Sort descending (Tip -> Root) for integration purposes, matching Python logic flow
  const stations = Array.from(new Set(rawStations)).sort((a, b) => b - a)

  // --- 2. Build Schrenk Table Data ---
  const schrenkPoints: SchrenkPoint[] = stations.map(station => {
    // Chord Distribution (Linear)
    let chord = 0
    if (station <= 0) chord = root_chord
    else if (station >= semi_span_in) chord = tip_chord
    else chord = root_chord - (root_chord - tip_chord) * (station / semi_span_in)

    // Ellipse Height
    const y_ft = station / 12.0
    const two_y_over_b = (2 * y_ft) / span_ft
    let ellipse = 0
    if (Math.abs(two_y_over_b) < 1.0) {
      ellipse = (4 * wing_area_sqft) / (Math.PI * span_ft) * Math.sqrt(1 - Math.pow(two_y_over_b, 2))
    }

    const cCla = (chord + ellipse) / 2
    const unit_Cla = chord === 0 ? 0 : cCla / chord

    return {
      station_in: station,
      chord_ft: chord,
      ellipse,
      screnk_cCla: cCla,
      unit_Cla
    }
  })

  // --- 3. Build Aerodynamic Loads (Integration) ---
  const n = stations.length
  const aeroLoads = {
    shear_force_lb: new Array(n).fill(0),
    bending_moment_lb_in: new Array(n).fill(0),
    element_lift_lb: new Array(n).fill(0)
  }

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      // Tip (first element in descending list)
      aeroLoads.element_lift_lb[i] = 0
    } else {
      const delta_y = stations[i - 1] - stations[i]
      const avg_chord = (schrenkPoints[i - 1].chord_ft + schrenkPoints[i].chord_ft) / 2
      const element_area = (delta_y / 12) * avg_chord
      const avg_unit_Cla = (schrenkPoints[i - 1].unit_Cla + schrenkPoints[i].unit_Cla) / 2
      const element_lift = qCL * element_area * avg_unit_Cla
      aeroLoads.element_lift_lb[i] = element_lift
    }
  }

  // Cumulative Shear (Tip to Root)
  let currentShear = 0
  for (let i = 0; i < n; i++) {
    currentShear += aeroLoads.element_lift_lb[i]
    aeroLoads.shear_force_lb[i] = currentShear
  }

  // Bending Moment (Area under shear)
  let currentMoment = 0
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      aeroLoads.bending_moment_lb_in[i] = 0
    } else {
      const delta_y = stations[i - 1] - stations[i]
      const avg_shear = (aeroLoads.shear_force_lb[i - 1] + aeroLoads.shear_force_lb[i]) / 2
      currentMoment += avg_shear * delta_y
      aeroLoads.bending_moment_lb_in[i] = currentMoment
    }
  }

  // --- 4. Inertia Loads ---
  const inertiaLoads = {
    distributed_shear: new Array(n).fill(0),
    distributed_moment: new Array(n).fill(0),
    inertia_loading_4g: new Array(n).fill(0),
    point_load_shear_lb: new Array(n).fill(0),
    point_load_moment_lb_in: new Array(n).fill(0),
    total_inertia_shear: new Array(n).fill(0),
    total_inertia_moment: new Array(n).fill(0)
  }

  // Helper for inertia loading calculation (distributed weight)
  const getInertiaLoading = (st: number): number => {
    if (st < wing_root_station_in) return 0.0
    if (st > semi_span_in) return 0.0
    
    const span_len = semi_span_in - wing_root_station_in
    const w_root = (wing_weight_per_side_lb * 2) / (1.25 * span_len)
    const w_tip = w_root / 4
    
    return w_tip + (w_root - w_tip) * (semi_span_in - st) / span_len
  }

  // Calculate distributed inertia loading (w)
  for (let i = 0; i < n; i++) {
    const w = getInertiaLoading(stations[i])
    inertiaLoads.inertia_loading_4g[i] = -w * load_factor_n
  }

  // Calculate Distributed Inertia Shear (Tip to Root)
  let distShear = 0
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const delta_y = stations[i - 1] - stations[i]
      const avg_load = (inertiaLoads.inertia_loading_4g[i - 1] + inertiaLoads.inertia_loading_4g[i]) / 2
      distShear += avg_load * delta_y
    }
    inertiaLoads.distributed_shear[i] = distShear
  }

  // Calculate Distributed Inertia Moment
  let distMoment = 0
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      inertiaLoads.distributed_moment[i] = 0
    } else {
      const delta_y = stations[i - 1] - stations[i]
      const avg_shear = (inertiaLoads.distributed_shear[i - 1] + inertiaLoads.distributed_shear[i]) / 2
      distMoment += avg_shear * delta_y
      inertiaLoads.distributed_moment[i] = distMoment
    }
  }

  // Calculate Point Load Shear & Moment
  // Python logic: if station < pointmass_station_in: load else 0
  const pointLoadVal = -pointmass_weight_lb * load_factor_n
  for (let i = 0; i < n; i++) {
    if (stations[i] < pointmass_station_in) {
      inertiaLoads.point_load_shear_lb[i] = pointLoadVal
    } else {
      inertiaLoads.point_load_shear_lb[i] = 0
    }
  }

  let pmMoment = 0
  for (let i = 0; i < n; i++) {
     if (i === 0) {
      inertiaLoads.point_load_moment_lb_in[i] = 0
     } else {
       const delta_y = stations[i - 1] - stations[i]
       const avg_shear = (inertiaLoads.point_load_shear_lb[i - 1] + inertiaLoads.point_load_shear_lb[i]) / 2
       pmMoment += avg_shear * delta_y
       inertiaLoads.point_load_moment_lb_in[i] = pmMoment
     }
  }

  // Combine Distributed and Point Loads into Total Inertia
  for (let i = 0; i < n; i++) {
    inertiaLoads.total_inertia_shear[i] = inertiaLoads.distributed_shear[i] + inertiaLoads.point_load_shear_lb[i]
    inertiaLoads.total_inertia_moment[i] = inertiaLoads.distributed_moment[i] + inertiaLoads.point_load_moment_lb_in[i]
  }

  // --- 5. Combine Loads ---
  const combinedLoadPoints: CombinedLoadPoint[] = []
  const ULT_FACTOR = 1.5
  
  for (let i = 0; i < n; i++) {
    const station = stations[i]
    
    // Limit Loads
    const aeroShear = aeroLoads.shear_force_lb[i]
    const aeroMoment = aeroLoads.bending_moment_lb_in[i]
    const inertiaShear = inertiaLoads.total_inertia_shear[i]
    const inertiaMoment = inertiaLoads.total_inertia_moment[i]

    // Total Shear = Aero + Total Inertia
    let totalShear = aeroShear + inertiaShear
                     
    // Total Moment = Aero + Total Inertia
    let totalMoment = aeroMoment + inertiaMoment

    // Cut off inboard of root
    let finalAeroShear = aeroShear
    let finalAeroMoment = aeroMoment
    let finalInertiaShear = inertiaShear
    let finalInertiaMoment = inertiaMoment

    if (station < wing_root_station_in) {
      totalShear = 0
      totalMoment = 0
      // Also zero out components for cleaner graphs inboard
      finalAeroShear = 0
      finalAeroMoment = 0
      finalInertiaShear = 0
      finalInertiaMoment = 0
    }

    combinedLoadPoints.push({
      station_in: station,
      aero_shear_lb: finalAeroShear,
      aero_moment_lb_in: finalAeroMoment,
      inertia_shear_lb: finalInertiaShear, // Total Inertia
      inertia_moment_lb_in: finalInertiaMoment, // Total Inertia
      point_load_shear_lb: inertiaLoads.point_load_shear_lb[i],
      point_load_moment_lb_in: inertiaLoads.point_load_moment_lb_in[i],
      total_limit_shear_lb: totalShear,
      total_limit_moment_lb_in: totalMoment,
      
      // Ultimate Loads
      ult_aero_shear_lb: finalAeroShear * ULT_FACTOR,
      ult_aero_moment_lb_in: finalAeroMoment * ULT_FACTOR,
      ult_inertia_shear_lb: finalInertiaShear * ULT_FACTOR,
      ult_inertia_moment_lb_in: finalInertiaMoment * ULT_FACTOR,
      ult_shear_lb: totalShear * ULT_FACTOR,
      ult_moment_lb_in: totalMoment * ULT_FACTOR
    })
  }

  // Find max values at root
  const rootPoint = combinedLoadPoints.find(p => Math.abs(p.station_in - wing_root_station_in) < 0.1)
  
  return {
    params,
    summary: {
      lift_lb,
      qCL,
      root_chord,
      tip_chord,
      ellipse_height_cl,
      max_shear_root: rootPoint ? rootPoint.ult_shear_lb : 0,
      max_moment_root: rootPoint ? rootPoint.ult_moment_lb_in : 0,
      limit_shear_root: rootPoint ? rootPoint.total_limit_shear_lb : 0,
      limit_moment_root: rootPoint ? rootPoint.total_limit_moment_lb_in : 0,
    },
    // Sort ascending (0 -> Tip) for Charts
    schrenkData: [...schrenkPoints].sort((a, b) => a.station_in - b.station_in),
    loadData: [...combinedLoadPoints].sort((a, b) => a.station_in - b.station_in)
  }
}

export const useSchrenkCalculator = () => {
  return {
    calculateWingData
  }
}

