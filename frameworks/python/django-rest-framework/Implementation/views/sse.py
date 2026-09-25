from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework.decorators import api_view, renderer_classes
from rest_framework.renderers import JSONRenderer

from renderers import EventStreamRenderer

# sse: items.medium's rows as server-sent events. DRF has no event stream of its own, so the view
# frames each row as one event and streams it, as the stream family streams its lines. The request
# accepts only text/event-stream, which DRF's content negotiation refuses with 406 unless a renderer
# of the view offers it, so the view names EventStreamRenderer.
P = settings.PAYLOADS
JSON = JSONRenderer()


# rb:handler sse.medium
@api_view(["GET"])
@renderer_classes([EventStreamRenderer])
def medium(request):
    return StreamingHttpResponse((b"data: " + JSON.render(row) + b"\n\n" for row in P.medium["items"]), content_type="text/event-stream")
