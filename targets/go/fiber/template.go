// template: server-side rendering of the same model the json family serializes.
//
// The engine is html/template, the same one every other Go target uses, but parsed here
// rather than through _hosts: that package is net/http and importing it would pull an HTTP
// stack Fiber does not use into the binary.
package main

import (
	_ "embed"
	"html/template"
	"strings"

	"github.com/gofiber/fiber/v3"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

//go:embed views/items.tmpl
var itemsTemplate string

var items = template.Must(template.New("items.tmpl").Parse(itemsTemplate))

func templateRoute(size string) fiber.Handler {
	body := d.Payload(size)
	return func(c fiber.Ctx) error {
		var out strings.Builder
		if err := items.Execute(&out, body); err != nil {
			return err
		}
		c.Set("content-type", "text/html; charset=utf-8")
		return c.SendString(out.String())
	}
}

func registerTemplate(app *fiber.App) {
	app.Get("/template/small", templateRoute("small"))

	app.Get("/template/medium", templateRoute("medium"))
}
