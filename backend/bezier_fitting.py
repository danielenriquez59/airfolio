"""
Bezier curve fitting module for airfoil parameterization.
Clean API-ready implementation based on bezier_curve.py example.
"""
import numpy as np
from scipy.spatial import KDTree
from scipy.optimize import minimize
from scipy.special import comb
from typing import Tuple, Dict, Any, List


class BezierFitter:
    """
    Fits Bezier curves to airfoil coordinate data.

    Takes upper and lower surface coordinates and fits separate
    Bezier curves to each surface using optimization.
    """

    def __init__(self, order: int = 6):
        """
        Initialize the fitter.

        Args:
            order: Degree of the Bezier curve (n). Control points = n + 1.
        """
        self.order = order
        self.num_cp = order + 1

    def _bernstein_poly(self, n: int, i: int, t: np.ndarray) -> np.ndarray:
        """Calculate Bernstein basis polynomial."""
        return comb(n, i) * (t ** (n - i)) * ((1 - t) ** i)

    def generate_curve(self, control_points: np.ndarray, num_points: int = 200) -> np.ndarray:
        """
        Generate points along a Bezier curve defined by control points.

        Args:
            control_points: Nx2 array of control point coordinates
            num_points: Number of points to generate along curve

        Returns:
            num_points x 2 array of curve coordinates
        """
        t = np.linspace(0, 1, num_points)
        curve_points = np.zeros((num_points, 2))

        n = len(control_points) - 1

        for i, point in enumerate(control_points):
            b_val = self._bernstein_poly(n, i, t)
            curve_points[:, 0] += point[0] * b_val
            curve_points[:, 1] += point[1] * b_val

        return curve_points

    def _point_line_segment_distance(
        self, px: float, py: float,
        x1: float, y1: float,
        x2: float, y2: float
    ) -> float:
        """Calculate perpendicular distance from point to line segment."""
        dx = x2 - x1
        dy = y2 - y1

        if dx == 0 and dy == 0:
            return np.sqrt((px - x1) ** 2 + (py - y1) ** 2)

        t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
        t = np.clip(t, 0, 1)

        closest_x = x1 + t * dx
        closest_y = y1 + t * dy

        return np.sqrt((px - closest_x) ** 2 + (py - closest_y) ** 2)

    def _calculate_error(
        self,
        free_params: np.ndarray,
        surface_data: np.ndarray,
        fixed_le: np.ndarray,
        fixed_te: np.ndarray
    ) -> float:
        """Calculate sum of squared errors between data and fitted curve."""
        cps = self._reconstruct_cps(free_params, fixed_le, fixed_te)
        curve_points = self.generate_curve(cps, num_points=200)
        tree = KDTree(curve_points)

        total_error_sq = 0.0

        for point in surface_data:
            px, py = point
            dist_nearest, idx = tree.query(point)

            d1 = float('inf')
            d2 = float('inf')

            if idx > 0:
                p1 = curve_points[idx - 1]
                p2 = curve_points[idx]
                d1 = self._point_line_segment_distance(px, py, p1[0], p1[1], p2[0], p2[1])

            if idx < len(curve_points) - 1:
                p1 = curve_points[idx]
                p2 = curve_points[idx + 1]
                d2 = self._point_line_segment_distance(px, py, p1[0], p1[1], p2[0], p2[1])

            min_d = min(d1, d2)
            if min_d == float('inf'):
                min_d = dist_nearest

            total_error_sq += min_d ** 2

        return total_error_sq

    def _reconstruct_cps(
        self,
        params: np.ndarray,
        fixed_le: np.ndarray,
        fixed_te: np.ndarray
    ) -> np.ndarray:
        """Reconstruct control points array from optimizer parameters."""
        cps = np.zeros((self.num_cp, 2))

        # P0 (Fixed LE)
        cps[0] = fixed_le

        # Pn (Fixed TE)
        cps[-1] = fixed_te

        # P1 (Constrained: vertical movement only, x=0)
        cps[1] = [0, params[0]]

        # P2 to P(n-1) (Free movement x and y)
        num_internal = self.num_cp - 3
        if num_internal > 0:
            internal_coords = params[1:].reshape((num_internal, 2))
            cps[2:-1] = internal_coords

        return cps

    def _generate_initial_guess(
        self,
        surface_data: np.ndarray,
        chord: float,
        is_upper: bool
    ) -> np.ndarray:
        """Generate initial guess for control point parameters."""
        max_y = np.max(np.abs(surface_data[:, 1]))
        if not is_upper:
            max_y = -max_y

        num_free_params = 1 + (self.num_cp - 3) * 2
        params = np.zeros(num_free_params)

        # Initial P1 y-guess
        params[0] = max_y * 0.5

        # Set internal points (P2...Pn-1)
        idx_param = 1
        for i in range(2, self.num_cp - 1):
            params[idx_param] = (i * chord) / self.order  # x
            params[idx_param + 1] = max_y  # y
            idx_param += 2

        return params

    def _fit_surface(
        self,
        surface_data: np.ndarray,
        chord: float,
        is_upper: bool
    ) -> Tuple[np.ndarray, float]:
        """
        Fit Bezier curve to a single surface.

        Returns:
            Tuple of (control_points, final_sse_error)
        """
        fixed_le = np.array([0.0, 0.0])
        fixed_te = np.array([chord, 0.0])

        x0 = self._generate_initial_guess(surface_data, chord, is_upper)

        result = minimize(
            self._calculate_error,
            x0,
            args=(surface_data, fixed_le, fixed_te),
            method='SLSQP',
            tol=1e-6,
            options={'maxiter': 500}
        )

        final_cps = self._reconstruct_cps(result.x, fixed_le, fixed_te)
        final_error = result.fun

        return final_cps, final_error

    def fit(
        self,
        upper_x: List[float],
        upper_y: List[float],
        lower_x: List[float],
        lower_y: List[float]
    ) -> Dict[str, Any]:
        """
        Fit Bezier curves to airfoil upper and lower surfaces.

        Args:
            upper_x: Upper surface X coordinates
            upper_y: Upper surface Y coordinates
            lower_x: Lower surface X coordinates
            lower_y: Lower surface Y coordinates

        Returns:
            Dictionary containing:
            - upper_control_points: Nx2 array
            - lower_control_points: Nx2 array
            - upper_curve: Mx2 array of fitted curve points
            - lower_curve: Mx2 array of fitted curve points
            - upper_sse: float
            - lower_sse: float
            - order: int
        """
        # Convert to numpy arrays
        upper_coords = np.column_stack([upper_x, upper_y])
        lower_coords = np.column_stack([lower_x, lower_y])

        # Determine chord length
        chord = max(np.max(upper_coords[:, 0]), np.max(lower_coords[:, 0]))

        # Ensure upper surface is sorted LE -> TE (ascending X)
        if upper_coords[0, 0] > upper_coords[-1, 0]:
            upper_coords = upper_coords[::-1]

        # Ensure lower surface is sorted LE -> TE (ascending X)
        if lower_coords[0, 0] > lower_coords[-1, 0]:
            lower_coords = lower_coords[::-1]

        # Fit both surfaces
        upper_cps, upper_sse = self._fit_surface(upper_coords, chord, is_upper=True)
        lower_cps, lower_sse = self._fit_surface(lower_coords, chord, is_upper=False)

        # Generate fitted curves for visualization
        upper_curve = self.generate_curve(upper_cps, num_points=200)
        lower_curve = self.generate_curve(lower_cps, num_points=200)

        return {
            'upper_control_points': upper_cps,
            'lower_control_points': lower_cps,
            'upper_curve': upper_curve,
            'lower_curve': lower_curve,
            'upper_sse': float(upper_sse),
            'lower_sse': float(lower_sse),
            'order': self.order,
        }
