"""Camera convention shared by solve_namsan_cameras.py and build_namsan_pano.py.

One place defines which way is east and which way is up, so the solver and the
composer cannot drift apart. Bearings are degrees clockwise from true north,
pitch is up (+), roll tilts the horizon clockwise as seen by the viewer (+).
World frame is local ENU (x east, y north, z up). Image frame is x right,
y down, like pixel coordinates.
"""
from __future__ import annotations

import math

import numpy as np


def cam_matrix(yaw: float, pitch: float, roll: float = 0.0) -> np.ndarray:
    """3x3 matrix whose columns are the camera's x (right), y (down) and
    z (forward) axes in ENU. Camera -> world is M @ c; world -> camera is w @ M."""
    y, p, r = map(math.radians, (yaw, pitch, roll))
    fwd = np.array([math.sin(y) * math.cos(p), math.cos(y) * math.cos(p), math.sin(p)])
    right0 = np.array([math.cos(y), -math.sin(y), 0.0])
    up0 = np.cross(right0, fwd)
    right = math.cos(r) * right0 + math.sin(r) * up0
    up = np.cross(right, fwd)
    return np.stack([right, -up, fwd], 1)


def project(dirs: np.ndarray, M: np.ndarray, f: float, cx: float, cy: float) -> np.ndarray:
    """World directions (N, 3) -> pixels (N, 2). Points behind the camera land
    far outside the image rather than raising."""
    c = np.atleast_2d(dirs) @ M
    z = np.maximum(c[:, 2], 1e-6)
    return np.stack([f * c[:, 0] / z + cx, f * c[:, 1] / z + cy], 1)


def backproject(pts: np.ndarray, M: np.ndarray, f: float, cx: float, cy: float) -> np.ndarray:
    """Pixels (N, 2) -> unit world directions (N, 3)."""
    c = np.stack([(pts[:, 0] - cx) / f, (pts[:, 1] - cy) / f, np.ones(len(pts))], 1) @ M.T
    return c / np.linalg.norm(c, axis=1, keepdims=True)
