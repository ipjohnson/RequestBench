from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.sse import EventSourceResponse

from payloads import Item, Payloads


def router(p: Payloads) -> APIRouter:
    """sse: items.medium's rows as server-sent events, through FastAPI's own support for them. Each
    row the handler yields is serialised by Pydantic, from the declared item type, as one event."""
    routes = APIRouter()

    @routes.get("/sse/medium", response_class=EventSourceResponse)
    async def medium() -> AsyncIterator[Item]:
        for row in p.medium.items:
            yield row

    return routes
