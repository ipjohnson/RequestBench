from rest_framework.decorators import api_view, renderer_classes
from rest_framework.response import Response

from renderers import PlainTextRenderer


# baseline: the dispatch floor, with nothing serialised. The string goes out through DRF's content
# negotiation and PlainTextRenderer.
# rb:handler baseline.plaintext
@api_view(["GET"])
@renderer_classes([PlainTextRenderer])
def plaintext(request):
    return Response("Hello, World!")
