"""RequestBench framework: Flask as a Lambda function, served by gunicorn behind the Lambda Web
Adapter.

start.sh starts the adapter beside this process. The adapter asks the Runtime API for each event,
sends it to gunicorn on loopback as an HTTP request, and streams gunicorn's answer back.
gunicorn writes no access log unless it is given a file, and it is given none.
"""
import os
from importlib.metadata import version

from gunicorn.app.base import BaseApplication

# A function answers one event at a time, so gunicorn runs one worker with one thread.
WORKERS = 1
THREADS = 1
# What /__meta names as the adapter. contract.py imports it with WORKERS. The Dockerfile names the
# Lambda Web Adapter it copies in.
ADAPTER = f"gunicorn {version('gunicorn')} behind {os.environ['RB_LAMBDA_ADAPTER']}"


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
        from app import build
        from payloads import load

        return build(load(os.environ["RB_PAYLOADS"]))

if __name__ == "__main__":
    if "RB_PAYLOADS" not in os.environ:
        raise SystemExit("RB_PAYLOADS has to name the payload directory")
    Server({
        "bind": f"127.0.0.1:{os.environ['AWS_LWA_PORT']}",
        "workers": WORKERS,
        # The gthread worker keeps the adapter's connection open between events, where the sync
        # worker closes it after each.
        "worker_class": "gthread",
        "threads": THREADS,
        # gunicorn opens a control socket for its gunicornc tool by default, served from a thread in
        # the master. Nothing here drives it.
        "control_socket_disable": True,
        # Each worker touches a heartbeat file on every pass of its loop, and gunicorn's FAQ puts
        # that file on a tmpfs.
        "worker_tmp_dir": "/dev/shm" if os.path.isdir("/dev/shm") else None,
    }).run()
