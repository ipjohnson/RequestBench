from django import forms
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from answers import echoed

# query: the query string bound by a Form, which is Django's binder as well as its validator. Each
# field converts its value, so cleaned_data is already the echo, and a value a field refuses is the
# form's own 400.
P = settings.PAYLOADS


class Page(forms.Form):
    page = forms.IntegerField()


class Search(forms.Form):
    """query.many's eight values, which forms.urlencoded posts as a form."""

    page = forms.IntegerField()
    size = forms.IntegerField()
    status = forms.CharField()
    category = forms.CharField()
    sort = forms.CharField()
    q = forms.CharField()
    minPrice = forms.IntegerField()
    maxPrice = forms.IntegerField()


# rb:handler query.one
@require_GET
async def one(request):
    page = Page(request.GET)
    if not page.is_valid():
        return JsonResponse(page.errors, status=400)
    return JsonResponse(echoed(P.small, page.cleaned_data))


# rb:handler query.many
@require_GET
async def many(request):
    search = Search(request.GET)
    if not search.is_valid():
        return JsonResponse(search.errors, status=400)
    return JsonResponse(echoed(P.small, search.cleaned_data))
