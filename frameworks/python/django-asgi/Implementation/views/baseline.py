from django.http import HttpResponse
from django.views.decorators.http import require_GET


# baseline: the dispatch floor, with nothing serialised.
# rb:handler baseline.plaintext
@require_GET
async def plaintext(request):
    return HttpResponse("Hello, World!", content_type="text/plain; charset=utf-8")
