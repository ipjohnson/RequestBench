// body: the parser and the validator, with size crossed against validation.
//
// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse. Validating is Fiber's own: the StructValidator
// in its config runs as part of Bind().Body().
package main

import (
	"github.com/gofiber/fiber/v3"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:wiring body.*
func bind(c fiber.Ctx) error {
	m, ok := bindAny(c)
	if !ok {
		return nil
	}
	return c.Status(200).JSON(d.BindEcho(m))
}

// rb:wiring body.*
func validated(c fiber.Ctx) error {
	ob, ok := bindOrder(c)
	if !ok {
		return nil
	}
	return c.Status(200).JSON(ob.order())
}

func registerBody(app *fiber.App) {
	app.Post("/body/bind/small", bind)

	app.Post("/body/bind/medium", bind)

	app.Post("/body/validate/small", validated)

	app.Post("/body/validate/medium", validated)

	// go-playground reports every rule that refused and offers no way to stop at the first,
	// so this row answers what Fiber's validator answers. The gap to body.rejected_all is
	// what Fiber costs rather than the same walk written twice.
	app.Post("/body/validate/first-error", validated)
}
