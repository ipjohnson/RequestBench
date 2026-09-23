package implementation

import (
	"github.com/gofiber/fiber/v3"
)

type ParametersOne struct {
	One int `uri:"one" json:"one"`
}

type ParametersTwo struct {
	One int `uri:"one" json:"one"`
	Two int `uri:"two" json:"two"`
}

// parametersRoutes bind router captures with c.Bind().URI, which converts each to the integer
// its field declares. Fiber tries routes in the order they are registered, so the static route
// comes before the capture that would also match its path.
func parametersRoutes(app *fiber.App, p *Payloads) {
	app.Get("/parameters/static/segment/literal", func(c fiber.Ctx) error { return c.JSON(&p.Small) })

	app.Get("/parameters/:one/segment/literal", func(c fiber.Ctx) error {
		var captured ParametersOne
		if err := c.Bind().URI(&captured); err != nil {
			return refuse(c, err)
		}
		return c.JSON(Echoed[ParametersOne]{&p.Small, captured})
	})

	app.Get("/parameters/:one/with-second/:two", func(c fiber.Ctx) error {
		var captured ParametersTwo
		if err := c.Bind().URI(&captured); err != nil {
			return refuse(c, err)
		}
		return c.JSON(Echoed[ParametersTwo]{&p.Small, captured})
	})
}
