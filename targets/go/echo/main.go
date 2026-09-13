// RequestBench target: Echo. Framework wiring only; behaviour from _shared.
package main

import (
	"errors"
	"log"
	"net/http"
	"os"
	"runtime"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

type H = map[string]any

func body(c echo.Context) (map[string]any, error) {
	var m map[string]any
	if err := c.Bind(&m); err != nil {
		return nil, &d.ValidationError{Errors: []d.FieldError{{Field: "body", Rule: "json"}}}
	}
	return m, nil
}

// send is the single exit point: handlers return (value, error) and the error handler
// below turns domain errors into the same statuses every other target produces.
func send(c echo.Context, v any, err error, status int) error {
	if err != nil {
		return err
	}
	return c.JSON(status, v)
}

func main() {
	fx := os.Getenv("RB_FIXTURE")
	if fx == "" {
		fx = "../../spec/fixture.json"
	}
	if err := d.Load(fx); err != nil {
		log.Fatalf("fixture: %v", err)
	}
	e := echo.New()
	e.HideBanner, e.HidePort = true, true
	e.Use(middleware.Recover())
	e.HTTPErrorHandler = func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}
		var ve *d.ValidationError
		var he *echo.HTTPError
		switch {
		case errors.Is(err, d.ErrNotFound):
			c.JSON(404, H{"error": "not_found"})
		case errors.As(err, &ve):
			c.JSON(422, H{"error": "validation_failed", "errors": ve.Errors})
		case errors.As(err, &he) && he.Code == 404:
			c.JSON(404, H{"error": "not_found"})
		default:
			c.JSON(500, H{"error": "internal", "message": err.Error()})
		}
	}

	get := func(path string, fn func(echo.Context) (any, error)) {
		e.GET(path, func(c echo.Context) error { v, err := fn(c); return send(c, v, err, 200) })
	}
	q := func(c echo.Context) map[string][]string { return c.QueryParams() }

	e.GET("/plaintext", func(c echo.Context) error { return c.String(200, "Hello, World!") })
	e.GET("/health", func(c echo.Context) error { return c.String(200, "ok") })
	get("/json/small", func(echo.Context) (any, error) { return d.JSONSmall(), nil })
	get("/products", func(c echo.Context) (any, error) { return d.ListProducts(q(c)), nil })
	get("/customers", func(c echo.Context) (any, error) { return d.ListCustomers(q(c)), nil })
	get("/orders", func(c echo.Context) (any, error) { return d.ListOrders(q(c)), nil })
	get("/search", func(c echo.Context) (any, error) { return d.Search(q(c)), nil })
	get("/dashboard", func(echo.Context) (any, error) { return d.Dashboard(), nil })
	e.GET("/__meta", func(c echo.Context) error {
		return c.JSON(200, H{"framework": "echo", "version": echo.Version,
			"runtime": runtime.Version()})
	})
	e.GET("/boom", func(echo.Context) error { panic(d.Boom{}) })
	e.GET("/forbidden", func(c echo.Context) error { return c.JSON(403, H{"error": "forbidden"}) })

	get("/products/:pid", func(c echo.Context) (any, error) { return d.GetProduct(c.Param("pid")) })
	get("/customers/:cid", func(c echo.Context) (any, error) { return d.GetCustomer(c.Param("cid")) })
	get("/orders/:oid", func(c echo.Context) (any, error) { return d.GetOrder(c.Param("oid")) })
	get("/products/:pid/reviews", func(c echo.Context) (any, error) { return d.GetProductReviews(c.Param("pid")) })
	get("/products/:pid/related", func(c echo.Context) (any, error) { return d.RelatedProducts(c.Param("pid")) })
	get("/customers/:cid/orders", func(c echo.Context) (any, error) { return d.GetCustomerOrders(c.Param("cid")) })
	get("/customers/:cid/summary", func(c echo.Context) (any, error) { return d.CustomerSummary(c.Param("cid")) })
	get("/orders/:oid/lines", func(c echo.Context) (any, error) { return d.GetOrderLines(c.Param("oid")) })
	get("/orders/:oid/full", func(c echo.Context) (any, error) { return d.OrderFull(c.Param("oid")) })
	get("/regions/:r/customers", func(c echo.Context) (any, error) { return d.GetRegionCustomers(c.Param("r")) })
	get("/regions/:r/report", func(c echo.Context) (any, error) { return d.RegionReport(c.Param("r")) })
	get("/customers/:cid/orders/:oid", func(c echo.Context) (any, error) {
		return d.GetCustomerOrder(c.Param("cid"), c.Param("oid"))
	})
	get("/orders/:oid/lines/:lid", func(c echo.Context) (any, error) {
		return d.GetOrderLine(c.Param("oid"), c.Param("lid"))
	})
	get("/regions/:r/customers/:cid/orders/:oid/lines/:lid", func(c echo.Context) (any, error) {
		return d.GetOrderLine(c.Param("oid"), c.Param("lid"))
	})

	post := func(path string, fn func(map[string]any) (any, error), status int) {
		e.POST(path, func(c echo.Context) error {
			m, err := body(c)
			if err != nil {
				return err
			}
			v, err := fn(m)
			return send(c, v, err, status)
		})
	}
	post("/orders/validate", func(m map[string]any) (any, error) { return d.ValidateOrder(m) }, 200)
	post("/customers/validate", func(m map[string]any) (any, error) { return d.ValidateCustomer(m) }, 200)
	post("/products/validate", func(m map[string]any) (any, error) { return d.ValidateProduct(m) }, 200)
	post("/echo", func(m map[string]any) (any, error) { return d.Echo(m), nil }, 200)
	post("/orders", func(m map[string]any) (any, error) { return d.ValidateOrder(m) }, 201)

	e.POST("/orders/:oid/lines", func(c echo.Context) error {
		if _, err := d.GetOrder(c.Param("oid")); err != nil {
			return err
		}
		m, err := body(c)
		if err != nil {
			return err
		}
		v, err := d.ValidateLine(m)
		return send(c, v, err, 201)
	})
	e.PUT("/orders/:oid", func(c echo.Context) error {
		o, err := d.GetOrder(c.Param("oid"))
		if err != nil {
			return err
		}
		m, err := body(c)
		if err != nil {
			return err
		}
		v, err := d.ValidateOrder(m)
		if err != nil {
			return err
		}
		return c.JSON(200, d.ValidatedOrderWithID{ID: o.ID, ValidatedOrder: *v})
	})
	e.PATCH("/customers/:cid", func(c echo.Context) error {
		m, err := body(c)
		if err != nil {
			return err
		}
		v, err := d.PatchCustomer(c.Param("cid"), m)
		return send(c, v, err, 200)
	})
	e.DELETE("/orders/:oid/lines/:lid", func(c echo.Context) error {
		if _, err := d.GetOrderLine(c.Param("oid"), c.Param("lid")); err != nil {
			return err
		}
		return c.NoContent(204)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("echo listening on %s", port)
	log.Fatal(http.ListenAndServe(":"+port, e))
}
