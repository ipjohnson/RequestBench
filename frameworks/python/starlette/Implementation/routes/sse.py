from collections.abc import AsyncIterator

# rb:wiring sse.*
from sse_starlette import EventSourceResponse
from starlette.requests import Request
from starlette.routing import BaseRoute, Route

from payloads import Payloads
from routes.stream import text


def routes(p: Payloads) -> list[BaseRoute]:
    """sse: items.medium's rows as server-sent events. Starlette has no response for them, and
    sse-starlette's EventSourceResponse is the one Starlette applications use: it writes each event
    the iterator yields in the event-stream format, pings an idle stream and stops on a disconnect."""

    # rb:handler sse.medium
    async def events() -> AsyncIterator[dict[str, str]]:
        for row in p.medium["items"]:
            yield {"data": text(row)}

    async def medium(request: Request) -> EventSourceResponse:
        """
        responses:
          200: {description: One event per row of items.medium, content: {text/event-stream: {schema: {type: string}}}}
        """
        return EventSourceResponse(events())
    # rb:end

    return [Route("/sse/medium", medium)]
