package implementation

import (
	"embed"
	"io/fs"
	"net/http"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/template/html/v3"
)

// rb:wiring template.*

//go:embed views/items.tmpl
var views embed.FS

// newViews is the html/template engine from gofiber/template, over the embedded views/ directory
// with the prefix taken off, so the template is named items. The app loads it once, when it is
// built.
func newViews() fiber.Views {
	root, err := fs.Sub(views, "views")
	if err != nil {
		panic(err)
	}
	return html.NewFileSystem(http.FS(root), ".tmpl")
}

// rb:end

// templateRoutes render the payload through the app's Views, which c.Render reaches.
func templateRoutes(app *fiber.App, p *Payloads) {
	app.Get("/template/small", func(c fiber.Ctx) error { return c.Render("items", &p.Small) })

	app.Get("/template/medium", func(c fiber.Ctx) error { return c.Render("items", &p.Medium) })
}
