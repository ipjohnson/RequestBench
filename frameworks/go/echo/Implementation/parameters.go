package implementation

import (
	"net/http"

	"github.com/labstack/echo/v5"
)

type ParametersOne struct {
	One int `param:"one" json:"one"`
}

type ParametersTwo struct {
	One int `param:"one" json:"one"`
	Two int `param:"two" json:"two"`
}

// parametersRoutes bind router captures with echo.BindPathValues, which converts each to the
// integer its field declares. Echo's router tries a static segment before a capture, so the
// static route wins its own path.
func parametersRoutes(e *echo.Echo, p *Payloads) {
	e.GET("/parameters/static/segment/literal", func(c *echo.Context) error { return c.JSON(http.StatusOK, &p.Small) })

	e.GET("/parameters/:one/segment/literal", func(c *echo.Context) error {
		var captured ParametersOne
		if err := echo.BindPathValues(c, &captured); err != nil {
			return err
		}
		return c.JSON(http.StatusOK, Echoed[ParametersOne]{&p.Small, captured})
	})

	e.GET("/parameters/:one/with-second/:two", func(c *echo.Context) error {
		var captured ParametersTwo
		if err := echo.BindPathValues(c, &captured); err != nil {
			return err
		}
		return c.JSON(http.StatusOK, Echoed[ParametersTwo]{&p.Small, captured})
	})
}
