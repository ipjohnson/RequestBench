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

//go:embed views/items.tmpl
var itemsTemplate string

func fail(c *gin.Context, err error) {
	if errors.Is(err, d.ErrNotFound) {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	c.JSON(500, gin.H{"error": "internal", "message": err.Error()})
}

func ok(c *gin.Context, v any, err error, status int) {
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(status, v)
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

// validatorsFor sets the cache headers and answers the conditional for one size. The ETag
// is pinned in the fixture, so what this measures is emitting the header and comparing it
// rather than hashing the body; hash cost belongs in Suite B's static-content suite.
//
// The size is closed over rather than read back out of the path, and the comparison
// requires a non-empty header. Matching a missing if-none-match against an empty ETag
// answers 304 to a client that never asked a conditional question.
func validatorsFor(size string) gin.HandlerFunc {
	etag := d.ETagOf(size)
	return func(c *gin.Context) {
		c.Header("etag", etag)
		c.Header("cache-control", d.Cacheable)
		c.Header("x-rb-serial", d.NextSerial())
		if inm := c.GetHeader("if-none-match"); inm != "" && inm == etag {
			c.AbortWithStatus(304)
			return
		}
		c.Next()
	}
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
	// rb:snippet errors.unmatched
	r.NoRoute(func(c *gin.Context) { c.JSON(404, gin.H{"error": "not_found"}) })

	sizes := []string{"small", "medium", "large"}
	// The response is read once and served from the closure rather than looked up per
	// request: the map lookup is not what any of these endpoints is measuring, and every
	// other target reaches its payload the same way.
	payload := func(size string) gin.HandlerFunc {
		body := d.Payload(size)
		return func(c *gin.Context) { c.JSON(200, body) }
	}
	small := payload("small")

	// ---- baseline, json, parameters, query, headers ---------------------------------

	r.GET("/plaintext", func(c *gin.Context) { c.String(200, "Hello, World!") })
	r.GET("/health", func(c *gin.Context) { c.String(200, "ok") })
	r.GET("/__meta", func(c *gin.Context) {
		c.JSON(200, hosts.Meta("gin", gin.Version, "html/template"))
	})

	// Static routes, not /json/:size. The size set is fixed, so a capture would make Gin
	// pay radix parameter cost on the family every other target serves from a static
	// route, and json.small is the denominator most of the set is read against. It would
	// also answer 200 with an empty payload for a size that does not exist.
	// rb:snippet json.small json.medium json.large
	for _, size := range sizes {
		r.GET("/json/"+size, payload(size))
	}

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
	// rb:snippet compressed.identity_small compressed.identity_medium compressed.identity_large
	// rb:snippet compressed.gzip_small compressed.gzip_medium compressed.gzip_large
	comp := r.Group("/compressed", gzip.Gzip(d.GzipLevel))
	for _, size := range sizes {
		body := d.Payload(size)
		comp.GET("/"+size, func(c *gin.Context) {
			c.Header("x-rb-serial", d.NextSerial())
			c.JSON(200, body)
		})
	}
	// rb:snippet-end

	// ---- cached: validator headers and the conditional, scoped the same way ---------

	// rb:snippet cached.small cached.medium cached.large cached.revalidate
	cached := r.Group("/cached")
	for _, size := range sizes {
		cached.GET("/"+size, validatorsFor(size), payload(size))
	}
	// rb:snippet-end

	// ---- template -------------------------------------------------------------------

	// Gin's view facility: the template lives on the engine and c.HTML reaches it by name,
	// so no handler calls a render function. Parsed once, rendered per request.
	r.SetHTMLTemplate(template.Must(template.New("items.tmpl").Parse(itemsTemplate)))

	// rb:snippet template.small template.medium
	for _, size := range []string{"small", "medium"} {
		body := d.Payload(size)
		r.GET("/template/"+size, func(c *gin.Context) { c.HTML(200, "items.tmpl", body) })
	}

	// ---- body: bind, validate, and the two rejection contracts ----------------------

	withBody := func(fn func(*gin.Context, map[string]any)) gin.HandlerFunc {
		return func(c *gin.Context) {
			if m, ok := bindAny(c); ok {
				fn(c, m)
			}
		}
	}
	// validate and the two rejection contracts go through Gin's binder, which parses and
	// validates in one call, so they take the context rather than a parsed map.
	validated := func(fn func(*gin.Context, *orderBody)) gin.HandlerFunc {
		return func(c *gin.Context) {
			if ob, ok := bindOrder(c); ok {
				fn(c, ob)
			}
		}
	}
	// bind parses and binds without validating, so validate minus bind is the validator
	// alone rather than the validator plus the parse.
	// rb:snippet body.bind_small body.bind_medium
	for _, size := range []string{"small", "medium"} {
		r.POST("/body/bind/"+size, withBody(func(c *gin.Context, m map[string]any) {
			c.JSON(200, d.BindEcho(m))
		}))
	}
	r.POST("/body/validate/small", validated(func(c *gin.Context, ob *orderBody) {
		c.JSON(200, ob.order())
	}))
	r.POST("/body/validate/medium", validated(func(c *gin.Context, ob *orderBody) {
		c.JSON(200, ob.order())
	}))
	// go-playground reports every rule that refused, and offers no way to stop at the first.
	// That is the framework's answer to this endpoint, so it is the answer, and the gap
	// between this row and body.rejected_all is what Gin actually costs rather than a walk
	// written twice.
	r.POST("/body/validate/first-error", validated(func(c *gin.Context, ob *orderBody) {
		c.JSON(200, ob.order())
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
	r.POST("/domain/orders", validated(func(c *gin.Context, ob *orderBody) {
		c.Header("location", "/domain/orders/"+strconv.Itoa(d.NextOrderID))
		c.JSON(201, ob.order())
	}))
	r.PUT("/domain/orders/:oid", func(c *gin.Context) {
		o, err := d.GetOrder(c.Param("oid"))
		if err != nil {
			fail(c, err)
			return
		}
		ob, ok := bindOrder(c)
		if !ok {
			return
		}
		c.JSON(200, d.ValidatedOrderWithID{ID: o.ID, ValidatedOrder: *ob.order()})
	})
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
