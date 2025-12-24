export interface WingParameters {
  span_ft: number
  wing_area_sqft: number
  taper_ratio: number
  max_weight_lb: number
  load_factor_n: number
  tail_lift_lb: number
  wing_weight_per_side_lb: number
  pointmass_weight_lb: number
  pointmass_station_in: number
  wing_root_station_in: number
}

export interface SchrenkPoint {
  station_in: number
  chord_ft: number
  ellipse: number
  screnk_cCla: number
  unit_Cla: number
}

export interface CombinedLoadPoint {
  station_in: number
  // Limit Loads
  aero_shear_lb: number
  aero_moment_lb_in: number
  inertia_shear_lb: number // Total Inertia (Distributed + Point)
  inertia_moment_lb_in: number // Total Inertia (Distributed + Point)
  point_load_shear_lb: number
  point_load_moment_lb_in: number
  total_limit_shear_lb: number
  total_limit_moment_lb_in: number
  
  // Ultimate Loads (1.5x)
  ult_aero_shear_lb: number
  ult_aero_moment_lb_in: number
  ult_inertia_shear_lb: number
  ult_inertia_moment_lb_in: number
  ult_shear_lb: number // Total Ultimate
  ult_moment_lb_in: number // Total Ultimate
}

export interface CalculationResult {
  params: WingParameters
  summary: {
    lift_lb: number
    qCL: number
    root_chord: number
    tip_chord: number
    ellipse_height_cl: number
    max_shear_root: number
    max_moment_root: number
  }
  schrenkData: SchrenkPoint[]
  loadData: CombinedLoadPoint[]
}

