// body: the parser and the validator, with size crossed against validation.
//
// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse. Validating is Echo's own: c.Bind fills the
// struct, c.Validate runs the validator registered on the engine.
package main

import (
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
	"github.com/labstack/echo/v4"
)

func registerBody(e *echo.Echo) {
	e.POST("/body/bind/small", func(c echo.Context) error {
		m, ok := bindAny(c)
		if !ok {
			return nil
		}
		return c.JSON(200, d.BindEcho(m))
	})

	e.POST("/body/bind/medium", func(c echo.Context) error {
		m, ok := bindAny(c)
		if !ok {
			return nil
		}
		return c.JSON(200, d.BindEcho(m))
	})

	e.POST("/body/validate/small", validated)

	e.POST("/body/validate/medium", validated)

	// go-playground reports every rule that refused and offers no way to stop at the first,
	// so this row answers what Echo's validator answers. The gap to body.rejected_all is what
	// Echo costs rather than the same walk written twice.
	e.POST("/body/validate/first-error", validated)
}

func validated(c echo.Context) error {
	ob, ok := bindOrder(c)
	if !ok {
		return nil
	}
	return c.JSON(200, ob.order())
}
