// headers: the request header map at five and at thirty headers, left unread and with three of
// them bound and echoed.
//
// /headers reads no header at all, so headers.many minus headers.few is the cost of
// materialising 25 nobody asked for.
//
// /headers/bind goes through Echo's own binder. c.Bind never reads a header, so the handler
// asks for the headers alone with echo.BindHeaders, which is how Echo's guide binds from one
// source. The struct is both what Echo fills and what the handler echoes, so nothing copies
// one shape into another.
//
// Each tag is the canonical form net/http keys a header by. Echo looks a tag up as written
// and falls back to a case-insensitive walk of every header, so a lowercase tag would cost a
// walk per field.
package main

import (
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
	"github.com/labstack/echo/v5"
)

// rb:wiring headers.*
type boundHeaders struct {
	Tenant    string `header:"X-Rb-Tenant"     json:"tenant"`
	RequestID string `header:"X-Rb-Request-Id" json:"request_id"`
	Account   int    `header:"X-Rb-Account"    json:"account"`
}

// rb:wiring headers.*
// bindHeaders fills out from the request headers, answering the failure itself if there is
// one, in the shape bindQuery answers a query Echo could not bind.
func bindHeaders(c *echo.Context, out any) bool {
	if err := echo.BindHeaders(c, out); err != nil {
		_ = c.JSON(400, map[string]string{"error": "invalid_header", "detail": err.Error()})
		return false
	}
	return true
}

func registerHeaders(e *echo.Echo) {
	e.GET("/headers", payload("small"))

	e.GET("/headers/bind", func(c *echo.Context) error {
		var h boundHeaders
		if !bindHeaders(c, &h) {
			return nil
		}
		return c.JSON(200, d.WithEcho("small", h))
	})
}
