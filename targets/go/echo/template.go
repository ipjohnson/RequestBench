// template: server-side rendering of the same model the json family serializes.
//
// Echo renders through a Renderer set on the engine, which c.Render invokes. The handler
// names a template and hands over a model; it never calls a render function, so the family
// measures Echo's own path to the engine.
//
// Embedded rather than read from disk: a container image is the built binary on a bare
// alpine, so a template file beside the source would not be there to load.
package main

import (
	_ "embed"
	"html/template"
	"io"

	d "github.com/ianjohnson/requestbench/targets/go/_shared"
	"github.com/labstack/echo/v4"
)

// rb:wiring template.*
//go:embed views/items.tmpl
var itemsTemplate string

// rb:wiring template.*
// The echo.Renderer implementation the engine holds. Parsed once, rendered per request: a
// precomputed string would measure nothing.
type renderer struct{ templates *template.Template }

func (r *renderer) Render(w io.Writer, name string, data any, _ echo.Context) error {
	return r.templates.ExecuteTemplate(w, name, data)
}

// rb:wiring template.*
func newRenderer() echo.Renderer {
	return &renderer{templates: template.Must(template.New("items.tmpl").Parse(itemsTemplate))}
}

// rb:wiring template.*
func templateRoute(size string) echo.HandlerFunc {
	body := d.Payload(size)
	return func(c echo.Context) error { return c.Render(200, "items.tmpl", body) }
}

func registerTemplate(e *echo.Echo) {
	e.GET("/template/small", templateRoute("small"))

	e.GET("/template/medium", templateRoute("medium"))
}
