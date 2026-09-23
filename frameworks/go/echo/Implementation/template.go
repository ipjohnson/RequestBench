package implementation

import (
	"embed"
	"html/template"
	"net/http"

	"github.com/labstack/echo/v5"
)

// rb:wiring template.*

//go:embed views/items.tmpl
var views embed.FS

// templateRoutes render the payload through the Renderer on the instance, which c.Render calls.
// It is echo.TemplateRenderer, the default renderer Echo's templates guide sets, over
// html/template. The template is compiled into the binary and parsed once, here.
func templateRoutes(e *echo.Echo, p *Payloads) {
	// rb:wiring template.*
	e.Renderer = &echo.TemplateRenderer{Template: template.Must(template.ParseFS(views, "views/items.tmpl"))}

	e.GET("/template/small", func(c *echo.Context) error { return c.Render(http.StatusOK, "items.tmpl", &p.Small) })

	e.GET("/template/medium", func(c *echo.Context) error { return c.Render(http.StatusOK, "items.tmpl", &p.Medium) })
}
