package implementation

import (
	"github.com/gofiber/fiber/v3"
)

// HeadersBound is the three headers /headers/bind binds. Fiber's binder matches a header tag
// to a request header whatever the case of either.
type HeadersBound struct {
	Tenant    string `header:"x-rb-tenant" json:"tenant"`
	RequestID string `header:"x-rb-request-id" json:"requestId"`
	Account   int    `header:"x-rb-account" json:"account"`
}

// headersRoutes: /headers reads no header, and /headers/bind binds three with
// c.Bind().Header, the account as an integer.
func headersRoutes(app *fiber.App, p *Payloads) {
	app.Get("/headers", func(c fiber.Ctx) error { return c.JSON(&p.Small) })

	app.Get("/headers/bind", func(c fiber.Ctx) error {
		var bound HeadersBound
		if err := c.Bind().Header(&bound); err != nil {
			return refuse(c, err)
		}
		return c.JSON(Echoed[HeadersBound]{&p.Small, bound})
	})
}
