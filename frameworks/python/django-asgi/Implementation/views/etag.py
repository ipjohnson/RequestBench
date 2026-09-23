from django.conf import settings
from django.http import JsonResponse
# rb:wiring etag.*
from django.middleware.http import ConditionalGetMiddleware
from django.utils.decorators import decorator_from_middleware
from django.views.decorators.http import require_GET

from serial import fresh

P = settings.PAYLOADS

# rb:wiring etag.*
# ConditionalGetMiddleware, scoped to the two views here, as decorator_from_middleware scopes any
# middleware. It hashes the body the view answered with MD5, writes the ETag, and answers an
# If-None-Match that names it with 304. The view has run and built its body by then, so a 304 saves
# the write and nothing else.
conditional = decorator_from_middleware(ConditionalGetMiddleware)


# rb:handler etag.small
@require_GET
@conditional
async def small(request):
    return fresh(JsonResponse(P.small))


# rb:handler etag.large,etag.match_large,etag.stale_large
@require_GET
@conditional
async def large(request):
    return fresh(JsonResponse(P.large))
