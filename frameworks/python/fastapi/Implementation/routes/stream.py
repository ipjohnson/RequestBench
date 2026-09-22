from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import TypeAdapter

from payloads import Item, Payloads


class NDJSONResponse(StreamingResponse):
    media_type = "application/x-ndjson"


ROW = TypeAdapter(Item)


def router(p: Payloads) -> APIRouter:
    """stream: items.medium's rows written one per line, each as it is produced. FastAPI's own JSON
    Lines streaming answers application/jsonl, and this row asks for application/x-ndjson, so the
    route streams bytes through a response class of that type, as FastAPI documents for any other.
    Each row is written by Pydantic, as the json rows' are."""
    routes = APIRouter()

    @routes.get("/stream/items", response_class=NDJSONResponse)
    async def lines() -> AsyncIterator[bytes]:
        for row in p.medium.items:
            yield ROW.dump_json(row) + b"\n"

    return routes
