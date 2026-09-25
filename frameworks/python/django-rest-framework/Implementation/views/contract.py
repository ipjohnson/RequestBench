import platform
from importlib.metadata import version

from rest_framework.decorators import api_view, renderer_classes
from rest_framework.response import Response

from renderers import PlainTextRenderer
from server import ADAPTER, THREADS, WORKERS

META = {
    "framework": "Django REST framework",
    "version": version("djangorestframework"),
    "runtime": f"{platform.python_implementation()} {platform.python_version()}",
    "adapter": ADAPTER,
    "serializer": "DRF's JSONRenderer, over the standard library's json",
    "workers": WORKERS,
    "threads": THREADS,
}


# /health and /__meta, which the contract asks of every framework outside the corpus. The payloads
# are loaded before a worker accepts, so a worker that answers has them.
@api_view(["GET"])
@renderer_classes([PlainTextRenderer])
def health(request):
    return Response("ok")


@api_view(["GET"])
def meta(request):
    return Response(META)
