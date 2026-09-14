// RequestBench target: Fiber v3. Behaviour from _shared.
//
// Fiber runs on fasthttp rather than net/http, so none of the other Go targets' helpers
// apply; this is the only go target that does not speak http.ResponseWriter.
package main

import (
	"errors"
	"log"
	"os"
	"runtime"
	"strconv"

	"github.com/gofiber/fiber/v3"
	fiberrecover "github.com/gofiber/fiber/v3/middleware/recover"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// fasthttp hands query values back one at a time; the domain takes net/http's shape.
func query(c fiber.Ctx) map[string][]string {
	out := map[string][]string{}
	for k, v := range c.Queries() {
		out[k] = []string{v}
	}
	return out
}

func fail(c fiber.Ctx, err error) error {
	var ve *d.ValidationError
	switch {
	case errors.Is(err, d.ErrNotFound):
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	case errors.As(err, &ve):
		return c.Status(422).JSON(fiber.Map{"error": "validation_failed", "errors": ve.Errors})
	default:
		return c.Status(500).JSON(fiber.Map{"error": "internal", "message": err.Error()})
	}
}

func ok(c fiber.Ctx, v any, err error, status int) error {
	if err != nil {
		return fail(c, err)
	}
	return c.Status(status).JSON(v)
}

func body(c fiber.Ctx) (map[string]any, error) {
	var m map[string]any
	if err := c.Bind().Body(&m); err != nil {
		return nil, &d.ValidationError{Errors: []d.FieldError{{Field: "body", Rule: "json"}}}
	}
	return m, nil
}

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
	})
	// ErrorHandler only sees returned errors. A panic escapes it and takes the process
	// down, which showed up as a connection reset on /boom rather than the 500 the
	// contract asks for.
	app.Use(fiberrecover.New())

	get := func(path string, fn func(fiber.Ctx) (any, error)) {
		app.Get(path, func(c fiber.Ctx) error { v, err := fn(c); return ok(c, v, err, 200) })
	}

	app.Get("/plaintext", func(c fiber.Ctx) error { return c.Type("txt").SendString("Hello, World!") })
	app.Get("/health", func(c fiber.Ctx) error { return c.Type("txt").SendString("ok") })
	get("/__meta", func(fiber.Ctx) (any, error) {
		// No adapter line: Fiber is fasthttp, so it runs only under container, and
		// importing the host package would link the function-host libraries into a
		// binary that never calls them.
		return fiber.Map{"framework": "fiber", "version": fiber.Version,
			"runtime": runtime.Version(), "adapter": ""}, nil
	})
	get("/json/small", func(fiber.Ctx) (any, error) { return d.JSONSmall(), nil })
	get("/products", func(c fiber.Ctx) (any, error) { return d.ListProducts(query(c)), nil })
	get("/customers", func(c fiber.Ctx) (any, error) { return d.ListCustomers(query(c)), nil })
	get("/orders", func(c fiber.Ctx) (any, error) { return d.ListOrders(query(c)), nil })
	get("/search", func(c fiber.Ctx) (any, error) { return d.Search(query(c)), nil })
	get("/dashboard", func(fiber.Ctx) (any, error) { return d.Dashboard(), nil })
	app.Get("/boom", func(fiber.Ctx) error { panic(d.Boom{}) })
	app.Get("/forbidden", func(c fiber.Ctx) error {
		return c.Status(403).JSON(fiber.Map{"error": "forbidden"})
	})

	get("/products/:pid", func(c fiber.Ctx) (any, error) { return d.GetProduct(c.Params("pid")) })
	get("/customers/:cid", func(c fiber.Ctx) (any, error) { return d.GetCustomer(c.Params("cid")) })
	get("/orders/:oid", func(c fiber.Ctx) (any, error) { return d.GetOrder(c.Params("oid")) })
	get("/products/:pid/reviews", func(c fiber.Ctx) (any, error) { return d.GetProductReviews(c.Params("pid")) })
	get("/products/:pid/related", func(c fiber.Ctx) (any, error) { return d.RelatedProducts(c.Params("pid")) })
	get("/customers/:cid/orders", func(c fiber.Ctx) (any, error) { return d.GetCustomerOrders(c.Params("cid")) })
	get("/customers/:cid/summary", func(c fiber.Ctx) (any, error) { return d.CustomerSummary(c.Params("cid")) })
	get("/orders/:oid/lines", func(c fiber.Ctx) (any, error) { return d.GetOrderLines(c.Params("oid")) })
	get("/orders/:oid/full", func(c fiber.Ctx) (any, error) { return d.OrderFull(c.Params("oid")) })
	get("/regions/:r/customers", func(c fiber.Ctx) (any, error) { return d.GetRegionCustomers(c.Params("r")) })
	get("/regions/:r/report", func(c fiber.Ctx) (any, error) { return d.RegionReport(c.Params("r")) })
	get("/customers/:cid/orders/:oid", func(c fiber.Ctx) (any, error) {
		return d.GetCustomerOrder(c.Params("cid"), c.Params("oid"))
	})
	get("/orders/:oid/lines/:lid", func(c fiber.Ctx) (any, error) {
		return d.GetOrderLine(c.Params("oid"), c.Params("lid"))
	})
	get("/regions/:r/customers/:cid/orders/:oid/lines/:lid", func(c fiber.Ctx) (any, error) {
		return d.GetOrderLine(c.Params("oid"), c.Params("lid"))
	})

	post := func(path string, fn func(map[string]any) (any, error), status int) {
		app.Post(path, func(c fiber.Ctx) error {
			m, err := body(c)
			if err != nil {
				return fail(c, err)
			}
			v, err := fn(m)
			return ok(c, v, err, status)
		})
	}
	post("/orders/validate", func(m map[string]any) (any, error) { return d.ValidateOrder(m) }, 200)
	post("/customers/validate", func(m map[string]any) (any, error) { return d.ValidateCustomer(m) }, 200)
	post("/products/validate", func(m map[string]any) (any, error) { return d.ValidateProduct(m) }, 200)
	post("/echo", func(m map[string]any) (any, error) { return d.Echo(m), nil }, 200)

	app.Post("/orders", func(c fiber.Ctx) error {
		m, err := body(c)
		if err != nil {
			return fail(c, err)
		}
		v, err := d.ValidateOrder(m)
		if err != nil {
			return fail(c, err)
		}
		c.Set("location", "/orders/"+strconv.Itoa(d.NextOrderID))
		return c.Status(201).JSON(v)
	})
	app.Post("/orders/:oid/lines", func(c fiber.Ctx) error {
		o, err := d.GetOrder(c.Params("oid"))
		if err != nil {
			return fail(c, err)
		}
		m, err := body(c)
		if err != nil {
			return fail(c, err)
		}
		v, err := d.ValidateLine(m)
		c.Set("location", "/orders/"+c.Params("oid")+"/lines/"+strconv.Itoa(len(o.Lines)+1))
		return ok(c, v, err, 201)
	})
	app.Put("/orders/:oid", func(c fiber.Ctx) error {
		o, err := d.GetOrder(c.Params("oid"))
		if err != nil {
			return fail(c, err)
		}
		m, err := body(c)
		if err != nil {
			return fail(c, err)
		}
		v, err := d.ValidateOrder(m)
		if err != nil {
			return fail(c, err)
		}
		return c.Status(200).JSON(d.ValidatedOrderWithID{ID: o.ID, ValidatedOrder: *v})
	})
	app.Patch("/customers/:cid", func(c fiber.Ctx) error {
		m, err := body(c)
		if err != nil {
			return fail(c, err)
		}
		v, err := d.PatchCustomer(c.Params("cid"), m)
		return ok(c, v, err, 200)
	})
	app.Delete("/orders/:oid/lines/:lid", func(c fiber.Ctx) error {
		if _, err := d.GetOrderLine(c.Params("oid"), c.Params("lid")); err != nil {
			return fail(c, err)
		}
		return c.SendStatus(204)
	})

	app.Use(func(c fiber.Ctx) error {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("fiber listening on %s", port)
	log.Fatal(app.Listen(":" + port))
}
