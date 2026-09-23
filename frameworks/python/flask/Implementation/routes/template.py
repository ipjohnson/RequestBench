from flask import Blueprint, render_template

from payloads import Payloads


def blueprint(p: Payloads) -> Blueprint:
    """template: the payload rendered by Flask's render_template, with the Jinja2 environment Flask
    builds and keeps on the application. The loader compiles the template on first use and keeps
    it."""
    routes = Blueprint("template", __name__)

    @routes.get("/template/small")
    def small() -> str:
        return render_template("items.html", **p.small)

    @routes.get("/template/medium")
    def medium() -> str:
        return render_template("items.html", **p.medium)

    return routes
