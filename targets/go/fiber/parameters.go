// parameters: router captures with segment depth held constant.
package main

import "github.com/gofiber/fiber/v3"

func registerParameters(app *fiber.App) {
	app.Get("/parameters/static/segment/literal", payload("small"))

	app.Get("/parameters/:one", payload("small"))

	app.Get("/parameters/:one/with-second/:two", payload("small"))
}
