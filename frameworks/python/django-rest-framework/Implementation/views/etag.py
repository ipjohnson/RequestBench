from django.conf import settings
# rb:wiring etag.*
from django.middleware.http import ConditionalGetMiddleware
from django.utils.decorators import decorator_from_middleware
from rest_framework.decorators import api_view
from rest_framework.response import Response

from serial import fresh

P = settings.PAYLOADS

# rb:wiring etag.*
# DRF computes no validator. ConditionalGetMiddleware, scoped to the two functions here as
# decorator_from_middleware scopes any middleware, hashes the body DRF rendered with MD5, writes the
# ETag, and answers an If-None-Match that names it with 304. The view has run and DRF has rendered
# its body by then, so a 304 saves the write and nothing else.
conditional = decorator_from_middleware(ConditionalGetMiddleware)


# rb:handler etag.small
@api_view(["GET"])
@conditional
def small(request):
    return fresh(Response(P.small))


# rb:handler etag.large,etag.match_large,etag.stale_large
@api_view(["GET"])
@conditional
def large(request):
    return fresh(Response(P.large))
