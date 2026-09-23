from sanic import Blueprint
from sanic.response import json_dumps

from documented import answers
from payloads import Payloads


def blueprint(p: Payloads) -> Blueprint:
    """sse: items.medium's rows as server-sent events. Sanic has no helper for them, so the handler
    streams each row as the data of one event, as the stream family streams lines, typed
    text/event-stream."""
    routes = Blueprint("sse")

    @routes.get("/sse/medium")
    @answers(str, "items.medium's rows, one per event", media="text/event-stream")
    async def medium(request):
        response = await request.respond(content_type="text/event-stream")
        for row in p.medium["items"]:
            await response.send(f"data: {json_dumps(row)}\n\n")
        await response.eof()

    return routes
