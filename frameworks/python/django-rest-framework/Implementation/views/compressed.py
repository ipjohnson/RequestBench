from django.conf import settings
from django.views.decorators.gzip import gzip_page
from rest_framework.decorators import api_view
from rest_framework.response import Response

from serial import fresh

# compressed: DRF compresses nothing, so Django's gzip_page goes on the function @api_view wraps, as
# DRF's caching guide places cache_page. gzip_page is GZipMiddleware scoped to that function, so no
# other route looks at Accept-Encoding. It leaves a body under 200 bytes as it is, and compresses at
# level 6, which Django hard-codes and no setting changes.
P = settings.PAYLOADS


# rb:wiring compressed.*
# rb:handler compressed.gzip_small,compressed.identity_small
@api_view(["GET"])
@gzip_page
def small(request):
    return fresh(Response(P.small))


# rb:wiring compressed.*
# rb:handler compressed.gzip_large,compressed.identity_large
@api_view(["GET"])
@gzip_page
def large(request):
    return fresh(Response(P.large))
