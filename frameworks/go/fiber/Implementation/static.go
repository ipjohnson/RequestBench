package implementation

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/static"
)

// staticRoutes serve the payload directory with Fiber's static middleware, on a wildcard route
// as its documentation mounts one. It hands each file to fasthttp's file server.
func staticRoutes(app *fiber.App, p *Payloads) {
	// rb:handler static.file
	app.Get("/static*", static.New(p.Directory))
}
