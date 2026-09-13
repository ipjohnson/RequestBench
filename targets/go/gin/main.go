// RequestBench target: Gin. Framework wiring only; behaviour from _shared.
package main

import (
	"errors"
	"log"
	"net/http"
	"os"
	"runtime"

	"github.com/gin-gonic/gin"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func fail(c *gin.Context, err error) {
	var ve *d.ValidationError
	switch {
	case errors.Is(err, d.ErrNotFound):
		c.JSON(404, gin.H{"error": "not_found"})
	case errors.As(err, &ve):
		c.JSON(422, gin.H{"error": "validation_failed", "errors": ve.Errors})
	default:
		c.JSON(500, gin.H{"error": "internal", "message": err.Error()})
	}
}
func ok(c *gin.Context, v any, err error, status int) {
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(status, v)
}
func body(c *gin.Context) (map[string]any, error) {
	var m map[string]any
	if err := c.ShouldBindJSON(&m); err != nil {
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
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.CustomRecovery(func(c *gin.Context, v any) {
		msg := "internal"
		if e, k := v.(error); k {
			msg = e.Error()
		}
		c.AbortWithStatusJSON(500, gin.H{"error": "internal", "message": msg})
	}))
	r.NoRoute(func(c *gin.Context) { c.JSON(404, gin.H{"error": "not_found"}) })

	get := func(path string, fn func(*gin.Context) (any, error)) {
		r.GET(path, func(c *gin.Context) { v, err := fn(c); ok(c, v, err, 200) })
	}
	q := func(c *gin.Context) map[string][]string { return c.Request.URL.Query() }

	r.GET("/plaintext", func(c *gin.Context) { c.String(200, "Hello, World!") })
	r.GET("/health", func(c *gin.Context) { c.String(200, "ok") })
	get("/json/small", func(*gin.Context) (any, error) { return d.JSONSmall(), nil })
	get("/products", func(c *gin.Context) (any, error) { return d.ListProducts(q(c)), nil })
	get("/customers", func(c *gin.Context) (any, error) { return d.ListCustomers(q(c)), nil })
	get("/orders", func(c *gin.Context) (any, error) { return d.ListOrders(q(c)), nil })
	get("/search", func(c *gin.Context) (any, error) { return d.Search(q(c)), nil })
	get("/dashboard", func(*gin.Context) (any, error) { return d.Dashboard(), nil })
	r.GET("/__meta", func(c *gin.Context) {
		c.JSON(200, gin.H{"framework": "gin", "version": gin.Version,
			"runtime": runtime.Version()})
	})
	r.GET("/boom", func(*gin.Context) { panic(d.Boom{}) })
	r.GET("/forbidden", func(c *gin.Context) { c.JSON(403, gin.H{"error": "forbidden"}) })

	get("/products/:pid", func(c *gin.Context) (any, error) { return d.GetProduct(c.Param("pid")) })
	get("/customers/:cid", func(c *gin.Context) (any, error) { return d.GetCustomer(c.Param("cid")) })
	get("/orders/:oid", func(c *gin.Context) (any, error) { return d.GetOrder(c.Param("oid")) })
	get("/products/:pid/reviews", func(c *gin.Context) (any, error) { return d.GetProductReviews(c.Param("pid")) })
	get("/products/:pid/related", func(c *gin.Context) (any, error) { return d.RelatedProducts(c.Param("pid")) })
	get("/customers/:cid/orders", func(c *gin.Context) (any, error) { return d.GetCustomerOrders(c.Param("cid")) })
	get("/customers/:cid/summary", func(c *gin.Context) (any, error) { return d.CustomerSummary(c.Param("cid")) })
	get("/orders/:oid/lines", func(c *gin.Context) (any, error) { return d.GetOrderLines(c.Param("oid")) })
	get("/orders/:oid/full", func(c *gin.Context) (any, error) { return d.OrderFull(c.Param("oid")) })
	get("/regions/:r/customers", func(c *gin.Context) (any, error) { return d.GetRegionCustomers(c.Param("r")) })
	get("/regions/:r/report", func(c *gin.Context) (any, error) { return d.RegionReport(c.Param("r")) })
	get("/customers/:cid/orders/:oid", func(c *gin.Context) (any, error) {
		return d.GetCustomerOrder(c.Param("cid"), c.Param("oid"))
	})
	get("/orders/:oid/lines/:lid", func(c *gin.Context) (any, error) {
		return d.GetOrderLine(c.Param("oid"), c.Param("lid"))
	})
	get("/regions/:r/customers/:cid/orders/:oid/lines/:lid", func(c *gin.Context) (any, error) {
		return d.GetOrderLine(c.Param("oid"), c.Param("lid"))
	})

	post := func(path string, fn func(map[string]any) (any, error), status int) {
		r.POST(path, func(c *gin.Context) {
			m, err := body(c)
			if err != nil {
				fail(c, err)
				return
			}
			v, err := fn(m)
			ok(c, v, err, status)
		})
	}
	post("/orders/validate", func(m map[string]any) (any, error) { return d.ValidateOrder(m) }, 200)
	post("/customers/validate", func(m map[string]any) (any, error) { return d.ValidateCustomer(m) }, 200)
	post("/products/validate", func(m map[string]any) (any, error) { return d.ValidateProduct(m) }, 200)
	post("/echo", func(m map[string]any) (any, error) { return d.Echo(m), nil }, 200)
	post("/orders", func(m map[string]any) (any, error) { return d.ValidateOrder(m) }, 201)

	r.POST("/orders/:oid/lines", func(c *gin.Context) {
		if _, err := d.GetOrder(c.Param("oid")); err != nil {
			fail(c, err)
			return
		}
		m, err := body(c)
		if err != nil {
			fail(c, err)
			return
		}
		v, err := d.ValidateLine(m)
		ok(c, v, err, 201)
	})
	r.PUT("/orders/:oid", func(c *gin.Context) {
		o, err := d.GetOrder(c.Param("oid"))
		if err != nil {
			fail(c, err)
			return
		}
		m, err := body(c)
		if err != nil {
			fail(c, err)
			return
		}
		v, err := d.ValidateOrder(m)
		if err != nil {
			fail(c, err)
			return
		}
		c.JSON(200, d.ValidatedOrderWithID{ID: o.ID, ValidatedOrder: *v})
	})
	r.PATCH("/customers/:cid", func(c *gin.Context) {
		m, err := body(c)
		if err != nil {
			fail(c, err)
			return
		}
		v, err := d.PatchCustomer(c.Param("cid"), m)
		ok(c, v, err, 200)
	})
	r.DELETE("/orders/:oid/lines/:lid", func(c *gin.Context) {
		if _, err := d.GetOrderLine(c.Param("oid"), c.Param("lid")); err != nil {
			fail(c, err)
			return
		}
		c.Status(204)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("gin listening on %s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
