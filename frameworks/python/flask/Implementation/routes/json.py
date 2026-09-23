from flask import Blueprint

from payloads import Json, Payloads


def blueprint(p: Payloads) -> Blueprint:
    """json: a payload the framework already holds. A view that returns a dict is answered by
    Flask's JSON provider. Three static routes rather than one with a capture, so the router pays no
    capture here."""
    routes = Blueprint("json", __name__)

    @routes.get("/json/small")
    def small() -> Json:
        return p.small

    @routes.get("/json/medium")
    def medium() -> Json:
        return p.medium

    @routes.get("/json/large")
    def large() -> Json:
        return p.large

    return routes
