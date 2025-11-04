import os
import urllib.parse as urlparse

from dotenv import load_dotenv
from src.preprocess_image import get_processed_image
from tiled.client import from_uri

load_dotenv("../.env")
TILED_URL = os.getenv("SCATTERING_TILED_URL")
TILED_API_KEY = os.getenv("SCATTERING_TILED_API_KEY")


def fetch_image_uri_by_index(index, files_uris, accumulated_data, initialization_mode):
    if initialization_mode or not accumulated_data["image_names"]:
        return files_uris[index]
    else:
        # Step 1: Retrieve the image name from accumulated_data["image_names"]
        try:
            image_name = accumulated_data["image_names"][index]
        except IndexError:
            print("Invalid index: No image exists at this position.")
            return None

        # Step 2: Find the image URI in files_uris
        try:
            # Locate the position of image_name in files_uris
            # image_uri = next(uri for uri in files_uris if image_name in uri)
            for uri in files_uris:
                if image_name == uri:
                    image_uri = image_name
                    break
        except StopIteration:
            print(f"Image name '{image_name}' not found in files_uris.")
            return None

        # Step 3: Return or fetch the URI as needed
        return image_uri


def get_images_arrays_and_names(
    files_uris,
    images_indices,
    mask_detector,
    tiled_uri,
    accumulated_data,
    initialization_mode=False,
):

    image_arrays = []
    image_names = []

    try:
        all_images_uris = []
        for index in images_indices:
            all_images_uris.append(fetch_image_uri_by_index(index, files_uris, accumulated_data, initialization_mode))
    except Exception as e:
        print(f"Error fetching image URIs: {str(e)}")
        return image_arrays, image_names

    # Load images from the tiled server
    for i in range(len(all_images_uris)):

        image_uri = all_images_uris[i]
        tiled_uri = tiled_uri if tiled_uri.endswith("/") else tiled_uri + "/"
        file_uri = urlparse.urljoin(tiled_uri, image_uri)

        image_client = from_uri(file_uri, api_key=TILED_API_KEY)
        image_array = image_client.read()  # Retrieve the NumPy array

        processed_image = get_processed_image(
            image_array,
            mask_detector,
        )

        image_arrays.append(processed_image)
        image_names.append(image_uri)

    return image_arrays, image_names
