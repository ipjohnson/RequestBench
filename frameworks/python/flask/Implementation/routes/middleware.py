from flask import Blueprint

from payloads import Json, Payloads


# rb:wiring middleware.*
def noop() -> None:
    """One layer: it returns nothing, so Flask carries on to the next one and then to the view."""


def layered(name: str, count: int) -> Blueprint:
    """Flask has no middleware on a route. A blueprint's before_request hooks run for its own routes
    alone, so each layer count is a blueprint with that many no-op hooks."""
    layers = Blueprint(name, __name__)
    for _ in range(count):
        layers.before_request(noop)
    return layers
# rb:end


def blueprint(p: Payloads) -> Blueprint:
    """middleware: no-op layers in front of the view, one nested blueprint per layer count."""
    routes = Blueprint("middleware", __name__)
    none, four, sixteen = layered("none", 0), layered("four", 4), layered("sixteen", 16)

    @none.get("/middleware/none")
    def zero() -> Json:
        return p.small

    @four.get("/middleware/four")
    def four_layers() -> Json:
        return p.small

    @sixteen.get("/middleware/sixteen")
    def sixteen_layers() -> Json:
        return p.small

    for layers in (none, four, sixteen):
        routes.register_blueprint(layers)
    return routes
