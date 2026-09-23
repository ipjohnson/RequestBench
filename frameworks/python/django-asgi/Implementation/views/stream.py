import json

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.http import StreamingHttpResponse
from django.views.decorators.http import require_GET

# stream: items.medium's rows written one per line, each as it is produced. Under ASGI Django sends
# each chunk an async iterator yields as it comes. Each row is encoded as JsonResponse encodes.
P = settings.PAYLOADS


# rb:handler stream.ndjson
@require_GET
async def lines(request):
    async def rows():
        for row in P.medium["items"]:
            yield json.dumps(row, cls=DjangoJSONEncoder) + "\n"

    return StreamingHttpResponse(rows(), content_type="application/x-ndjson")
