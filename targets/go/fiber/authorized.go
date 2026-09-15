// authorized: the framework's authorization mechanism, crypto excluded.
//
// Route-scoped middleware, not an if in the handler. An if would measure the language;
// the point of the family is the framework's own plumbing.
package main

import (
	"github.com/gofiber/fiber/v3"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func requireToken(c fiber.Ctx) error {
	if !d.TokenOK(c.Get("authorization")) {
		return c.Status(403).JSON(d.ForbiddenBody())
	}
	return c.Next()
}

func registerAuthorized(app *fiber.App) {
	route(app, fiber.MethodGet, "/authorized/small", requireToken, payload("small"))
}
