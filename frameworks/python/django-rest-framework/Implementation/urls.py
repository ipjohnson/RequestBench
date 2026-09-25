"""The URLconf. Django's router matches the path alone and tries the patterns in the order they are
listed, so the two families most rows are read against come first. The method is DRF's to decide:
each view names the methods it answers, and DRF refuses the others with 405. The items resource is
a ViewSet, whose routes DRF's SimpleRouter writes. The errors family has no views: its answers are
Django's router's, DRF's parser's and the ViewSet's."""
from django.conf import settings
from django.urls import path
from django.views.static import serve
from rest_framework.routers import SimpleRouter

from views import (
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

# /items and /items/<int:pk>, with no trailing slash, as Django path() patterns, and a route for
# each action the ViewSet defines.
# rb:wiring items.*
router = SimpleRouter(trailing_slash=False, use_regex_path=False)
router.register("items", items.Items, basename="item")
# rb:end

urlpatterns = [
    path("plaintext", baseline.plaintext),
    path("json/small", json.small),
    path("json/medium", json.medium),
    path("json/large", json.large),
    path("middleware/none", middleware.none),
    path("middleware/four", middleware.four),
    path("middleware/sixteen", middleware.sixteen),
    path("parameters/static/segment/literal", parameters.static),
    path("parameters/<int:one>/segment/literal", parameters.one),
    path("parameters/<int:one>/with-second/<int:two>", parameters.two),
    path("query/one", query.one),
    path("query/many", query.many),
    path("headers", headers.unread),
    path("headers/bind", headers.bind),
    path("body/bind/small", body.bind_small),
    path("body/bind/medium", body.bind_medium),
    path("body/validate/small", body.validate_small),
    path("body/validate/medium", body.validate_medium),
    path("body/validate/first-error", body.validate_first_error),
    path("authorized/small", authorized.small),
    *router.urls,
    path("cache/small", cache.small),
    path("cache/medium", cache.medium),
    path("cache/large", cache.large),
    path("cache/vary/one", cache.vary_one),
    path("cache/vary/many", cache.vary_many),
    path("etag/small", etag.small),
    path("etag/large", etag.large),
    path("compressed/small", compressed.small),
    path("compressed/large", compressed.large),
    path("cors/small", cors.small),
    path("forms/urlencoded", forms.urlencoded),
    path("forms/multipart", forms.multipart),
    path("stream/items", stream.lines),
    path("sse/medium", sse.medium),
    path("template/small", template.small),
    path("template/medium", template.medium),
    # DRF serves no files. serve is Django's static file view, which Django documents for
    # development. WhiteNoise, the usual answer in production, is a middleware that looks at every
    # request on every route.
    # rb:handler static.file
    # rb:wiring static.*
    path("static/<path:path>", serve, {"document_root": settings.PAYLOADS.directory}),
    path("health", contract.health),
    path("__meta", contract.meta),
]
