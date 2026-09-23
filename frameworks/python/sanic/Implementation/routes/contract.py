import platform
from importlib.metadata import version

from sanic import Blueprint
from sanic.response import json, text

from documented import answers
from payloads import Payloads
from server import WORKERS

META = {
    "framework": "Sanic",
    "version": version("sanic"),
    "runtime": f"{platform.python_implementation()} {platform.python_version()}",
    "adapter": f"Sanic's own server, on uvloop {version('uvloop')}",
    "serializer": f"ujson {version('ujson')}",
    "workers": WORKERS,
}


def blueprint(p: Payloads) -> Blueprint:
    """/health and /__meta, which the contract asks of every framework outside the corpus."""
    routes = Blueprint("contract")

    # The payloads are loaded before a worker accepts, so a worker that answers has them.
    @routes.get("/health")
    @answers(str, "ok, once the worker has loaded the payloads", media="text/plain")
    async def health(request):
        return text("ok")

    @routes.get("/__meta")
    @answers(dict, "What runs")
    async def meta(request):
        return json(META)

    return routes
