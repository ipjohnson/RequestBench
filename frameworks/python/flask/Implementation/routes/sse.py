from flask import Blueprint, Response, current_app

from payloads import Payloads


def blueprint(p: Payloads) -> Blueprint:
    """sse: items.medium's rows as server-sent events. Flask has no helper for them, so the view
    streams each event's text from a generator, typed text/event-stream, with each row written by the
    application's JSON provider."""
    routes = Blueprint("sse", __name__)

    @routes.get("/sse/medium")
    def medium() -> Response:
        dumps = current_app.json.dumps
        return Response((f"data: {dumps(row)}\n\n" for row in p.medium["items"]), mimetype="text/event-stream")

    return routes
