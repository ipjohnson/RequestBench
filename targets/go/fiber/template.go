// template: server-side rendering of the same model the json family serializes.
//
// Fiber renders through a Views engine on its config, which c.Render invokes. The engine is
// gofiber/template/html, html/template underneath, so the Go targets differ in how they
// reach the engine rather than in which engine they render with.
//
// Embedded rather than read from disk: a container image is the built binary on a bare
// alpine, so a template file beside the source would not be there to load. The embed is
// rooted at views/ and handed over with that prefix stripped, which is what makes the
// template "items" rather than "views/items".
package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/template/html/v3"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:wiring template.*
//go:embed views
var viewsFS embed.FS

// Parsed once by the engine on first render, then rendered per request. A precomputed
// string would measure nothing.
// rb:wiring template.*
func newViews() fiber.Views {
	sub, err := fs.Sub(viewsFS, "views")
	if err != nil {
		log.Fatalf("views: %v", err)
	}
	return html.NewFileSystem(http.FS(sub), ".tmpl")
}

// rb:wiring template.*
func templateRoute(size string) fiber.Handler {
	body := d.Payload(size)
	return func(c fiber.Ctx) error { return c.Render("items", body) }
}

func registerTemplate(app *fiber.App) {
	app.Get("/template/small", templateRoute("small"))

	app.Get("/template/medium", templateRoute("medium"))
}
