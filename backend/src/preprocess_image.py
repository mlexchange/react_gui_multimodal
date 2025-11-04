import numpy as np


def get_processed_image(image, mask_detector):
    """Process the image using the detector mask.
    Original mask_detector has: 1 = masked area (beam stop etc), 0 = unmasked area
    We invert it so that: 0 = masked area, 1 = unmasked area
    """
    # Convert image to float32 first
    processed_image = image.copy().astype(np.float32)

    if mask_detector is None:
        return processed_image

    # Invert the mask first (1 - mask)
    inverted_mask = 1 - mask_detector

    # Create combined mask (True where we want to mask)
    mask_neg = np.array(processed_image < 0.0)
    mask_nan = np.isnan(processed_image)
    mask = (
        mask_nan | mask_neg | (inverted_mask == 0)
    )  # Now looking for nans, negatives, and zeros in inverted mask

    # Apply mask by setting masked values to NaN
    processed_image[mask] = np.nan  # 0

    return processed_image
