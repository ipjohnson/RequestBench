from sanic import Blueprint
from sanic.response import json_dumps

from documented import answers
from payloads import Payloads


def blueprint(p: Payloads) -> Blueprint:
    """stream: items.medium's rows written one per line, each as it is produced. request.respond()
    sends the head at once, and the body goes out in chunks as the handler sends each row, written
    by the ujson dumps that Sanic's json() uses."""
    routes = Blueprint("stream")

    @routes.get("/stream/items")
    @answers(str, "items.medium's rows, one per line", media="application/x-ndjson")
    async def lines(request):
        response = await request.respond(content_type="application/x-ndjson")
        for row in p.medium["items"]:
            await response.send(json_dumps(row) + "\n")
        await response.eof()

    return routes
