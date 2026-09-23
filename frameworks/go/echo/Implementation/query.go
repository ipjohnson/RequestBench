package implementation

import (
	"net/http"

	"github.com/labstack/echo/v5"
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

// queryRoutes bind the query string with echo.BindQueryParams, where a field's query tag names
// the parameter and its type is the conversion.
func queryRoutes(e *echo.Echo, p *Payloads) {
	e.GET("/query/one", func(c *echo.Context) error {
		var query QueryOne
		if err := echo.BindQueryParams(c, &query); err != nil {
			return err
		}
		return c.JSON(http.StatusOK, Echoed[QueryOne]{&p.Small, query})
	})

	e.GET("/query/many", func(c *echo.Context) error {
		var query Search
		if err := echo.BindQueryParams(c, &query); err != nil {
			return err
		}
		return c.JSON(http.StatusOK, Echoed[Search]{&p.Small, query})
	})
}
