from flask import Blueprint, abort, request

from payloads import Json, Payloads


def blueprint(p: Payloads) -> Blueprint:
    """authorized: Werkzeug parses the bearer token, and a hook on this family's blueprint compares
    it before the view runs."""
    token = p.settings["token"]
    routes = Blueprint("authorized", __name__)

    # rb:wiring authorized.*
    @routes.before_request
    def require_token() -> None:
        """Flask ships no authorization. A before_request hook that raises is Flask's way to refuse a
        request before its view runs, and abort(403) answers with Werkzeug's Forbidden."""
        credentials = request.authorization
        if credentials is None or credentials.type != "bearer" or credentials.token != token:
            abort(403)
    # rb:end

    @routes.get("/authorized/small")
    def small() -> Json:
        return p.small

    return routes
