// query: query string parsing and coercion, isolated from any use of the values.
//
// Fiber's own binder fills the struct: c.Bind().Query reads the `query:` tag through
// gofiber/schema. The struct is both what Fiber fills and what the handler answers, so the
// response is the bound values and nothing copies one shape into another.
//
// SkipValidation, because the StructValidator in the config runs after every bind and these
// two arms have no rules to run: the family measures the parse, and a validator walking
// eight fields with nothing to say would be measured alongside it.
//
// Fiber decides what a value it cannot bind is: a missing parameter leaves the field at its
// zero value, and one that will not parse comes back as a *fiber.BindError. That never
// fires on the endpoint set, whose query strings are always complete and well-formed, but
// it is the framework's line and not this file's.
package main

import (
	"github.com/gofiber/fiber/v3"
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

// What domain.filter pages by. Not a response shape, so it carries no json tags.
// rb:wiring domain.*
type orderFilter struct {
	Page   int    `query:"page"`
	Size   int    `query:"size"`
	Status string `query:"status"`
}

// bindQuery fills out from the query string, answering the failure itself if there is one.
// The same 400 shape as a body Fiber could not bind, because it is the same binder refusing.
// rb:wiring query.*,domain.*
func bindQuery(c fiber.Ctx, out any) bool {
	if err := c.Bind().SkipValidation(true).Query(out); err != nil {
		_ = c.Status(400).JSON(fiber.Map{"error": "invalid_query", "detail": err.Error()})
		return false
	}
	return true
}

func registerQuery(app *fiber.App) {
	app.Get("/query/one", func(c fiber.Ctx) error {
		var q queryOne
		if !bindQuery(c, &q) {
			return nil
		}
		return c.JSON(q)
	})

	app.Get("/query/many", func(c fiber.Ctx) error {
		var q queryMany
		if !bindQuery(c, &q) {
			return nil
		}
		return c.JSON(q)
	})
}
