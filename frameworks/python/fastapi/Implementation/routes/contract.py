import platform
from importlib.metadata import version

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from payloads import Payloads
from server import WORKERS

META = {
    "framework": "FastAPI",
    "version": version("fastapi"),
    "runtime": f"{platform.python_implementation()} {platform.python_version()}",
    "adapter": f"uvicorn {version('uvicorn')}",
    "serializer": f"pydantic-core {version('pydantic-core')}",
    "workers": WORKERS,
}


def router(p: Payloads) -> APIRouter:
    """/health and /__meta, which the contract asks of every framework outside the corpus."""
    routes = APIRouter()

    # The payloads are loaded before a worker accepts, so a worker that answers has them.
    @routes.get("/health", response_class=PlainTextResponse)
    async def health() -> str:
        return "ok"

    @routes.get("/__meta")
    async def meta() -> dict[str, str | int]:
        return META

    return routes
