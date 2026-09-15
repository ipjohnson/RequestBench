// json: the serializer and response buffering across three size regimes.
//
// Three static routes, not /json/:size. The size set is fixed, so a capture would make the
// router pay parameter cost on the family every other target serves from a static route,
// and it would answer 200 with an empty body for a size that does not exist.
package main

import (
	"github.com/gofiber/fiber/v3"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// The response is read once and served from the closure rather than looked up per request:
// the map lookup is not what any of these endpoints is measuring.
func payload(size string) fiber.Handler {
	body := d.Payload(size)
	return func(c fiber.Ctx) error { return c.JSON(body) }
}

func registerJSON(app *fiber.App) {
	app.Get("/json/small", payload("small"))

	app.Get("/json/medium", payload("medium"))

	app.Get("/json/large", payload("large"))
}
