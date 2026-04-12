"""
config/logging_config.py
Structured JSON logging setup for agent observability (Ch.18, Ch.19).
"""
import logging
import sys


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)-8s | %(name)-40s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        stream=sys.stdout,
    )
    # Quieten noisy libraries
    for lib in ("httpx", "httpcore", "azure", "urllib3"):
        logging.getLogger(lib).setLevel(logging.WARNING)
