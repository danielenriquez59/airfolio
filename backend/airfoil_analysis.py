"""
AeroSandbox-based airfoil analysis function.
Performs aerodynamics analysis using NeuralFoil.
"""
import aerosandbox as asb
import numpy as np
from typing import List, Dict, Any, Tuple


def analyze_airfoil(
    upper_x_coords: List[float],
    upper_y_coords: List[float],
    lower_x_coords: List[float],
    lower_y_coords: List[float],
    reynolds_number: float,
    mach_number: float = 0.0,
    alpha_range: List[float] = None,  # [start, end, step]
    n_crit: float = 9.0,
    airfoil_name: str = "Airfoil",
    model_size: str = "xsmall"
) -> Dict[str, Any]:
    """
    Analyze an airfoil using AeroSandbox NeuralFoil.
    
    Args:
        upper_x_coords: Upper surface X coordinates (TE to LE, descending)
        upper_y_coords: Upper surface Y coordinates (corresponding to upper_x)
        lower_x_coords: Lower surface X coordinates (LE to TE, ascending)
        lower_y_coords: Lower surface Y coordinates (corresponding to lower_x)
        reynolds_number: Reynolds number for analysis
        mach_number: Mach number (default: 0.0)
        alpha_range: List [start, end, step] for angle of attack range in degrees
        n_crit: Critical N-factor (default: 9.0)
        airfoil_name: Name of the airfoil (default: "Airfoil")
        model_size: NeuralFoil model size - "xsmall", "small", "medium", "large" (default: "xsmall")
    
    Returns:
        Dictionary containing analysis results:
        {
            'CL': [...],  # Lift coefficients
            'CD': [...],  # Drag coefficients
            'CM': [...],  # Moment coefficients
            'alpha': [...],  # Angle of attack values
            'Cpmin': [...],  # Minimum pressure coefficients
            'Top_Xtr': [...],  # Upper surface transition locations
            'Bot_Xtr': [...],  # Lower surface transition locations
            'top_xtr': [...],  # Alternative naming
            'bot_xtr': [...],  # Alternative naming
            ... (other NeuralFoil outputs)
        }
    
    Raises:
        ValueError: If inputs are invalid or analysis fails
    """
    try:
        # Validate inputs
        if len(upper_x_coords) != len(upper_y_coords):
            raise ValueError("Upper X and Y coordinate arrays must have the same length")
        if len(lower_x_coords) != len(lower_y_coords):
            raise ValueError("Lower X and Y coordinate arrays must have the same length")
        if len(upper_x_coords) < 2 or len(lower_x_coords) < 2:
            raise ValueError("Need at least 2 points for upper and lower surfaces")
        
        # Convert lists to numpy arrays
        upper_x = np.array(upper_x_coords)
        upper_y = np.array(upper_y_coords)
        lower_x = np.array(lower_x_coords)
        lower_y = np.array(lower_y_coords)
        # Ensure upper surface is sorted descending (TE -> LE)
        # If first point has smaller X than last, reverse it
        if upper_x[0] < upper_x[-1]:
            upper_x = upper_x[::-1]
            upper_y = upper_y[::-1]
        
        # Ensure lower surface is sorted ascending (LE -> TE)
        # If first point has larger X than last, reverse it
        if lower_x[0] > lower_x[-1]:
            lower_x = lower_x[::-1]
            lower_y = lower_y[::-1]
        
        # Combine coordinates: upper TE -> LE -> lower LE -> TE
        # Upper surface (without trailing edge duplicate)
        upper_coords = np.column_stack([upper_x, upper_y])
        
        # Lower surface (including leading edge)
        lower_coords = np.column_stack([lower_x, lower_y])
        
        # Check if leading edge point is duplicated
        # Leading edge is typically at x=0 or the point with minimum x
        le_upper = upper_coords[-1]  # Last point of upper (should be LE)
        le_lower = lower_coords[0]    # First point of lower (should be LE)
        
        # If leading edge points are very close (within tolerance), remove duplicate
        tolerance = 1e-6
        if np.linalg.norm(le_upper - le_lower) < tolerance:
            # Remove duplicate LE from upper surface
            coordinates = np.vstack([
                upper_coords[:-1],  # Upper surface without LE
                lower_coords        # Lower surface including LE
            ])
        else:
            # Combine both surfaces
            coordinates = np.vstack([
                upper_coords,
                lower_coords
            ])
        
        # # Ensure trailing edge is closed (points should be close)
        # te_upper = coordinates[0]
        # te_lower = coordinates[-1]
        # if np.linalg.norm(te_upper - te_lower) > tolerance:
        #     # Add trailing edge closure point
        #     te_point = (te_upper + te_lower) / 2
        #     coordinates = np.vstack([coordinates, te_point])
        
        # Create Airfoil object
        airfoil = asb.Airfoil(
            name=airfoil_name,
            coordinates=coordinates
        )
        
        # Generate alpha schedule from range
        if alpha_range is None:
            raise ValueError("alpha_range is required")
        
        # Generate actual alpha values from range [start, end, step]
        start, end, step = alpha_range
        alpha_values = np.arange(start, end + step, step)
        
        # Run NeuralFoil analysis
        aero = airfoil.get_aero_from_neuralfoil(
            alpha=alpha_values,
            Re=reynolds_number,
            mach=mach_number,
            n_crit=n_crit,
            model_size=model_size
        )
   
        smoothness_CM = smoothness_measure(alpha_values, aero['CM'])
        avg_confidence = np.mean(aero['analysis_confidence'])
        
        # Convert results to lists for JSON serialization
        results = {
            'alpha': alpha_values.tolist(),
            'CL': aero['CL'].tolist(),
            'CD': aero['CD'].tolist(),
            'CM': aero['CM'].tolist(),
            'avg_confidence': float(avg_confidence),
            'smoothness_CM': float(smoothness_CM),
        }
        
        # Add optional fields if present
        if 'Cpmin' in aero:
            results['Cpmin'] = aero['Cpmin'].tolist()
        
        if 'Top_Xtr' in aero:
            results['Top_Xtr'] = aero['Top_Xtr'].tolist()
        
        if 'Bot_Xtr' in aero:
            results['Bot_Xtr'] = aero['Bot_Xtr'].tolist()
        
        return results
    
    except Exception as e:
        raise ValueError(f"Airfoil analysis failed: {str(e)}") from e

def smoothness_measure(x, y):
    slopes = np.diff(y) / np.diff(x)
    second_derivatives = np.diff(slopes) 
    return float(np.sum(np.abs(second_derivatives)))
