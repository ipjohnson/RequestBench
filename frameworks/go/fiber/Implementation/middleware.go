package implementation

import (
	"github.com/gofiber/fiber/v3"
)

// middlewareRoutes put no-op layers in front of the handler. Fiber runs a route's handlers in
// the order they are registered, and each reaches the next with c.Next, so the layers come
// first and are on these two routes alone.
func middlewareRoutes(app *fiber.App, p *Payloads) {
	small := func(c fiber.Ctx) error { return c.JSON(&p.Small) }
	four := layered(4, small)
	sixteen := layered(16, small)

	app.Get("/middleware/none", small)

	app.Get("/middleware/four", four[0], four[1:]...)

	app.Get("/middleware/sixteen", sixteen[0], sixteen[1:]...)
}

// rb:wiring middleware.*
// noop is one layer: it calls the next handler and does nothing else.
func noop(c fiber.Ctx) error { return c.Next() }

// layered is the handler behind count no-op layers, in the order a route runs them.
func layered(count int, handler fiber.Handler) []any {
	chain := make([]any, count, count+1)
	for i := range chain {
		chain[i] = noop
	}
	return append(chain, handler)
}

// rb:end
