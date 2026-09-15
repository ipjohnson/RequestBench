// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
//
// Fiber runs the handlers on a route in the order given, so the layers go before the
// payload. Each layer calls Next and does nothing else.
package main

import "github.com/gofiber/fiber/v3"

func noop(c fiber.Ctx) error { return c.Next() }

func layers(n int, last fiber.Handler) []fiber.Handler {
	out := make([]fiber.Handler, n, n+1)
	for i := range out {
		out[i] = noop
	}
	return append(out, last)
}

func registerMiddleware(app *fiber.App) {
	app.Get("/middleware/none", payload("small"))

	route(app, fiber.MethodGet, "/middleware/four", layers(4, payload("small"))...)

	route(app, fiber.MethodGet, "/middleware/sixteen", layers(16, payload("small"))...)
}
