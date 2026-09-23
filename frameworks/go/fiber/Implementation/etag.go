package implementation

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/etag"
)

// etagRoutes answer like any other. Fiber's etag middleware, on these two routes alone, tags
// the body the handler wrote and answers 304 when If-None-Match names the tag. The body is
// built and hashed before anything is compared, so a 304 saves the write and nothing else.
func etagRoutes(app *fiber.App, p *Payloads) {
	// rb:wiring etag.*
	tagged := etag.New()

	app.Get("/etag/small", tagged, fresh(&p.Small))

	app.Get("/etag/large", tagged, fresh(&p.Large))
}
