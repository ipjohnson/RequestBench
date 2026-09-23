from flask import Blueprint, request

from answers import echoed
from payloads import Json, Payloads
from routes.query import SEARCH, bound


def blueprint(p: Payloads) -> Blueprint:
    """forms: the same eight values query.many reads, from a urlencoded body, and an upload. Werkzeug
    parses both before the view reads them."""
    routes = Blueprint("forms", __name__)

    @routes.post("/forms/urlencoded")
    def urlencoded() -> Json:
        return echoed(p.small, bound(request.form, SEARCH))

    # The upload is parsed to its end before the view reads it, and read again for its length.
    @routes.post("/forms/multipart")
    def multipart() -> Json:
        upload = request.files["file"]
        return {"file": {"name": upload.filename, "bytes": len(upload.read())},
                "echo": {"tenant": request.form["tenant"], "requestId": request.form["requestId"]}}

    return routes
