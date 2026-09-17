// query: query string parsing and coercion, isolated from any use of the values.
//
// Echo's own binder fills the struct: c.Bind reads the `query:` tag, and for a GET that is
// the whole of what it binds. The struct is both what Echo fills and what the handler
// answers, so the response is the bound values and nothing copies one shape into another.
//
// Echo decides what a value it cannot bind is: a missing parameter leaves the field at its
// zero value, and one that will not parse comes back as an *echo.HTTPError carrying 400.
// That never fires on the endpoint set, whose query strings are always complete and
// well-formed, but it is the framework's line and not this file's.
package main

import (
	"github.com/labstack/echo/v4"
)

// rb:wiring query.*
type queryOne struct {
	Page int `query:"page" json:"page"`
}

// rb:wiring query.*
type queryMany struct {
	Page     int    `query:"page"      json:"page"`
	Size     int    `query:"size"      json:"size"`
	Status   string `query:"status"    json:"status"`
	Category string `query:"category"  json:"category"`
	Sort     string `query:"sort"      json:"sort"`
	Q        string `query:"q"         json:"q"`
	MinPrice int    `query:"min_price" json:"min_price"`
	MaxPrice int    `query:"max_price" json:"max_price"`
}

// rb:wiring domain.*
// What domain.filter pages by. Not a response shape, so it carries no json tags.
type orderFilter struct {
	Page   int    `query:"page"`
	Size   int    `query:"size"`
	Status string `query:"status"`
}

// rb:wiring query.*,domain.*
// bindQuery fills out from the query string, answering the failure itself if there is one.
// The same 400 shape as a body Echo could not bind, because it is the same binder refusing.
func bindQuery(c echo.Context, out any) bool {
	if err := c.Bind(out); err != nil {
		_ = c.JSON(400, map[string]string{"error": "invalid_query", "detail": err.Error()})
		return false
	}
	return true
}

func registerQuery(e *echo.Echo) {
	e.GET("/query/one", func(c echo.Context) error {
		var q queryOne
		if !bindQuery(c, &q) {
			return nil
		}
		return c.JSON(200, q)
	})

	e.GET("/query/many", func(c echo.Context) error {
		var q queryMany
		if !bindQuery(c, &q) {
			return nil
		}
		return c.JSON(200, q)
	})
}
