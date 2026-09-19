// etag and cache: Echo middleware around the digest and the store in _shared.
//
// Echo ships neither: nothing in it computes a validator for a dynamic response and
// nothing stores one. So the digest and the store are the shared ones, declared in
// /__meta, and what is Echo's own is the middleware being on these routes and nowhere else.
package main

import (
	"bytes"
	"net/http"
	"strings"

	d "github.com/ianjohnson/requestbench/targets/go/_shared"
	"github.com/labstack/echo/v5"
)

// capture holds the response until the middleware around it has hashed or stored the
// bytes. Echo writes through whatever c.SetResponse installed, so installing this is how a
// middleware gets at them.
type capture struct {
	http.ResponseWriter
	buf    bytes.Buffer
	status int
}

// WriteHeader records rather than passes through. Echo's Response commits on the first
// write, and a committed response cannot have a validator written onto it afterwards.
func (c *capture) WriteHeader(status int) { c.status = status }

func (c *capture) Write(p []byte) (int, error) {
	if c.status == 0 {
		c.status = http.StatusOK
	}
	return c.buf.Write(p)
}

// Unwrap is how echo.UnwrapResponse finds Echo's own Response under this writer, which
// c.SetResponse asks of anything it installs.
func (c *capture) Unwrap() http.ResponseWriter { return c.ResponseWriter }

// rb:wiring etag.*
// revalidates hashes the body the handler wrote and answers the conditional. Shallow,
// which is the point: the handler runs and the body is built before anything is compared,
// so the 304 saves the write and nothing else.
func revalidates(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error {
		original := c.Response()
		buffer := &capture{ResponseWriter: original}
		c.SetResponse(buffer)
		err := next(c)
		c.SetResponse(original)
		if err != nil {
			return err
		}
		body := buffer.buf.Bytes()
		etag := d.ContentETag(body)
		original.Header().Set("etag", etag)
		original.Header().Set("cache-control", d.Cacheable)
		if c.Request().Header.Get("if-none-match") == etag {
			original.Header().Del("content-type")
			original.WriteHeader(http.StatusNotModified)
			return nil
		}
		original.WriteHeader(buffer.status)
		_, err = original.Write(body)
		return err
	}
}

// rb:wiring cache.*
// replays answers from the store when it holds the key, and stores what the handler wrote
// when it does not.
func replays(store *d.Store, on []string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			values := make([]string, len(on))
			for i, name := range on {
				values[i] = c.Request().Header.Get(name)
			}
			key := d.CacheKey(c.Request().URL.Path, values)
			original := c.Response()
			if hit, ok := store.Get(key); ok {
				for name, vs := range hit.Header {
					for _, v := range vs {
						original.Header().Add(name, v)
					}
				}
				original.WriteHeader(hit.Status)
				_, err := original.Write(hit.Body)
				return err
			}
			buffer := &capture{ResponseWriter: original}
			c.SetResponse(buffer)
			err := next(c)
			c.SetResponse(original)
			if err != nil {
				return err
			}
			body := buffer.buf.Bytes()
			if buffer.status == http.StatusOK {
				store.Set(key, d.Stored{Status: 200, Header: original.Header().Clone(), Body: body})
			}
			original.WriteHeader(buffer.status)
			_, err = original.Write(body)
			return err
		}
	}
}

// served is payload() plus the freshness counter both families carry.
func served(size string, extra map[string]string) echo.HandlerFunc {
	body := d.Payload(size)
	return func(c *echo.Context) error {
		for name, value := range extra {
			c.Response().Header().Set(name, value)
		}
		c.Response().Header().Set("x-rb-serial", d.NextSerial())
		return c.JSON(200, body)
	}
}

func registerEtag(e *echo.Echo) {
	// rb:handler etag.*
	for _, size := range []string{"small", "large"} {
		e.GET("/etag/"+size, served(size, nil), revalidates)
	}
}

func registerCache(e *echo.Echo) {
	// One store for the target rather than one per route, so the capacity the fixture
	// derives from the key count means what it says.
	store := d.NewStore()
	// rb:handler cache.small,cache.medium,cache.large
	for _, size := range []string{"small", "medium", "large"} {
		e.GET("/cache/"+size, served(size, nil), replays(store, nil))
	}
	// rb:handler cache.vary_one,cache.vary_many
	for _, which := range []string{"one", "many"} {
		on := d.VaryOn(which)
		e.GET("/cache/vary/"+which,
			served("small", map[string]string{"vary": strings.Join(on, ", ")}),
			replays(store, on))
	}
}
