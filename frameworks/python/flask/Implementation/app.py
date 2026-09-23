from flask import Flask

from payloads import Payloads
from routes import (
    authorized,
    baseline,
    body,
    cache,
    compressed,
    contract,
    cors,
    etag,
    forms,
    headers,
    items,
    json,
    middleware,
    parameters,
    query,
    sse,
    stream,
    template,
)


def build(p: Payloads) -> Flask:
    """The application, as each gunicorn worker builds it and as the suite does.

    Each family is a blueprint of its own, so a hook a family registers runs for that family's
    routes alone. The errors family has none: its answers are Werkzeug's router's, the body
    parser's and the items handlers'.
    """
    # Flask's own static route, /static/<path:filename>, serves the payload directory.
    # rb:handler static.file
    app = Flask(__name__, static_folder=p.directory, static_url_path="/static")
    for family in (baseline, json, middleware, parameters, query, headers, body, authorized, items, cache, etag, compressed, cors, forms, stream, sse, template, contract):
        app.register_blueprint(family.blueprint(p))
    return app
