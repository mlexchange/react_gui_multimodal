"""
Shared Q-space computation utilities.

This module provides the core Q-matrix computation logic used by both
the q_vectors API endpoint and the linecut extraction utilities.
"""

from typing import Tuple

import numpy as np
from pyFAI.integrator.azimuthal import AzimuthalIntegrator


def compute_q_matrices(
    image_shape: Tuple[int, int],
    calibration: dict,
    invert_qy: bool = True,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Compute Q-value matrices for an image using pyFAI.

    Args:
        image_shape: (height, width) of the image
        calibration: Dictionary with calibration parameters:
            - sample_detector_distance: Distance in mm
            - beam_center_x, beam_center_y: Beam center in pixels
            - pixel_size_x, pixel_size_y: Pixel size in micrometers
            - wavelength: X-ray wavelength in Angstroms
            - tilt, tilt_plan_rotation: Tilt parameters in degrees
            - experiment_type: "SAXS" or "GISAXS"
            - incident_angle: For GISAXS, in degrees
        negate_qy_saxs: Whether to negate q_y in SAXS mode to match
            image display convention (default True)

    Returns:
        (q_x_matrix, q_y_matrix) as 2D numpy arrays
    """
    experiment_type = calibration.get("experiment_type", "SAXS")
    image_height, image_width = image_shape

    if experiment_type == "GISAXS":
        # Direct GISAXS calculation
        # Reference: DESY P03 beamline + pyFAI units.py
        wavelength_nm = calibration["wavelength"] / 10.0  # Angstroms to nm
        det_dist_m = calibration["sample_detector_distance"] / 1000.0  # mm to m
        pixel_size_x_m = calibration["pixel_size_x"] / 1e6  # micrometers to m
        pixel_size_y_m = calibration["pixel_size_y"] / 1e6
        alpha_i = np.radians(calibration.get("incident_angle", 0.16))

        # Wavevector magnitude k = 2*pi/lambda
        k = 2 * np.pi / wavelength_nm

        # Pixel grid relative to beam center (in meters)
        x = (np.arange(image_width) - calibration["beam_center_x"]) * pixel_size_x_m
        y = (calibration["beam_center_y"] - np.arange(image_height)) * pixel_size_y_m
        X, Y = np.meshgrid(x, y)

        # Scattering angles
        alpha_f = np.arctan2(Y, det_dist_m)  # Exit angle (vertical)
        psi = np.arctan2(X, det_dist_m)  # Azimuthal angle (horizontal)

        # Q-vector components (elastic scattering: |k_i| = |k_f| = k)
        # k_i = k * (cos(alpha_i), 0, -sin(alpha_i))  incident beam
        # k_f = k * (cos(alpha_f)*cos(psi), cos(alpha_f)*sin(psi), sin(alpha_f))
        # Q = k_f - k_i
        q_x_comp = k * (np.cos(alpha_f) * np.cos(psi) - np.cos(alpha_i))
        q_y_comp = k * np.cos(alpha_f) * np.sin(psi)
        q_z_comp = k * (np.sin(alpha_f) + np.sin(alpha_i))

        # qip (in-plane) and qoop (out-of-plane)
        # qip = sqrt(qx² + qy²) with sign from qy (lateral direction)
        # qoop = qz (vertical direction)
        q_x = np.sqrt(q_x_comp**2 + q_y_comp**2) * np.sign(q_y_comp)
        q_y = q_z_comp
    else:
        # SAXS uses pyFAI AzimuthalIntegrator for standard qx/qy coordinates
        ai = AzimuthalIntegrator()
        ai.setFit2D(
            directDist=calibration["sample_detector_distance"],
            centerX=calibration["beam_center_x"],
            centerY=calibration["beam_center_y"],
            tilt=calibration.get("tilt", 0.0),
            tiltPlanRotation=calibration.get("tilt_plan_rotation", 0.0),
            pixelX=calibration["pixel_size_x"],
            pixelY=calibration["pixel_size_y"],
            wavelength=calibration["wavelength"],
        )
        q_x = ai.array_from_unit(shape=image_shape, unit="qx_nm^-1")
        q_y = ai.array_from_unit(shape=image_shape, unit="qy_nm^-1")

        if invert_qy:
            # Negate qy to match image display convention:
            # pyFAI's qy follows image coords (y increases downward)
            q_y = -q_y

    return q_x, q_y
