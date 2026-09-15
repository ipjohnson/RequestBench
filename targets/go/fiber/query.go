// query: query string parsing and coercion, isolated from any use of the values.
//
// Fiber parses c.Queries(), which is the work this family measures; the domain coerces
// what it parsed, so every target in the language answers the same values.
package main

import (
	"github.com/gofiber/fiber/v3"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func registerQuery(app *fiber.App) {
	app.Get("/query/one", func(c fiber.Ctx) error { return c.JSON(d.CoerceOne(query(c))) })

	app.Get("/query/many", func(c fiber.Ctx) error { return c.JSON(d.CoerceMany(query(c))) })
}
