// Package implementation is the RequestBench corpus answered by Fiber. Each corpus family's
// routes are registered by a function of its own, in a file named for the family.
package implementation

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/recover"
)

// App builds every route over the payloads, on an app nothing serves yet, so the suite can
// serve it on a port of its own.
func App(p *Payloads) *fiber.App {
	app := fiber.New(fiber.Config{
		StructValidator: newValidator(),
		Views:           newViews(),
	})
	// Fiber recovers from no panic by default, so recover is the one middleware every route runs.
	app.Use(recover.New())

	contractRoutes(app)
	baselineRoutes(app)
	jsonRoutes(app, p)
	middlewareRoutes(app, p)
	parametersRoutes(app, p)
	queryRoutes(app, p)
	headersRoutes(app, p)
	bodyRoutes(app)
	authorizedRoutes(app, p)
	cacheRoutes(app, p)
	compressedRoutes(app, p)
	etagRoutes(app, p)
	templateRoutes(app, p)
	itemsRoutes(app, p)
	corsRoutes(app, p)
	formsRoutes(app, p)
	streamRoutes(app, p)
	sseRoutes(app, p)
	staticRoutes(app, p)
	return app
}
