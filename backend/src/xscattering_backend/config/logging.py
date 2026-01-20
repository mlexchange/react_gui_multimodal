"""
Centralized logging configuration.

Provides consistent logging setup across all backend modules.
"""

import logging
import os
import sys


def setup_logging() -> None:
    """
    Configure the root logger for the application.

    Log level can be set via SCATTERING_BACKEND_LOG_LEVEL environment variable.
    Valid levels: DEBUG, INFO, WARNING, ERROR, CRITICAL.
    Default: INFO.
    """
    log_level = os.getenv("SCATTERING_BACKEND_LOG_LEVEL", "INFO").upper()

    # Validate log level
    valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
    if log_level not in valid_levels:
        log_level = "INFO"

    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, log_level),
        format="[%(levelname)s] %(name)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    # Reduce noise from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with the given name.

    Args:
        name: Logger name, typically __name__ from the calling module.

    Returns:
        Configured logger instance.
    """
    return logging.getLogger(name)
