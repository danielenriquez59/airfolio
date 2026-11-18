"""
AeroSandbox-based airfoil analysis function.
Performs aerodynamics analysis using NeuralFoil.
"""
import aerosandbox as asb
import numpy as np
from typing import List, Dict, Any

from utils import orient_airfoil_surfaces


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
    model_size: str = "xlarge"
) -> Dict[str, Any]:
    """
    Run NeuralFoil on an airfoil given as upper/lower surface arrays (either direction).
    alpha_range is [start, end, step] in degrees, end included.
    Returns alpha, CL, CD, CM lists, avg_confidence, smoothness_CM and, when present, Cpmin, Top_Xtr, Bot_Xtr.
    Raises ValueError if the inputs are invalid or the analysis fails.
    """
    try:
        # Validate inputs
        if len(upper_x_coords) != len(upper_y_coords):
            raise ValueError("Upper X and Y coordinate arrays must have the same length")
        if len(lower_x_coords) != len(lower_y_coords):
            raise ValueError("Lower X and Y coordinate arrays must have the same length")
        if len(upper_x_coords) < 2 or len(lower_x_coords) < 2:
            raise ValueError("Need at least 2 points for upper and lower surfaces")

        # Upper TE -> LE, lower LE -> TE
        upper, lower = orient_airfoil_surfaces(
            list(zip(upper_x_coords, upper_y_coords)), list(zip(lower_x_coords, lower_y_coords))
        )
        upper_coords = np.array(upper)
        lower_coords = np.array(lower)

        # Drop the upper copy of a leading-edge point both surfaces share
        if np.linalg.norm(upper_coords[-1] - lower_coords[0]) < 1e-6:
            upper_coords = upper_coords[:-1]
        coordinates = np.vstack([upper_coords, lower_coords])

        airfoil = asb.Airfoil(
            name=airfoil_name,
            coordinates=coordinates
        )

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
