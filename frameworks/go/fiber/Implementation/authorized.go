package implementation

import (
	"github.com/gofiber/fiber/v3"
)

// authorizedRoutes put a middleware in front of the handler that refuses any bearer token but
// settings.json's. Fiber's keyauth middleware answers a wrong key with 401, and the corpus asks
// for 403, so the check is a middleware written for the route, returning Fiber's own 403.
func authorizedRoutes(app *fiber.App, p *Payloads) {
	app.Get("/authorized/small", requireToken(p.Settings.Token), func(c fiber.Ctx) error { return c.JSON(&p.Small) })
}

// rb:wiring authorized.*
func requireToken(token string) fiber.Handler {
	expected := "Bearer " + token
	return func(c fiber.Ctx) error {
		if c.Get(fiber.HeaderAuthorization) != expected {
			return fiber.ErrForbidden
		}
		return c.Next()
	}
}
