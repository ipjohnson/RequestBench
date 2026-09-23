from collections.abc import Callable

from flask import Blueprint, Response, jsonify, request
from flask.blueprints import BlueprintSetupState
# rb:wiring cache.*
from flask_caching import Cache

from payloads import Json, Payloads
from serial import fresh


def blueprint(p: Payloads) -> Blueprint:
    """cache: the view skipped and a stored answer written back. The view writes x-rb-serial, so a
    replayed answer repeats the serial it was stored with."""
    settings = p.settings["cache"]
    one = tuple(settings["vary"]["one"])
    many = tuple(settings["vary"]["many"])
    routes = Blueprint("cache", __name__)

    # rb:wiring cache.*
    # Flask-Caching's SimpleCache keeps the store in the worker's memory, so each worker holds its
    # own, sized in entries by settings.json. It stores what the view returned, here the response.
    cache = Cache(config={"CACHE_TYPE": "SimpleCache", "CACHE_THRESHOLD": settings["capacity"],
                          "CACHE_DEFAULT_TIMEOUT": settings["ttlSeconds"]})

    @routes.record_once
    def install(state: BlueprintSetupState) -> None:
        cache.init_app(state.app)

    def keyed_on(names: tuple[str, ...]) -> Callable[[], str]:
        """The key a vary row is stored under: its path, and the request headers it varies on.
        Flask-Caching keys the other rows on the path alone."""
        return lambda: "|".join([request.path, *(request.headers.get(name, "") for name in names)])
    # rb:end

    @routes.get("/cache/small")
    @cache.cached()
    def small() -> Response:
        return fresh(jsonify(p.small))

    @routes.get("/cache/medium")
    @cache.cached()
    def medium() -> Response:
        return fresh(jsonify(p.medium))

    @routes.get("/cache/large")
    @cache.cached()
    def large() -> Response:
        return fresh(jsonify(p.large))

    # The Vary header tells a cache in front of the framework what the answer depends on. The store
    # keys on the route's own list, not on this header.
    @routes.get("/cache/vary/one")
    @cache.cached(make_cache_key=keyed_on(one))
    def vary_one() -> Response:
        return varying(p.small, one)

    @routes.get("/cache/vary/many")
    @cache.cached(make_cache_key=keyed_on(many))
    def vary_many() -> Response:
        return varying(p.small, many)

    return routes


def varying(payload: Json, on: tuple[str, ...]) -> Response:
    response = fresh(jsonify(payload))
    response.headers["vary"] = ", ".join(on)
    return response
