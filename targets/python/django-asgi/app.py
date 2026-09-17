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
import pathlib

import django
from django.conf import settings
from django.utils.decorators import markcoroutinefunction

from _hosts import host
from _shared import domain as d

#: The cache.* routes: three keyed by path, two by header. Each gets a bookkeeping entry
#: of its own in the store, which is why the capacity below is not the fixture's alone.
CACHED_PATHS = 5

settings.configure(
    DEBUG=False,
    ALLOWED_HOSTS=["*"],
    ROOT_URLCONF=__name__,
    SECRET_KEY="requestbench",
    MIDDLEWARE=[__name__ + ".Failures"],
    # The response cache cache_page writes into, with an expiry past the end of a run so
    # nothing re-misses inside the measured window. The capacity is the one the fixture
    # derives from the key count plus one entry per cached path: cache_page keeps a second
    # entry there remembering which headers that path varies on, and Django counts both
    # against MAX_ENTRIES.
    CACHES={"default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "OPTIONS": {"MAX_ENTRIES": d.cache_spec()["capacity"] + CACHED_PATHS},
        "TIMEOUT": d.cache_spec()["ttl_s"],
    }},
    LOGGING_CONFIG=None,
    USE_TZ=False,
    # Django's own template engine, which is what the framework ships and what its own
    # tutorial renders with. The directory is absolute because _hosts/container.py loads
    # this module by file path rather than by name, so there is no app to search. With
    # DEBUG false the backend wraps its loaders in the cached one, so the template is
    # parsed on first render and reused: a precomputed string would measure nothing.
    # rb:wiring template.*
    TEMPLATES=[{
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [str(pathlib.Path(__file__).resolve().parent / "templates")],
        "APP_DIRS": False,
        "OPTIONS": {},
    }],
)
django.setup()

from django.http import HttpResponse, JsonResponse  # noqa: E402
from django import forms  # noqa: E402
from django.core.exceptions import ValidationError  # noqa: E402
from django.core.validators import MinLengthValidator  # noqa: E402
from django.shortcuts import render  # noqa: E402
from django.urls import path  # noqa: E402
from django.views import View  # noqa: E402
from django.views.decorators.gzip import gzip_page  # noqa: E402
from django.middleware.http import ConditionalGetMiddleware  # noqa: E402
from django.utils.decorators import decorator_from_middleware  # noqa: E402
from django.views.decorators.cache import cache_page  # noqa: E402
from django.views.decorators.http import require_GET, require_POST  # noqa: E402
from django.views.decorators.vary import vary_on_headers  # noqa: E402

META = host.meta("django-asgi", dist="django", adapter="daphne",
                 template="django " + host.dist_version("django"),
                 etag="django ConditionalGetMiddleware md5",
                 cache="django cache_page, LocMemCache")


# rb:wiring body.*,domain.*
def body_of(request):
    """Django does not parse a request body, so the shared parse does. What happens to the
    value afterwards is the form's."""
    return d.parse_body(request.body)

# ---- validation: a django.forms.Form ------------------------------------------------
#
# Django's validation facility is forms. A Form declares its fields, and is_valid() runs
# each field's own to_python and validate plus any clean_<field> the form adds, collecting
# every error into form.errors. That is the framework doing the work rather than a walk in
# the view.
#
# What a Form cannot express is the nested list: forms are flat, and `lines` is a list of
# objects. So `lines` is a JSONField the form declares and clean_lines checks with
# django.core.validators, which is still Django's facility rather than an if in the view.
#
# It lives here rather than in a sibling module because _hosts/container.py loads a target
# by file path, and this directory is not a legal module name.


class Refused(Exception):
    """A body the form refused, and the fields it named."""

    def __init__(self, errors):
        super().__init__("validation failed")
        self.errors = errors


# rb:wiring body.*,errors.*
def refused_body(errors):
    return {"error": "validation_failed", "errors": errors}


def not_bound_body(detail):
    return {"error": "invalid_body", "detail": detail}


# rb:wiring body.*,domain.*
class OrderForm(forms.Form):
    """The order body, as Django declares a body."""

    customer_id = forms.IntegerField()
    status = forms.CharField()
    lines = forms.JSONField()

    def clean_lines(self):
        rows = self.cleaned_data["lines"]
        if not isinstance(rows, list):
            raise ValidationError("Enter a list.", code="invalid_list")
        MinLengthValidator(1, message="Enter at least one line.")(rows)
        for i, row in enumerate(rows):
            row = row if isinstance(row, dict) else {}
            if not isinstance(row.get("product_id"), int):
                raise ValidationError("Line %(i)s: enter a whole number.",
                                      code="invalid", params={"i": i})
            qty = row.get("qty")
            if not isinstance(qty, int) or qty < 1:
                raise ValidationError("Line %(i)s: enter a number 1 or greater.",
                                      code="min_value", params={"i": i})
        return rows

    def order(self):
        """The order, once the form has said the body is one."""
        return d.price_order(self.cleaned_data["customer_id"],
                             self.cleaned_data["status"], self.cleaned_data["lines"])


# rb:wiring body.*,domain.*
def validated(request):
    """The order, or Refused carrying what the form put in form.errors.

    Django reports its own codes -- required, invalid, min_value -- so nothing here
    translates them into this repository's vocabulary.
    """
    form = OrderForm(body_of(request))
    if form.is_valid():
        return form.order()
    raise Refused([{"field": field, "rule": e.code}
                   for field, errs in form.errors.as_data().items() for e in errs])



async def small(_):
    return JsonResponse(d.payload("small"))


# ---- failures ------------------------------------------------------------------------
#
# Views raise and never build a 404 or a 422 themselves, so the six Python targets cannot
# drift.

FAILURES = {
    d.NotFound: lambda exc: JsonResponse(d.not_found_body(), status=404),
    Refused: lambda exc: JsonResponse(refused_body(exc.errors), status=422),
    d.Malformed: lambda exc: JsonResponse(not_bound_body(exc.detail), status=400),
}


# rb:wiring errors.*
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


# rb:handler errors.unmatched
# Sync, unlike every other view here: Django resolves the error handler off the event loop
# and does not await what it returns, so a coroutine would reach the client as a 500.
# rb:wiring errors.*
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


# rb:wiring json.*,parameters.*,headers.*,middleware.*,authorized.*
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


# ---- query: a django.forms.Form over request.GET -------------------------------------
#
# Django's binder is the same facility as its validator: a Form declares its fields, and
# is_valid() runs each field's to_python over the values the router parsed. cleaned_data is
# what comes out, typed, and is what the arm answers.
#
# The fields are required, which is Django's default and what makes a missing parameter an
# error rather than a None the view has to decide about. A value the field cannot convert
# is refused the same way a body is, in Django's own vocabulary, because it is the same
# facility refusing.


# rb:wiring query.*
class QueryOneForm(forms.Form):
    page = forms.IntegerField()


# rb:wiring query.*
class QueryManyForm(forms.Form):
    page = forms.IntegerField()
    size = forms.IntegerField()
    status = forms.CharField()
    category = forms.CharField()
    sort = forms.CharField()
    q = forms.CharField()
    min_price = forms.IntegerField()
    max_price = forms.IntegerField()


# rb:wiring domain.*
class OrderFilterForm(forms.Form):
    """What domain.filter pages by."""

    page = forms.IntegerField()
    size = forms.IntegerField()
    status = forms.CharField()


# rb:wiring query.*,domain.*
def bound(form_class, request):
    """The query as the form typed it, or Refused carrying what it put in form.errors."""
    form = form_class(request.GET)
    if form.is_valid():
        return form.cleaned_data
    raise Refused([{"field": field, "rule": e.code}
                   for field, errs in form.errors.as_data().items() for e in errs])


@require_GET
async def query_one(request):
    return JsonResponse(bound(QueryOneForm, request))


@require_GET
async def query_many(request):
    return JsonResponse(bound(QueryManyForm, request))


# ---- middleware: one view decorator per layer ----------------------------------------

# rb:wiring middleware.*
def noop(view):
    """One layer: it calls the next and does nothing else."""
    async def layer(request, *args, **kwargs):
        return await view(request, *args, **kwargs)
    return layer


# rb:wiring middleware.*
def layered(view, n):
    for _ in range(n):
        view = noop(view)
    return require_GET(view)


# ---- authorized: a view decorator, not an if in the handler --------------------------

# rb:wiring authorized.*
def require_token(view):
    async def guard(request, *args, **kwargs):
        if not d.token_ok(request.headers.get("authorization")):
            return JsonResponse(d.forbidden_body(), status=403)
        return await view(request, *args, **kwargs)
    return require_GET(guard)


# ---- compressed: Django's own per-view gzip ------------------------------------------

# rb:wiring compressed.*
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


# ---- etag: ConditionalGetMiddleware, scoped to the view ------------------------------
#
# The middleware hashes the response Django is about to send, writes the ETag when there is
# none, and answers if-none-match with an HttpResponseNotModified, so nothing here compares
# anything. Django's own decorator_from_middleware is what scopes it: as a MIDDLEWARE entry
# it would hash every response in the blend and contaminate the rows these subtract.
#
# The 304 it builds carries the six headers RFC 9110 15.4.5 names and drops the rest, so
# x-rb-serial does not survive it. That arm proves itself with its status instead: a target
# that ignored the conditional request answers 200 with a body.

# rb:wiring etag.*
revalidates = decorator_from_middleware(ConditionalGetMiddleware)


# rb:wiring etag.*
def etag_view(size):
    @require_GET
    @revalidates
    async def view(_):
        response = JsonResponse(d.payload(size))
        response["cache-control"] = d.CACHEABLE
        response["x-rb-serial"] = d.next_serial()
        return response
    return view


# ---- cache: cache_page, which is Django's own response cache --------------------------
#
# cache_page stores the whole response under a key built from the path and the request
# headers named in the response's Vary, and replays it without entering the view.
# vary_on_headers is what puts those names there, which is Django's own way to say what a
# row is keyed on. The store is the locmem backend, capped from the fixture: the capacity
# derived from the key count means what it says only if there is one store to count against.

# rb:wiring cache.*
def cache_view(size, vary=()):
    @require_GET
    async def view(_):
        return JsonResponse(d.payload(size),
                            headers={"x-rb-serial": d.next_serial()})
    if vary:
        view = vary_on_headers(*vary)(view)
    return cache_page(d.cache_spec()["ttl_s"])(view)


# ---- body ----------------------------------------------------------------------------
#
# bind parses and binds without validating, so validate minus bind is the validator alone
# rather than the validator plus the parse.

@require_POST
async def bind(request):
    return JsonResponse(d.bind_echo(body_of(request)))


@require_POST
async def validate_all(request):
    return JsonResponse(validated(request))


# A Form collects every error and offers no way to stop at the first, so this row answers
# what the form answers. The gap to body.rejected_all is what Django costs rather than the
# same walk written twice.
@require_POST
async def validate_first(request):
    return JsonResponse(validated(request))


# ---- domain --------------------------------------------------------------------------

class Orders(View):
    """One path, two methods. Django's router matches on path alone, so the method split is
    the view's -- which is what a class-based view is for."""

    async def get(self, request):
        q = bound(OrderFilterForm, request)
        return JsonResponse(d.domain_filter(q["page"], q["size"], q["status"]))

    async def post(self, request):
        out = validated(request)
        return JsonResponse(out, status=201,
                            headers={"location": d.created_location()})


class Order(View):
    async def get(self, _, oid):
        return JsonResponse(d.get_order(oid))

    async def put(self, request, oid):
        existing = d.get_order(oid)
        return JsonResponse({"id": existing["id"], **validated(request)})


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
        # A 204 carries no body, so it declares no type. Django sets one from
        # DEFAULT_CONTENT_TYPE whatever the status is.
        response = HttpResponse(status=204)
        del response["content-type"]
        return response


# ---- template: Django's own view facility --------------------------------------------
#
# render() finds the template through the TEMPLATES setting and writes the response, so no
# view calls a render function. Django is the one Python target here that does not render
# with Jinja2: its own engine is the Django template language, and that is what its
# tutorial and its documentation use.

# rb:wiring template.*
def template_view(size):
    @require_GET
    async def view(request):
        return render(request, "items.html", d.payload(size))
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
    # rb:handler etag.match_large,etag.stale_large
    path("etag/small", etag_view("small")),
    path("etag/large", etag_view("large")),
    path("cache/small", cache_view("small")),
    path("cache/medium", cache_view("medium")),
    path("cache/large", cache_view("large")),
    path("cache/vary/one", cache_view("small", d.vary_on("one"))),
    path("cache/vary/many", cache_view("small", d.vary_on("many"))),
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
