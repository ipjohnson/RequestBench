import platform
from importlib.metadata import version

from flask import Blueprint

from payloads import Payloads
from server import THREADS, WORKERS

META = {
    "framework": "Flask",
    "version": version("flask"),
    "runtime": f"{platform.python_implementation()} {platform.python_version()}",
    "adapter": f"gunicorn {version('gunicorn')}",
    "serializer": "Flask's DefaultJSONProvider, over the standard library's json",
    "workers": WORKERS,
    "threads": THREADS,
}


def blueprint(p: Payloads) -> Blueprint:
    """/health and /__meta, which the contract asks of every framework outside the corpus."""
    routes = Blueprint("contract", __name__)

    # The payloads are loaded before a worker accepts, so a worker that answers has them.
    @routes.get("/health")
    def health() -> tuple[str, dict[str, str]]:
        return "ok", {"content-type": "text/plain; charset=utf-8"}

    @routes.get("/__meta")
    def meta() -> dict[str, str | int]:
        return META

    return routes
