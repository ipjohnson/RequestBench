from flask import Blueprint

from answers import echoed
from payloads import Json, Payloads


def blueprint(p: Payloads) -> Blueprint:
    """parameters: path captures, each converted to an int by Werkzeug's int converter, which
    matches digits alone. Werkzeug's router tries a static segment before a converter, whatever
    order the routes were added in."""
    routes = Blueprint("parameters", __name__)

    @routes.get("/parameters/static/segment/literal")
    def static() -> Json:
        return p.small

    @routes.get("/parameters/<int:one>/segment/literal")
    def one(one: int) -> Json:
        return echoed(p.small, {"one": one})

    @routes.get("/parameters/<int:one>/with-second/<int:two>")
    def two(one: int, two: int) -> Json:
        return echoed(p.small, {"one": one, "two": two})

    return routes
