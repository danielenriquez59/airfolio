"""
Bezier curve fitting module for airfoil parameterization.

Uses linear least-squares fitting (Rajnarayan et al. 2018, Section IV.B):
control-point x positions are fixed via the x=u^2 blossom formula, data
points are assigned u=sqrt(x), and only free control-point y values are
solved in a single np.linalg.lstsq call.
"""
import numpy as np
from scipy.spatial import KDTree
from scipy.special import comb
from typing import Tuple, Dict, Any, List


class BezierFitter:
    """
    Fits Bezier curves to airfoil coordinate data via linear least-squares.

    Takes upper and lower surface coordinates and fits separate
    Bezier curves to each surface with fixed x parametrization (x=u^2).
    """

    def __init__(self, order: int = 6, smoothing: float = 1e-4):
        """
        Initialize the fitter.

        Args:
            order: Degree of the Bezier curve (n). Control points = n + 1.
            smoothing: Weight on 2nd-difference penalty for control-point y values.
        """
        self.order = order
        self.num_cp = order + 1
        self.smoothing = smoothing

    def _bernstein_poly(self, n: int, i: int, t: np.ndarray) -> np.ndarray:
        """Calculate Bernstein basis polynomial B_{n,i}(t) = C(n,i) t^i (1-t)^(n-i)."""
        return comb(n, i) * (t ** i) * ((1 - t) ** (n - i))

    def _bernstein_all(self, n: int, t: float) -> np.ndarray:
        """Return all n+1 Bernstein basis values at scalar t."""
        vals = np.zeros(n + 1)
        for i in range(n + 1):
            vals[i] = comb(n, i) * (t ** i) * ((1 - t) ** (n - i))
        return vals

    def _blossom_x_positions(self, degree: int, num_cp: int) -> np.ndarray:
        """
        Compute normalized control-point x positions for x(u) = u^2.

        Uses the blossom of f(t)=t^2 on knot vector [0]*(n+1) + [1]*(n+1).
        """
        n = degree
        full_knots = [0.0] * (n + 1) + [1.0] * (n + 1)
        xs = np.zeros(num_cp)
        num_pairs = n * (n - 1) / 2

        for i in range(num_cp):
            knot_args = full_knots[i + 1: i + 1 + n]
            total = 0.0
            for a in range(n):
                for b in range(a + 1, n):
                    total += knot_args[a] * knot_args[b]
            xs[i] = total / num_pairs if num_pairs > 0 else 0.0

        return xs

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

    def _max_error_pct(
        self,
        data: np.ndarray,
        ctrl_pts: np.ndarray,
        chord: float
    ) -> float:
        """
        Maximum distance from any data point to the fitted curve,
        expressed as a percentage of chord length.
        """
        if chord < 1e-12:
            return 0.0

        curve = self.generate_curve(ctrl_pts, num_points=500)
        tree = KDTree(curve)
        dists, _ = tree.query(data)
        return float(dists.max()) / chord * 100.0

    def _fit_surface(
        self,
        surface_data: np.ndarray,
        chord: float,
        is_upper: bool
    ) -> Tuple[np.ndarray, float]:
        """
        Fit a Bezier curve to one surface using linear least-squares.

        Args:
            surface_data: Nx2 array of (x, y) coordinates
            chord: Chord length for x normalization and control-point scaling
            is_upper: Unused; kept for API compatibility with fit()

        Returns:
            Tuple of (control_points, max_error_pct)
        """
        n = self.order
        num_cp = self.num_cp

        x_raw = surface_data[:, 0]
        y_raw = surface_data[:, 1]
        x_norm = np.clip(x_raw / chord, 0.0, 1.0)

        u = np.sqrt(x_norm)
        m = len(u)

        ctrl_x = self._blossom_x_positions(n, num_cp) * chord

        known_y = {0: 0.0, n: 0.0}
        free_idx = [k for k in range(num_cp) if k not in known_y]
        n_free = len(free_idx)
        col = {k: j for j, k in enumerate(free_idx)}

        A_data = np.zeros((m, n_free))
        b_data = y_raw.copy()

        for i in range(m):
            basis = self._bernstein_all(n, u[i])
            for k, yv in known_y.items():
                b_data[i] -= basis[k] * yv
            for k in free_idx:
                A_data[i, col[k]] = basis[k]

        n_smooth = n_free - 2
        if n_smooth > 0 and self.smoothing > 0:
            A_smooth = np.zeros((n_smooth, n_free))
            b_smooth = np.zeros(n_smooth)
            w = self.smoothing
            for s in range(n_smooth):
                for offset, coef in enumerate([w, -2 * w, w]):
                    k = free_idx[s + offset]
                    if k in col:
                        A_smooth[s, col[k]] += coef
                    elif k in known_y:
                        b_smooth[s] -= coef * known_y[k]
            A = np.vstack([A_data, A_smooth])
            b = np.concatenate([b_data, b_smooth])
        else:
            A, b = A_data, b_data

        sol, _, _, _ = np.linalg.lstsq(A, b, rcond=None)

        ctrl_y = np.zeros(num_cp)
        for k, yv in known_y.items():
            ctrl_y[k] = yv
        for k in free_idx:
            ctrl_y[k] = sol[col[k]]

        ctrl_pts = np.column_stack([ctrl_x, ctrl_y])
        max_error_pct = self._max_error_pct(surface_data, ctrl_pts, chord)

        return ctrl_pts, max_error_pct

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
            - upper_max_error_pct: float
            - lower_max_error_pct: float
            - order: int
        """
        upper_coords = np.column_stack([upper_x, upper_y])
        lower_coords = np.column_stack([lower_x, lower_y])

        chord = max(np.max(upper_coords[:, 0]), np.max(lower_coords[:, 0]))
        if chord < 1e-12:
            chord = 1.0

        if upper_coords[0, 0] > upper_coords[-1, 0]:
            upper_coords = upper_coords[::-1]

        if lower_coords[0, 0] > lower_coords[-1, 0]:
            lower_coords = lower_coords[::-1]

        upper_cps, upper_max_error_pct = self._fit_surface(
            upper_coords, chord, is_upper=True
        )
        lower_cps, lower_max_error_pct = self._fit_surface(
            lower_coords, chord, is_upper=False
        )

        upper_curve = self.generate_curve(upper_cps, num_points=200)
        lower_curve = self.generate_curve(lower_cps, num_points=200)

        return {
            'upper_control_points': upper_cps,
            'lower_control_points': lower_cps,
            'upper_curve': upper_curve,
            'lower_curve': lower_curve,
            'upper_max_error_pct': float(upper_max_error_pct),
            'lower_max_error_pct': float(lower_max_error_pct),
            'order': self.order,
        }
