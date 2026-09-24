import platform
from importlib.metadata import version

from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.routing import BaseRoute, Route

from payloads import Payloads
from server import ADAPTER, WORKERS

META = {
    "framework": "Starlette",
    "version": version("starlette"),
    "runtime": f"{platform.python_implementation()} {platform.python_version()}",
    "adapter": ADAPTER,
    "serializer": "json",
    "workers": WORKERS,
}


def routes(p: Payloads) -> list[BaseRoute]:
    """/health and /__meta, which the contract asks of every framework outside the corpus."""

    # The payloads are loaded before a worker accepts, so a worker that answers has them.
    async def health(request: Request) -> PlainTextResponse:
        """
        responses:
          200: {description: The worker is ready, content: {text/plain: {schema: {type: string}}}}
        """
        return PlainTextResponse("ok")

    async def meta(request: Request) -> JSONResponse:
        """
        responses:
          200: {description: What runs, content: {application/json: {schema: {$ref: "#/components/schemas/Meta"}}}}
        """
        return JSONResponse(META)

    return [
        Route("/health", health),
        Route("/__meta", meta),
    ]
