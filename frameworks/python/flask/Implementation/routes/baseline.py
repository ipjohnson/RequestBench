from flask import Blueprint

from payloads import Payloads


def blueprint(p: Payloads) -> Blueprint:
    """baseline: the dispatch floor, with nothing serialised."""
    routes = Blueprint("baseline", __name__)

    @routes.get("/plaintext")
    def plaintext() -> tuple[str, dict[str, str]]:
        return "Hello, World!", {"content-type": "text/plain; charset=utf-8"}

    return routes
