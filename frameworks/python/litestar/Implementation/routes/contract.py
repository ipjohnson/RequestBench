import platform
from importlib.metadata import version

from litestar import MediaType, Router, get

from payloads import Payloads
from server import ADAPTER, WORKERS

META = {
    "framework": "Litestar",
    "version": version("litestar"),
    "runtime": f"{platform.python_implementation()} {platform.python_version()}",
    "adapter": ADAPTER,
    "serializer": f"msgspec {version('msgspec')}",
    "workers": WORKERS,
}


def router(p: Payloads) -> Router:
    """/health and /__meta, which the contract asks of every framework outside the corpus."""

    # The payloads are loaded before a worker accepts, so a worker that answers has them.
    @get("/health", media_type=MediaType.TEXT)
    async def health() -> str:
        return "ok"

    @get("/__meta")
    async def meta() -> dict[str, str | int]:
        return META

    return Router(path="/", route_handlers=[health, meta])
