from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.gzip import gzip_page
from django.views.decorators.http import require_GET

from serial import fresh

# compressed: gzip_page is GZipMiddleware scoped to one view, so no other route looks at
# Accept-Encoding. It leaves a body under 200 bytes as it is, and compresses at level 6, which
# Django hard-codes and no setting changes.
P = settings.PAYLOADS


# rb:wiring compressed.*
# rb:handler compressed.gzip_small,compressed.identity_small
@require_GET
@gzip_page
async def small(request):
    return fresh(JsonResponse(P.small))


# rb:wiring compressed.*
# rb:handler compressed.gzip_large,compressed.identity_large
@require_GET
@gzip_page
async def large(request):
    return fresh(JsonResponse(P.large))
