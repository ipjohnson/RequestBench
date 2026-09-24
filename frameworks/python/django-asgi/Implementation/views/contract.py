import platform
from importlib.metadata import version

from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET

from server import ADAPTER, WORKERS

META = {
    "framework": "Django",
    "version": version("django"),
    "runtime": f"{platform.python_implementation()} {platform.python_version()}",
    "adapter": ADAPTER,
    "serializer": "json",
    "workers": WORKERS,
}


# /health and /__meta, which the contract asks of every framework outside the corpus. The payloads
# are loaded before a worker accepts, so a worker that answers has them.
@require_GET
async def health(request):
    return HttpResponse("ok", content_type="text/plain; charset=utf-8")


@require_GET
async def meta(request):
    return JsonResponse(META)
