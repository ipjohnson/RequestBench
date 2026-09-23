from functools import cache

from django import forms
from django.conf import settings
from django.http import Http404, HttpResponse, JsonResponse
from django.urls import reverse
from django.views import View
from django.views.decorators.http import require_POST

from views.body import parsed

# items: every method on one resource over the rows of items.large. A measured row may not leave
# the server changed, so the writes store nothing and answer as if they had written.
P = settings.PAYLOADS
CREATED = P.large["count"] + 1


class NewItem(forms.Form):
    """An item as a client creates or replaces one. A required BooleanField refuses False, so
    inStock is not required."""

    name = forms.CharField()
    category = forms.CharField()
    priceCents = forms.IntegerField()
    inStock = forms.BooleanField(required=False)


class ItemPatch(forms.Form):
    """The two fields items.update changes."""

    priceCents = forms.IntegerField(required=False)
    inStock = forms.BooleanField(required=False)


@cache
def location() -> str:
    """Where the created item would live, reversed from the URLconf's own pattern."""
    return reverse("item", kwargs={"id": CREATED})


# rb:handler items.create
@require_POST
async def create(request):
    item = NewItem(parsed(request))
    if not item.is_valid():
        return JsonResponse(item.errors, status=400)
    return JsonResponse({"id": CREATED, **item.cleaned_data}, status=201, headers={"Location": location()})


class Item(View):
    """The one path the other methods share. Django's router matches the path alone, so the View
    splits it by method: it answers HEAD with get, and a method it has no handler for with 405. A
    missing row is Http404, which Django answers with its own 404."""

    # rb:handler items.read,items.head
    # rb:handler errors.not_found
    async def get(self, request, id: int):
        row = P.row(id)
        if row is None:
            raise Http404
        return JsonResponse(row)

    # rb:handler items.replace
    async def put(self, request, id: int):
        item = NewItem(parsed(request))
        if not item.is_valid():
            return JsonResponse(item.errors, status=400)
        return JsonResponse({"id": id, **item.cleaned_data})

    # rb:handler items.update
    async def patch(self, request, id: int):
        row = P.row(id)
        if row is None:
            raise Http404
        patch = parsed(request)
        form = ItemPatch(patch)
        if not form.is_valid():
            return JsonResponse(form.errors, status=400)
        return JsonResponse(row | {name: value for name, value in form.cleaned_data.items() if name in patch})

    # rb:handler items.delete
    async def delete(self, request, id: int):
        if P.row(id) is None:
            raise Http404
        return HttpResponse(status=204)
