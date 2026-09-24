"""RequestBench framework: Sanic, on its own server with two worker processes.

The container gets two cores, and one Python process runs Python on one of them at a time. This
process is Sanic's manager: it binds the socket and starts the workers. Sanic starts each worker as a
new process, and the loader's factory builds the application in it from the payloads before the
worker accepts.
"""
import os
import sys
from pathlib import Path

from sanic import Sanic
from sanic.worker.loader import AppLoader

# Written as a number, not read from the machine: under a CPU quota Python counts every core the
# host has, not the two the quota allows, and so does Sanic's fast mode.
WORKERS = 2

if __name__ == "__main__":
    if "RB_PAYLOADS" not in os.environ:
        raise SystemExit("RB_PAYLOADS has to name the payload directory")
    # The application, beside this host's directory. Sanic starts each worker with this path.
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "Implementation"))
    # Imported here rather than at the top, because routes/contract.py imports WORKERS from this
    # module.
    from main import create

    loader = AppLoader(factory=create)
    app = loader.load()
    # No access log and no banner. Sanic writes one line per request when access_log is on, and no
    # other framework in the corpus logs a request.
    app.prepare(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")), workers=WORKERS, access_log=False, motd=False)
    Sanic.serve(primary=app, app_loader=loader)
