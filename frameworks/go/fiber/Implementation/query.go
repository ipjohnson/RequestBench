package implementation

import (
	"github.com/gofiber/fiber/v3"
)

type QueryOne struct {
	Page int `query:"page" json:"page"`
}

// Search is query.many's eight values, which forms.urlencoded posts as a form.
type Search struct {
	Page     int    `query:"page" form:"page" json:"page"`
	Size     int    `query:"size" form:"size" json:"size"`
	Status   string `query:"status" form:"status" json:"status"`
	Category string `query:"category" form:"category" json:"category"`
	Sort     string `query:"sort" form:"sort" json:"sort"`
	Q        string `query:"q" form:"q" json:"q"`
	MinPrice int    `query:"minPrice" form:"minPrice" json:"minPrice"`
	MaxPrice int    `query:"maxPrice" form:"maxPrice" json:"maxPrice"`
}

// queryRoutes bind the query string with c.Bind().Query, where a field's query tag names the
// parameter and its type is the conversion.
func queryRoutes(app *fiber.App, p *Payloads) {
	app.Get("/query/one", func(c fiber.Ctx) error {
		var query QueryOne
		if err := c.Bind().Query(&query); err != nil {
			return refuse(c, err)
		}
		return c.JSON(Echoed[QueryOne]{&p.Small, query})
	})

	app.Get("/query/many", func(c fiber.Ctx) error {
		var query Search
		if err := c.Bind().Query(&query); err != nil {
			return refuse(c, err)
		}
		return c.JSON(Echoed[Search]{&p.Small, query})
	})
}
