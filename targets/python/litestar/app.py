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

import uvicorn
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
from litestar.response import Template
from litestar.plugins.jinja import JinjaTemplateEngine
from litestar.template.config import TemplateConfig
from litestar.types import ASGIApp, Receive, Scope, Send

from _hosts import host
from _shared import domain as d


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


@dataclass
class LineIn:
    product_id: int
    qty: Annotated[int, Meta(ge=1)]


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
                 template="jinja2 " + host.dist_version("jinja2"))


# ---- middleware and guards -----------------------------------------------------------

class Noop:
    """One layer: it calls the next and does nothing else."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        await self.app(scope, receive, send)


def layers(n):
    return [Noop for _ in range(n)]


def require_token(connection: ASGIConnection, _: BaseRouteHandler) -> None:
    """A guard, which is Litestar's own authorization facility. An ``if`` in the handler
    would measure the language; the point of the authorized family is the plumbing."""
    if not d.token_ok(connection.headers.get("authorization")):
        raise PermissionDeniedException()


# Threshold and level are the pinned ones rather than Litestar's defaults. Whether a
# framework bothers to compress a body too small to benefit is what compressed.gzip_small
# is in the set to show, so the floor has to be the same floor everywhere or the row
# reports a default instead.
gzip_scoped = [DefineMiddleware(
    CompressionMiddleware,
    config=CompressionConfig(backend="gzip", gzip_compress_level=d.GZIP_LEVEL,
                             minimum_size=d.GZIP_MIN_SIZE),
)]


def validators(size):
    return {"etag": d.etag_of(size), "cache-control": d.CACHEABLE,
            "x-rb-serial": d.next_serial()}


def conditional(request: Request, size: str) -> Response:
    """Sets the validators and answers the conditional. The ETag is pinned in the fixture,
    so what this measures is emitting the header and comparing it rather than hashing a
    body.

    The comparison requires a non-empty header: matching a missing if-none-match against an
    empty ETag answers 304 to a client that never asked a conditional question.
    """
    headers = validators(size)
    if request.headers.get("if-none-match") == headers["etag"]:
        return Response(None, status_code=304, headers=headers)
    return Response(d.payload(size), headers=headers)


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


@get("/parameters/{one:str}")
async def parameters_one() -> dict:
    return d.payload("small")


@get("/parameters/{one:str}/with-second/{two:str}")
async def parameters_two() -> dict:
    return d.payload("small")


# The framework parses the query string, which is the work this family is here to measure;
# the domain coerces what it parsed, so all six targets answer the same values.
@get("/query/one")
async def query_one(request: Request) -> dict:
    return d.coerce_one(request.query_params)


@get("/query/many")
async def query_many(request: Request) -> dict:
    return d.coerce_many(request.query_params)


# The handler reads no header at all, so headers.many minus headers.few is the cost of
# materialising 27 nobody asked for.
@get("/headers")
async def headers() -> dict:
    return d.payload("small")


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


@get("/cached/small")
async def cached_small(request: Request) -> Response:
    return conditional(request, "small")


@get("/cached/medium")
async def cached_medium(request: Request) -> Response:
    return conditional(request, "medium")


@get("/cached/large")
async def cached_large(request: Request) -> Response:
    return conditional(request, "large")


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
async def domain_orders(request: Request) -> dict:
    return d.domain_filter(request.query_params)


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

def not_found(_: Request, __: Exception) -> Response:
    return Response(d.not_found_body(), status_code=404)


def forbidden(_: Request, __: Exception) -> Response:
    return Response(d.forbidden_body(), status_code=403)


# Litestar raises ValidationException for a body msgspec could not decode and for one it
# decoded and then refused alike, and answers 400 for both. Its own envelope carries the
# status, its own wording and the detail msgspec gave it, so it is passed through rather
# than rewritten. NotFoundException and PermissionDeniedException are also ClientExceptions,
# and their own handlers win because Litestar resolves along the MRO.
def client_error(_: Request, exc: ClientException) -> Response:
    """Anything else Litestar refused before a handler ran."""
    return Response({"status_code": exc.status_code, "detail": exc.detail},
                    status_code=exc.status_code)


def invalid(_: Request, exc: ValidationException) -> Response:
    return Response({"status_code": 400, "detail": exc.detail,
                     "extra": exc.extra}, status_code=400)


# rb:snippet errors.unmatched
app = Litestar(
    route_handlers=[
        plaintext, health, meta,
        json_small, json_medium, json_large,
        parameters_static, parameters_one, parameters_two,
        query_one, query_many, headers,
        middleware_none, middleware_four, middleware_sixteen,
        authorized_small,
        compressed_small, compressed_medium, compressed_large,
        cached_small, cached_medium, cached_large,
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
    template_config=TemplateConfig(
        directory=pathlib.Path(__file__).resolve().parent / "templates",
        engine=JinjaTemplateEngine,
    ),
)


def serve():
    uvicorn.run(app, host="0.0.0.0", port=host.boot("litestar"),
                log_level="warning", access_log=False)
