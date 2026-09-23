"""The URLconf. Django's router matches the path alone and tries the patterns in the order they are
listed, so the two families most rows are read against come first. The method is the view's to
decide: require_GET and require_POST refuse the others with 405, and so does the items View. The
errors family has no views: its answers are the router's, the views' and Django's own."""
from django.conf import settings
from django.urls import path
from django.views.static import serve

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
    path("items", items.create),
    path("items/<int:id>", items.Item.as_view(), name="item"),
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
    # serve is Django's static file view. Django documents it for development, and WhiteNoise, the
    # usual answer in production, is a synchronous middleware: while one is installed, Django runs
    # every request, on every route, through a thread. serve is synchronous too, and only this route
    # pays for that.
    # rb:handler static.file
    # rb:wiring static.*
    path("static/<path:path>", serve, {"document_root": settings.PAYLOADS.directory}),
    path("health", contract.health),
    path("__meta", contract.meta),
]
