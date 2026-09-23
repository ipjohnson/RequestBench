from flask import Blueprint, Response, jsonify
from flask.blueprints import BlueprintSetupState
# rb:wiring compressed.*
from flask_compress import Compress

from payloads import Payloads
from serial import fresh


def blueprint(p: Payloads) -> Blueprint:
    """compressed: Flask-Compress on these two views alone, which gzips an answer when the request
    asks."""
    routes = Blueprint("compressed", __name__)

    # rb:wiring compressed.*
    compress = Compress()

    @routes.record_once
    def install(state: BlueprintSetupState) -> None:
        """COMPRESS_REGISTER off keeps Flask-Compress off every other answer, and its compressed()
        decorator puts it on a view. gzip runs at level 1, the fastest level every framework here
        compresses at, where Flask-Compress's own default is 6. A body under 500 bytes goes out as it
        is, which is Flask-Compress's default."""
        state.app.config.update(COMPRESS_REGISTER=False, COMPRESS_LEVEL=1)
        compress.init_app(state.app)
    # rb:end

    # rb:handler compressed.gzip_small,compressed.identity_small
    @routes.get("/compressed/small")
    @compress.compressed()
    def small() -> Response:
        return fresh(jsonify(p.small))

    # rb:handler compressed.gzip_large,compressed.identity_large
    @routes.get("/compressed/large")
    @compress.compressed()
    def large() -> Response:
        return fresh(jsonify(p.large))

    return routes
