// parameters: router captures with segment depth held constant, each bound as an integer and
// echoed.
//
// Fiber's own binder fills the struct: c.Bind().URI reads the `uri:` tag from the route's
// captures. The struct is both what Fiber fills and what the handler echoes, so nothing copies
// one shape into another. The bind skips validation, because the StructValidator in the config
// runs after every bind and these structs have no rules for it.
//
// Fiber tries routes in the order they were registered. :one matches the literal segment
// static as readily as a number, so the static route is registered first.
package main

import (
	"github.com/gofiber/fiber/v3"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:wiring parameters.*
type oneCapture struct {
	One int `uri:"one" json:"one"`
}

// rb:wiring parameters.*
type twoCaptures struct {
	One int `uri:"one" json:"one"`
	Two int `uri:"two" json:"two"`
}

// bindCaptures fills out from the route's captures, answering the failure itself if there is
// one, in the shape bindQuery answers a query Fiber could not bind.
// rb:wiring parameters.*
func bindCaptures(c fiber.Ctx, out any) bool {
	if err := c.Bind().SkipValidation(true).URI(out); err != nil {
		_ = c.Status(400).JSON(fiber.Map{"error": "invalid_path", "detail": err.Error()})
		return false
	}
	return true
}

func registerParameters(app *fiber.App) {
	app.Get("/parameters/static/segment/literal", payload("small"))

	app.Get("/parameters/:one/segment/literal", func(c fiber.Ctx) error {
		var p oneCapture
		if !bindCaptures(c, &p) {
			return nil
		}
		return c.JSON(d.WithEcho("small", p))
	})

	app.Get("/parameters/:one/with-second/:two", func(c fiber.Ctx) error {
		var p twoCaptures
		if !bindCaptures(c, &p) {
			return nil
		}
		return c.JSON(d.WithEcho("small", p))
	})
}
