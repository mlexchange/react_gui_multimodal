import urllib.parse as urlparse

from src.get_preprocess_image import get_processed_image
from src.tiled_client import get_tiled_client_for_uri


def get_single_image_array_and_name(image_uri, mask_detector, tiled_uri):
    """Process a single image and return its array and name."""
    tiled_uri = tiled_uri if tiled_uri.endswith("/") else tiled_uri + "/"
    file_uri = urlparse.urljoin(tiled_uri, image_uri)

    image_client = get_tiled_client_for_uri(file_uri)
    image_array = image_client.read()

    processed_image = get_processed_image(image_array, mask_detector)

    return processed_image, image_uri
