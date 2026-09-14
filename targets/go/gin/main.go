// RequestBench target: Gin. Framework wiring only; behaviour from _shared.
//
// Every feature family uses Gin's own facility rather than an if in the handler, and each
// one is scoped to its own routes through a group. Compression registered on the engine
// would put a "did they ask?" check on all forty-five endpoints and contaminate the
// baseline the compressed rows are measured against, which is the whole reason those rows
// have their own paths instead of riding on /json with an accept-encoding header.
package main

import (
	_ "embed"
	"errors"
	"html/template"
	"log"
	"os"
	"strconv"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	hosts "github.com/ianjohnson/requestbench/targets/go/_hosts"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// Embedded rather than read from disk: the container image is the built binary on a bare
// alpine, so a template file beside the source would not be there to load.
//
//go:embed views/items.tmpl
var itemsTemplate string

const cacheable = "public, max-age=60"

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

// requireToken is Gin middleware, not a check inside the handler. An if in the handler
// would measure the language; the point of the authorized family is the framework's own
// plumbing.
func requireToken(c *gin.Context) {
	if !d.TokenOK(c.GetHeader("authorization")) {
		c.AbortWithStatusJSON(403, gin.H{"error": "forbidden"})
		return
	}
	c.Next()
}

// noop is one middleware layer: it calls the next and does nothing else.
func noop(c *gin.Context) { c.Next() }

func layers(n int) []gin.HandlerFunc {
	out := make([]gin.HandlerFunc, n)
	for i := range out {
		out[i] = noop
	}
	return out
}

// validators sets the cache headers and answers the conditional. The ETag is pinned in the
// fixture, so what this measures is emitting the header and comparing it rather than
// hashing the body; hash cost belongs in Suite B's static-content suite.
func validators(c *gin.Context) {
	etag := d.ETagOf(c.Param("size"))
	c.Header("etag", etag)
	c.Header("cache-control", cacheable)
	c.Header("x-rb-serial", d.NextSerial())
	if c.GetHeader("if-none-match") == etag {
		c.AbortWithStatus(304)
		return
	}
	c.Next()
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
	r.SetHTMLTemplate(template.Must(template.New("items.tmpl").Parse(itemsTemplate)))

	small := func(c *gin.Context) { c.JSON(200, d.Payload("small")) }

	// ---- baseline, json, parameters, query, headers ---------------------------------

	r.GET("/plaintext", func(c *gin.Context) { c.String(200, "Hello, World!") })
	r.GET("/health", func(c *gin.Context) { c.String(200, "ok") })
	r.GET("/__meta", func(c *gin.Context) {
		m := hosts.Meta("gin", gin.Version)
		m["template"] = "html/template"
		c.JSON(200, m)
	})

	r.GET("/json/:size", func(c *gin.Context) { c.JSON(200, d.Payload(c.Param("size"))) })

	r.GET("/parameters/static/segment/literal", small)
	r.GET("/parameters/:one", small)
	r.GET("/parameters/:one/with-second/:two", small)

	r.GET("/query/one", func(c *gin.Context) { c.JSON(200, d.CoerceOne(c.Request.URL.Query())) })
	r.GET("/query/many", func(c *gin.Context) { c.JSON(200, d.CoerceMany(c.Request.URL.Query())) })

	// The handler reads no header at all, so headers.many minus headers.few is the cost of
	// materialising 27 nobody asked for.
	r.GET("/headers", small)

	// ---- middleware: real Gin handlers on the route, each calling the next ----------

	r.GET("/middleware/none", small)
	r.GET("/middleware/four", append(layers(4), small)...)
	r.GET("/middleware/sixteen", append(layers(16), small)...)

	// ---- authorized: middleware on the route, not an if in the handler --------------

	r.GET("/authorized/small", requireToken, small)

	// ---- compressed: gin-contrib/gzip on this group only ----------------------------

	// Level is pinned across every language. The default size threshold is left alone:
	// whether a framework bothers to compress a body too small to benefit is what
	// compressed.gzip_small is in the set to show, so forcing it would erase the answer.
	comp := r.Group("/compressed", gzip.Gzip(d.GzipLevel))
	comp.GET("/:size", func(c *gin.Context) {
		c.Header("x-rb-serial", d.NextSerial())
		c.JSON(200, d.Payload(c.Param("size")))
	})

	// ---- cached: validator headers and the conditional, scoped the same way ---------

	cached := r.Group("/cached", validators)
	cached.GET("/:size", func(c *gin.Context) { c.JSON(200, d.Payload(c.Param("size"))) })

	// ---- template -------------------------------------------------------------------

	r.GET("/template/:size", func(c *gin.Context) {
		c.HTML(200, "items.tmpl", d.Payload(c.Param("size")))
	})

	// ---- body: bind, validate, and the two rejection contracts ----------------------

	withBody := func(fn func(*gin.Context, map[string]any)) gin.HandlerFunc {
		return func(c *gin.Context) {
			m, err := body(c)
			if err != nil {
				fail(c, err)
				return
			}
			fn(c, m)
		}
	}
	// bind parses and binds without validating, so validate minus bind is the validator
	// alone rather than the validator plus the parse.
	r.POST("/body/bind/:size", withBody(func(c *gin.Context, m map[string]any) {
		c.JSON(200, d.BindEcho(m))
	}))
	r.POST("/body/validate/small", withBody(func(c *gin.Context, m map[string]any) {
		v, err := d.ValidateOrder(m)
		ok(c, v, err, 200)
	}))
	r.POST("/body/validate/medium", withBody(func(c *gin.Context, m map[string]any) {
		v, err := d.ValidateOrder(m)
		ok(c, v, err, 200)
	}))
	r.POST("/body/validate/first-error", withBody(func(c *gin.Context, m map[string]any) {
		v, err := d.ValidateOrderFirst(m)
		ok(c, v, err, 200)
	}))

	// ---- domain ---------------------------------------------------------------------

	r.GET("/domain/orders", func(c *gin.Context) { c.JSON(200, d.DomainFilter(c.Request.URL.Query())) })
	r.GET("/domain/orders/:oid", func(c *gin.Context) {
		v, err := d.GetOrder(c.Param("oid"))
		ok(c, v, err, 200)
	})
	r.GET("/domain/customers/:cid/summary", func(c *gin.Context) {
		v, err := d.DomainJoin(c.Param("cid"))
		ok(c, v, err, 200)
	})
	r.GET("/domain/regions/:region/report", func(c *gin.Context) {
		v, err := d.DomainAggregate(c.Param("region"))
		ok(c, v, err, 200)
	})
	r.POST("/domain/orders", withBody(func(c *gin.Context, m map[string]any) {
		v, err := d.ValidateOrder(m)
		if err != nil {
			fail(c, err)
			return
		}
		c.Header("location", "/domain/orders/"+strconv.Itoa(d.NextOrderID))
		c.JSON(201, v)
	}))
	r.PUT("/domain/orders/:oid", withBody(func(c *gin.Context, m map[string]any) {
		o, err := d.GetOrder(c.Param("oid"))
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
	}))
	r.PATCH("/domain/customers/:cid", withBody(func(c *gin.Context, m map[string]any) {
		v, err := d.PatchCustomer(c.Param("cid"), m)
		ok(c, v, err, 200)
	}))
	r.DELETE("/domain/orders/:oid/lines/:lid", func(c *gin.Context) {
		if _, err := d.GetOrderLine(c.Param("oid"), c.Param("lid")); err != nil {
			fail(c, err)
			return
		}
		c.Status(204)
	})

	hosts.Serve("gin", r, nil)
}
