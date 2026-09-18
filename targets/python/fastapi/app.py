"""RequestBench target: FastAPI. Framework wiring only; behaviour from _shared/domain.py.

Every feature family here uses FastAPI's own facility rather than an ``if`` in the handler,
and each one is scoped to its own routes. Compression added to the application would put a
"did the client ask?" check on all forty-five endpoints and contaminate the rows the
compressed family is measured against, which is the whole reason those rows have their own
paths instead of riding on /json with an accept-encoding header.

Two of those facilities are worth naming, because FastAPI has no route-scoped middleware
and the substitutes are what the numbers describe:

  middleware  A dependency list on the route. Dependencies are what FastAPI composes
              per-route layers out of, and `dependencies=[Depends(noop)] * n` is how a
              reader of the documentation would add n of them.
  compressed  A mounted sub-application carrying GZipMiddleware. Mounting is FastAPI's own
              way to scope middleware, and the extra dispatch it costs lands in
              compressed.identity_* -- which is the honest price of not taxing the other
              forty-two endpoints.
"""
import pathlib
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.gzip import GZipMiddleware

from cachetools import TTLCache

from _hosts import host
from _shared import domain as d
from _shared.asgi import ConditionalGet, ResponseCache


# ---- validation: a Pydantic model as the body parameter ------------------------------
#
# Declaring the parameter's type is the whole wiring. FastAPI builds a validator from the
# model at import, runs it before the handler, and raises RequestValidationError itself
# when the body does not fit, so no handler calls a validator. These routes used to take
# `body: dict`, which made Pydantic a parser and nothing more.
#
# Pydantic draws no line between a wrong type and a wrong value: both are entries in the
# same error list and both are a 422. A typed binder does the opposite, failing
# deserialization before any rule runs.
#
# It lives here rather than in a sibling module because _hosts/container.py loads a target
# by file path, and this directory is named after the package it measures.


# rb:wiring body.*,domain.*
class LineIn(BaseModel):
    product_id: int
    qty: int = Field(ge=1)


# rb:wiring body.*,domain.*
class OrderIn(BaseModel):
    customer_id: int
    status: str
    lines: list[LineIn] = Field(min_length=1)

    def order(self):
        """The order, once Pydantic has said the body is one."""
        return d.price_order(
            self.customer_id, self.status,
            [{"product_id": line.product_id, "qty": line.qty} for line in self.lines],
        )

# The documentation routes are off: they are three more entries in the router the
# benchmark never asks for, and /docs is not part of the endpoint set.
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

META = host.meta("fastapi", adapter="uvicorn",
                 template="jinja2 " + host.dist_version("jinja2"),
                 etag="sha1 (fastapi ships no conditional handling)",
                 cache="starlette middleware over cachetools "
                       + host.dist_version("cachetools"))


# rb:wiring parameters.*,headers.*,middleware.*,authorized.*,json.*
def small():
    return d.payload("small")


# ---- failures ------------------------------------------------------------------------
#
# Handlers raise and never build a 404 or a 422 themselves, so the six Python targets
# cannot drift. The router's own miss arrives here as an HTTPException, which is what
# gives errors.unmatched the same body as errors.not_found.

# rb:handler errors.unmatched
STATUS_BODY = {403: d.forbidden_body, 404: d.not_found_body}


@app.exception_handler(StarletteHTTPException)
# rb:wiring errors.*
async def http_error(_: Request, exc: StarletteHTTPException):
    body = STATUS_BODY.get(exc.status_code)
    return JSONResponse(body() if body else {"error": "internal"},
                        status_code=exc.status_code)


@app.exception_handler(d.NotFound)
# rb:wiring errors.*
async def not_found(_: Request, __: d.NotFound):
    return JSONResponse(d.not_found_body(), status_code=404)


# FastAPI raises this itself, for a body that will not parse and for one that parsed and
# did not fit the model alike. Pydantic draws no line between the two: both are entries in
# the same list, distinguished by their `type`, and both are a 422. The envelope is
# FastAPI's own, so it is passed through rather than rewritten.
@app.exception_handler(RequestValidationError)
# rb:wiring errors.*,body.*
async def invalid(_: Request, exc: RequestValidationError):
    return JSONResponse({"detail": jsonable_encoder(exc.errors())}, status_code=422)


# ---- baseline, json, parameters, query, headers --------------------------------------

@app.get("/plaintext", response_class=PlainTextResponse)
async def plaintext():
    return "Hello, World!"


@app.get("/health", response_class=PlainTextResponse)
async def health():
    return "ok"


@app.get("/__meta")
async def meta():
    return META


# The three sizes are static routes, not /json/{size}. The size set is fixed, so a capture
# would make the router pay parameter cost on the family every other target serves from a
# static route, and it would answer 200 with an empty body for a size that does not exist.
@app.get("/json/small")
async def json_small():
    return d.payload("small")


@app.get("/json/medium")
async def json_medium():
    return d.payload("medium")


@app.get("/json/large")
async def json_large():
    return d.payload("large")


@app.get("/parameters/static/segment/literal")
async def parameters_static():
    return small()


# FastAPI tries routes in the order they were registered, and {one} matches "static" before
# the int is checked. So the static route above has to stay first.
@app.get("/parameters/{one}/segment/literal")
async def parameters_one(one: int):
    return d.with_echo("small", {"one": one})


@app.get("/parameters/{one}/with-second/{two}")
async def parameters_two(one: int, two: int):
    return d.with_echo("small", {"one": one, "two": two})


# Declared parameters, which is FastAPI's whole query story: the annotation is the binding,
# and Pydantic coerces the string the router parsed into it before the handler runs. The
# default is what a missing parameter is; a value Pydantic cannot coerce is a
# RequestValidationError, which the handler above answers with FastAPI's own 422 envelope.
@app.get("/query/one")
async def query_one(page: int = 0):
    return d.with_echo("small", {"page": page})


@app.get("/query/many")
async def query_many(page: int = 0, size: int = 0, status: str = "", category: str = "",
                     sort: str = "", q: str = "", min_price: int = 0, max_price: int = 0):
    return d.with_echo("small", {"page": page, "size": size, "status": status,
                                 "category": category, "sort": sort, "q": q,
                                 "min_price": min_price, "max_price": max_price})


# The handler reads no header at all. headers.many sends 30 request headers and headers.few
# sends 5, so the difference is the cost of materialising 25 that nobody asked for.
@app.get("/headers")
async def headers():
    return small()


# Header() on a typed parameter is the binding. FastAPI reads the header named like the
# parameter, with hyphens for underscores. Pydantic coerces x-rb-account to an int before the
# handler runs. The default is what a missing header is.
@app.get("/headers/bind")
async def headers_bind(x_rb_tenant: Annotated[str, Header()] = "",
                       x_rb_request_id: Annotated[str, Header()] = "",
                       x_rb_account: Annotated[int, Header()] = 0):
    return d.with_echo("small", {"tenant": x_rb_tenant, "request_id": x_rb_request_id,
                                 "account": x_rb_account})


# ---- middleware: a dependency per layer, scoped to the route -------------------------

# rb:wiring middleware.*
async def noop():
    """One layer: it is resolved and does nothing else."""


# rb:wiring middleware.*
def layers(n):
    return [Depends(noop) for _ in range(n)]


@app.get("/middleware/none")
async def middleware_none():
    return small()


@app.get("/middleware/four", dependencies=layers(4))
async def middleware_four():
    return small()


@app.get("/middleware/sixteen", dependencies=layers(16))
async def middleware_sixteen():
    return small()


# ---- authorized: a route dependency, not an if in the handler ------------------------

# rb:wiring authorized.*
async def require_token(request: Request):
    if not d.token_ok(request.headers.get("authorization")):
        raise HTTPException(status_code=403)


@app.get("/authorized/small", dependencies=[Depends(require_token)])
async def authorized_small():
    return small()


# ---- compressed: GZipMiddleware on a mounted sub-application -------------------------

# rb:wiring compressed.*
# The size floor is Starlette's own default. Whether a framework bothers to compress a body
# too small to benefit is what compressed.gzip_small is in the set to show.
gzipped = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
gzipped.add_middleware(GZipMiddleware, compresslevel=1)
# rb:end


# rb:wiring compressed.*
def compressed_route(size):
    async def handler(response: Response):
        response.headers["x-rb-serial"] = d.next_serial()
        return d.payload(size)
    return handler


# rb:handler compressed.*
for _size in ("small", "medium", "large"):
    gzipped.add_api_route("/" + _size, compressed_route(_size), methods=["GET"])

# rb:wiring compressed.*
app.mount("/compressed", gzipped)


# ---- etag: the conditional middleware on a mounted sub-application --------------------
#
# FastAPI ships no conditional-request handling and neither does Starlette under it: nothing
# in either computes a validator for a dynamic response or answers if-none-match. So the
# digest is the shared one, declared in /__meta, and what is FastAPI's own is the scoping --
# a mounted sub-application, the same way the compressed family gets its middleware without
# putting a hash on the other rows.

conditional = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
conditional.add_middleware(ConditionalGet)


# rb:wiring etag.*
def etag_route(size):
    async def handler(response: Response):
        response.headers["cache-control"] = d.CACHEABLE
        response.headers["x-rb-serial"] = d.next_serial()
        return d.payload(size)
    return handler


# rb:handler etag.*
for _size in ("small", "large"):
    conditional.add_api_route("/" + _size, etag_route(_size), methods=["GET"])

app.mount("/etag", conditional)


# ---- cache: the response cache on one mounted sub-application ------------------------
#
# One sub-application for the whole family, so there is one store and the capacity the
# fixture derives from the key count means what it says. The header names a route is keyed
# on are middleware configuration rather than something a handler decides, which is why the
# middleware takes the map rather than the routes taking a decorator.

# rb:wiring cache.*
VARY = {"/cache/vary/" + which: d.vary_on(which) for which in ("one", "many")}

cached = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
cached.add_middleware(
    ResponseCache,
    store=TTLCache(maxsize=d.cache_spec()["capacity"], ttl=d.cache_spec()["ttl_s"]),
    vary=VARY,
)


# rb:wiring cache.*
def cache_route(size, vary=()):
    async def handler(response: Response):
        if vary:
            response.headers["vary"] = ", ".join(vary)
        response.headers["x-rb-serial"] = d.next_serial()
        return d.payload(size)
    return handler


# rb:handler cache.small,cache.medium,cache.large
for _size in ("small", "medium", "large"):
    cached.add_api_route("/" + _size, cache_route(_size), methods=["GET"])
# rb:handler cache.vary_one,cache.vary_many
for _which in ("one", "many"):
    _on = d.vary_on(_which)
    cached.add_api_route("/vary/" + _which, cache_route("small", _on), methods=["GET"])

app.mount("/cache", cached)


# ---- body: bind, validate, and the two rejection contracts ---------------------------
#
# bind parses and binds without validating, so validate minus bind is the validator alone
# rather than the validator plus the parse.

@app.post("/body/bind/small")
async def bind_small(body: dict):
    return d.bind_echo(body)


@app.post("/body/bind/medium")
async def bind_medium(body: dict):
    return d.bind_echo(body)


# The parameter's type is the wiring: FastAPI validates against the model before the
# handler runs, so a body that does not fit never reaches one.
@app.post("/body/validate/small")
async def validate_small(body: OrderIn):
    return body.order()


@app.post("/body/validate/medium")
async def validate_medium(body: OrderIn):
    return body.order()


# Pydantic collects every error and offers no way to stop at the first, so this row answers
# what Pydantic answers. The gap to body.rejected_all is what FastAPI costs rather than the
# same walk written twice.
@app.post("/body/validate/first-error")
async def validate_first(body: OrderIn):
    return body.order()


# ---- domain --------------------------------------------------------------------------

@app.get("/domain/orders")
async def domain_orders(page: int = 0, size: int = 0, status: str = ""):
    return d.domain_filter(page, size, status)


@app.post("/domain/orders", status_code=201)
async def create_order(body: OrderIn, response: Response):
    out = body.order()
    response.headers["location"] = d.created_location()
    return out


@app.get("/domain/orders/{oid}")
async def lookup_order(oid: str):
    return d.get_order(oid)


@app.put("/domain/orders/{oid}")
async def replace_order(oid: str, body: OrderIn):
    existing = d.get_order(oid)
    return {"id": existing["id"], **body.order()}


@app.get("/domain/customers/{cid}/summary")
async def customer_summary(cid: str):
    return d.domain_join(cid)


@app.get("/domain/regions/{region}/report")
async def region_report(region: str):
    return d.domain_aggregate(region)


@app.patch("/domain/customers/{cid}")
async def patch_customer(cid: str, body: dict):
    return d.patch_customer(cid, body)


# response_class, because FastAPI's default is JSONResponse and that declares a
# content-type on a response that by definition has no body.
@app.delete("/domain/orders/{oid}/lines/{lid}", status_code=204, response_class=Response)
async def delete_line(oid: str, lid: str):
    d.get_order_line(oid, lid)


# ---- template: FastAPI's own view facility -------------------------------------------
#
# fastapi.templating.Jinja2Templates is what FastAPI ships for server-side rendering, and
# TemplateResponse is what reaches it. The handler takes a Request because that is the
# signature Jinja2Templates requires, not because it reads anything from it. Compiled on
# first render and cached by the environment: a precomputed string would measure nothing.

# rb:wiring template.*
templates = Jinja2Templates(
    directory=str(pathlib.Path(__file__).resolve().parent / "templates"))


# rb:wiring template.*
# A copy of the payload, not the payload. Jinja2Templates inserts the request into the
# context it is handed, and d.payload returns the fixture object the json family
# serializes, so rendering once put a request key in every json.* body until this copied.
TEMPLATE_MODELS = {size: dict(d.payload(size)) for size in ("small", "medium")}


@app.get("/template/small", response_class=HTMLResponse)
async def template_small(request: Request):
    return templates.TemplateResponse(request, "items.html", TEMPLATE_MODELS["small"])


@app.get("/template/medium", response_class=HTMLResponse)
async def template_medium(request: Request):
    return templates.TemplateResponse(request, "items.html", TEMPLATE_MODELS["medium"])


def serve():
    host.run_uvicorn(app, host="0.0.0.0", port=host.boot("fastapi"),
                     log_level="warning", access_log=False)
