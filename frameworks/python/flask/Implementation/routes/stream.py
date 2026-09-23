from flask import Blueprint, Response, current_app

from payloads import Payloads


def blueprint(p: Payloads) -> Blueprint:
    """stream: items.medium's rows written one per line, each as it is produced. A view that returns
    a generator streams, as Flask documents, and with no length gunicorn sends the body chunked. Each
    row is written by the application's JSON provider, as the json rows are."""
    routes = Blueprint("stream", __name__)

    @routes.get("/stream/items")
    def lines() -> Response:
        dumps = current_app.json.dumps
        return Response((f"{dumps(row)}\n" for row in p.medium["items"]), mimetype="application/x-ndjson")

    return routes
