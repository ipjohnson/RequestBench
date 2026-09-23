from flask import Blueprint, Response, jsonify
# rb:wiring cors.*
from flask_cors import CORS

from payloads import Payloads
from serial import fresh


def blueprint(p: Payloads) -> Blueprint:
    """cors: Flask-CORS on this family's blueprint, which adds its headers after the view, and to the
    OPTIONS answer Flask writes itself for every route. The view writes x-rb-serial, so its absence
    on a preflight shows no view ran."""
    settings = p.settings["cors"]
    routes = Blueprint("cors", __name__)
    # rb:wiring cors.*
    CORS(routes, origins=[settings["origin"]], methods=[settings["method"]], allow_headers=[settings["header"]],
         max_age=settings["maxAgeSeconds"])

    # rb:handler cors.request
    @routes.get("/cors/small")
    def small() -> Response:
        return fresh(jsonify(p.small))

    return routes
