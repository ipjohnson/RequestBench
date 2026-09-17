// RequestBench target: Fiber v3. Behaviour from _shared.
//
// One file per endpoint family. Go puts every file in a directory into one package, so the
// families sit beside main.go rather than under it; each exports a register function.
//
// Fiber runs on fasthttp rather than net/http, so none of the other Go targets' helpers
// apply and it is the only Go target that never touches http.ResponseWriter. That is also
// why spec/matrix.json excludes it from both function hosts.
package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v3"
	fiberrecover "github.com/gofiber/fiber/v3/middleware/recover"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:wiring errors.*,domain.*
func fail(c fiber.Ctx, err error) error {
	if isNotFound(err) {
		return c.Status(404).JSON(d.NotFoundBody())
	}
	return c.Status(500).JSON(fiber.Map{"error": "internal", "message": err.Error()})
}

// rb:wiring domain.*
func send(c fiber.Ctx, v any, err error, status int) error {
	if err != nil {
		return fail(c, err)
	}
	return c.Status(status).JSON(v)
}

// route registers a chain on one path, in the order given.
//
// Fiber v3's Get takes the first handler as an argument and the rest variadically, and it
// runs them in exactly that order: a handler that does not call Next ends the chain. So a
// layer goes before the handler it wraps, not after it. Written the other way round the
// payload answered first and the middleware never ran, which the response body cannot show
// -- authorized.denied answering 200 is what caught it.
// rb:wiring middleware.*,authorized.*,compressed.*
func route(app *fiber.App, method, path string, chain ...fiber.Handler) {
	rest := make([]any, len(chain)-1)
	for i, h := range chain[1:] {
		rest[i] = h
	}
	app.Add([]string{method}, path, chain[0], rest...)
}

// The request body as a value, or the 422 every target answers when it is not JSON.
func main() {
	fx := os.Getenv("RB_FIXTURE")
	if fx == "" {
		fx = "../../spec/fixture.json"
	}
	if err := d.Load(fx); err != nil {
		log.Fatalf("fixture: %v", err)
	}

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c fiber.Ctx, err error) error { return fail(c, err) },
		// Fiber's validation facility: Bind().Body() runs this after binding, so no handler
		// calls a validator.
		StructValidator: newValidator(),
		// Fiber's view facility: c.Render reaches this engine, so no handler calls a
		// render function.
		Views: newViews(),
	})
	// ErrorHandler only sees returned errors. A panic escapes it and takes the process
	// down, which showed up as a connection reset rather than the 500 the contract asks
	// for.
	app.Use(fiberrecover.New())

	registerBaseline(app)
	registerJSON(app)
	registerParameters(app)
	registerQuery(app)
	registerHeaders(app)
	registerMiddleware(app)
	registerAuthorized(app)
	registerCompressed(app)
	registerEtag(app)
	registerCache(app)
	registerBody(app)
	registerDomain(app)
	registerTemplate(app)

	// errors: registered last. Fiber matches in registration order, so a catch-all mounted
	// earlier would answer every route declared after it.
	//
	// rb:handler errors.unmatched
	app.Use(func(c fiber.Ctx) error { return c.Status(404).JSON(d.NotFoundBody()) })

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("container/fiber listening on %s", port)
	log.Fatal(app.Listen(":"+port, fiber.ListenConfig{DisableStartupMessage: true}))
}
