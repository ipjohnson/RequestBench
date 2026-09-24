"""RequestBench framework: Litestar, served by uvicorn with two worker processes.

The container gets two cores, and one Python process runs Python on one of them at a time. This
process is uvicorn's supervisor: it binds the socket, starts the workers, and each worker imports
main, loads the payloads and accepts from that socket. uvicorn is the first server Litestar's
deployment documentation lists, and the one its own `litestar run` command starts.
"""
import os
from pathlib import Path

import uvicorn

# Written as a number, not read from the machine: under a CPU quota Python counts every core the
# host has, not the two the quota allows.
WORKERS = 2

# The application, which uvicorn puts on the path of every worker it starts.
IMPLEMENTATION = Path(__file__).resolve().parent.parent / "Implementation"

if __name__ == "__main__":
    if "RB_PAYLOADS" not in os.environ:
        raise SystemExit("RB_PAYLOADS has to name the payload directory")
    # No access log. uvicorn writes one line per request by default, and no other framework in the
    # corpus logs a request.
    uvicorn.run("main:app", app_dir=str(IMPLEMENTATION), host="0.0.0.0", port=int(os.environ.get("PORT", "8080")),
                workers=WORKERS, access_log=False)
