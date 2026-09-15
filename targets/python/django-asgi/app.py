"""RequestBench target: Django over ASGI. Framework wiring only; behaviour from
_shared/domain.py.

Served by daphne, the ASGI server the Django project maintains and lists first in its own
deployment documentation. The views are async, so Django serves them on the event loop
rather than through a thread pool, which is what "over ASGI" is here to mean.

MIDDLEWARE holds one entry. Django's startproject default installs seven, and every one of
them would run on all forty-five endpoints -- sessions, CSRF, authentication -- which is
work no other target in the set does. What is left is the exception hook, because Django is
the one framework here with no registry mapping an exception class to a response.

Django's router matches on path alone, so the method is part of the view: require_GET and
require_POST where a path serves one, a View subclass where it serves two. Every other
target gets that from its router, and leaving it out would measure an application that
answers POST /json/small with 200.

Django writes a URL pattern without a leading slash, because path() matches what is left
after the one the request carried.
"""
import django
from django.conf import settings
from django.utils.decorators import markcoroutinefunction

from _hosts import host
from _shared import domain as d

settings.configure(
    DEBUG=False,
    ALLOWED_HOSTS=["*"],
    ROOT_URLCONF=__name__,
    SECRET_KEY="requestbench",
    MIDDLEWARE=[__name__ + ".Failures"],
    LOGGING_CONFIG=None,
    USE_TZ=False,
)
django.setup()

from django.http import HttpResponse, JsonResponse  # noqa: E402
from django.urls import path  # noqa: E402
from django.views import View  # noqa: E402
from django.views.decorators.gzip import gzip_page  # noqa: E402
from django.views.decorators.http import condition, require_GET, require_POST  # noqa: E402

META = host.meta("django-asgi", dist="django", adapter="daphne")


def body_of(request):
    """Django does not parse a request body, so the domain does: it is the same parse, and
    the same 422, in all six targets."""
    return d.parse_body(request.body)


async def small(_):
    return JsonResponse(d.payload("small"))


# ---- failures ------------------------------------------------------------------------
#
# Views raise and never build a 404 or a 422 themselves, so the six Python targets cannot
# drift.

FAILURES = {
    d.NotFound: lambda exc: JsonResponse(d.not_found_body(), status=404),
    d.Invalid: lambda exc: JsonResponse(d.invalid_body(exc.errors), status=422),
}


class Failures:
    """Django's process_exception hook, which is the framework's own way to turn an
    exception into a response. Marked async so Django does not adapt it, which would put a
    thread hop in front of every request."""

    async_capable = True
    sync_capable = False

    def __init__(self, get_response):
        self.get_response = get_response
        markcoroutinefunction(self)

    async def __call__(self, request):
        return await self.get_response(request)

    async def process_exception(self, _, exc):
        build = FAILURES.get(type(exc))
        return build(exc) if build else None


# Sync, unlike every other view here: Django resolves the error handler off the event loop
# and does not await what it returns, so a coroutine would reach the client as a 500.
# rb:snippet errors.unmatched
def handler404(request, exception):
    return JsonResponse(d.not_found_body(), status=404)


# ---- baseline, json, parameters, query, headers --------------------------------------

@require_GET
async def plaintext(_):
    return HttpResponse("Hello, World!", content_type="text/plain; charset=utf-8")


@require_GET
async def health(_):
    return HttpResponse("ok", content_type="text/plain; charset=utf-8")


@require_GET
async def meta(_):
    return JsonResponse(META)


def payload_view(size):
    """The three sizes are static routes, not json/<size>. The size set is fixed, so a
    capture would make the router pay parameter cost on the family every other target
    serves from a static route, and it would answer 200 with an empty body for a size that
    does not exist."""
    @require_GET
    async def view(_):
        return JsonResponse(d.payload(size))
    return view


@require_GET
async def parameters_static(_):
    return JsonResponse(d.payload("small"))


@require_GET
async def parameters_one(_, one):
    return JsonResponse(d.payload("small"))


@require_GET
async def parameters_two(_, one, two):
    return JsonResponse(d.payload("small"))


# The framework parses the query string, which is the work this family is here to measure;
# the domain coerces what it parsed, so all six targets answer the same values.
@require_GET
async def query_one(request):
    return JsonResponse(d.coerce_one(request.GET))


@require_GET
async def query_many(request):
    return JsonResponse(d.coerce_many(request.GET))


# ---- middleware: one view decorator per layer ----------------------------------------

def noop(view):
    """One layer: it calls the next and does nothing else."""
    async def layer(request, *args, **kwargs):
        return await view(request, *args, **kwargs)
    return layer


def layered(view, n):
    for _ in range(n):
        view = noop(view)
    return require_GET(view)


# ---- authorized: a view decorator, not an if in the handler --------------------------

def require_token(view):
    async def guard(request, *args, **kwargs):
        if not d.token_ok(request.headers.get("authorization")):
            return JsonResponse(d.forbidden_body(), status=403)
        return await view(request, *args, **kwargs)
    return require_GET(guard)


# ---- compressed: Django's own per-view gzip ------------------------------------------

def compressed_view(size):
    """gzip_page is GZipMiddleware as a decorator, so compression is scoped to these three
    routes and the other forty-two never look at accept-encoding. Django compresses at
    level 6, which is the level every language here is pinned to, and skips a body under
    200 bytes -- below the small payload either way."""
    @require_GET
    @gzip_page
    async def view(_):
        response = JsonResponse(d.payload(size))
        response["x-rb-serial"] = d.next_serial()
        return response
    return view


# ---- cached: Django's own conditional decorator --------------------------------------

def cached_view(size):
    """The ETag is pinned in the fixture, so condition() is given it rather than asked to
    hash the body: what this measures is emitting the header and comparing it. The
    decorator answers the conditional itself and never reaches the view, which is why the
    two headers it does not know about are set outside it."""
    etag = d.etag_of(size)

    @condition(etag_func=lambda *_, **__: etag)
    async def inner(_):
        return JsonResponse(d.payload(size))

    @require_GET
    async def view(request, *args, **kwargs):
        response = await inner(request, *args, **kwargs)
        response["cache-control"] = d.CACHEABLE
        response["x-rb-serial"] = d.next_serial()
        return response
    return view


# ---- body ----------------------------------------------------------------------------
#
# bind parses and binds without validating, so validate minus bind is the validator alone
# rather than the validator plus the parse.

@require_POST
async def bind(request):
    return JsonResponse(d.bind_echo(body_of(request)))


@require_POST
async def validate_all(request):
    return JsonResponse(d.validate_order(body_of(request)))


@require_POST
async def validate_first(request):
    return JsonResponse(d.validate_order(body_of(request), first_error=True))


# ---- domain --------------------------------------------------------------------------

class Orders(View):
    """One path, two methods. Django's router matches on path alone, so the method split is
    the view's -- which is what a class-based view is for."""

    async def get(self, request):
        return JsonResponse(d.domain_filter(request.GET))

    async def post(self, request):
        out = d.validate_order(body_of(request))
        return JsonResponse(out, status=201,
                            headers={"location": d.created_location()})


class Order(View):
    async def get(self, _, oid):
        return JsonResponse(d.get_order(oid))

    async def put(self, request, oid):
        existing = d.get_order(oid)
        return JsonResponse({"id": existing["id"], **d.validate_order(body_of(request))})


@require_GET
async def customer_summary(_, cid):
    return JsonResponse(d.domain_join(cid))


@require_GET
async def region_report(_, region):
    return JsonResponse(d.domain_aggregate(region))


class Customer(View):
    async def patch(self, request, cid):
        return JsonResponse(d.patch_customer(cid, body_of(request)))


class OrderLine(View):
    async def delete(self, _, oid, lid):
        d.get_order_line(oid, lid)
        return HttpResponse(status=204)


# ---- template: the engine named in /__meta -------------------------------------------

def template_view(size):
    @require_GET
    async def view(_):
        return HttpResponse(host.render_items(d.payload(size)),
                            content_type="text/html; charset=utf-8")
    return view


urlpatterns = [
    path("plaintext", plaintext),
    path("health", health),
    path("__meta", meta),
    path("json/small", payload_view("small")),
    path("json/medium", payload_view("medium")),
    path("json/large", payload_view("large")),
    path("parameters/static/segment/literal", parameters_static),
    path("parameters/<one>", parameters_one),
    path("parameters/<one>/with-second/<two>", parameters_two),
    path("query/one", query_one),
    path("query/many", query_many),
    # The view reads no header at all, so headers.many minus headers.few is the cost of
    # materialising 27 nobody asked for.
    path("headers", require_GET(small)),
    path("middleware/none", layered(small, 0)),
    path("middleware/four", layered(small, 4)),
    path("middleware/sixteen", layered(small, 16)),
    path("authorized/small", require_token(small)),
    path("compressed/small", compressed_view("small")),
    path("compressed/medium", compressed_view("medium")),
    path("compressed/large", compressed_view("large")),
    path("cached/small", cached_view("small")),
    path("cached/medium", cached_view("medium")),
    path("cached/large", cached_view("large")),
    path("body/bind/small", bind),
    path("body/bind/medium", bind),
    path("body/validate/small", validate_all),
    path("body/validate/medium", validate_all),
    path("body/validate/first-error", validate_first),
    path("domain/orders", Orders.as_view()),
    path("domain/orders/<oid>", Order.as_view()),
    path("domain/customers/<cid>/summary", customer_summary),
    path("domain/regions/<region>/report", region_report),
    path("domain/customers/<cid>", Customer.as_view()),
    path("domain/orders/<oid>/lines/<lid>", OrderLine.as_view()),
    path("template/small", template_view("small")),
    path("template/medium", template_view("medium")),
]

from django.core.asgi import get_asgi_application  # noqa: E402

application = get_asgi_application()


def serve():
    from daphne.endpoints import build_endpoint_description_strings
    from daphne.server import Server

    port = host.boot("django-asgi")
    Server(application=application, verbosity=0,
           endpoints=build_endpoint_description_strings(host="0.0.0.0", port=port)).run()
