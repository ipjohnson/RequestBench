"""RequestBench framework: Django over ASGI, served by uvicorn with two worker processes.

The container gets two cores, and one Python process runs Python on one of them at a time. This
process is uvicorn's supervisor: it binds the socket, starts the workers, and each worker imports
asgi, which sets Django up from settings.py, loads the payloads and accepts from that socket.
"""
import os
from importlib.metadata import version
from pathlib import Path

import uvicorn

# Written as a number, not read from the machine: under a CPU quota Python counts every core the
# host has, not the two the quota allows.
WORKERS = 2
# What /__meta names as the adapter. contract.py imports it with WORKERS.
ADAPTER = f"uvicorn {version('uvicorn')}"

# The application, which uvicorn puts on the path of every worker it starts.
IMPLEMENTATION = Path(__file__).resolve().parent.parent / "Implementation"

if __name__ == "__main__":
    if "RB_PAYLOADS" not in os.environ:
        raise SystemExit("RB_PAYLOADS has to name the payload directory")
    # No access log. uvicorn writes one line per request by default, and no other framework in the
    # corpus logs a request. Django implements no ASGI lifespan, so uvicorn is told not to ask.
    uvicorn.run("asgi:application", app_dir=str(IMPLEMENTATION), host="0.0.0.0", port=int(os.environ.get("PORT", "8080")),
                workers=WORKERS, access_log=False, lifespan="off")
