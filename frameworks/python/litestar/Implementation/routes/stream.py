from collections.abc import AsyncIterator

import msgspec
from litestar import Router, get
from litestar.response import Stream

from payloads import Payloads


def router(p: Payloads) -> Router:
    """stream: items.medium's rows written one per line, each as it is produced, by Litestar's Stream
    typed application/x-ndjson. Each row is encoded by msgspec, as the json rows' are. The generator
    is async: Stream runs a plain iterator's every step on a worker thread."""
    encode = msgspec.json.Encoder().encode

    async def rows() -> AsyncIterator[bytes]:
        for row in p.medium.items:
            yield encode(row) + b"\n"

    @get("/stream/items")
    async def lines() -> Stream:
        return Stream(rows(), media_type="application/x-ndjson")

    return Router(path="/", route_handlers=[lines])
