"""
Centralized logging configuration.

Provides consistent logging setup across all backend modules.
Log level is controlled by the SCATTERING_BACKEND_LOG_LEVEL environment variable.
"""

import logging
import os


def _get_log_level() -> str:
    level = os.getenv("SCATTERING_BACKEND_LOG_LEVEL", "INFO").upper()
    valid = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
    return level if level in valid else "INFO"


def get_log_config() -> dict:
    """Build a logging dict config for uvicorn.run(log_config=...).

    Uses Uvicorn's DefaultFormatter for both Uvicorn and application
    loggers, and Uvicorn's AccessFormatter for access logs.
    """
    level = _get_log_level()

    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "uvicorn": {
                "()": "uvicorn.logging.DefaultFormatter",
                "fmt": "%(levelprefix)s %(message)s",
            },
            "access": {
                "()": "uvicorn.logging.AccessFormatter",
                "fmt": '%(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s',
            },
            "app": {
                "()": "uvicorn.logging.DefaultFormatter",
                "fmt": "%(levelprefix)s %(name)s: %(message)s",
            },
        },
        "handlers": {
            "uvicorn": {
                "formatter": "uvicorn",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stderr",
            },
            "access": {
                "formatter": "access",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
            "app": {
                "formatter": "app",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stderr",
            },
        },
        "loggers": {
            "uvicorn": {"handlers": ["uvicorn"], "level": level, "propagate": False},
            "uvicorn.error": {"level": level},
            "uvicorn.access": {"handlers": ["access"], "level": level, "propagate": False},
            "httpx": {"level": "WARNING"},
            "httpcore": {"level": "WARNING"},
        },
        "root": {"handlers": ["app"], "level": level},
    }


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the given name (typically __name__)."""
    return logging.getLogger(name)
