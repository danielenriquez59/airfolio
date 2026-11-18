"""
Utility functions for the airfoil analysis backend.
"""
import hashlib
import json
from typing import Dict, Any, List, Tuple, Optional
from pydantic import BaseModel
import numpy as np
import aerosandbox as asb


def generate_condition_hash(conditions: BaseModel, airfoil_id: str, flap_fraction: Optional[float] = None, deflection: Optional[float] = None) -> str:
    """
    SHA256 cache key (performance_cache.cond_hash) of the conditions, airfoil id and optional flap settings.
    Unset fields hash as the defaults the analysis uses, so stored keys never change.
    """
    conditions_dict = conditions.model_dump(exclude_none=False, mode='json')

    if conditions_dict.get('n_crit') is None:
        conditions_dict['n_crit'] = 9.0

    if conditions_dict.get('control_surface_fraction') is None:
        conditions_dict['control_surface_fraction'] = 0.0

    if conditions_dict.get('control_surface_deflection') is None:
        conditions_dict['control_surface_deflection'] = 0.0

    # Include airfoil ID in the hash
    hash_data = {
        'conditions': conditions_dict,
        'airfoil_id': airfoil_id
    }

    # Include control surface parameters if provided
    if flap_fraction is not None:
        hash_data['flap_fraction'] = flap_fraction
    if deflection is not None:
        hash_data['deflection'] = deflection

    hash_str = json.dumps(hash_data, sort_keys=True)
    return hashlib.sha256(hash_str.encode()).hexdigest()


# Airfoil Upload Utilities

def validate_monotonic(x_coords: List[float]) -> Tuple[bool, str]:
    """
    Check if x-coordinates are monotonic (either all increasing or all decreasing).
    
    Args:
        x_coords: List of x coordinates
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(x_coords) < 2:
        return True, ""
    
    is_increasing = all(x_coords[i] < x_coords[i + 1] for i in range(len(x_coords) - 1))
    is_decreasing = all(x_coords[i] > x_coords[i + 1] for i in range(len(x_coords) - 1))
    
    if not (is_increasing or is_decreasing):
        return False, "X-coordinates must be monotonic (either all increasing or all decreasing)"
    
    return True, ""


# Geometry Calculation using AeroSandbox

def sanitize_float(value: Any) -> Any:
    """
    Convert float values to JSON-compliant format.
    Replaces inf, -inf, and NaN with None.
    """
    if value is None:
        return None
    try:
        float_val = float(value)
        if not np.isfinite(float_val):
            return None
        return float_val
    except (ValueError, TypeError):
        return None


def orient_airfoil_surfaces(
    upper: List[Tuple[float, float]],
    lower: List[Tuple[float, float]],
) -> Tuple[List[Tuple[float, float]], List[Tuple[float, float]]]:
    """
    Return upper surface TE to LE and lower surface LE to TE.

    Uploads may store both surfaces LE to TE (Lednicer). The closed profile
    polygon is trailing edge, leading edge, then trailing edge again.
    """
    if len(upper) >= 2 and upper[0][0] < upper[-1][0]:
        upper = upper[::-1]
    if len(lower) >= 2 and lower[0][0] > lower[-1][0]:
        lower = lower[::-1]
    return upper, lower


def selig_loop(
    upper: List[Tuple[float, float]],
    lower: List[Tuple[float, float]],
) -> List[List[float]]:
    """
    One loop of [x, y] points in Selig order: upper trailing edge, round the
    nose, to the lower trailing edge. Same order as buildSeligString in
    frontend/composables/useAirfoilDownload.ts.
    """
    upper, lower = orient_airfoil_surfaces(upper, lower)
    points: List[List[float]] = []
    for x, y in [*upper, *lower]:
        # Skip adjacent repeats so the shared leading-edge point appears once
        if points and abs(points[-1][0] - x) < 5e-5 and abs(points[-1][1] - y) < 5e-5:
            continue
        points.append([x, y])
    return points


def calculate_area_coefficient(x: List[float], y: List[float]) -> Optional[float]:
    """
    Enclosed profile area of a chord-normalized polygon, as A/c^2.

    Uses the shoelace formula. Returns None when the polygon is shorter
    than three points or contains a non-finite coordinate.
    """
    if x is None or y is None or len(x) != len(y) or len(x) < 3:
        return None

    try:
        xs = np.asarray(x, dtype=float)
        ys = np.asarray(y, dtype=float)
    except (TypeError, ValueError):
        return None

    if xs.size != ys.size or xs.size < 3:
        return None
    if not np.isfinite(xs).all() or not np.isfinite(ys).all():
        return None

    area = 0.5 * abs(float(np.dot(xs, np.roll(ys, -1)) - np.dot(ys, np.roll(xs, -1))))
    if not np.isfinite(area):
        return None
    return area


PROPERTY_COLUMNS = ('thickness_pct', 'thickness_loc_pct', 'camber_pct', 'camber_loc_pct', 'le_radius', 'te_thickness', 'te_angle')


def calculate_properties(x: List[float], y: List[float]) -> Dict[str, Optional[float]]:
    """
    Geometric properties of an airfoil from x and y arrays in TE upper -> LE -> TE lower order,
    keyed as the airfoils table columns. All None when AeroSandbox fails.
    """
    try:
        airfoil = asb.Airfoil(name="Custom", coordinates=np.column_stack([x, y]))
        x_sample = np.linspace(0, 1, 201)
        values = [
            airfoil.max_thickness(x_sample),
            x_sample[np.argmax(airfoil.local_thickness(x_sample))],
            airfoil.max_camber(x_sample),
            x_sample[np.argmax(airfoil.local_camber(x_sample))],
            airfoil.LE_radius(),
            airfoil.TE_thickness(),
            airfoil.TE_angle(),
        ]
    except Exception as e:
        print(f"Error calculating airfoil properties: {e}")
        values = [None] * len(PROPERTY_COLUMNS)
    return dict(zip(PROPERTY_COLUMNS, map(sanitize_float, values)))


def deflect_trailing_edge_flap(x: List[float], y: List[float], deflection: float, hinge_point: float = 0.75) -> Dict[str, List[float]]:
    """
    Deflect a trailing edge flap (degrees, downwards-positive) hinged at x/c = hinge_point.
    x, y run TE upper -> LE -> TE lower; returns the deflected {'x': [...], 'y': [...]}.
    """
    airfoil = asb.Airfoil(name="Custom", coordinates=np.column_stack([x, y]))
    deflected = airfoil.add_control_surface(
        deflection=deflection,
        hinge_point_x=hinge_point,
        modify_coordinates=True,
        modify_polars=True,
    ).coordinates
    return {"x": deflected[:, 0].tolist(), "y": deflected[:, 1].tolist()}
