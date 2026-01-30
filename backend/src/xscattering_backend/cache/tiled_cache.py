"""
Centralized Tiled client module.

Provides cached connections to the Tiled server that can be reused
across all routes, avoiding repeated client initialization.
"""

from functools import lru_cache
from urllib.parse import urlparse

from dotenv import load_dotenv
from tiled.client import from_uri
from tiled.client.container import Container
from xscattering_backend.config.logging import get_logger
from xscattering_backend.config.settings import get_config

logger = get_logger(__name__)

# Load .env file (auto-discovers from current and parent directories)
load_dotenv()


@lru_cache(maxsize=1)
def get_tiled_client():
    """Get cached tiled client instance for the base server."""
    config = get_config()
    return from_uri(config["tiled_url"], api_key=config["tiled_api_key"])


def get_tiled_client_for_uri(uri: str):
    """
    Get cached tiled client for a specific URI (e.g., image URIs).
    """
    config = get_config()
    return _get_tiled_client_for_uri_cached(uri, config["tiled_api_key"])


@lru_cache(maxsize=4)
def _get_tiled_client_for_uri_cached(uri: str, api_key: str):
    """Internal cached function for URI-specific clients."""
    return from_uri(uri, api_key=api_key)


def get_tiled_base_uri() -> str:
    """Get the base URI from the tiled client."""
    return get_tiled_client().uri


@lru_cache(maxsize=1)
def is_tiled_results_enabled() -> bool:
    """Check if saving results to Tiled is configured and available.

    On first call, ensures the results container exists (creating it if
    needed). The result is cached for all subsequent calls.
    """
    config = get_config()
    results_url = config.get("tiled_results_url")
    if not results_url:
        return False

    base_uri, container_names = _split_uri_at_metadata(results_url)
    if not container_names:
        return True

    results_api_key = config.get("tiled_results_api_key")
    try:
        _create_or_navigate_containers(base_uri, container_names, results_api_key)
        logger.info("Tiled results container ready: %s", "/".join(container_names))
        return True
    except Exception as e:
        logger.warning("Failed to ensure Tiled results container: %s", e)
        logger.warning("Saving results to Tiled will be disabled")
        return False


@lru_cache(maxsize=1)
def get_tiled_results_client() -> Container | None:
    """Get cached tiled client for the results container. Returns None if not configured."""
    config = get_config()
    results_url = config.get("tiled_results_url")
    if not results_url:
        return None
    results_api_key = config.get("tiled_results_api_key")
    base_uri, container_names = _split_uri_at_metadata(results_url)
    if not container_names:
        # URL has no container path — use as-is (e.g. bare API URL)
        client = from_uri(results_url, api_key=results_api_key)
        if not isinstance(client, Container):
            raise ValueError(f"Results URL does not point to a Container: {results_url}")
        return client
    return _navigate_to_container(base_uri, container_names, results_api_key)


@lru_cache(maxsize=1)
def is_tiled_calibration_enabled() -> bool:
    """Check if the calibration Tiled server is configured and reachable.

    Returns True if the calibration URL is set and the server can be contacted.
    The result is cached for all subsequent calls.
    """
    config = get_config()
    calibration_url = config.get("tiled_calibration_url")
    if not calibration_url:
        return False

    calibration_api_key = config.get("tiled_calibration_api_key")
    try:
        from_uri(calibration_url, api_key=calibration_api_key)
        logger.info("Tiled calibration server reachable: %s", calibration_url)
        return True
    except Exception as e:
        logger.warning("Failed to reach Tiled calibration server: %s", e)
        logger.warning("Loading calibrations from Tiled will be disabled")
        return False


@lru_cache(maxsize=1)
def get_tiled_calibration_client():
    """Get cached tiled client instance for the calibration server.

    Returns None if not configured.
    """
    config = get_config()
    calibration_url = config.get("tiled_calibration_url")
    if not calibration_url:
        return None
    calibration_api_key = config.get("tiled_calibration_api_key")
    return from_uri(calibration_url, api_key=calibration_api_key)


def get_tiled_calibration_base_uri() -> str | None:
    """Get the base URI from the calibration tiled client.

    Returns None if calibration server is not configured.
    """
    client = get_tiled_calibration_client()
    if client is not None:
        return client.uri
    return None


def get_tiled_calibration_client_for_uri(uri: str):
    """
    Get cached tiled client for a specific URI on the calibration server.

    Uses the calibration Tiled API key. Returns None if the calibration
    server is not configured.
    """
    config = get_config()
    calibration_api_key = config.get("tiled_calibration_api_key")
    if calibration_api_key is None:
        return None
    return _get_tiled_client_for_uri_cached(uri, calibration_api_key)


def _split_uri_at_metadata(uri: str) -> tuple[str, list[str]]:
    """
    Split a Tiled URI into the base URI (up to and including ``metadata``)
    and the list of container names after it.

    For example::

        "http://host:8888/api/v1/metadata/data/saved_results"
        → ("http://host:8888/api/v1/metadata", ["data", "saved_results"])

    URLs must include ``metadata`` in the path for container navigation.

    If ``metadata`` is not found, returns ``(uri, [])``.
    """
    parsed = urlparse(uri)
    segments = parsed.path.strip("/").split("/")

    for i, seg in enumerate(segments):
        if seg == "metadata":
            base_path = "/".join(segments[: i + 1])
            container_names = segments[i + 1 :]
            return f"{parsed.scheme}://{parsed.netloc}/{base_path}", container_names

    # No "metadata" segment — return original URI with no containers
    return uri, []


def _navigate_to_container(base_uri: str, container_names: list[str], api_key: str) -> Container:
    """Connect to the Tiled base URI and navigate through container names."""
    client = from_uri(base_uri, api_key=api_key)
    for name in container_names:
        client = client[name]
    if not isinstance(client, Container):
        raise ValueError(f"Path does not resolve to a Container: {'/'.join(container_names)}")
    return client


def _create_or_navigate_containers(base_uri: str, container_names: list[str], api_key: str) -> Container:
    """
    Connect to the Tiled base URI and create/navigate containers.

    Iterates through container names, creating any that don't exist.
    """
    client = from_uri(base_uri, api_key=api_key)
    for name in container_names:
        if name in client:
            client = client[name]
        else:
            client = client.create_container(key=name)
            logger.info("Created Tiled container '%s'", name)
    return client
