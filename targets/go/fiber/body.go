// body: the parser and the validator, with size crossed against validation.
//
// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse.
package main

import (
	"github.com/gofiber/fiber/v3"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func bind(c fiber.Ctx) error {
	m, err := body(c)
	return send(c, d.BindEcho(m), err, 200)
}

func validateAll(c fiber.Ctx) error {
	m, err := body(c)
	if err != nil {
		return fail(c, err)
	}
	v, err := d.ValidateOrder(m)
	return send(c, v, err, 200)
}

func validateFirst(c fiber.Ctx) error {
	m, err := body(c)
	if err != nil {
		return fail(c, err)
	}
	v, err := d.ValidateOrderFirst(m)
	return send(c, v, err, 200)
}

func registerBody(app *fiber.App) {
	app.Post("/body/bind/small", bind)

	app.Post("/body/bind/medium", bind)

	app.Post("/body/validate/small", validateAll)

	app.Post("/body/validate/medium", validateAll)

	app.Post("/body/validate/first-error", validateFirst)
}
