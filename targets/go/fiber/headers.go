// headers: the request header map at five and at thirty headers, left unread and with three of
// them bound and echoed.
//
// /headers reads no header at all, so headers.many minus headers.few is the cost of
// materialising 25 nobody asked for.
//
// /headers/bind goes through Fiber's own binder: c.Bind().Header reads the `header:` tag. The
// struct is both what Fiber fills and what the handler echoes, so nothing copies one shape
// into another. The bind skips validation, because the StructValidator in the config runs
// after every bind and this struct has no rules for it.
package main

import (
	"github.com/gofiber/fiber/v3"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:wiring headers.*
type boundHeaders struct {
	Tenant    string `header:"x-rb-tenant"     json:"tenant"`
	RequestID string `header:"x-rb-request-id" json:"request_id"`
	Account   int    `header:"x-rb-account"    json:"account"`
}

// bindHeaders fills out from the request headers, answering the failure itself if there is
// one, in the shape bindQuery answers a query Fiber could not bind.
// rb:wiring headers.*
func bindHeaders(c fiber.Ctx, out any) bool {
	if err := c.Bind().SkipValidation(true).Header(out); err != nil {
		_ = c.Status(400).JSON(fiber.Map{"error": "invalid_header", "detail": err.Error()})
		return false
	}
	return true
}

func registerHeaders(app *fiber.App) {
	app.Get("/headers", payload("small"))

	app.Get("/headers/bind", func(c fiber.Ctx) error {
		var h boundHeaders
		if !bindHeaders(c, &h) {
			return nil
		}
		return c.JSON(d.WithEcho("small", h))
	})
}
