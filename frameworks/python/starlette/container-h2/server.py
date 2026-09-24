"""RequestBench framework: Starlette, served by Hypercorn with two worker processes, over HTTP/2
with prior knowledge.

uvicorn, which serves it on container-h1, speaks only HTTP/1.1. Starlette's documentation names
uvicorn and points to the ASGI specification's list of servers, which lists Hypercorn. This process
binds the socket and starts the workers, and each worker imports main, loads the payloads and
accepts from that socket. A connection that opens with the HTTP/2 preface is answered in HTTP/2.
"""
import os
from importlib.metadata import version
from pathlib import Path

from hypercorn.config import Config
from hypercorn.run import run

# Written as a number, not read from the machine: under a CPU quota Python counts every core the
# host has, not the two the quota allows.
WORKERS = 2
# What /__meta names as the adapter. contract.py imports it with WORKERS.
ADAPTER = f"Hypercorn {version('hypercorn')}"

# The application, which each worker imports by its path.
IMPLEMENTATION = Path(__file__).resolve().parent.parent / "Implementation"

if __name__ == "__main__":
    if "RB_PAYLOADS" not in os.environ:
        raise SystemExit("RB_PAYLOADS has to name the payload directory")
    config = Config()
    config.bind = [f"0.0.0.0:{os.environ.get('PORT', '8080')}"]
    config.workers = WORKERS
    # uvloop, the event loop uvicorn runs container-h1's workers on.
    config.worker_class = "uvloop"
    # No access log, as on container-h1. No other framework in the corpus logs a request.
    config.accesslog = None
    config.application_path = f"{IMPLEMENTATION / 'main'}:app"
    raise SystemExit(run(config))
