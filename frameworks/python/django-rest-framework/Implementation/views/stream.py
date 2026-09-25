from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework.decorators import api_view
from rest_framework.renderers import JSONRenderer

# stream: items.medium's rows written one per line, each as it is produced. DRF's Response renders
# the whole body at once, so the view answers with Django's StreamingHttpResponse, which DRF sends on
# as it is, and gunicorn sends the body chunked. Each row is rendered by DRF's JSONRenderer, as the
# json rows are.
P = settings.PAYLOADS
JSON = JSONRenderer()


# rb:handler stream.ndjson
@api_view(["GET"])
def lines(request):
    return StreamingHttpResponse((JSON.render(row) + b"\n" for row in P.medium["items"]), content_type="application/x-ndjson")
