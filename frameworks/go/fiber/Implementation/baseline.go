package implementation

import (
	"github.com/gofiber/fiber/v3"
)

// baselineRoutes is the dispatch floor, with nothing serialised.
func baselineRoutes(app *fiber.App) {
	app.Get("/plaintext", func(c fiber.Ctx) error { return c.SendString("Hello, World!") })
}
