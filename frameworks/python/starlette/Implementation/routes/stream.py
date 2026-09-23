import json
from collections.abc import AsyncIterator

from starlette.requests import Request
from starlette.responses import StreamingResponse
from starlette.routing import BaseRoute, Route

from payloads import Json, Payloads


def text(row: Json) -> str:
    """One row as JSON, with the settings Starlette's JSONResponse renders a body with."""
    return json.dumps(row, ensure_ascii=False, allow_nan=False, indent=None, separators=(",", ":"))


def routes(p: Payloads) -> list[BaseRoute]:
    """stream: items.medium's rows written one per line, each as it is produced, through
    StreamingResponse, which sends each chunk the iterator yields and sets no length."""

    # rb:handler stream.ndjson
    async def lines() -> AsyncIterator[str]:
        for row in p.medium["items"]:
            yield text(row) + "\n"

    async def items(request: Request) -> StreamingResponse:
        """
        responses:
          200: {description: One row of items.medium per line, content: {application/x-ndjson: {schema: {$ref: "#/components/schemas/Item"}}}}
        """
        return StreamingResponse(lines(), media_type="application/x-ndjson")
    # rb:end

    return [Route("/stream/items", items)]
