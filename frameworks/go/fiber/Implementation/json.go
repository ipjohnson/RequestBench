package implementation

import (
	"github.com/gofiber/fiber/v3"
)

// jsonRoutes serialise a payload the framework already holds, at three sizes. c.JSON encodes
// it with the app's JSONEncoder, encoding/json's Marshal by default, and sets it as the body.
func jsonRoutes(app *fiber.App, p *Payloads) {
	app.Get("/json/small", func(c fiber.Ctx) error { return c.JSON(&p.Small) })

	app.Get("/json/medium", func(c fiber.Ctx) error { return c.JSON(&p.Medium) })

	app.Get("/json/large", func(c fiber.Ctx) error { return c.JSON(&p.Large) })
}
