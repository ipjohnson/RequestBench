from sanic import Blueprint
from sanic.response import text

from documented import answers
from payloads import Payloads


def blueprint(p: Payloads) -> Blueprint:
    """baseline: the dispatch floor, with nothing serialised."""
    routes = Blueprint("baseline")

    @routes.get("/plaintext")
    @answers(str, "The string", media="text/plain")
    async def plaintext(request):
        return text("Hello, World!")

    return routes
