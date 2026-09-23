from flask import Blueprint, request
from werkzeug.datastructures import MultiDict

from answers import echoed
from payloads import Json, Payloads

# query.many's eight values, which forms.urlencoded posts as a form, each with the type Werkzeug
# converts it to.
SEARCH = {"page": int, "size": int, "status": str, "category": str, "sort": str, "q": str, "minPrice": int, "maxPrice": int}


def bound(values: MultiDict, names: dict[str, type]) -> dict[str, int | str | None]:
    """Each value read by name from a parsed query string or form. Werkzeug's MultiDict.get runs the
    conversion and answers None for a value that is missing or does not convert."""
    return {name: values.get(name, type=kind) for name, kind in names.items()}


def blueprint(p: Payloads) -> Blueprint:
    """query: the query string Werkzeug parsed, each value converted as it is read."""
    routes = Blueprint("query", __name__)

    @routes.get("/query/one")
    def one() -> Json:
        return echoed(p.small, bound(request.args, {"page": int}))

    @routes.get("/query/many")
    def many() -> Json:
        return echoed(p.small, bound(request.args, SEARCH))

    return routes
