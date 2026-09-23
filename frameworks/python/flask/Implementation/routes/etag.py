from flask import Blueprint, Response, jsonify, request

from payloads import Payloads
from serial import fresh


def blueprint(p: Payloads) -> Blueprint:
    """etag: a hook on this family's blueprint, over the validator Werkzeug's Response already
    carries. No other route has it."""
    routes = Blueprint("etag", __name__)

    # rb:wiring etag.*
    @routes.after_request
    def revalidate(response: Response) -> Response:
        """add_etag hashes the body with SHA-1, and make_conditional turns the response into a 304
        when If-None-Match names the tag. The body is built and hashed before anything is compared,
        so a 304 saves the write and nothing else."""
        response.add_etag()
        return response.make_conditional(request)
    # rb:end

    @routes.get("/etag/small")
    def small() -> Response:
        return fresh(jsonify(p.small))

    @routes.get("/etag/large")
    def large() -> Response:
        return fresh(jsonify(p.large))

    return routes
