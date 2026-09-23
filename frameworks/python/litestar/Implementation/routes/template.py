from pathlib import Path

from litestar import Router, get
# rb:wiring template.*
from litestar.plugins.jinja import JinjaTemplateEngine
from litestar.response import Template
from litestar.template.config import TemplateConfig

from payloads import Payload, Payloads


# rb:wiring template.*
# Jinja2 is the engine litestar[standard] installs. The engine loads the template once and keeps it
# compiled.
CONFIG = TemplateConfig(directory=Path(__file__).parent.parent / "templates", engine=JinjaTemplateEngine)
# rb:end


def router(p: Payloads) -> Router:
    """template: the payload rendered by a Jinja2 template, through the application's TemplateConfig."""

    @get("/template/small")
    async def small() -> Template:
        return page(p.small)

    @get("/template/medium")
    async def medium() -> Template:
        return page(p.medium)

    return Router(path="/", route_handlers=[small, medium])


def page(payload: Payload) -> Template:
    return Template(template_name="items.html", context={"page": payload})
