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

type ParametersThree struct {
	One   int `uri:"one" json:"one"`
	Two   int `uri:"two" json:"two"`
	Three int `uri:"three" json:"three"`
}

// parametersRoutes bind router captures with c.Bind().URI, which converts each to the integer
// its field declares. Fiber tries routes in the order they are registered, so each route comes
// before any capture that would also match its path. Three captures match the paths of the
// routes above them, so they come last.
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

	app.Get("/parameters/:one/:two/:three", func(c fiber.Ctx) error {
		var captured ParametersThree
		if err := c.Bind().URI(&captured); err != nil {
			return refuse(c, err)
		}
		return c.JSON(Echoed[ParametersThree]{&p.Small, captured})
	})
}
