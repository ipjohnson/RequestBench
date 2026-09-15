// body: the parser and the validator, with size crossed against validation.
//
// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse.
package main

import (
	"encoding/json"

	"github.com/labstack/echo/v4"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// The request body as a value, or the 422 every target answers when it is not JSON. Echo's
// Bind would answer 400 with its own body; the endpoint set answers 422 there, the same
// status as a body that parsed and failed validation.
func body(c echo.Context) (map[string]any, error) {
	var m map[string]any
	if err := json.NewDecoder(c.Request().Body).Decode(&m); err != nil {
		return nil, d.MalformedBody()
	}
	return m, nil
}

func registerBody(e *echo.Echo) {
	e.POST("/body/bind/small", func(c echo.Context) error {
		m, err := body(c)
		return send(c, d.BindEcho(m), err, 200)
	})

	e.POST("/body/bind/medium", func(c echo.Context) error {
		m, err := body(c)
		return send(c, d.BindEcho(m), err, 200)
	})

	e.POST("/body/validate/small", func(c echo.Context) error {
		m, err := body(c)
		if err != nil {
			return fail(c, err)
		}
		v, err := d.ValidateOrder(m)
		return send(c, v, err, 200)
	})

	e.POST("/body/validate/medium", func(c echo.Context) error {
		m, err := body(c)
		if err != nil {
			return fail(c, err)
		}
		v, err := d.ValidateOrder(m)
		return send(c, v, err, 200)
	})

	e.POST("/body/validate/first-error", func(c echo.Context) error {
		m, err := body(c)
		if err != nil {
			return fail(c, err)
		}
		v, err := d.ValidateOrderFirst(m)
		return send(c, v, err, 200)
	})
}
