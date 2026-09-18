"""RequestBench target: Litestar. Framework wiring only; behaviour from _shared/domain.py.

Every feature family uses Litestar's own facility -- handler middleware, a guard, its
compression middleware -- rather than an ``if`` in the handler, and each one is scoped to
its own routes. Compression configured on the application would put a "did the client
ask?" check on all forty-five endpoints and contaminate the rows the compressed family is
measured against, which is the whole reason those rows have their own paths instead of
riding on /json with an accept-encoding header.

Litestar writes a path parameter as ``{oid:str}``: the type is part of the syntax, not an
annotation this repository added.
"""
import pathlib

from litestar import Litestar, MediaType, Request, Response, delete, get, patch, post, put
from litestar.config.compression import CompressionConfig
from litestar.connection import ASGIConnection
from dataclasses import dataclass
from typing import Annotated

from msgspec import Meta

from litestar.exceptions import (ClientException, NotFoundException,
                                 PermissionDeniedException, ValidationException)
from litestar.handlers.base import BaseRouteHandler
from litestar.middleware import DefineMiddleware
from litestar.middleware.compression import CompressionMiddleware
from litestar.params import FromPath, HeaderParameter
from litestar.response import Template
from litestar.plugins.jinja import JinjaTemplateEngine
from litestar.template.config import TemplateConfig
from litestar.types import ASGIApp, Receive, Scope, Send

from litestar.config.response_cache import ResponseCacheConfig

from _hosts import host
from _shared import domain as d
from _shared.asgi import ConditionalGet

# rb:wiring cache.*
#: Well past the roughly 600s a target is up for, so no key expires inside the run. The
#: store Litestar ships is unbounded, which clears the capacity the fixture derives from
#: the key count without having to be told it.
CACHE_TTL = d.cache_spec()["ttl_s"]


# ---- validation: a typed data parameter, decoded and checked by msgspec --------------
#
# Declaring the parameter's type is the whole wiring. Litestar builds a msgspec decoder
# from the annotation at import and runs it before the handler, so a body that does not
# fit never reaches one. These routes used to take `data: dict`, which made msgspec a
# parser and nothing more.
#
# msgspec stops at the first field it cannot decode and reports that one, which is why the
# first-error row and the collect-all row are the same answer here.
#
# It lives here rather than in a sibling module because _hosts/container.py loads a target
# by file path, and this directory is named after the package it measures.


# rb:wiring body.*,domain.*
@dataclass
class LineIn:
    product_id: int
    qty: Annotated[int, Meta(ge=1)]


# rb:wiring body.*,domain.*
@dataclass
class OrderIn:
    customer_id: int
    status: str
    lines: Annotated[list[LineIn], Meta(min_length=1)]

    def order(self) -> dict:
        """The order, once msgspec has said the body is one."""
        return d.price_order(
            self.customer_id, self.status,
            [{"product_id": line.product_id, "qty": line.qty} for line in self.lines],
        )

META = host.meta("litestar", adapter="uvicorn",
                 template="jinja2 " + host.dist_version("jinja2"),
                 etag="sha1 (litestar emits a validator, it does not compare one)",
                 cache="litestar response cache, MemoryStore")


# ---- middleware and guards -----------------------------------------------------------

# rb:wiring middleware.*
class Noop:
    """One layer: it calls the next and does nothing else."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        await self.app(scope, receive, send)


# rb:wiring middleware.*
def layers(n):
    return [Noop for _ in range(n)]


# rb:wiring authorized.*
def require_token(connection: ASGIConnection, _: BaseRouteHandler) -> None:
    """A guard, which is Litestar's own authorization facility. An ``if`` in the handler
    would measure the language; the point of the authorized family is the plumbing."""
    if not d.token_ok(connection.headers.get("authorization")):
        raise PermissionDeniedException()


# rb:wiring compressed.*
# Threshold and level are the pinned ones rather than Litestar's defaults. Whether a
# framework bothers to compress a body too small to benefit is what compressed.gzip_small
# is in the set to show, so the floor has to be the same floor everywhere or the row
# reports a default instead.
gzip_scoped = [DefineMiddleware(
    CompressionMiddleware,
    config=CompressionConfig(backend="gzip", gzip_compress_level=d.GZIP_LEVEL,
                             minimum_size=d.GZIP_MIN_SIZE),
)]


# ---- etag and cache: middleware on the handler, and Litestar's own response cache -----
#
# Litestar's ETag datastructure emits a value the handler already knows, and nothing in it
# answers if-none-match for a dynamic response: only FileResponse does. So the conditional
# is the shared ASGI middleware, attached to the handler, which is Litestar's own scoping
# and the same way the compressed rows get theirs. The digest is declared in /__meta.
#
# The response cache is Litestar's, configured on the application and opted into per handler
# with cache=. cache_key_builder is what folds a vary row's header values into the key, and
# because it is the handler's own it does not have to be one builder for every route.

# rb:wiring etag.*
conditional_scoped = [DefineMiddleware(ConditionalGet)]


def keyed_on(names):
    """A key built from the path and the named headers, for one vary row."""
    def build(request: Request) -> str:
        return "|".join([request.url.path,
                         *(request.headers.get(n, "") for n in names)])
    return build


# ---- baseline, json, parameters, query, headers --------------------------------------

@get("/plaintext", media_type=MediaType.TEXT)
async def plaintext() -> str:
    return "Hello, World!"


@get("/health", media_type=MediaType.TEXT)
async def health() -> str:
    return "ok"


@get("/__meta")
async def meta() -> dict:
    return META


# The three sizes are static routes, not /json/{size:str}. The size set is fixed, so a
# capture would make the router pay parameter cost on the family every other target serves
# from a static route, and it would answer 200 with an empty body for a size that does not
# exist.
@get("/json/small")
async def json_small() -> dict:
    return d.payload("small")


@get("/json/medium")
async def json_medium() -> dict:
    return d.payload("medium")


@get("/json/large")
async def json_large() -> dict:
    return d.payload("large")


@get("/parameters/static/segment/literal")
async def parameters_static() -> dict:
    return d.payload("small")


# FromPath is how the pinned Litestar declares a path parameter. The bare `oid: str` style the
# domain routes use is deprecated.
@get("/parameters/{one:int}/segment/literal")
async def parameters_one(one: FromPath[int]) -> dict:
    return d.with_echo("small", {"one": one})


@get("/parameters/{one:int}/with-second/{two:int}")
async def parameters_two(one: FromPath[int], two: FromPath[int]) -> dict:
    return d.with_echo("small", {"one": one, "two": two})


# Declared parameters, which is how Litestar binds a query: the annotation is the binding,
# and msgspec coerces the string the router parsed into it before the handler runs. The
# default is what a missing parameter is; a value msgspec cannot coerce is a
# ValidationException, which is Litestar's own 400.
@get("/query/one")
async def query_one(page: int = 0) -> dict:
    return {"page": page}


@get("/query/many")
async def query_many(page: int = 0, size: int = 0, status: str = "", category: str = "",
                     sort: str = "", q: str = "", min_price: int = 0,
                     max_price: int = 0) -> dict:
    return {"page": page, "size": size, "status": status, "category": category,
            "sort": sort, "q": q, "min_price": min_price, "max_price": max_price}


# The handler reads no header at all. headers.many sends 30 request headers and headers.few
# sends 5, so the difference is the cost of materialising 25 that nobody asked for.
@get("/headers")
async def headers() -> dict:
    return d.payload("small")


# HeaderParameter names the header, because a Python parameter cannot spell x-rb-tenant.
# msgspec converts x-rb-account to an int before the handler runs. The default is what a
# missing header is.
@get("/headers/bind")
async def headers_bind(
        tenant: Annotated[str, HeaderParameter(name="x-rb-tenant")] = "",
        request_id: Annotated[str, HeaderParameter(name="x-rb-request-id")] = "",
        account: Annotated[int, HeaderParameter(name="x-rb-account")] = 0) -> dict:
    return d.with_echo("small", {"tenant": tenant, "request_id": request_id,
                                 "account": account})


@get("/middleware/none")
async def middleware_none() -> dict:
    return d.payload("small")


@get("/middleware/four", middleware=layers(4))
async def middleware_four() -> dict:
    return d.payload("small")


@get("/middleware/sixteen", middleware=layers(16))
async def middleware_sixteen() -> dict:
    return d.payload("small")


@get("/authorized/small", guards=[require_token])
async def authorized_small() -> dict:
    return d.payload("small")


# ---- compressed and cached -----------------------------------------------------------

@get("/compressed/small", middleware=gzip_scoped)
async def compressed_small() -> Response:
    return Response(d.payload("small"), headers={"x-rb-serial": d.next_serial()})


@get("/compressed/medium", middleware=gzip_scoped)
async def compressed_medium() -> Response:
    return Response(d.payload("medium"), headers={"x-rb-serial": d.next_serial()})


@get("/compressed/large", middleware=gzip_scoped)
async def compressed_large() -> Response:
    return Response(d.payload("large"), headers={"x-rb-serial": d.next_serial()})


# rb:handler etag.*
@get("/etag/small", middleware=conditional_scoped)
async def etag_small() -> Response:
    return Response(d.payload("small"), headers={
        "cache-control": d.CACHEABLE, "x-rb-serial": d.next_serial()})


@get("/etag/large", middleware=conditional_scoped)
async def etag_large() -> Response:
    return Response(d.payload("large"), headers={
        "cache-control": d.CACHEABLE, "x-rb-serial": d.next_serial()})


# rb:handler cache.small,cache.medium,cache.large
@get("/cache/small", cache=CACHE_TTL)
async def cache_small() -> Response:
    return Response(d.payload("small"), headers={"x-rb-serial": d.next_serial()})


@get("/cache/medium", cache=CACHE_TTL)
async def cache_medium() -> Response:
    return Response(d.payload("medium"), headers={"x-rb-serial": d.next_serial()})


@get("/cache/large", cache=CACHE_TTL)
async def cache_large() -> Response:
    return Response(d.payload("large"), headers={"x-rb-serial": d.next_serial()})


# rb:handler cache.vary_one,cache.vary_many
@get("/cache/vary/one", cache=CACHE_TTL, cache_key_builder=keyed_on(d.vary_on("one")))
async def cache_vary_one() -> Response:
    return Response(d.payload("small"), headers={
        "vary": ", ".join(d.vary_on("one")), "x-rb-serial": d.next_serial()})


@get("/cache/vary/many", cache=CACHE_TTL, cache_key_builder=keyed_on(d.vary_on("many")))
async def cache_vary_many() -> Response:
    return Response(d.payload("small"), headers={
        "vary": ", ".join(d.vary_on("many")), "x-rb-serial": d.next_serial()})


# ---- body ----------------------------------------------------------------------------
#
# Litestar binds the request body itself, so a body that is not JSON fails inside the
# framework rather than in the domain. bind parses and binds without validating, so validate
# minus bind is the validator alone rather than the validator plus the parse.

@post("/body/bind/small", status_code=200)
async def bind_small(data: dict) -> dict:
    return d.bind_echo(data)


@post("/body/bind/medium", status_code=200)
async def bind_medium(data: dict) -> dict:
    return d.bind_echo(data)


@post("/body/validate/small", status_code=200)
async def validate_small(data: OrderIn) -> dict:
    return data.order()


@post("/body/validate/medium", status_code=200)
async def validate_medium(data: OrderIn) -> dict:
    return data.order()


# msgspec reports the first field it could not decode and offers no collect-all mode, so
# this row answers what Litestar answers.
@post("/body/validate/first-error", status_code=200)
async def validate_first(data: OrderIn) -> dict:
    return data.order()


# ---- domain --------------------------------------------------------------------------

@get("/domain/orders")
async def domain_orders(page: int = 0, size: int = 0, status: str = "") -> dict:
    return d.domain_filter(page, size, status)


@post("/domain/orders")
async def create_order(data: OrderIn) -> Response:
    return Response(data.order(), status_code=201,
                    headers={"location": d.created_location()})


@get("/domain/orders/{oid:str}")
async def lookup_order(oid: str) -> dict:
    return d.get_order(oid)


@put("/domain/orders/{oid:str}")
async def replace_order(oid: str, data: OrderIn) -> dict:
    existing = d.get_order(oid)
    return {"id": existing["id"], **data.order()}


@get("/domain/customers/{cid:str}/summary")
async def customer_summary(cid: str) -> dict:
    return d.domain_join(cid)


@get("/domain/regions/{region:str}/report")
async def region_report(region: str) -> dict:
    return d.domain_aggregate(region)


@patch("/domain/customers/{cid:str}", status_code=200)
async def patch_customer(cid: str, data: dict) -> dict:
    return d.patch_customer(cid, data)


@delete("/domain/orders/{oid:str}/lines/{lid:str}")
async def delete_line(oid: str, lid: str) -> None:
    d.get_order_line(oid, lid)


# ---- template: Litestar's own view facility ------------------------------------------
#
# A TemplateConfig on the app holds the engine, and returning a Template names a file
# rather than calling a render function. JinjaTemplateEngine is the engine Litestar's own
# templating docs lead with and the one litestar[standard] installs. Compiled on first
# render and cached by the engine: a precomputed string would measure nothing.

@get("/template/small", media_type=MediaType.HTML)
async def template_small() -> Template:
    return Template(template_name="items.html", context=d.payload("small"))


@get("/template/medium", media_type=MediaType.HTML)
async def template_medium() -> Template:
    return Template(template_name="items.html", context=d.payload("medium"))


# ---- failures ------------------------------------------------------------------------
#
# Handlers raise and never build a 404 or a 422 themselves, so the six Python targets cannot
# drift. The router's own miss arrives here as a NotFoundException, which is what gives
# errors.unmatched the same body as errors.not_found.

# rb:wiring errors.*
def not_found(_: Request, __: Exception) -> Response:
    return Response(d.not_found_body(), status_code=404)


def forbidden(_: Request, __: Exception) -> Response:
    return Response(d.forbidden_body(), status_code=403)


# rb:wiring errors.*
# Litestar raises ValidationException for a body msgspec could not decode and for one it
# decoded and then refused alike, and answers 400 for both. Its own envelope carries the
# status, its own wording and the detail msgspec gave it, so it is passed through rather
# than rewritten. NotFoundException and PermissionDeniedException are also ClientExceptions,
# and their own handlers win because Litestar resolves along the MRO.
def client_error(_: Request, exc: ClientException) -> Response:
    """Anything else Litestar refused before a handler ran."""
    return Response({"status_code": exc.status_code, "detail": exc.detail},
                    status_code=exc.status_code)


# rb:wiring errors.*,body.*
def invalid(_: Request, exc: ValidationException) -> Response:
    return Response({"status_code": 400, "detail": exc.detail,
                     "extra": exc.extra}, status_code=400)


# rb:handler errors.unmatched
app = Litestar(
    route_handlers=[
        plaintext, health, meta,
        json_small, json_medium, json_large,
        parameters_static, parameters_one, parameters_two,
        query_one, query_many, headers,
        headers_bind,
        middleware_none, middleware_four, middleware_sixteen,
        authorized_small,
        compressed_small, compressed_medium, compressed_large,
        etag_small, etag_large,
        cache_small, cache_medium, cache_large, cache_vary_one, cache_vary_many,
        bind_small, bind_medium, validate_small, validate_medium, validate_first,
        domain_orders, create_order, lookup_order, replace_order,
        customer_summary, region_report, patch_customer, delete_line,
        template_small, template_medium,
    ],
    exception_handlers={
        NotFoundException: not_found,
        PermissionDeniedException: forbidden,
        # ValidationException is itself a ClientException. Litestar resolves along the MRO,
        # so the more specific one has to be registered for the body failures to reach it.
        ValidationException: invalid,
        ClientException: client_error,
        d.NotFound: not_found,
    },
    openapi_config=None,
    response_cache_config=ResponseCacheConfig(default_expiration=CACHE_TTL),
    # rb:wiring template.*
    template_config=TemplateConfig(
        directory=pathlib.Path(__file__).resolve().parent / "templates",
        engine=JinjaTemplateEngine,
    ),
)


def serve():
    host.run_uvicorn(app, host="0.0.0.0", port=host.boot("litestar"),
                     log_level="warning", access_log=False)
