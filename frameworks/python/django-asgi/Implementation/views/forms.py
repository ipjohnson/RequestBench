from django import forms
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from answers import echoed
from views.query import Search

# forms: the same eight values query.many reads, from a urlencoded body, and an upload. Django
# parses both into request.POST and request.FILES, and a Form binds them.
P = settings.PAYLOADS


class Upload(forms.Form):
    """What forms.multipart posts: two fields and a file."""

    tenant = forms.CharField()
    requestId = forms.CharField()
    file = forms.FileField()


# rb:handler forms.urlencoded
@require_POST
async def urlencoded(request):
    search = Search(request.POST)
    if not search.is_valid():
        return JsonResponse(search.errors, status=400)
    return JsonResponse(echoed(P.small, search.cleaned_data))


# rb:handler forms.multipart
@require_POST
async def multipart(request):
    upload = Upload(request.POST, request.FILES)
    if not upload.is_valid():
        return JsonResponse(upload.errors, status=400)
    file = upload.cleaned_data["file"]
    return JsonResponse({"file": {"name": file.name, "bytes": file.size},
                         "echo": {"tenant": upload.cleaned_data["tenant"], "requestId": upload.cleaned_data["requestId"]}})
