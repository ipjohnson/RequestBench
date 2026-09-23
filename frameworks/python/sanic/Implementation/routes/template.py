from sanic import Blueprint
# rb:wiring template.*
from sanic_ext import render

from documented import answers
from payloads import Json, Payloads


def blueprint(p: Payloads) -> Blueprint:
    """template: the payload rendered by a Jinja2 template through sanic-ext's templating, which
    compiles the template once and renders it asynchronously."""
    routes = Blueprint("template")

    @routes.get("/template/small")
    @answers(str, "items.small as a page", media="text/html")
    async def small(request):
        return await page(request, p.small)

    @routes.get("/template/medium")
    @answers(str, "items.medium as a page", media="text/html")
    async def medium(request):
        return await page(request, p.medium)

    return routes


# rb:wiring template.*
async def page(request, payload: Json):
    """Sanic has no view layer of its own. sanic-ext renders with Jinja2, the one engine it supports.
    render() adds the request to the context it is given, so each render gets a copy of the
    payload's fields rather than the payload."""
    return await render("items.html", context=dict(payload), app=request.app)
# rb:end
