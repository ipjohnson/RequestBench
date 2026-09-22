from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from payloads import Payloads


def router(p: Payloads) -> APIRouter:
    """baseline: the dispatch floor, with nothing serialised."""
    routes = APIRouter()

    @routes.get("/plaintext", response_class=PlainTextResponse)
    async def plaintext() -> str:
        return "Hello, World!"

    return routes
