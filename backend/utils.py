"""
Utility functions for the airfoil analysis backend.
"""
import hashlib
import json
from typing import Dict, Any, List, Tuple
from pydantic import BaseModel
import math
import numpy as np
import aerosandbox as asb


def generate_condition_hash(conditions: BaseModel, airfoil_id: str) -> str:
    """
    Generate a SHA256 hash of analysis conditions and airfoil ID for cache lookup.
    
    Args:
        conditions: Pydantic model with analysis conditions
        airfoil_id: Single airfoil UUID
        
    Returns:
        Hex string hash of the conditions and airfoil ID
    """
    conditions_dict = conditions.model_dump(exclude_none=True, mode='json')
    
    # Include airfoil ID in the hash
    hash_data = {
        'conditions': conditions_dict,
        'airfoil_id': airfoil_id
    }
    
    hash_str = json.dumps(hash_data, sort_keys=True)
    return hashlib.sha256(hash_str.encode()).hexdigest()


def validate_alpha_range(alpha_range: list) -> bool:
    """
    Validate that alpha_range is in correct format: [start, end, step].
    
    Args:
        alpha_range: List with [start, end, step]
        
    Returns:
        True if valid, False otherwise
    """
    if not isinstance(alpha_range, list) or len(alpha_range) != 3:
        return False
    
    start, end, step = alpha_range
    
    if not all(isinstance(x, (int, float)) for x in [start, end, step]):
        return False
    
    if step <= 0:
        return False
    
    if start >= end:
        return False
    
    return True


def format_alpha_schedule(alpha_range: list) -> list:
    """
    Convert alpha_range [start, end, step] to a list of alpha values.
    
    Args:
        alpha_range: [start, end, step]
        
    Returns:
        List of alpha values
    """
    start, end, step = alpha_range
    return [round(start + i * step, 2) for i in range(int((end - start) / step) + 1)]


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


def extract_coordinates(upper: List[Tuple[float, float]], lower: List[Tuple[float, float]]) -> Dict[str, List[float]]:
    """
    Extract x and y coordinates into separate arrays.
    
    Args:
        upper: List of [x, y] for upper surface
        lower: List of [x, y] for lower surface
        
    Returns:
        Dictionary with upper_x, upper_y, lower_x, lower_y arrays
    """
    upper_x = [p[0] for p in upper]
    upper_y = [p[1] for p in upper]
    lower_x = [p[0] for p in lower]
    lower_y = [p[1] for p in lower]
    
    return {
        'upper_x_coordinates': upper_x,
        'upper_y_coordinates': upper_y,
        'lower_x_coordinates': lower_x,
        'lower_y_coordinates': lower_y,
    }


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


def sanitize_array(arr: Any) -> List[Any]:
    """
    Sanitize an array of values for JSON serialization.
    """
    if arr is None:
        return []
    try:
        if isinstance(arr, np.ndarray):
            arr = arr.tolist()
        return [sanitize_float(v) if isinstance(v, (int, float, np.number)) else v for v in arr]
    except (ValueError, TypeError):
        return []


def calculate_properties(x: List[float], y: List[float]) -> Dict[str, Any]:
    """
    Calculate geometric properties of an airfoil from x and y coordinate arrays.
    
    Args:
        x: Array of x-coordinates (chord-normalized, typically 0 to 1)
        y: Array of y-coordinates (chord-normalized)
    
    Returns:
        Dictionary containing geometric properties:
        - max_thickness: Maximum thickness as fraction of chord
        - max_thickness_location: x/c location of maximum thickness
        - max_camber: Maximum camber as fraction of chord
        - max_camber_location: x/c location of maximum camber
        - thickness_distribution: Array of local thickness values
        - camber_distribution: Array of local camber values
        - le_radius: Leading edge radius
        - te_thickness: Trailing edge thickness
        - te_angle: Trailing edge angle in degrees
        - upper_coordinates: Upper surface coordinates (Nx2 array)
        - lower_coordinates: Lower surface coordinates (Nx2 array)
    """
    try:
        # Convert inputs to numpy arrays if they aren't already
        x = np.array(x)
        y = np.array(y)
        
        # Combine x and y into Nx2 coordinate array
        # AeroSandbox expects coordinates in standard airfoil order:
        # trailing edge upper -> leading edge -> trailing edge lower
        coordinates = np.column_stack([x, y])
        
        # Create Airfoil object from coordinates
        # Use a generic name since we don't have one
        airfoil = asb.Airfoil(name="Custom", coordinates=coordinates)
        
        # Sample points for thickness and camber distributions
        x_sample = np.linspace(0, 1, 201)
        
        # Calculate thickness and camber distributions
        thickness_dist = airfoil.local_thickness(x_sample)
        camber_dist = airfoil.local_camber(x_sample)
        
        # Calculate maximum values
        max_thickness = airfoil.max_thickness(x_sample)
        max_camber = airfoil.max_camber(x_sample)
        
        # Find locations of maximum values
        max_thickness_loc = x_sample[np.argmax(thickness_dist)]
        max_camber_loc = x_sample[np.argmax(camber_dist)]
        
        # Get upper and lower surface coordinates
        upper_coordinates = airfoil.upper_coordinates()
        lower_coordinates = airfoil.lower_coordinates()
        
        # Calculate additional properties
        le_radius = airfoil.LE_radius()
        te_thickness = airfoil.TE_thickness()
        te_angle = airfoil.TE_angle()
        
        return {
            "max_thickness": sanitize_float(max_thickness),
            "max_thickness_location": sanitize_float(max_thickness_loc),
            "max_camber": sanitize_float(max_camber),
            "max_camber_location": sanitize_float(max_camber_loc),
            "thickness_distribution": sanitize_array(thickness_dist),
            "camber_distribution": sanitize_array(camber_dist),
            "le_radius": sanitize_float(le_radius),
            "te_thickness": sanitize_float(te_thickness),
            "te_angle": sanitize_float(te_angle),
            "upper_coordinates": sanitize_array(upper_coordinates) if isinstance(upper_coordinates, np.ndarray) else [],
            "lower_coordinates": sanitize_array(lower_coordinates) if isinstance(lower_coordinates, np.ndarray) else [],
        }
    except Exception as e:
        # If calculation fails, return None for all properties
        print(f"Error calculating airfoil properties: {e}")
        return {
            "max_thickness": None,
            "max_thickness_location": None,
            "max_camber": None,
            "max_camber_location": None,
            "thickness_distribution": [],
            "camber_distribution": [],
            "le_radius": None,
            "te_thickness": None,
            "te_angle": None,
            "upper_coordinates": [],
            "lower_coordinates": [],
        }

