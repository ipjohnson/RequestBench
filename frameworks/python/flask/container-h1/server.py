"""RequestBench framework: Flask, served by gunicorn with two worker processes.

Flask is a WSGI framework and ships no production server, and its deployment documentation lists
gunicorn first. This process is gunicorn's master: it binds the socket and starts the workers, and
each worker builds the application, loading the payloads before it accepts from that socket.
gunicorn writes no access log unless it is given a file, and it is given none.
"""
import os
import sys
from pathlib import Path

from gunicorn.app.base import BaseApplication

# Written as a number, not read from the machine: under a CPU quota Python counts every core the
# host has, not the two the quota allows.
WORKERS = 2
# gunicorn documents 2 to 4 threads per core, and the container has two cores. Each worker runs
# Python on one core at a time, so more threads would only queue for it.
THREADS = 4


class Server(BaseApplication):
    """gunicorn started from Python rather than from its command line, as its documentation
    describes for a custom application."""

    def __init__(self, options: dict[str, object]) -> None:
        self.options = options
        super().__init__()

    def load_config(self) -> None:
        for name, value in self.options.items():
            self.cfg.set(name, value)

    def load(self):
        # preload_app is off, so each worker calls this after the fork and builds its own
        # application, with its own cache store.
        from app import build
        from payloads import load

        return build(load(os.environ["RB_PAYLOADS"]))


if __name__ == "__main__":
    if "RB_PAYLOADS" not in os.environ:
        raise SystemExit("RB_PAYLOADS has to name the payload directory")
    # The application, beside this host's directory. The workers fork from here and keep the path.
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "Implementation"))
    Server({
        "bind": f"0.0.0.0:{os.environ.get('PORT', '8080')}",
        "workers": WORKERS,
        # The sync worker answers one request at a time and closes the connection after each. The
        # gthread worker keeps a connection open between requests, on the worker that accepted it.
        "worker_class": "gthread",
        "threads": THREADS,
        # gunicorn opens a control socket for its gunicornc tool by default, served from a thread in
        # the master. Nothing here drives it.
        "control_socket_disable": True,
        # Each worker touches a heartbeat file on every pass of its loop, and gunicorn's FAQ puts
        # that file on a tmpfs. macOS has no /dev/shm, so a local run there keeps the default.
        "worker_tmp_dir": "/dev/shm" if os.path.isdir("/dev/shm") else None,
    }).run()
