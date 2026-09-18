// RequestBench target: Gin. Framework wiring only; behaviour from _shared.
//
// Every feature family uses Gin's own facility rather than an if in the handler, and each
// one is scoped to its own routes through a group. Compression registered on the engine
// would put a "did they ask?" check on all forty-five endpoints and contaminate the
// baseline the compressed rows are measured against, which is the whole reason those rows
// have their own paths instead of riding on /json with an accept-encoding header.
package main

import (
	"bytes"
	_ "embed"
	"errors"
	"html/template"
	"log"
	"os"
	"strconv"
	"strings"

	// rb:wiring compressed.*
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	hosts "github.com/ianjohnson/requestbench/targets/go/_hosts"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:wiring template.*
//go:embed views/items.tmpl
var itemsTemplate string

// rb:wiring errors.*,domain.*
func fail(c *gin.Context, err error) {
	if errors.Is(err, d.ErrNotFound) {
		c.JSON(404, gin.H{"error": "not_found"})
		return
	}
	c.JSON(500, gin.H{"error": "internal", "message": err.Error()})
}

// rb:wiring domain.*
func ok(c *gin.Context, v any, err error, status int) {
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(status, v)
}

// rb:wiring authorized.*
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

// rb:wiring middleware.*
// noop is one middleware layer: it calls the next and does nothing else.
func noop(c *gin.Context) { c.Next() }

// rb:wiring middleware.*
func layers(n int) []gin.HandlerFunc {
	out := make([]gin.HandlerFunc, n)
	for i := range out {
		out[i] = noop
	}
	return out
}

// rb:wiring etag.*
// revalidates hashes the body the handler wrote and answers the conditional. Gin ships no
// ETag and neither does net/http under it, so the digest is the shared one and /__meta says
// so; what is Gin's own is the middleware being on this group's routes and nowhere else.
//
// Shallow, which is the point: the handler runs and the body is written into the buffer
// before anything is compared, so the 304 saves the write and nothing else.
func revalidates() gin.HandlerFunc {
	return func(c *gin.Context) {
		buffer := &bodyCapture{ResponseWriter: c.Writer}
		c.Writer = buffer
		c.Next()
		body := buffer.buf.Bytes()
		etag := d.ContentETag(body)
		header := buffer.ResponseWriter.Header()
		header.Set("etag", etag)
		header.Set("cache-control", d.Cacheable)
		if c.GetHeader("if-none-match") == etag {
			header.Del("content-type")
			buffer.ResponseWriter.WriteHeader(304)
			return
		}
		buffer.ResponseWriter.WriteHeader(buffer.status)
		_, _ = buffer.ResponseWriter.Write(body)
	}
}

// bodyCapture holds the response until the middleware above has hashed it. Gin writes
// through its own ResponseWriter, so swapping it is how a middleware gets at the bytes.
type bodyCapture struct {
	gin.ResponseWriter
	buf    bytes.Buffer
	status int
}

func (b *bodyCapture) WriteHeader(status int) { b.status = status }
func (b *bodyCapture) Write(p []byte) (int, error) {
	if b.status == 0 {
		b.status = 200
	}
	return b.buf.Write(p)
}
func (b *bodyCapture) WriteString(s string) (int, error) { return b.Write([]byte(s)) }

// rb:wiring cache.*
// replays answers from the store before the handler is reached, and stores what the handler
// wrote when it is not there. Gin ships no response cache, so the store is the shared LRU
// sized from the fixture and the wiring is one Gin handler in front of the route.
func replays(store *d.Store, on []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		values := make([]string, len(on))
		for i, name := range on {
			values[i] = c.GetHeader(name)
		}
		key := d.CacheKey(c.Request.URL.Path, values)
		if hit, ok := store.Get(key); ok {
			for name, vs := range hit.Header {
				for _, v := range vs {
					c.Writer.Header().Add(name, v)
				}
			}
			c.Writer.WriteHeader(hit.Status)
			_, _ = c.Writer.Write(hit.Body)
			c.Abort()
			return
		}
		buffer := &bodyCapture{ResponseWriter: c.Writer}
		c.Writer = buffer
		c.Next()
		body := buffer.buf.Bytes()
		header := buffer.ResponseWriter.Header()
		if buffer.status == 200 {
			store.Set(key, d.Stored{Status: 200, Header: header.Clone(), Body: body})
		}
		buffer.ResponseWriter.WriteHeader(buffer.status)
		_, _ = buffer.ResponseWriter.Write(body)
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
	hosts.Serve("gin", router(), nil)
}

// router builds every route, on a router nothing is serving yet. It is its own function
// so a test can hand it requests: built inline in main(), the only way to reach it was
// to start this target on its container port. main() serves what it returns.
func router() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.CustomRecovery(func(c *gin.Context, v any) {
		msg := "internal"
		if e, k := v.(error); k {
			msg = e.Error()
		}
		c.AbortWithStatusJSON(500, gin.H{"error": "internal", "message": msg})
	}))
	// rb:handler errors.unmatched
	r.NoRoute(func(c *gin.Context) { c.JSON(404, gin.H{"error": "not_found"}) })

	sizes := []string{"small", "medium", "large"}
	// The response is read once and served from the closure rather than looked up per
	// request: the map lookup is not what any of these endpoints is measuring, and every
	// other target reaches its payload the same way.
	// rb:wiring json.*,parameters.*,headers.*,middleware.*,authorized.*
	payload := func(size string) gin.HandlerFunc {
		body := d.Payload(size)
		return func(c *gin.Context) { c.JSON(200, body) }
	}
	// rb:wiring parameters.*,headers.*,middleware.*,authorized.*
	small := payload("small")

	// ---- baseline, json, parameters, query, headers ---------------------------------

	r.GET("/plaintext", func(c *gin.Context) { c.String(200, "Hello, World!") })
	r.GET("/health", func(c *gin.Context) { c.String(200, "ok") })
	r.GET("/__meta", func(c *gin.Context) {
		c.JSON(200, hosts.Meta("gin", gin.Version, "html/template",
			"sha1 (gin ships no conditional handling)", "gin middleware over a shared LRU"))
	})

	// rb:handler json.*
	// Static routes, not /json/:size. The size set is fixed, so a capture would make Gin
	// pay radix parameter cost on the family every other target serves from a static
	// route, and json.small is the denominator most of the set is read against. It would
	// also answer 200 with an empty payload for a size that does not exist.
	for _, size := range sizes {
		r.GET("/json/"+size, payload(size))
	}

	r.GET("/parameters/static/segment/literal", small)
	r.GET("/parameters/:one/segment/literal", func(c *gin.Context) {
		var p oneCapture
		if bindCaptures(c, &p) {
			c.JSON(200, d.WithEcho("small", p))
		}
	})
	r.GET("/parameters/:one/with-second/:two", func(c *gin.Context) {
		var p twoCaptures
		if bindCaptures(c, &p) {
			c.JSON(200, d.WithEcho("small", p))
		}
	})

	// Gin binds both arms, so the handler echoes the struct it filled rather than reading
	// the raw map. query.go holds the shapes and the tags it reads them with.
	r.GET("/query/one", func(c *gin.Context) {
		var q queryOne
		if bindQuery(c, &q) {
			c.JSON(200, d.WithEcho("small", q))
		}
	})
	r.GET("/query/many", func(c *gin.Context) {
		var q queryMany
		if bindQuery(c, &q) {
			c.JSON(200, d.WithEcho("small", q))
		}
	})

	// The handler reads no header at all, so headers.many minus headers.few is the cost of
	// materialising 25 nobody asked for.
	r.GET("/headers", small)
	// Gin binds the three the plan sends on every request, so the handler echoes the struct it
	// filled rather than reading the raw map. headers.go holds the shape and its tags.
	r.GET("/headers/bind", func(c *gin.Context) {
		var h boundHeaders
		if bindHeaders(c, &h) {
			c.JSON(200, d.WithEcho("small", h))
		}
	})

	// ---- middleware: real Gin handlers on the route, each calling the next ----------

	r.GET("/middleware/none", small)
	r.GET("/middleware/four", append(layers(4), small)...)
	r.GET("/middleware/sixteen", append(layers(16), small)...)

	// ---- authorized: middleware on the route, not an if in the handler --------------

	r.GET("/authorized/small", requireToken, small)

	// ---- compressed: gin-contrib/gzip on this group only ----------------------------

	// rb:handler compressed.*
	// Level is pinned across every language. The default size threshold is left alone:
	// whether a framework bothers to compress a body too small to benefit is what
	// compressed.gzip_small is in the set to show, so forcing it would erase the answer.
	comp := r.Group("/compressed", gzip.Gzip(d.GzipLevel))
	for _, size := range sizes {
		body := d.Payload(size)
		comp.GET("/"+size, func(c *gin.Context) {
			c.Header("x-rb-serial", d.NextSerial())
			c.JSON(200, body)
		})
	}
	// rb:end

	// ---- etag: the conditional on this group's routes and nowhere else --------------

	// rb:handler etag.*
	conditional := r.Group("/etag", revalidates())
	for _, size := range []string{"small", "large"} {
		body := d.Payload(size)
		conditional.GET("/"+size, func(c *gin.Context) {
			c.Header("x-rb-serial", d.NextSerial())
			c.JSON(200, body)
		})
	}
	// rb:end

	// ---- cache: one store, a handler in front of each route -------------------------

	// rb:wiring cache.*
	// One store for the target rather than one per route, so the capacity the fixture
	// derives from the key count means what it says.
	store := d.NewStore()
	// rb:handler cache.small,cache.medium,cache.large
	for _, size := range sizes {
		body := d.Payload(size)
		r.GET("/cache/"+size, replays(store, nil), func(c *gin.Context) {
			c.Header("x-rb-serial", d.NextSerial())
			c.JSON(200, body)
		})
	}
	// rb:end
	// rb:handler cache.vary_one,cache.vary_many
	for _, which := range []string{"one", "many"} {
		on := d.VaryOn(which)
		body := d.Payload("small")
		r.GET("/cache/vary/"+which, replays(store, on), func(c *gin.Context) {
			c.Header("vary", strings.Join(on, ", "))
			c.Header("x-rb-serial", d.NextSerial())
			c.JSON(200, body)
		})
	}
	// rb:end

	// ---- template -------------------------------------------------------------------

	// rb:wiring template.*
	// Gin's view facility: the template lives on the engine and c.HTML reaches it by name,
	// so no handler calls a render function. Parsed once, rendered per request.
	r.SetHTMLTemplate(template.Must(template.New("items.tmpl").Parse(itemsTemplate)))

	// rb:handler template.*
	for _, size := range []string{"small", "medium"} {
		body := d.Payload(size)
		r.GET("/template/"+size, func(c *gin.Context) { c.HTML(200, "items.tmpl", body) })
	}

	// ---- body: bind, validate, and the two rejection contracts ----------------------

	// rb:wiring body.*,domain.*
	withBody := func(fn func(*gin.Context, map[string]any)) gin.HandlerFunc {
		return func(c *gin.Context) {
			if m, ok := bindAny(c); ok {
				fn(c, m)
			}
		}
	}
	// validate and the two rejection contracts go through Gin's binder, which parses and
	// validates in one call, so they take the context rather than a parsed map.
	// rb:wiring body.*,domain.*
	validated := func(fn func(*gin.Context, *orderBody)) gin.HandlerFunc {
		return func(c *gin.Context) {
			if ob, ok := bindOrder(c); ok {
				fn(c, ob)
			}
		}
	}
	// bind parses and binds without validating, so validate minus bind is the validator
	// alone rather than the validator plus the parse.
	// rb:handler body.bind_small,body.bind_medium
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

	r.GET("/domain/orders", func(c *gin.Context) {
		var f orderFilter
		if bindQuery(c, &f) {
			c.JSON(200, d.DomainFilter(f.Page, f.Size, f.Status))
		}
	})
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
	return r
}
